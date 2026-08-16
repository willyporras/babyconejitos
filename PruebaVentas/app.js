const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const todayISO = new Date().toISOString().slice(0,10);
const state = {
  screen:'screen-home',
  selected:null,
  nextSale:581,
  lastSale:null,
  filters:{code:'',category:'',type:'',color:'',size:''}
};

const products = [
  {code:'235',brand:'Kelly',category:'PibeNiño',type:'SandaliaG',color:'Azul',sizes:[17,18,19,20,21,22],stock:{17:0,18:1,19:1,20:1,21:1,22:0}},
  {code:'233',brand:'Ericka',category:'PibeNiño',type:'Cuero',color:'Olivo',sizes:[17,18,19,20,21,22],stock:{17:0,18:1,19:1,20:1,21:1,22:0}},
  {code:'250',brand:'Brakedi',category:'PibeNiño',type:'Cuero',color:'Habano',sizes:[17,18,19,20,21,22]},
  {code:'252',brand:'Florence',category:'PibeNiño',type:'Sandalia',color:'Marron',sizes:[17,18,19,20,21,22]},
  {code:'A178',brand:'Kelly',category:'PibeNiña',type:'SandaliaG',color:'Rosado',sizes:[17,18,19,20,21,22]},
  {code:'A356',brand:'Ericka',category:'PibeNiña',type:'Sandalia',color:'Rosado',sizes:[17,18,19,20,21,22]},
  {code:'A367',brand:'NicolStalin',category:'PibeNiña',type:'Charol',color:'Blanco',sizes:[17,18,19,20,21,22]},
  {code:'A370',brand:'Ericka',category:'PibeNiña',type:'Cuero',color:'Vino',sizes:[17,18,19,20,21,22]},
  {code:'A387',brand:'Claudina',category:'PibeNiña',type:'Goma',color:'Negro',sizes:[17,18,19,20,21,22]},
  {code:'ZN044',brand:'Elcriz',category:'ZapatoNiño',type:'Cuero',color:'Camel',sizes:[22,23,24,25,26]},
  {code:'ZN046',brand:'Marquina',category:'ZapatoNiño',type:'Sandalia',color:'Lucuma',sizes:[22,23,24,25,26]},
  {code:'Z138',brand:'DXiomy',category:'ZapatoNiña',type:'BalEscarcha',color:'Blanco',sizes:[22,23,24,25,26]}
];

const screenTitles={
  'screen-home':'Ventas','screen-identify':'Registrar Venta','screen-gallery':'Registrar Venta','screen-register':'Registrar Venta','screen-success':'Registrar Venta'
};

