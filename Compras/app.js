/*
  COMPRAS · SOLO LECTURA
  ----------------------
  Mismo patrón que Stock:
  - URL separada en config.js
  - JSONP para lectura desde Google Apps Script
  - caché local inmediata + actualización posterior
  - sin operaciones de escritura sobre el origen
*/
const COMPRAS_API_URL = String((window.COMPRAS_CONFIG && window.COMPRAS_CONFIG.apiUrl) || '').trim();
const CACHE_KEY = 'babyconejitos_compras_cache_v1';
const CACHE_VERSION = 1;
const JSONP_TIMEOUT_MS = 15000;

const state = {
  screen: 'screen-home',
  purchases: [],
  detail: null,
  source: 'loading',
  updatedAt: ''
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const FILTER_IDS = {
  purchase: '#consultPurchaseCode',
  code: '#consultProductCode',
  date: '#consultDate',
  brand: '#consultBrand',
  category: '#consultCategory',
  type: '#consultType',
  color: '#consultColor',
  entry: '#consultEntry',
  size: '#consultSize'
};

const SELECT_FILTERS = ['brand','category','type','color','entry','size'];
const EMPTY_LABELS = {
  brand: 'Todas las marcas',
  category: 'Todas las categorías',
  type: 'Todos los tipos',
  color: 'Todos los colores',
  entry: 'Nuevo o reposición',
  size: 'Todas las tallas'
};

function show(id){
  $$('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if(el) el.classList.add('active');
  state.screen = id;
  $('#btnBack').style.visibility = id === 'screen-home' ? 'hidden' : 'visible';
  window.scrollTo({top:0,behavior:'smooth'});
}

function toast(msg){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function money(v){
  return `S/ ${Number(v || 0).toLocaleString('es-PE',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function formatDateEs(v){
  if(!v) return '—';
  const [y,m,d] = String(v).slice(0,10).split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : v;
}

function sizesText(sizes){
  if(!sizes || !sizes.length) return '—';
  return sizes.map(s => Number(s.qty) > 1 ? `${s.size} (${s.qty})` : String(s.size)).join(', ');
}

function escapeHtml(v){
  return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function normalizeText(v){
  return String(v ?? '').trim();
}

function normalizePurchase(raw){
  const get = (...keys) => {
    for(const k of keys){ if(raw && raw[k] !== undefined && raw[k] !== null) return raw[k]; }
    return '';
  };

  let sizes = get('sizes','tallas');
  if(!Array.isArray(sizes)){
    sizes = [];
    for(let s=17;s<=32;s++){
      const q = Number(get(String(s), s));
      if(q > 0) sizes.push({size:String(s),qty:q});
    }
  } else {
    sizes = sizes.map(x => ({size:String(x.size ?? x.talla ?? ''), qty:Number(x.qty ?? x.cantidad ?? 0)})).filter(x => x.size && x.qty > 0);
  }

  const pairs = Number(get('pairs','Pares','pares')) || sizes.reduce((a,x)=>a+x.qty,0);
  const cost = Number(get('cost','Costo','costo')) || 0;
  let date = normalizeText(get('date','Fecha C','fecha','fechaCompra'));
  if(/^\d{4}-\d{2}-\d{2}/.test(date)) date = date.slice(0,10);

  return {
    purchase: normalizeText(get('purchase','ID Compra','idCompra','id_compra')),
    month: normalizeText(get('month','Mes','mes')),
    date,
    pairs,
    code: normalizeText(get('code','Codigo','Código','codigo')),
    brand: normalizeText(get('brand','Marca','marca')),
    category: normalizeText(get('category','Categoria','Categoría','categoria')),
    type: normalizeText(get('type','Tipo','tipo')),
    color: normalizeText(get('color','Color')),
    entry: normalizeText(get('entry','Ingreso','ingreso')),
    sizes,
    cost,
    partner: normalizeText(get('partner','Socio','socio'))
  };
}

function payloadToRows(payload){
  const body = payload && (payload.purchases || payload.compras || payload.data);
  if(!Array.isArray(body)) return [];
  if(!body.length) return [];
  if(Array.isArray(body[0])){
    const headers = body[0].map(String);
    return body.slice(1).map(row => Object.fromEntries(headers.map((h,i)=>[h,row[i]])));
  }
  return body;
}

function readCache(){
  try{
    const cache = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if(!cache || cache.version !== CACHE_VERSION || !Array.isArray(cache.purchases)) return null;
    return cache;
  }catch(_){ return null; }
}

function writeCache(purchases, updatedAt){
  try{
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
      savedAt: new Date().toISOString(),
      actualizado: updatedAt || '',
      purchases
    }));
  }catch(_){ }
}

function loadJsonp(url){
  return new Promise((resolve,reject) => {
    const callbackName = `__comprasCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement('script');
    const sep = url.includes('?') ? '&' : '?';
    let finished = false;

    const cleanup = () => {
      if(script.parentNode) script.parentNode.removeChild(script);
      try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
    };

    const timer = setTimeout(() => {
      if(finished) return;
      finished = true; cleanup(); reject(new Error('Tiempo de espera agotado.'));
    }, JSONP_TIMEOUT_MS);

    window[callbackName] = (payload) => {
      if(finished) return;
      finished = true; clearTimeout(timer); cleanup(); resolve(payload);
    };

    script.onerror = () => {
      if(finished) return;
      finished = true; clearTimeout(timer); cleanup(); reject(new Error('No se pudo cargar el endpoint.'));
    };

    script.src = `${url}${sep}callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function loadPurchases(){
  const cache = readCache();
  const cached = cache ? cache.purchases.map(normalizePurchase) : [];

  // Igual que Stock: si existe caché, se muestra inmediatamente.
  // No existe una copia fija de datos dentro del proyecto.
  if(cached.length){
    state.purchases = cached;
    state.source = 'cache';
    state.updatedAt = cache.actualizado || cache.savedAt || '';
    afterDataLoaded();
  }else{
    state.purchases = [];
    state.source = 'loading';
    state.updatedAt = '';
    afterDataLoaded();
  }

  if(!COMPRAS_API_URL){
    state.source = cached.length ? 'cache-no-api' : 'no-api';
    updateConnectionPill();
    return;
  }

  try{
    const payload = await loadJsonp(COMPRAS_API_URL);
    if(!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'Respuesta inválida del endpoint.');
    const fresh = payloadToRows(payload).map(normalizePurchase).filter(x => x.purchase && x.code);
    if(!fresh.length) throw new Error('El endpoint no devolvió compras válidas.');

    state.purchases = fresh;
    state.source = 'api';
    state.updatedAt = payload.actualizado || payload.generatedAt || new Date().toISOString();
    writeCache(fresh,state.updatedAt);
    afterDataLoaded();
  }catch(err){
    state.source = cached.length ? 'cache-error' : 'api-error';
    updateConnectionPill();
    console.warn('No se pudo actualizar Compras:', err);
  }
}

function afterDataLoaded(){
  state.purchases = state.purchases
    .filter(x => x.purchase && x.code)
    .sort((a,b) => b.date.localeCompare(a.date) || b.purchase.localeCompare(a.purchase));
  populateFacets();
  updateConnectionPill();
  renderHomeSummary();
  renderPurchases(state.purchases);
}

function updateConnectionPill(){
  const pill = $('#connectionPill');
  const labels = {
    api: `Solo lectura · conectado`,
    cache: `Solo lectura · caché`,
    'cache-error': `Solo lectura · caché · sin conexión`,
    'cache-no-api': `Solo lectura · caché · endpoint no configurado`,
    loading: `Solo lectura · conectando…`,
    'no-api': `Solo lectura · endpoint no configurado`,
    'api-error': `Solo lectura · sin conexión`
  };
  pill.textContent = labels[state.source] || 'Solo lectura';
}

function renderHomeSummary(){
  const rows = state.purchases;
  if(!rows.length){ $('#homeDatasetSummary').textContent = 'No hay datos de compras cargados.'; return; }
  const dates = rows.map(x=>x.date).filter(Boolean).sort();
  const pairs = rows.reduce((a,x)=>a+x.pairs,0);
  const cost = rows.reduce((a,x)=>a+x.cost,0);
  $('#homeDatasetSummary').textContent = `${rows.length} compras · ${pairs} pares · ${money(cost)} · ${formatDateEs(dates[0])} a ${formatDateEs(dates.at(-1))}`;
}

function getFilters(){
  const f = {};
  for(const [key,selector] of Object.entries(FILTER_IDS)) f[key] = normalizeText($(selector).value);
  f.purchase = f.purchase.toUpperCase();
  f.code = f.code.toUpperCase();
  return f;
}

function recordMatches(x, f, ignoreKey=''){
  if(ignoreKey !== 'purchase' && f.purchase && !x.purchase.toUpperCase().includes(f.purchase)) return false;
  if(ignoreKey !== 'code' && f.code && !x.code.toUpperCase().includes(f.code)) return false;
  if(ignoreKey !== 'date' && f.date && x.date !== f.date) return false;
  if(ignoreKey !== 'brand' && f.brand && x.brand !== f.brand) return false;
  if(ignoreKey !== 'category' && f.category && x.category !== f.category) return false;
  if(ignoreKey !== 'type' && f.type && x.type !== f.type) return false;
  if(ignoreKey !== 'color' && f.color && x.color !== f.color) return false;
  if(ignoreKey !== 'entry' && f.entry && x.entry !== f.entry) return false;
  if(ignoreKey !== 'size' && f.size && !x.sizes.some(s => String(s.size) === String(f.size))) return false;
  return true;
}

function valueForFacet(x,key){
  if(key === 'size') return x.sizes.map(s=>String(s.size));
  return [x[key]];
}

function setSelectOptions(key, values, selected){
  const el = $(FILTER_IDS[key]);
  const unique = [...new Set(values.filter(Boolean))].sort((a,b) => {
    if(key === 'size') return Number(a)-Number(b);
    return String(a).localeCompare(String(b),'es',{sensitivity:'base'});
  });
  el.innerHTML = `<option value="">${EMPTY_LABELS[key]}</option>` + unique.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  if(selected && unique.includes(selected)) el.value = selected;
  else el.value = '';
}

function populateFacets(){
  const blank = {purchase:'',code:'',date:'',brand:'',category:'',type:'',color:'',entry:'',size:''};
  for(const key of SELECT_FILTERS){
    const values = state.purchases.flatMap(x=>valueForFacet(x,key));
    setSelectOptions(key,values,blank[key]);
  }
  updateCompatibleHint();
}

function refreshFacets(){
  // Dos pasadas permiten que, al invalidarse una selección, los demás desplegables
  // se recalculen inmediatamente con la nueva combinación válida.
  for(let pass=0;pass<2;pass++){
    const f = getFilters();
    for(const key of SELECT_FILTERS){
      const selected = $(FILTER_IDS[key]).value;
      const compatible = state.purchases.filter(x => recordMatches(x,f,key));
      const values = compatible.flatMap(x => valueForFacet(x,key));
      setSelectOptions(key,values,selected);
    }
  }
  updateCompatibleHint();
}

function updateCompatibleHint(){
  const f = getFilters();
  const compatible = state.purchases.filter(x=>recordMatches(x,f));
  const pairs = compatible.reduce((a,x)=>a+x.pairs,0);
  $('#compatibleHint').textContent = `${compatible.length} compras compatibles con los filtros actuales · ${pairs} pares`;
}

function filteredPurchases(){
  const f = getFilters();
  return state.purchases.filter(x => recordMatches(x,f));
}

function renderPurchases(rows){
  const sorted = rows.slice().sort((a,b)=>b.date.localeCompare(a.date) || b.purchase.localeCompare(a.purchase));
  const list = $('#purchaseList');
  list.innerHTML = '';
  $('#consultEmpty').classList.toggle('hidden', sorted.length > 0);
  $('#consultCount').textContent = `${sorted.length} ${sorted.length === 1 ? 'registro' : 'registros'}`;
  $('#metricPurchases').textContent = sorted.length.toLocaleString('es-PE');
  $('#metricPairs').textContent = sorted.reduce((a,x)=>a+x.pairs,0).toLocaleString('es-PE');
  $('#metricCost').textContent = money(sorted.reduce((a,x)=>a+x.cost,0));

  sorted.forEach(x => {
    const unit = x.pairs ? x.cost / x.pairs : 0;
    const el = document.createElement('article');
    el.className = 'purchase-row';
    el.innerHTML = `
      <div class="purchase-thumb read-thumb" aria-hidden="true">👟</div>
      <div class="purchase-main">
        <div class="purchase-top">
          <strong>${escapeHtml(x.purchase)}</strong>
          <span class="purchase-date">📅 ${formatDateEs(x.date)}</span>
          <span class="purchase-brand">${escapeHtml(x.brand)}</span>
          <span class="purchase-entry">${escapeHtml(x.entry)}</span>
        </div>
        <div class="purchase-code-line"><h3>${escapeHtml(x.code)}</h3><span class="purchase-category">${escapeHtml(x.category)} · ${escapeHtml(x.type)} · ${escapeHtml(x.color)}</span></div>
        <p>${x.pairs} ${x.pairs === 1 ? 'par' : 'pares'} · Tallas ${escapeHtml(sizesText(x.sizes))}</p>
        <p><strong>Costo ${money(x.cost)}</strong> · ${money(unit)} por par</p>
      </div>
      <button class="secondary-btn purchase-view">Ver detalle →</button>`;
    el.querySelector('.purchase-view').onclick = () => openPurchaseDetail(x);
    list.appendChild(el);
  });
}

function runSearch(){
  const rows = filteredPurchases();
  renderPurchases(rows);
  updateCompatibleHint();
  if(!rows.length) toast('No encontramos compras con esos filtros.');
}

function resetFilters(){
  for(const selector of Object.values(FILTER_IDS)) $(selector).value = '';
  populateFacets();
  renderPurchases(state.purchases);
}

function openPurchaseDetail(x){
  state.detail = x;
  $('#detailSubtitle').textContent = `${x.purchase} · ${formatDateEs(x.date)}`;
  $('#detailProductCode').textContent = x.code;
  $('#detailProductInfo').textContent = `${x.category} · ${x.type} · ${x.color}`;
  $('#detailBrand').textContent = x.brand || '—';
  $('#detailSizes').textContent = sizesText(x.sizes);
  $('#detailPairs').textContent = x.pairs;
  $('#detailMoney').textContent = money(x.cost);
  $('#detailPurchase').textContent = x.purchase;
  $('#detailDate').textContent = formatDateEs(x.date);
  $('#detailEntry').textContent = x.entry || '—';
  $('#detailUnitCost').textContent = x.pairs ? money(x.cost/x.pairs) : '—';
  $('#detailCategory').textContent = x.category || '—';
  $('#detailType').textContent = x.type || '—';
  $('#detailColor').textContent = x.color || '—';
  $('#detailMonth').textContent = x.month || '—';
  show('screen-purchase-detail');
}

function filterSameProduct(){
  const x = state.detail;
  if(!x) return;
  resetFilters();
  $('#consultProductCode').value = x.code;
  refreshFacets();
  renderPurchases(filteredPurchases());
  show('screen-consult');
}

// Navegación
$('#btnBack').onclick = () => {
  if(state.screen === 'screen-purchase-detail') show('screen-consult');
  else if(state.screen === 'screen-consult') show('screen-home');
};
$('#btnOpenConsult').onclick = () => { renderPurchases(filteredPurchases()); show('screen-consult'); };
$('#btnExitConsult').onclick = () => show('screen-home');
$('#btnBackResults').onclick = () => show('screen-consult');
$('#btnSameProduct').onclick = filterSameProduct;

// Filtros interconectados
for(const key of SELECT_FILTERS){
  $(FILTER_IDS[key]).addEventListener('change', refreshFacets);
}
$('#consultDate').addEventListener('change', refreshFacets);
$('#consultPurchaseCode').addEventListener('input', refreshFacets);
$('#consultProductCode').addEventListener('input', refreshFacets);
$('#btnRunConsult').onclick = runSearch;
$('#btnClearConsult').onclick = resetFilters;
['#consultPurchaseCode','#consultProductCode'].forEach(selector => {
  $(selector).addEventListener('keydown', e => { if(e.key === 'Enter') runSearch(); });
});

$('#btnBack').style.visibility = 'hidden';
loadPurchases();
