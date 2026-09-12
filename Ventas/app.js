/* =========================================================
   VENTAS · SOLO LECTURA · DATOS REALES

   Fuente principal:
   - API de Ventas (Apps Script incluido en este paquete)

   Catálogo / imágenes:
   - Reutiliza el caché local de Stock si está disponible.
   - Opcionalmente actualiza el catálogo usando stockApiUrl.

   La aplicación NO contiene funciones de escritura.
   ========================================================= */

"use strict";

const READ_ONLY_MODE = true;

const SALES_API_URL = String(
  window.VENTAS_CONFIG && window.VENTAS_CONFIG.apiUrl || ""
).trim();

const STOCK_API_URL = String(
  window.VENTAS_CONFIG && window.VENTAS_CONFIG.stockApiUrl || ""
).trim();

const SALES_LOAD_TIMEOUT_MS = 15000;
const STOCK_LOAD_TIMEOUT_MS = 15000;

const SALES_LOCAL_CACHE_KEY = "babyconejitos_sales_cache_v1";
const SALES_LOCAL_CACHE_VERSION = 1;
const SALES_CATALOG_CACHE_KEY = "babyconejitos_ventas_catalog_cache_v1";
const SALES_CATALOG_CACHE_VERSION = 1;
const SHARED_STOCK_CACHE_KEY = "babyconejitos_stock_cache_v1";

const RESULT_BATCH_SIZE = 80;

let sales = [];
let catalog = [];

const state = {
  screen: "screen-home",
  selectedSale: null,
  currentResults: [],
  currentFilters: null,
  renderedCount: 0,
  calendarCursor: startOfMonth(new Date()),
  detailReturn: "screen-sales-results",
  salesSource: "",
  catalogSource: ""
};

const $ = id => document.getElementById(id);

/* =========================================================
   NORMALIZACIÓN
   ========================================================= */
function text(value){
  return String(value ?? "").trim();
}