function show(id){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  $('#'+id).classList.add('active');
  state.screen=id;
  $('#headerTitle').textContent=screenTitles[id]||'Ventas';
  $('#btnBack').style.visibility=id==='screen-home'?'hidden':'visible';
  window.scrollTo({top:0,behavior:'instant'});
}

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),1800)}
function padSale(n){return 'V-'+String(n).padStart(4,'0')}
function formatDate(v){if(!v)return '—';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`}
function unique(key){return [...new Set(products.map(p=>p[key]))].sort((a,b)=>String(a).localeCompare(String(b),'es'))}
function fillSelect(sel,values,label){const el=$(sel);el.innerHTML=`<option value="">${label}</option>`+values.map(v=>`<option>${v}</option>`).join('')}

function initFilters(){
  fillSelect('#categorySelect',unique('category'),'Todas las categorías');
  fillSelect('#typeSelect',unique('type'),'Todos los tipos');
  fillSelect('#colorSelect',unique('color'),'Todos los colores');
  fillSelect('#sizeSelect',[17,18,19,20,21,22,23,24,25,26,27],'Todas las tallas');
}

function clearFilters(){
  $('#codeInput').value='';$('#categorySelect').value='';$('#typeSelect').value='';$('#colorSelect').value='';$('#sizeSelect').value='';
  state.filters={code:'',category:'',type:'',color:'',size:''};
}

function getFilters(){return {
  code:$('#codeInput').value.trim().toUpperCase(),
  category:$('#categorySelect').value,
  type:$('#typeSelect').value,
  color:$('#colorSelect').value,
  size:$('#sizeSelect').value
}}

function searchProducts(){
  const f=getFilters();state.filters=f;
  let results=[];
  if(f.code){
    // El código tiene prioridad absoluta: ignora los demás filtros.
    results=products.filter(p=>p.code.toUpperCase()===f.code || p.code.toUpperCase().includes(f.code));
  }else{
    results=products.filter(p=>(!f.category||p.category===f.category)&&(!f.type||p.type===f.type)&&(!f.color||p.color===f.color)&&(!f.size||p.sizes.includes(Number(f.size))));
  }
  renderGallery(results,f);
  show('screen-gallery');
}

function renderGallery(results,f){
  const chips=$('#activeFilters');chips.innerHTML='';
  if(f.code){addChip('Código: '+f.code,true)}
  else{
    if(f.category)addChip(f.category);if(f.type)addChip(f.type);if(f.color)addChip(f.color);if(f.size)addChip('Talla '+f.size);
    if(!f.category&&!f.type&&!f.color&&!f.size)addChip('Todos los productos');
  }
  $('#searchSummary').textContent=f.code?'Búsqueda prioritaria por código.':'Selecciona la fotografía que coincida con el zapato vendido.';
  $('#resultCount').textContent=results.length;
  const gallery=$('#gallery');gallery.innerHTML='';
  $('#emptyState').classList.toggle('hidden',results.length>0);
  results.forEach((p,i)=>{
    const b=document.createElement('button');b.className='product-card'+(f.code?' code-hit':'');
    b.innerHTML=`<div class="photo"><img src="producto-demo.png" alt="Producto ${p.code}" style="filter:hue-rotate(${(i*32)%160}deg) saturate(${1+(i%3)*.15})"></div><div class="meta"><h3>${p.code}</h3><p>${p.brand}</p><p>${p.category} · ${p.type} · ${p.color}</p></div>`;
    b.onclick=()=>selectProduct(p);gallery.appendChild(b);
  });
}
function addChip(text,priority=false){const s=document.createElement('span');s.className='chip'+(priority?' priority':'');s.textContent=text;$('#activeFilters').appendChild(s)}

function selectProduct(p){
  state.selected=p;
  $('#registerCode').textContent=p.code;
  $('#registerName').textContent=`${p.brand} · ${p.category} · ${p.type} · ${p.color}`;
  $('#saleId').textContent=padSale(state.nextSale);
  $('#saleDate').value=todayISO;
  $('#salePrice').value='';$('#saleNotes').value='';
  $('#saleSize').innerHTML='<option value="">Seleccionar talla</option>'+p.sizes.map(s=>`<option>${s}</option>`).join('');
  show('screen-register');
}

function registerSale(){
  const p=state.selected;if(!p){toast('Selecciona un producto.');return}
  const size=$('#saleSize').value,price=Number($('#salePrice').value),date=$('#saleDate').value;
  if(!size){toast('Selecciona la talla vendida.');return}
  if(!date){toast('Selecciona la fecha de venta.');return}
  if(!Number.isFinite(price)||price<=0){toast('Ingresa el precio de venta.');return}
  const sale={id:padSale(state.nextSale++),date,product:p,size:Number(size),price,notes:$('#saleNotes').value.trim()};
  state.lastSale=sale;
  renderSuccess(sale);
  show('screen-success');
  toast('Venta registrada correctamente.');
}

function remainingSizesAfterSale(product, soldSize){
  const stock=product.stock||Object.fromEntries(product.sizes.map(size=>[size,1]));
  const remaining={...stock};
  remaining[soldSize]=Math.max(0,(remaining[soldSize]||0)-1);
  return Object.entries(remaining)
    .filter(([,qty])=>qty>0)
    .map(([size,qty])=>qty>1?`${size} (${qty})`:String(size));
}

function renderSuccess(s){
  $('#summaryCode').textContent=s.product.code;
  $('#summaryInfo').textContent=`${s.product.brand} · ${s.product.category} · ${s.product.type} · ${s.product.color}`;
  $('#summarySize').textContent=s.size;
  $('#summaryPrice').textContent=`S/ ${s.price.toFixed(2)}`;
  const available=remainingSizesAfterSale(s.product,s.size);
  $('#summaryAvailableSizes').textContent=available.length?available.join(', '):'Sin tallas disponibles';
}

function resetRegisterState(){state.selected=null;state.lastSale=null;clearFilters();$('#salePrice').value='';$('#saleNotes').value='';$('#saleDate').value=todayISO}
function exitToHome(){resetRegisterState();show('screen-home')}

$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#btnSearch').onclick=searchProducts;
$('#btnClearFilters').onclick=clearFilters;
$('#btnModifySearch').onclick=()=>show('screen-identify');
$('#btnRegisterSale').onclick=registerSale;
$('#btnChangeProduct').onclick=()=>show('screen-gallery');
$('#btnAnotherSale').onclick=()=>{clearFilters();state.selected=null;show('screen-identify')};
$('#btnFinish').onclick=()=>{exitToHome();toast('Registro finalizado.')};
$('#btnHelp').onclick=()=>toast('Prototipo de Registrar Venta.');

$('#btnBack').onclick=()=>{
  const back={
    'screen-identify':'screen-home',
    'screen-gallery':'screen-identify',
    'screen-register':'screen-gallery',
    'screen-success':'screen-home'
  };
  if(state.screen==='screen-identify'){exitToHome();return}
  show(back[state.screen]||'screen-home');
};

initFilters();
$('#saleDate').value=todayISO;
$('#btnBack').style.visibility='hidden';

// ===== Consultar ventas (datos ficticios del prototipo) =====
state.consultFilters={date:'',code:'',saleId:'',category:'',size:''};
state.selectedSale=null;

const demoSales=[
  {id:'V-0580',date:'2026-08-15',product:products.find(p=>p.code==='235'),size:20,price:45,notes:'Precio regular.',available:['18','19','21'],history:[]},
  {id:'V-0579',date:'2026-08-15',product:products.find(p=>p.code==='233'),size:21,price:38,notes:'Venta reconstruida con revisión de stock.',available:['18','19','20'],history:[]},
  {id:'V-0578',date:'2026-08-14',product:products.find(p=>p.code==='A178'),size:19,price:42,notes:'Rebaja solicitada por cliente.',available:['17','18','20','21','22'],history:[]},
  {id:'V-0577',date:'2026-08-13',product:products.find(p=>p.code==='ZN044'),size:24,price:55,notes:'',available:['22','23','25','26'],history:[]},
  {id:'V-0576',date:'2026-08-12',product:products.find(p=>p.code==='A367'),size:20,price:48,notes:'',available:['17','18','19','21','22'],history:[]}
];

Object.assign(screenTitles,{
  'screen-consult':'Consultar Ventas','screen-sales-results':'Consultar Ventas','screen-sale-detail':'Detalle de Venta','screen-edit-sale':'Editar Venta','screen-sale-history':'Historial de Venta'
});

function initConsultFilters(){
  fillSelect('#consultCategory',unique('category'),'Todas');
  fillSelect('#consultSize',[17,18,19,20,21,22,23,24,25,26,27],'Todas');
}
function clearConsultFilters(){
  $('#consultDate').value='';$('#consultCode').value='';$('#consultSaleId').value='';$('#consultCategory').value='';$('#consultSize').value='';
  state.consultFilters={date:'',code:'',saleId:'',category:'',size:''};
}
function getConsultFilters(){return {date:$('#consultDate').value,code:$('#consultCode').value.trim().toUpperCase(),saleId:$('#consultSaleId').value.trim().toUpperCase(),category:$('#consultCategory').value,size:$('#consultSize').value}}
function allSales(){return [...demoSales,...(state.sessionSales||[])]}
function findSales(){
  const f=getConsultFilters();state.consultFilters=f;
  const found=allSales().filter(s=>(!f.date||s.date===f.date)&&(!f.code||s.product.code.toUpperCase().includes(f.code))&&(!f.saleId||s.id.toUpperCase().includes(f.saleId))&&(!f.category||s.product.category===f.category)&&(!f.size||s.size===Number(f.size)))
    .sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  renderSalesResults(found,f);show('screen-sales-results');
}
function renderSalesResults(found,f){
  const chips=$('#consultChips');chips.innerHTML='';
  if(f.date)addConsultChip('Fecha: '+formatDate(f.date));if(f.code)addConsultChip('Código: '+f.code);if(f.saleId)addConsultChip(f.saleId);if(f.category)addConsultChip(f.category);if(f.size)addConsultChip('Talla '+f.size);if(!Object.values(f).some(Boolean))addConsultChip('Todas las ventas');
  $('#salesResultCount').textContent=found.length;$('#salesEmpty').classList.toggle('hidden',found.length>0);
  const box=$('#salesResults');box.innerHTML='';
  found.forEach(s=>{const b=document.createElement('button');b.className='sale-list-card';b.innerHTML=`<div class="sale-list-top"><span class="date-badge">${formatDate(s.date)}</span><span class="sale-id-badge">${s.id}</span></div><div class="sale-list-body"><img class="sale-thumb" src="producto-demo.png" alt="${s.product.code}"><div class="sale-list-main"><h3>Código ${s.product.code}</h3><p>${s.product.brand} · ${s.product.category}</p><p>Talla ${s.size}</p><span class="sale-list-arrow">Ver detalle →</span></div><div class="sale-list-price">S/ ${s.price.toFixed(2)}</div></div>`;b.onclick=()=>openSaleDetail(s);box.appendChild(b)});
}
function addConsultChip(text){const s=document.createElement('span');s.className='chip';s.textContent=text;$('#consultChips').appendChild(s)}
function openSaleDetail(s){state.selectedSale=s;renderSaleDetail(s);show('screen-sale-detail')}
function renderSaleDetail(s){
  $('#detailSaleId').textContent=s.id;$('#detailId').textContent=s.id;$('#detailCode').textContent=s.product.code;$('#detailInfo').textContent=`${s.product.brand} · ${s.product.category} · ${s.product.type} · ${s.product.color}`;$('#detailDate').textContent=formatDate(s.date);$('#detailPrice').textContent=`S/ ${s.price.toFixed(2)}`;$('#detailSize').textContent=s.size;$('#detailAvailable').textContent=(s.available&&s.available.length)?s.available.join(', '):'Sin tallas disponibles';$('#detailNotes').textContent=s.notes||'Sin observaciones';
  const has=s.history&&s.history.length;$('#saleModifiedBox').classList.toggle('hidden',!has);if(has){$('#saleModifiedDates').innerHTML=s.history.map((h,i)=>`<div>Corrección ${i+1}: <strong>${h.when}</strong></div>`).join('')}
}
function openEditSale(){
  const s=state.selectedSale;if(!s)return;
  $('#editSaleId').textContent=s.id;$('#editOriginal').innerHTML=`<h3>Datos antes de editar</h3><p><strong>Fecha:</strong> ${formatDate(s.date)}</p><p><strong>Talla:</strong> ${s.size}</p><p><strong>Precio:</strong> S/ ${s.price.toFixed(2)}</p><p><strong>Observaciones:</strong> ${s.notes||'Sin observaciones'}</p>`;
  $('#editSaleDate').value=s.date;$('#editSaleSize').innerHTML=s.product.sizes.map(x=>`<option${x===s.size?' selected':''}>${x}</option>`).join('');$('#editSalePrice').value=s.price.toFixed(2);$('#editSaleNotes').value=s.notes||'';$('#editSaleReason').value='';show('screen-edit-sale');
}
function nowLabel(){return new Intl.DateTimeFormat('es-PE',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).replace(',',' -')}
function saveSaleCorrection(){
  const s=state.selectedSale;if(!s)return;const next={date:$('#editSaleDate').value,size:Number($('#editSaleSize').value),price:Number($('#editSalePrice').value),notes:$('#editSaleNotes').value.trim()};
  const changes=[];if(next.date!==s.date)changes.push({field:'Fecha',from:formatDate(s.date),to:formatDate(next.date)});if(next.size!==s.size)changes.push({field:'Talla',from:String(s.size),to:String(next.size)});if(next.price!==s.price)changes.push({field:'Precio',from:`S/ ${s.price.toFixed(2)}`,to:`S/ ${next.price.toFixed(2)}`});if(next.notes!==s.notes)changes.push({field:'Observaciones',from:s.notes||'Sin observaciones',to:next.notes||'Sin observaciones'});
  if(!changes.length){toast('No se detectaron cambios.');renderSaleDetail(s);show('screen-sale-detail');return}
  const reason=$('#editSaleReason').value.trim();if(!reason){toast('Indica el motivo de la corrección.');return}if(!next.date||!Number.isFinite(next.price)||next.price<=0){toast('Revisa fecha y precio.');return}
  s.history=s.history||[];s.history.push({when:nowLabel(),changes,reason});s.date=next.date;s.size=next.size;s.price=next.price;s.notes=next.notes;renderSaleDetail(s);show('screen-sale-detail');toast('Corrección guardada.');
}
function renderSaleHistory(){const s=state.selectedSale;if(!s)return;$('#historySaleId').textContent=s.id;$('#saleHistoryList').innerHTML=(s.history||[]).map((h,i)=>`<div class="history-item"><div class="history-head">Corrección ${i+1} realizada el ${h.when}</div>${h.changes.map(c=>`<div class="history-change"><small>${c.field}</small><strong>${c.from} → ${c.to}</strong></div>`).join('')}<div class="history-reason"><small>Motivo</small><div>${h.reason}</div></div></div>`).join('')||'<div class="empty-state"><h3>Sin correcciones</h3></div>';show('screen-sale-history')}
function leaveConsultToSales(){clearConsultFilters();state.selectedSale=null;show('screen-home')}

// Las ventas registradas durante esta sesión también aparecen en Consultar Ventas.
state.sessionSales=[];
const originalRegisterSale=registerSale;
registerSale=function(){
  const before=state.nextSale;originalRegisterSale();
  if(state.lastSale&&state.nextSale===before+1){const s=state.lastSale;s.available=remainingSizesAfterSale(s.product,s.size);s.history=[];state.sessionSales.push(s)}
};
$('#btnRegisterSale').onclick=registerSale;

$('#btnConsultSales').onclick=()=>show('screen-consult');
$('#btnFindSales').onclick=findSales;$('#btnClearConsult').onclick=clearConsultFilters;$('#btnConsultToSales').onclick=leaveConsultToSales;$('#btnResultsToSales').onclick=leaveConsultToSales;$('#btnModifyConsult').onclick=()=>show('screen-consult');$('#btnDetailBack').onclick=()=>show('screen-sales-results');$('#btnEditSale').onclick=openEditSale;$('#btnCancelSaleEdit').onclick=()=>{renderSaleDetail(state.selectedSale);show('screen-sale-detail')};$('#btnSaveSaleCorrection').onclick=saveSaleCorrection;$('#btnSaleHistory').onclick=renderSaleHistory;$('#btnHistoryBack').onclick=()=>{renderSaleDetail(state.selectedSale);show('screen-sale-detail')};

const oldBack=$('#btnBack').onclick;
$('#btnBack').onclick=()=>{
  const consultBack={'screen-consult':'screen-home','screen-sales-results':'screen-consult','screen-sale-detail':'screen-sales-results','screen-edit-sale':'screen-sale-detail','screen-sale-history':'screen-sale-detail'};
  if(consultBack[state.screen]){if(state.screen==='screen-consult'){leaveConsultToSales();return}show(consultBack[state.screen]);return}oldBack();
};
initConsultFilters();
