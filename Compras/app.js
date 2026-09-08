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
const STOCK_API_URL = String((window.COMPRAS_CONFIG && window.COMPRAS_CONFIG.stockApiUrl) || '').trim();
const CACHE_KEY = 'babyconejitos_compras_cache_v1';
const CACHE_VERSION = 1;
const CATALOG_CACHE_KEY = 'babyconejitos_compras_catalog_cache_v1';
const CATALOG_CACHE_VERSION = 1;
const STOCK_SHARED_CACHE_KEY = 'babyconejitos_stock_cache_v1';
const JSONP_TIMEOUT_MS = 15000;

const state = {
  screen: 'screen-home',
  purchases: [],
  catalog: [],
  visiblePurchases: [],
  detail: null,
  source: 'loading',
  catalogSource: 'loading',
  updatedAt: '',
  catalogUpdatedAt: ''
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

const CATALOG_FILTERS = ['brand','category','type','color','size'];
const SELECT_FILTERS = [...CATALOG_FILTERS,'entry'];
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

function canonicalValue(v){
  return normalizeText(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]/g,'');
}

function sameValue(a,b){
  return canonicalValue(a) === canonicalValue(b);
}


function normalizeImageUrl(url){
  const value = normalizeText(url);
  if(!value) return '';

  let match = value.match(/drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&]+)/i);
  if(match) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;

  match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if(match) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;

  match = value.match(/drive\.google\.com\/open\?(?:[^#]*&)?id=([^&]+)/i);
  if(match) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;

  return value;
}

function normalizeCatalogProduct(raw){
  const sourceSizes = (raw && (raw.sizes || raw.tallas)) || {};
  const sizes = {};
  Object.entries(sourceSizes).forEach(([s,q]) => {
    const n = Number(String(q ?? 0).replace(',','.'));
    sizes[String(Number(s))] = Number.isFinite(n) ? n : 0;
  });

  return {
    code: normalizeText(raw && (raw.code ?? raw.codigo)).toUpperCase(),
    brand: normalizeText(raw && (raw.brand ?? raw.marca)),
    category: normalizeText(raw && (raw.category ?? raw.categoria)),
    type: normalizeText(raw && (raw.type ?? raw.tipo)),
    color: normalizeText(raw && raw.color),
    detail: normalizeText(raw && (raw.detail ?? raw.detalle)),
    sizes,
    imageUrl: normalizeImageUrl(raw && (raw.imageUrl ?? raw.imagen))
  };
}

function catalogRowsFromPayload(payload){
  const rows = payload && (payload.products || payload.productos || payload.data);
  return Array.isArray(rows) ? rows : [];
}

function readCatalogCache(){
  const candidates = [CATALOG_CACHE_KEY, STOCK_SHARED_CACHE_KEY];
  for(const key of candidates){
    try{
      const cache = JSON.parse(localStorage.getItem(key) || 'null');
      if(!cache || !Array.isArray(cache.products) || !cache.products.length) continue;
      const products = cache.products.map(normalizeCatalogProduct).filter(p => p.code);
      if(products.length){
        return {
          products,
          savedAt: cache.savedAt || '',
          actualizado: cache.actualizado || ''
        };
      }
    }catch(_){ }
  }
  return null;
}

function writeCatalogCache(products, updatedAt){
  try{
    localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({
      version: CATALOG_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      actualizado: updatedAt || '',
      products
    }));
  }catch(_){ }
}

function catalogProductForCode(code){
  const wanted = normalizeText(code).toUpperCase();
  return state.catalog.find(p => p.code === wanted) || null;
}

function productVisualForCode(code, altPrefix='Producto'){
  const product = catalogProductForCode(code);
  if(product && product.imageUrl){
    return `<img class="catalog-product-image" src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(altPrefix)} ${escapeHtml(code)}" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return '👟';
}

function rerenderCatalogVisuals(){
  // Al llegar Stock, actualiza imágenes y también los filtros de catálogo.
  // Las selecciones válidas se conservan.
  refreshFacets();

  if(state.visiblePurchases.length){
    renderPurchases(state.visiblePurchases);
  }
  if(state.detail){
    renderDetailProductVisual(state.detail);
  }
}

function renderDetailProductVisual(x){
  const box = $('.read-product-card .shoe-placeholder');
  if(!box || !x) return;
  box.innerHTML = productVisualForCode(x.code, 'Código');
}

async function loadCatalog(){
  const cache = readCatalogCache();
  if(cache && cache.products.length){
    state.catalog = cache.products;
    state.catalogSource = 'cache';
    state.catalogUpdatedAt = cache.actualizado || cache.savedAt || '';
    rerenderCatalogVisuals();
  }

  if(!STOCK_API_URL){
    state.catalogSource = cache ? 'cache-no-api' : 'no-api';
    return;
  }

  try{
    const payload = await loadJsonp(STOCK_API_URL, '__stockComprasCallback');
    if(!payload || payload.ok !== true) throw new Error((payload && payload.error) || 'Respuesta inválida del catálogo de Stock.');
    const fresh = catalogRowsFromPayload(payload).map(normalizeCatalogProduct).filter(p => p.code);
    if(!fresh.length) throw new Error('Stock no devolvió productos válidos.');

    state.catalog = fresh;
    state.catalogSource = 'api';
    state.catalogUpdatedAt = payload.actualizado || payload.generatedAt || new Date().toISOString();
    writeCatalogCache(fresh, state.catalogUpdatedAt);
    rerenderCatalogVisuals();
  }catch(err){
    state.catalogSource = cache ? 'cache-error' : 'api-error';
    console.warn('No se pudo actualizar el catálogo de Stock para Compras:', err);
  }
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

function loadJsonp(url, callbackPrefix='__comprasCallback'){
  return new Promise((resolve,reject) => {
    const callbackName = `${callbackPrefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
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
  if(ignoreKey !== 'brand' && f.brand && !sameValue(x.brand,f.brand)) return false;
  if(ignoreKey !== 'category' && f.category && !sameValue(x.category,f.category)) return false;
  if(ignoreKey !== 'type' && f.type && !sameValue(x.type,f.type)) return false;
  if(ignoreKey !== 'color' && f.color && !sameValue(x.color,f.color)) return false;
  if(ignoreKey !== 'entry' && f.entry && !sameValue(x.entry,f.entry)) return false;
  if(ignoreKey !== 'size' && f.size && !x.sizes.some(s => Number(s.size) === Number(f.size))) return false;
  return true;
}

function catalogFilterSource(){
  if(state.catalog.length) return state.catalog;

  // Respaldo temporal mientras Stock carga o si no estuviera disponible.
  // En cuanto llega el catálogo real, los filtros se reconstruyen con Stock.
  return state.purchases.map(x => ({
    code:x.code,
    brand:x.brand,
    category:x.category,
    type:x.type,
    color:x.color,
    sizes:Object.fromEntries(x.sizes.map(s => [String(s.size), Number(s.qty) || 0]))
  }));
}

function catalogMatches(p,f,ignoreKey=''){
  if(ignoreKey !== 'brand' && f.brand && !sameValue(p.brand,f.brand)) return false;
  if(ignoreKey !== 'category' && f.category && !sameValue(p.category,f.category)) return false;
  if(ignoreKey !== 'type' && f.type && !sameValue(p.type,f.type)) return false;
  if(ignoreKey !== 'color' && f.color && !sameValue(p.color,f.color)) return false;
  if(ignoreKey !== 'size' && f.size){
    const wanted = Number(f.size);
    const sizes = Object.keys(p.sizes || {}).map(Number);
    if(!sizes.includes(wanted)) return false;
  }
  return true;
}

function catalogValuesForFacet(p,key){
  if(key === 'size') return Object.keys(p.sizes || {}).map(s => String(Number(s)));
  return [p[key]];
}

function uniqueFacetValues(values,key){
  const map = new Map();
  values.filter(Boolean).forEach(v => {
    const display = String(v);
    const token = key === 'size' ? String(Number(v)) : canonicalValue(v);
    if(!map.has(token)) map.set(token,display);
  });
  return [...map.values()].sort((a,b) => {
    if(key === 'size') return Number(a)-Number(b);
    return String(a).localeCompare(String(b),'es',{sensitivity:'base'});
  });
}

function setSelectOptions(key, values, selected){
  const el = $(FILTER_IDS[key]);
  const unique = uniqueFacetValues(values,key);
  el.innerHTML = `<option value="">${EMPTY_LABELS[key]}</option>` + unique.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');

  if(selected){
    const matched = unique.find(v => key === 'size' ? Number(v) === Number(selected) : sameValue(v,selected));
    el.value = matched || '';
  }else{
    el.value = '';
  }
}

function populateFacets(){
  const current = getFilters();
  const source = catalogFilterSource();

  for(const key of CATALOG_FILTERS){
    const values = source.flatMap(x => catalogValuesForFacet(x,key));
    setSelectOptions(key,values,current[key]);
  }

  // Ingreso pertenece al historial de Compras, no al catálogo de Stock.
  // Se ofrecen todas las opciones conocidas, aunque una combinación concreta dé cero resultados.
  setSelectOptions('entry',state.purchases.map(x=>x.entry),current.entry);
  updateCompatibleHint();
}

function refreshFacets(){
  const source = catalogFilterSource();

  // Los cinco filtros de producto se interconectan exclusivamente con el catálogo.
  // Por eso una combinación válida sigue siendo seleccionable aunque nunca se haya comprado.
  for(let pass=0;pass<2;pass++){
    const f = getFilters();
    for(const key of CATALOG_FILTERS){
      const selected = $(FILTER_IDS[key]).value;
      const compatible = source.filter(x => catalogMatches(x,f,key));
      const values = compatible.flatMap(x => catalogValuesForFacet(x,key));
      setSelectOptions(key,values,selected);
    }
  }

  const entrySelected = $(FILTER_IDS.entry).value;
  setSelectOptions('entry',state.purchases.map(x=>x.entry),entrySelected);
  updateCompatibleHint();
}

function updateCompatibleHint(){
  const f = getFilters();
  const compatible = state.purchases.filter(x=>recordMatches(x,f));
  const pairs = compatible.reduce((a,x)=>a+x.pairs,0);
  const catalogLabel = state.catalog.length ? 'Combinación válida del catálogo' : 'Filtros disponibles';
  $('#compatibleHint').textContent = `${catalogLabel} · Historial: ${compatible.length} compras · ${pairs} pares`;
}

function filteredPurchases(){
  const f = getFilters();
  return state.purchases.filter(x => recordMatches(x,f));
}

function renderPurchases(rows, searched=false){
  state.visiblePurchases = rows.slice();
  const sorted = rows.slice().sort((a,b)=>b.date.localeCompare(a.date) || b.purchase.localeCompare(a.purchase));
  const list = $('#purchaseList');
  list.innerHTML = '';
  $('#consultEmpty').classList.toggle('hidden', sorted.length > 0);
  if(!sorted.length){
    const title = $('#consultEmpty h3');
    const text = $('#consultEmpty p');
    if(searched){
      const f = getFilters();
      const labels = [
        f.brand,
        f.category,
        f.type,
        f.color,
        f.size ? `Talla ${f.size}` : '',
        f.entry,
        f.code ? `Código ${f.code}` : '',
        f.purchase ? `Compra ${f.purchase}` : '',
        f.date ? formatDateEs(f.date) : ''
      ].filter(Boolean);
      title.textContent = 'No se registraron compras';
      text.textContent = labels.length
        ? `No hay compras registradas para: ${labels.join(' · ')}.`
        : 'No hay compras registradas con los criterios seleccionados.';
    }else{
      title.textContent = 'No encontramos compras';
      text.textContent = 'No hay datos de compras para mostrar.';
    }
  }
  $('#consultCount').textContent = `${sorted.length} ${sorted.length === 1 ? 'registro' : 'registros'}`;
  $('#metricPurchases').textContent = sorted.length.toLocaleString('es-PE');
  $('#metricPairs').textContent = sorted.reduce((a,x)=>a+x.pairs,0).toLocaleString('es-PE');
  $('#metricCost').textContent = money(sorted.reduce((a,x)=>a+x.cost,0));

  sorted.forEach(x => {
    const unit = x.pairs ? x.cost / x.pairs : 0;
    const el = document.createElement('article');
    el.className = 'purchase-row';
    el.innerHTML = `
      <div class="purchase-thumb read-thumb">${productVisualForCode(x.code, 'Código')}</div>
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
  renderPurchases(rows,true);
  updateCompatibleHint();
  if(!rows.length) toast('No se registraron compras con esos filtros.');
}

function resetFilters(){
  for(const selector of Object.values(FILTER_IDS)) $(selector).value = '';
  populateFacets();
  renderPurchases(state.purchases);
}

function openPurchaseDetail(x){
  state.detail = x;
  renderDetailProductVisual(x);
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
  renderPurchases(filteredPurchases(),true);
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

document.addEventListener('error', e => {
  const img = e.target;
  if(!(img instanceof HTMLImageElement) || !img.classList.contains('catalog-product-image')) return;
  const parent = img.parentElement;
  if(parent){
    img.remove();
    if(!parent.textContent.trim()) parent.textContent = '👟';
  }
}, true);

$('#btnBack').style.visibility = 'hidden';
loadPurchases();
loadCatalog();