function normalized(value){
  return text(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function normalizeImageUrl(url){
  const value = text(url);
  if(!value) return "";

  let match = value.match(/drive\.google\.com\/uc\?(?:[^#]*&)?id=([^&]+)/i);
  if(match){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;
  }

  match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if(match){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;
  }

  match = value.match(/drive\.google\.com\/open\?(?:[^#]*&)?id=([^&]+)/i);
  if(match){
    return `https://drive.google.com/thumbnail?id=${encodeURIComponent(match[1])}&sz=w1000`;
  }

  return value;
}

function normalizeSale(raw){
  const price = Number(String(raw.price ?? raw.precio ?? raw.precioVenta ?? 0).replace(",", "."));
  const size = Number(String(raw.size ?? raw.talla ?? "").replace(",", "."));
  const channelRaw = text(raw.channel ?? raw.canal);
  const internet = normalized(channelRaw) === "internet";

  return {
    id: text(raw.id ?? raw.saleId ?? raw.idVenta),
    date: normalizeIsoDate(raw.date ?? raw.fecha),
    code: text(raw.code ?? raw.codigo),
    size: Number.isFinite(size) ? size : null,
    brand: text(raw.brand ?? raw.marca),
    category: text(raw.category ?? raw.categoria),
    type: text(raw.type ?? raw.tipo),
    color: text(raw.color),
    price: Number.isFinite(price) ? price : 0,
    partner: text(raw.partner ?? raw.socio),
    channel: internet ? "Internet" : "Tienda",
    channelSource: text(raw.channelSource ?? raw.origenCanal)
  };
}

function normalizeProduct(raw){
  const sourceSizes = raw.sizes || raw.tallas || {};
  const sizes = {};

  if(Array.isArray(sourceSizes)){
    sourceSizes.forEach(value=>{
      const n = Number(value);
      if(Number.isFinite(n)) sizes[String(n)] = 0;
    });
  }else{
    Object.entries(sourceSizes).forEach(([s,q])=>{
      const size = Number(s);
      const qty = Number(String(q ?? 0).replace(",", "."));
      if(Number.isFinite(size)) sizes[String(size)] = Number.isFinite(qty) ? qty : 0;
    });
  }

  return {
    code: text(raw.code ?? raw.codigo),
    brand: text(raw.brand ?? raw.marca),
    category: text(raw.category ?? raw.categoria),
    type: text(raw.type ?? raw.tipo),
    color: text(raw.color),
    sizes,
    imageUrl: normalizeImageUrl(raw.imageUrl ?? raw.imagen ?? "")
  };
}

function normalizeIsoDate(value){
  const v = text(value);
  if(!v) return "";
  if(/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const dmy = v.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if(dmy){
    return `${dmy[3]}-${String(dmy[2]).padStart(2,"0")}-${String(dmy[1]).padStart(2,"0")}`;
  }

  const d = new Date(v);
  if(Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

/* =========================================================
   CACHÉ LOCAL DE VENTAS
   ========================================================= */
function saveLocalSalesCache(payload){
  try{
    const data = {
      version: SALES_LOCAL_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      actualizado: payload?.actualizado || payload?.generatedAt || null,
      sales
    };
    localStorage.setItem(SALES_LOCAL_CACHE_KEY, JSON.stringify(data));
  }catch(error){
    console.warn("No se pudo guardar el caché local de Ventas.", error);
  }
}

function loadLocalSalesCache(){
  try{
    const raw = localStorage.getItem(SALES_LOCAL_CACHE_KEY);
    if(!raw) return null;
    const data = JSON.parse(raw);

    if(
      !data ||
      data.version !== SALES_LOCAL_CACHE_VERSION ||
      !Array.isArray(data.sales) ||
      data.sales.length === 0
    ) return null;

    const cached = data.sales.map(normalizeSale).filter(s=>s.id && s.code && s.date);
    if(!cached.length) return null;

    return {
      sales: cached,
      savedAt: data.savedAt || null,
      actualizado: data.actualizado || null
    };
  }catch(error){
    console.warn("No se pudo leer el caché local de Ventas.", error);
    return null;
  }
}

/* =========================================================
   CACHÉ LOCAL DEL CATÁLOGO DE STOCK

   - Ventas puede reutilizar el caché compartido que dejó /Stock.
   - También conserva su propia copia del catálogo para abrir rápido
     aunque el usuario no haya visitado /Stock recientemente.
   - Ventas NO sobrescribe el caché propio de Stock.
   ========================================================= */
function cacheTimestamp(data){
  const raw = data?.actualizado || data?.savedAt || "";
  const t = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function readCatalogCacheEntry(key, requireVersion=false){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;

    const data = JSON.parse(raw);

    if(
      !data ||
      (requireVersion && data.version !== SALES_CATALOG_CACHE_VERSION) ||
      !Array.isArray(data.products) ||
      data.products.length === 0
    ){
      return null;
    }

    const products = data.products
      .map(normalizeProduct)
      .filter(p=>p.code);

    if(!products.length) return null;

    return {
      products,
      savedAt: data.savedAt || null,
      actualizado: data.actualizado || null,
      timestamp: cacheTimestamp(data),
      key
    };
  }catch(error){
    console.warn(`No se pudo leer el caché de catálogo ${key}.`, error);
    return null;
  }
}

function loadLocalCatalogCache(){
  const own = readCatalogCacheEntry(SALES_CATALOG_CACHE_KEY, true);
  const shared = readCatalogCacheEntry(SHARED_STOCK_CACHE_KEY, false);

  if(own && shared){
    return shared.timestamp > own.timestamp ? shared : own;
  }

  return own || shared || null;
}

function saveLocalCatalogCache(payload){
  try{
    const data = {
      version: SALES_CATALOG_CACHE_VERSION,
      savedAt: new Date().toISOString(),
      actualizado: payload?.actualizado || payload?.generatedAt || null,
      products: catalog
    };

    localStorage.setItem(
      SALES_CATALOG_CACHE_KEY,
      JSON.stringify(data)
    );
  }catch(error){
    console.warn("No se pudo guardar el caché local del catálogo para Ventas.", error);
  }
}

/* =========================================================
   JSONP
   ========================================================= */
function jsonp(url, callbackPrefix, timeoutMs){
  return new Promise((resolve,reject)=>{
    if(!url){
      reject(new Error("Falta configurar la URL de la API."));
      return;
    }

    const callbackName = `__${callbackPrefix}_${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const script = document.createElement("script");
    let finished = false;

    const cleanup = ()=>{
      try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
      script.remove();
    };

    const timer = setTimeout(()=>{
      if(finished) return;
      finished = true;
      cleanup();
      reject(new Error("La consulta tardó demasiado."));
    }, timeoutMs);

    window[callbackName] = payload=>{
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      resolve(payload);
    };

    script.onerror = ()=>{
      if(finished) return;
      finished = true;
      clearTimeout(timer);
      cleanup();
      reject(new Error("No se pudo conectar con la API."));
    };

    const sep = url.includes("?") ? "&" : "?";
    script.src = `${url}${sep}callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.head.appendChild(script);
  });
}

async function loadSalesData(){
  const payload = await jsonp(SALES_API_URL, "ventasCallback", SALES_LOAD_TIMEOUT_MS);
  const rows = Array.isArray(payload?.sales)
    ? payload.sales
    : Array.isArray(payload?.ventas)
      ? payload.ventas
      : null;

  if(!payload || payload.ok !== true || !rows){
    throw new Error(payload?.error || "Respuesta inválida de la API de Ventas.");
  }

  sales = rows.map(normalizeSale).filter(s=>s.id && s.code && s.date);
  state.salesSource = payload.cacheServidor === true ? "Caché servidor" : "Google Sheets";
  return payload;
}

async function loadStockData(){
  const payload = await jsonp(STOCK_API_URL, "stockCallbackVentas", STOCK_LOAD_TIMEOUT_MS);
  const rows = Array.isArray(payload?.products)
    ? payload.products
    : Array.isArray(payload?.productos)
      ? payload.productos
      : null;

  if(!payload || payload.ok !== true || !rows){
    throw new Error(payload?.error || "Respuesta inválida de la API de Stock.");
  }

  catalog = rows.map(normalizeProduct).filter(p=>p.code);
  state.catalogSource = payload.cacheServidor === true ? "Caché servidor Stock" : "Stock";
  return payload;
}

/* =========================================================
   ESTADO VISUAL
   ========================================================= */
function setDataStatus(message, kind="info", title=""){
  const el = $("dataStatus");
  if(!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
  if(title) el.title = title;
  else el.removeAttribute("title");
}

function renderDatasetSummary(){
  const box = $("homeDatasetSummary");
  if(!box) return;

  if(!sales.length){
    box.innerHTML = "";
    return;
  }

  const sortedDates = sales.map(s=>s.date).filter(Boolean).sort();
  const first = sortedDates[0] || "";
  const last = sortedDates[sortedDates.length-1] || "";
  const internetCount = sales.filter(s=>s.channel === "Internet").length;

  box.innerHTML = `
    <div class="dataset-stat"><small>Ventas cargadas</small><strong>${sales.length}</strong></div>
    <div class="dataset-stat"><small>Internet</small><strong>${internetCount}</strong></div>
    <div class="dataset-stat"><small>Tienda</small><strong>${sales.length-internetCount}</strong></div>
    <div class="dataset-stat wide"><small>Periodo disponible</small><strong>${formatDate(first)} → ${formatDate(last)}</strong></div>
    <div class="dataset-stat"><small>Última venta</small><strong>${formatDate(last)}</strong></div>
  `;
}

function updateUiAfterDataChange(){
  renderDatasetSummary();
  initializeFilterOptions();
  renderCalendar();
}

/* =========================================================
   CATÁLOGO Y FICHA DE PRODUCTO
   ========================================================= */
function productKeyParts(item){
  return [item.code,item.category,item.type,item.color].map(normalized);
}

function catalogMatchesSale(sale){
  if(!sale) return null;
  const codeMatches = catalog.filter(p=>normalized(p.code) === normalized(sale.code));
  if(!codeMatches.length) return null;
  if(codeMatches.length === 1) return codeMatches[0];

  const exact = codeMatches.find(p=>
    normalized(p.category) === normalized(sale.category) &&
    normalized(p.type) === normalized(sale.type) &&
    normalized(p.color) === normalized(sale.color)
  );
  if(exact) return exact;

  const category = codeMatches.find(p=>normalized(p.category) === normalized(sale.category));
  return category || codeMatches[0];
}

function saleBrand(sale){
  return text(sale?.brand) || text(catalogMatchesSale(sale)?.brand);
}

function productImage(sale){
  return catalogMatchesSale(sale)?.imageUrl || "";
}

function visualHtml(sale, className="sale-thumb"){
  const image = productImage(sale);
  if(image){
    return `<img class="${className}" src="${escapeHtml(image)}" alt="Código ${escapeHtml(sale.code)}" loading="lazy" referrerpolicy="no-referrer">`;
  }
  return `<div class="sale-thumb-fallback" aria-hidden="true">👟</div>`;
}

/* =========================================================
   FILTROS INTERCONECTADOS
   ========================================================= */
function pseudoCatalogFromSales(){
  const map = new Map();
  sales.forEach(s=>{
    const key = productKeyParts(s).join("|");
    if(!map.has(key)){
      map.set(key, {
        code:s.code,
        brand:s.brand,
        category:s.category,
        type:s.type,
        color:s.color,
        sizes:{}
      });
    }
    if(s.size !== null) map.get(key).sizes[String(s.size)] = 0;
  });
  return [...map.values()];
}

function filterCatalogSource(){
  return catalog.length ? catalog : pseudoCatalogFromSales();
}

function selectedCatalogFilters(){
  return {
    brand: text($("consultBrand").value),
    category: $("consultCategory").value,
    type: $("consultType").value,
    color: $("consultColor").value,
    size: $("consultSize").value
  };
}

function productHasSize(product, size){
  if(!size) return true;
  return Object.prototype.hasOwnProperty.call(product.sizes || {}, String(Number(size)));
}

function productMatchesCatalogFilters(product, filters, ignoredField=""){
  if(ignoredField !== "brand" && filters.brand && !normalized(product.brand).startsWith(normalized(filters.brand))) return false;
  if(ignoredField !== "category" && filters.category && normalized(product.category) !== normalized(filters.category)) return false;
  if(ignoredField !== "type" && filters.type && normalized(product.type) !== normalized(filters.type)) return false;
  if(ignoredField !== "color" && filters.color && normalized(product.color) !== normalized(filters.color)) return false;
  if(ignoredField !== "size" && filters.size && !productHasSize(product, filters.size)) return false;
  return true;
}

function uniqueSorted(values, numeric=false){
  const set = [...new Set(values.filter(v=>v !== "" && v !== null && v !== undefined))];
  return set.sort(numeric
    ? (a,b)=>Number(a)-Number(b)
    : (a,b)=>String(a).localeCompare(String(b), "es", {sensitivity:"base"})
  );
}

function setSelectOptions(id, values, first, selectedValue){
  const el = $(id);
  const selectedNorm = normalized(selectedValue);
  el.innerHTML = `<option value="">${first}</option>` + values.map(v=>
    `<option value="${escapeHtml(String(v))}">${escapeHtml(String(v))}</option>`
  ).join("");

  if(selectedValue){
    const option = [...el.options].find(o=>normalized(o.value) === selectedNorm);
    if(option) el.value = option.value;
    else el.value = "";
  }
}

function availableBrandSuggestions(){
  const source = filterCatalogSource();
  const f = selectedCatalogFilters();
  const query = normalized(f.brand);

  return uniqueSorted(
    source
      .filter(p=>productMatchesCatalogFilters(p,f,"brand"))
      .map(p=>p.brand)
  ).filter(brand=>!query || normalized(brand).startsWith(query));
}

function renderBrandSuggestions(open=false){
  const box = $("consultBrandSuggestions");
  const toggle = $("btnBrandDropdown");
  const brands = availableBrandSuggestions();

  box.innerHTML = brands.length
    ? brands.map(brand=>`<button type="button" class="brand-option" data-brand="${escapeHtml(brand)}">${escapeHtml(brand)}</button>`).join("")
    : '<div class="brand-no-results">Sin marcas coincidentes</div>';

  box.querySelectorAll("[data-brand]").forEach(button=>{
    button.addEventListener("click",()=>{
      $("consultBrand").value = button.dataset.brand;
      closeBrandSuggestions();
      refreshInterconnectedFilters();
    });
  });

  if(open){
    box.classList.remove("hidden");
    toggle.setAttribute("aria-expanded","true");
  }
}

function closeBrandSuggestions(){
  $("consultBrandSuggestions").classList.add("hidden");
  $("btnBrandDropdown").setAttribute("aria-expanded","false");
}

function initializeFilterOptions(){
  const source = filterCatalogSource();
  const partners = uniqueSorted(sales.map(s=>s.partner));
  setSelectOptions("consultPartner", partners, "Todos", $("consultPartner").value);

  if(!source.length){
    renderBrandSuggestions(false);
    setSelectOptions("consultCategory", uniqueSorted(sales.map(s=>s.category)), "Todas", $("consultCategory").value);
    setSelectOptions("consultType", uniqueSorted(sales.map(s=>s.type)), "Todos", $("consultType").value);
    setSelectOptions("consultColor", uniqueSorted(sales.map(s=>s.color)), "Todos", $("consultColor").value);
    setSelectOptions("consultSize", uniqueSorted(sales.map(s=>s.size), true), "Todas", $("consultSize").value);
    return;
  }

  refreshInterconnectedFilters();
}

function refreshInterconnectedFilters(){
  const source = filterCatalogSource();
  if(!source.length) return;

  // Dos pasadas permiten limpiar selecciones que dejaron de ser válidas
  // y recalcular inmediatamente el resto de opciones.
  for(let pass=0; pass<2; pass++){
    const f = selectedCatalogFilters();

    const brands = uniqueSorted(
      source.filter(p=>productMatchesCatalogFilters(p,f,"brand")).map(p=>p.brand)
    );
    renderBrandSuggestions(false);
    const categories = uniqueSorted(
      source.filter(p=>productMatchesCatalogFilters(p,f,"category")).map(p=>p.category)
    );
    setSelectOptions("consultCategory", categories, "Todas", f.category);

    const types = uniqueSorted(
      source.filter(p=>productMatchesCatalogFilters(p,f,"type")).map(p=>p.type)
    );
    setSelectOptions("consultType", types, "Todos", f.type);

    const colors = uniqueSorted(
      source.filter(p=>productMatchesCatalogFilters(p,f,"color")).map(p=>p.color)
    );
    setSelectOptions("consultColor", colors, "Todos", f.color);

    const sizes = uniqueSorted(
      source
        .filter(p=>productMatchesCatalogFilters(p,f,"size"))
        .flatMap(p=>Object.keys(p.sizes || {}).map(Number)),
      true
    );
    setSelectOptions("consultSize", sizes, "Todas", f.size);
  }
}

/* =========================================================
   BÚSQUEDA
   ========================================================= */
function getConsultFilters(){
  return {
    date: $("consultDate").value,
    code: text($("consultCode").value),
    saleId: text($("consultSaleId").value),
    brand: text($("consultBrand").value),
    category: $("consultCategory").value,
    type: $("consultType").value,
    color: $("consultColor").value,
    size: $("consultSize").value,
    channel: $("consultChannel").value,
    partner: $("consultPartner").value
  };
}

function saleMatchesFilters(s, f){
  if(f.date && s.date !== f.date) return false;
  if(f.code && !normalized(s.code).includes(normalized(f.code))) return false;
  if(f.saleId && !normalized(s.id).includes(normalized(f.saleId))) return false;
  if(f.brand && !normalized(saleBrand(s)).startsWith(normalized(f.brand))) return false;
  if(f.category && normalized(s.category) !== normalized(f.category)) return false;
  if(f.type && normalized(s.type) !== normalized(f.type)) return false;
  if(f.color && normalized(s.color) !== normalized(f.color)) return false;
  if(f.size && Number(s.size) !== Number(f.size)) return false;
  if(f.channel && s.channel !== f.channel) return false;
  if(f.partner && normalized(s.partner) !== normalized(f.partner)) return false;
  return true;
}

function saleSort(a,b){
  if(a.date !== b.date) return b.date.localeCompare(a.date);
  return numericId(b.id) - numericId(a.id);
}

function numericId(id){
  const m = text(id).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function runSearch(){
  if(!sales.length){
    toast("Todavía no hay datos de Ventas disponibles.");
    return;
  }

  const filters = getConsultFilters();
  state.currentFilters = {...filters};
  state.currentResults = sales.filter(s=>saleMatchesFilters(s,filters)).sort(saleSort);
  state.renderedCount = 0;
  renderConsultChips(filters);
  renderResultBatch(true);
  showScreen("screen-sales-results");
}

function renderConsultChips(f){
  const chips = [];
  if(f.date) chips.push(formatDate(f.date));
  if(f.code) chips.push(`Código ${f.code}`);
  if(f.saleId) chips.push(f.saleId);
  if(f.brand) chips.push(f.brand);
  if(f.category) chips.push(f.category);
  if(f.type) chips.push(f.type);
  if(f.color) chips.push(f.color);
  if(f.size) chips.push(`Talla ${f.size}`);
  if(f.channel) chips.push(f.channel);
  if(f.partner) chips.push(`Socio ${f.partner}`);

  $("consultChips").innerHTML = chips.length
    ? chips.map(c=>`<span class="chip">${escapeHtml(c)}</span>`).join("")
    : '<span class="chip">Todas las ventas</span>';
}

function isSingleCodeHistoryMode(){
  const f = state.currentFilters || {};
  if(!text(f.code)) return false;

  // Este diseño especial se usa solamente cuando Código es el único filtro.
  const otherFilters = [
    f.date,f.saleId,f.brand,f.category,f.type,
    f.color,f.size,f.channel,f.partner
  ];
  if(otherFilters.some(value=>text(value))) return false;

  const codes = new Set(
    state.currentResults
      .map(s=>normalized(s.code))
      .filter(Boolean)
  );

  // Evita agrupar si una búsqueda parcial coincide con varios códigos.
  return codes.size === 1;
}

function saleCardHtml(s, latest=false){
  return `
    <div class="sale-list-top">
      <span class="date-badge">${escapeHtml(formatDate(s.date))}</span>
      <span class="sale-id-badge">${escapeHtml(s.id)}</span>
      ${latest ? '<span class="latest-sale-badge">Última venta</span>' : ''}
      ${s.channel === "Internet" ? '<span class="internet-badge">Internet</span>' : ''}
    </div>
    <div class="sale-list-body">
      ${visualHtml(s)}
      <div class="sale-list-main">
        <h3>${escapeHtml(s.code)}</h3>
        <p>${escapeHtml([saleBrand(s),s.category].filter(Boolean).join(" · ") || "Producto")}</p>
        <p>${escapeHtml([s.type,s.color, s.size!==null ? `Talla ${s.size}` : ""].filter(Boolean).join(" · "))}</p>
        ${s.partner ? `<p>Socio ${escapeHtml(s.partner)}</p>` : ''}
        <span class="sale-list-arrow">Ver detalle →</span>
      </div>
      <div class="sale-list-price">
        <span>Precio de venta</span>
        <strong>${formatMoney(s.price)}</strong>
      </div>
    </div>
  `;
}

function compactHistoryCardHtml(s){
  return `
    <div class="sale-list-top">
      <span class="date-badge">${escapeHtml(formatDate(s.date))}</span>
      <span class="sale-id-badge">${escapeHtml(s.id)}</span>
      ${s.channel === "Internet" ? '<span class="internet-badge">Internet</span>' : ''}
    </div>
    <div class="history-sale-data">
      <div><small>Talla</small><strong>${escapeHtml(s.size ?? "—")}</strong></div>
      <div><small>Socio</small><strong>${escapeHtml(s.partner || "—")}</strong></div>
      <div><small>Canal</small><strong>${escapeHtml(s.channel || "Tienda")}</strong></div>
    </div>
    <div class="sale-list-price compact-price">
      <span>Precio de venta</span>
      <strong>${formatMoney(s.price)}</strong>
    </div>
    <span class="sale-list-arrow compact-arrow">Ver detalle →</span>
  `;
}

function renderResultBatch(reset=false){
  if(reset) state.renderedCount = 0;
  const container = $("salesResults");
  const empty = $("salesEmptyState");
  const more = $("btnMoreResults");

  if(reset) container.innerHTML = "";

  $("salesResultCount").textContent = state.currentResults.length;
  empty.classList.toggle("hidden", state.currentResults.length > 0);

  if(!state.currentResults.length){
    container.classList.remove("single-code-history");
    more.classList.add("hidden");
    return;
  }

  const singleCodeMode = isSingleCodeHistoryMode();
  container.classList.toggle("single-code-history", singleCodeMode);

  // Cuando Código es el único filtro y todos los resultados pertenecen
  // al mismo código, mostramos la foto una sola vez en la última venta.
  if(singleCodeMode){
    if(reset){
      const latest = state.currentResults[0];
      const hero = document.createElement("button");
      hero.type = "button";
      hero.className = "sale-list-card product-history-hero";
      hero.innerHTML = saleCardHtml(latest,true);
      hero.addEventListener("click",()=>openSaleDetail(latest));
      container.appendChild(hero);
      state.renderedCount = 1;

      if(state.currentResults.length > 1){
        const title = document.createElement("div");
        title.className = "history-section-title";
        title.innerHTML = `<strong>Ventas anteriores</strong><span>${state.currentResults.length - 1} registros</span>`;
        container.appendChild(title);
      }
    }

    const start = state.renderedCount;
    const end = Math.min(start + RESULT_BATCH_SIZE, state.currentResults.length);
    const batch = state.currentResults.slice(start,end);
    const fragment = document.createDocumentFragment();

    batch.forEach(s=>{
      const button = document.createElement("button");
      button.type = "button";
      button.className = "sale-history-card";
      button.innerHTML = compactHistoryCardHtml(s);
      button.addEventListener("click",()=>openSaleDetail(s));
      fragment.appendChild(button);
    });

    container.appendChild(fragment);
    state.renderedCount = end;
    more.classList.toggle("hidden", end >= state.currentResults.length);
    return;
  }

  const start = state.renderedCount;
  const end = Math.min(start + RESULT_BATCH_SIZE, state.currentResults.length);
  const batch = state.currentResults.slice(start,end);

  const fragment = document.createDocumentFragment();
  batch.forEach(s=>{
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sale-list-card";
    button.innerHTML = saleCardHtml(s,false);
    button.addEventListener("click",()=>openSaleDetail(s));
    fragment.appendChild(button);
  });

  container.appendChild(fragment);
  state.renderedCount = end;
  more.classList.toggle("hidden", end >= state.currentResults.length);
}

/* =========================================================
   DETALLE
   ========================================================= */
function openSaleDetail(sale){
  state.selectedSale = sale;
  state.detailReturn = "screen-sales-results";

  $("detailCode").textContent = sale.code || "—";
  $("detailBrand").textContent = saleBrand(sale) || "Marca no disponible";
  $("detailDescription").textContent = [sale.category,sale.type,sale.color].filter(Boolean).join(" · ") || "—";
  $("detailSaleId").textContent = sale.id || "—";
  $("detailDate").textContent = formatLongDate(sale.date);
  $("detailSize").textContent = sale.size ?? "—";
  $("detailPrice").textContent = formatMoney(sale.price);
  $("detailChannel").textContent = sale.channel || "Tienda";
  $("detailPartner").textContent = sale.partner || "—";
  $("detailMeta").textContent = [sale.category,sale.type,sale.color].filter(Boolean).join(" · ") || "—";

  $("detailInternetBadge").classList.toggle("hidden", sale.channel !== "Internet");

  const image = productImage(sale);
  $("detailVisual").innerHTML = image
    ? `<img src="${escapeHtml(image)}" alt="Código ${escapeHtml(sale.code)}" referrerpolicy="no-referrer">`
    : "👟";

  showScreen("screen-sale-detail");
}

function showSalesForSameProduct(){
  const s = state.selectedSale;
  if(!s) return;
  clearConsult(true);
  $("consultCode").value = s.code;
  state.currentFilters = {date:"",code:s.code,saleId:"",brand:"",category:"",type:"",color:"",size:"",channel:"",partner:""};
  state.currentResults = sales
    .filter(row=>normalized(row.code)===normalized(s.code))
    .sort(saleSort);
  state.renderedCount = 0;
  renderConsultChips({date:"",code:s.code,saleId:"",brand:"",category:"",type:"",color:"",size:"",channel:"",partner:""});
  renderResultBatch(true);
  showScreen("screen-sales-results");
}

/* =========================================================
   CALENDARIO
   ========================================================= */
function startOfMonth(date){
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isoFromParts(year,monthZero,day){
  return `${year}-${String(monthZero+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

function dateFromIso(iso){
  const m = text(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return null;
  return new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
}

function saleDateSet(){
  return new Set(sales.map(s=>s.date).filter(Boolean));
}

function renderCalendar(){
  const title = $("calendarTitle");
  const days = $("calendarDays");
  if(!title || !days) return;

  const cursor = state.calendarCursor;
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  title.textContent = cursor.toLocaleDateString("es-PE", {month:"long",year:"numeric"});

  const selected = $("consultDate").value;
  const marked = saleDateSet();
  const first = new Date(year,month,1);
  const mondayOffset = (first.getDay()+6)%7;
  const gridStart = new Date(year,month,1-mondayOffset);

  let html = "";
  for(let i=0;i<42;i++){
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate()+i);
    const iso = isoFromParts(d.getFullYear(),d.getMonth(),d.getDate());
    const outside = d.getMonth() !== month;
    const hasSales = marked.has(iso);
    const isSelected = selected === iso;
    html += `<button type="button" class="calendar-day${outside?" outside":""}${hasSales?" has-sales":""}${isSelected?" selected":""}" data-date="${iso}" aria-label="${escapeHtml(formatLongDate(iso))}">${d.getDate()}</button>`;
  }
  days.innerHTML = html;

  days.querySelectorAll("[data-date]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      setConsultDate(btn.dataset.date);
      closeCalendar();
    });
  });
}

function setConsultDate(iso){
  $("consultDate").value = iso || "";
  $("consultDateDisplay").value = iso ? formatDate(iso) : "";
  if(iso){
    const d = dateFromIso(iso);
    if(d) state.calendarCursor = startOfMonth(d);
  }
  renderCalendar();
}

function openCalendar(){
  $("saleCalendar").classList.remove("hidden");
  $("consultDateDisplay").setAttribute("aria-expanded","true");
  const selected = dateFromIso($("consultDate").value);
  if(selected) state.calendarCursor = startOfMonth(selected);
  else if(sales.length){
    const latest = [...sales].sort(saleSort)[0];
    const d = dateFromIso(latest?.date);
    if(d) state.calendarCursor = startOfMonth(d);
  }
  renderCalendar();
}

function closeCalendar(){
  $("saleCalendar").classList.add("hidden");
  $("consultDateDisplay").setAttribute("aria-expanded","false");
}

function toggleCalendar(){
  if($("saleCalendar").classList.contains("hidden")) openCalendar();
  else closeCalendar();
}

/* =========================================================
   NAVEGACIÓN Y LIMPIEZA
   ========================================================= */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(el=>el.classList.remove("active"));
  const target = $(id);
  if(target) target.classList.add("active");
  state.screen = id;
  $("btnBack").style.visibility = id === "screen-home" ? "hidden" : "visible";
  window.scrollTo({top:0,behavior:"smooth"});
}

function goBack(){
  const map = {
    "screen-consult":"screen-home",
    "screen-sales-results":"screen-consult",
    "screen-sale-detail":"screen-sales-results"
  };
  showScreen(map[state.screen] || "screen-home");
}

function clearConsult(clearDate=true){
  closeBrandSuggestions();
  closeCalendar();
  if(clearDate) setConsultDate("");
  $("consultCode").value = "";
  $("consultSaleId").value = "";
  $("consultBrand").value = "";
  $("consultCategory").value = "";
  $("consultType").value = "";
  $("consultColor").value = "";
  $("consultSize").value = "";
  $("consultChannel").value = "";
  $("consultPartner").value = "";
  initializeFilterOptions();
}

/* =========================================================
   FORMATO / SEGURIDAD
   ========================================================= */
function formatMoney(value){
  const n = Number(value || 0);
  return `S/ ${n.toLocaleString("es-PE", {minimumFractionDigits:2,maximumFractionDigits:2})}`;
}

function formatDate(iso){
  const d = dateFromIso(iso);
  return d ? d.toLocaleDateString("es-PE", {day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
}

function formatLongDate(iso){
  const d = dateFromIso(iso);
  return d ? d.toLocaleDateString("es-PE", {weekday:"long",day:"2-digit",month:"long",year:"numeric"}) : "—";
}

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,c=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function toast(message){
  const t = $("toast");
  t.textContent = message;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2300);
}

/* =========================================================
   EVENTOS
   ========================================================= */
$("btnBack").addEventListener("click",goBack);
$("btnConsultSales").addEventListener("click",()=>showScreen("screen-consult"));
$("btnConsultToSales").addEventListener("click",()=>showScreen("screen-home"));
$("btnFindSales").addEventListener("click",runSearch);
$("btnClearConsult").addEventListener("click",()=>clearConsult(true));
$("btnModifyConsult").addEventListener("click",()=>showScreen("screen-consult"));
$("btnResultsHome").addEventListener("click",()=>showScreen("screen-home"));
$("btnMoreResults").addEventListener("click",()=>renderResultBatch(false));
$("btnBackResults").addEventListener("click",()=>showScreen("screen-sales-results"));
$("btnSameProduct").addEventListener("click",showSalesForSameProduct);

$("consultDateToggle").addEventListener("click",toggleCalendar);
$("consultDateDisplay").addEventListener("click",toggleCalendar);
$("calendarPrev").addEventListener("click",()=>{
  state.calendarCursor = new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()-1,1);
  renderCalendar();
});
$("calendarNext").addEventListener("click",()=>{
  state.calendarCursor = new Date(state.calendarCursor.getFullYear(),state.calendarCursor.getMonth()+1,1);
  renderCalendar();
});
$("calendarClear").addEventListener("click",()=>{
  setConsultDate("");
  closeCalendar();
});

document.addEventListener("click",event=>{
  if(!event.target.closest("#saleDatePicker")) closeCalendar();
  if(!event.target.closest("#consultBrandWrap")) closeBrandSuggestions();
});

["consultCategory","consultType","consultColor","consultSize"].forEach(id=>{
  $(id).addEventListener("change",refreshInterconnectedFilters);
});
$("consultBrand").addEventListener("input",()=>{
  refreshInterconnectedFilters();
  renderBrandSuggestions(true);
});
$("consultBrand").addEventListener("focus",()=>renderBrandSuggestions(true));
$("btnBrandDropdown").addEventListener("click",()=>{
  const box = $("consultBrandSuggestions");
  if(box.classList.contains("hidden")){
    $("consultBrand").focus();
    renderBrandSuggestions(true);
  }else{
    closeBrandSuggestions();
  }
});

["consultCode","consultSaleId","consultBrand"].forEach(id=>{
  $(id).addEventListener("keydown",event=>{
    if(event.key === "Enter") runSearch();
  });
});

/* =========================================================
   INICIO
   ========================================================= */
async function start(){
  $("btnBack").style.visibility = "hidden";

  // 1) Catálogo de Stock: usa inmediatamente la copia local más reciente
  //    disponible entre el caché propio de Ventas y el compartido por /Stock.
  const stockCache = loadLocalCatalogCache();
  if(stockCache){
    catalog = stockCache.products;
    state.catalogSource =
      stockCache.key === SHARED_STOCK_CACHE_KEY
        ? "Caché local Stock"
        : "Caché local catálogo";
  }

  // 2) Ventas locales: permiten consultar incluso antes de que responda Sheets.
  const localCache = loadLocalSalesCache();
  if(localCache){
    sales = localCache.sales;
    state.salesSource = "Caché local";
    updateUiAfterDataChange();
    setDataStatus(
      `📱 Caché local: ${sales.length} ventas · Actualizando…`,
      "info",
      `Copia guardada: ${new Date(localCache.actualizado || localCache.savedAt || Date.now()).toLocaleString("es-PE")}`
    );
  }else{
    setDataStatus("Conectando con Google Sheets…","info");
  }

  // 3) Siempre se consulta la API de Ventas al abrir/recargar.
  const salesPromise = loadSalesData()
    .then(payload=>{
      saveLocalSalesCache(payload);
      updateUiAfterDataChange();
      const source = payload.cacheServidor === true ? "⚡ Caché servidor" : "☁️ Google Sheets";
      const ts = payload.actualizado || payload.generatedAt || null;
      setDataStatus(
        `${source}: ${sales.length} ventas.`,
        "ok",
        ts ? `Última lectura: ${new Date(ts).toLocaleString("es-PE")}` : ""
      );
    })
    .catch(error=>{
      console.error(error);
      if(localCache && sales.length){
        setDataStatus(`Sin conexión. Mostrando datos guardados: ${sales.length} ventas.`,"info");
        toast("No se pudo actualizar Ventas. Se mantienen los datos guardados.");
      }else{
        const configHint = SALES_API_URL ? error.message : "Falta configurar apiUrl en config.js.";
        setDataStatus(`Sin conexión de datos: ${configHint}`,"error");
      }
    });

  // 4) Stock es complementario: Ventas funciona sin él, pero al estar
  //    configurado aporta imágenes y un catálogo completo para los filtros.
  let stockPromise = Promise.resolve();
  if(STOCK_API_URL){
    stockPromise = loadStockData()
      .then(payload=>{
        saveLocalCatalogCache(payload);
        initializeFilterOptions();
        if(state.screen === "screen-sales-results") renderResultBatch(true);
        if(state.screen === "screen-sale-detail" && state.selectedSale){
          const selected = state.selectedSale;
          $("detailBrand").textContent = saleBrand(selected) || "Marca no disponible";
          const image = productImage(selected);
          $("detailVisual").innerHTML = image
            ? `<img src="${escapeHtml(image)}" alt="Código ${escapeHtml(selected.code)}" referrerpolicy="no-referrer">`
            : "👟";
        }
      })
      .catch(error=>console.warn("No se pudo actualizar el catálogo de Stock.",error));
  }else if(catalog.length){
    initializeFilterOptions();
  }

  await Promise.allSettled([salesPromise,stockPromise]);
}

start();
