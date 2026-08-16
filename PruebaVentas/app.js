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
  {code:'235',brand:'Kelly',category:'PibeNiño',type:'SandaliaG',color:'Azul',sizes:[17,18,19,20,21,22]},
  {code:'233',brand:'Ericka',category:'PibeNiño',type:'Cuero',color:'Olivo',sizes:[17,18,19,20,21,22]},
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

function renderSuccess(s){
  $('#summaryCode').textContent=s.product.code;
  $('#summaryInfo').textContent=`${s.product.brand} · ${s.product.category} · ${s.product.type} · ${s.product.color}`;
  $('#summarySaleId').textContent=s.id;
  $('#summarySize').textContent=s.size;
  $('#summaryDate').textContent=formatDate(s.date);
  $('#summaryPrice').textContent=`S/ ${s.price.toFixed(2)}`;
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
$('#btnConsultPlaceholder').onclick=()=>toast('Consultar Ventas será la siguiente etapa del prototipo.');
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
