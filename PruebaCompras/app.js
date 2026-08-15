const state = {
  screen: 'screen-home',
  brands: ['Kelly','Ericka','Brakedi','Pibe Shoes'],
  products: [
    {code:'A076',brand:'Kelly',category:'Pibe Niño',color:'Azul',material:'Cuero'},
    {code:'A255',brand:'Kelly',category:'Pibe Niño',color:'Azul',material:'Cuero'},
    {code:'A291',brand:'Kelly',category:'Pibe Niño',color:'Marrón',material:'Cuero'},
    {code:'A123',brand:'Ericka',category:'Pibe Niña',color:'Rosado'},
    {code:'A028',brand:'Ericka',category:'Pibe Niña',color:'Rosado'},
    {code:'A350',brand:'Ericka',category:'Pibe Niña',color:'Blanco'},
    {code:'A411',brand:'Brakedi',category:'Zapato Niño',color:'Negro'}
  ],
  colors:{
    'Pibe Niño':['Azul','Marrón','Negro','Blanco'],
    'Pibe Niña':['Rosado','Blanco','Azul','Negro'],
    'Zapato Niño':['Negro','Marrón','Azul','Blanco'],
    'Zapato Niña':['Rosado','Blanco','Negro','Azul'],
    'Zapato Niña 27':['Negro','Blanco'],
    'Zapato Bebé':['Blanco','Rosado','Azul']
  },
  sizes:{'Pibe Niño':[17,18,19,20,21,22],'Pibe Niña':[17,18,19,20,21,22],'Zapato Niño':[22,23,24,25,26],'Zapato Niña':[22,23,24,25,26],'Zapato Niña 27':[27,28,29,30,31],'Zapato Bebé':[14,15,16,17,18]},
  session:[],
  nextPurchase:1,
  nextProduct:292,
  selected:null,
  filters:{brand:'',category:'',color:'',code:''}
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const today = new Date().toISOString().slice(0,10);

function show(id){
  $$('.screen').forEach(s=>s.classList.remove('active'));
  const el = document.getElementById(id); if(el) el.classList.add('active');
  state.screen=id; window.scrollTo({top:0,behavior:'smooth'});
  $('#btnBack').style.visibility = id==='screen-home'?'hidden':'visible';
}

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}

function setBrandSuggestions(){
  const input=$('#brandInput'); const box=$('#brandSuggestions'); const q=input.value.trim().toLowerCase();
  box.innerHTML='';
  if(!q)return;
  state.brands.filter(b=>b.toLowerCase().startsWith(q)).forEach(b=>{
    const btn=document.createElement('button');btn.textContent=b;btn.type='button';
    btn.onclick=()=>{input.value=b;box.innerHTML='';state.filters.brand=b};box.appendChild(btn);
  });
}

function updateColors(){
  const cat=$('#categorySelect').value; const select=$('#colorSelect');
  select.innerHTML='';
  if(!cat){select.disabled=true;select.innerHTML='<option value="">Primero selecciona una categoría</option>';return}
  select.disabled=false;select.innerHTML='<option value="">Seleccionar color</option>';
  (state.colors[cat]||[]).forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;select.appendChild(o)});
}

function currentFilters(){
  state.filters.brand=$('#brandInput').value.trim();
  state.filters.category=$('#categorySelect').value;
  state.filters.color=$('#colorSelect').value;
  state.filters.code=$('#codeInput').value.trim().toUpperCase();
}

function renderGallery(){
  const f=state.filters;
  let result=state.products.filter(p=>
    (!f.brand||p.brand.toLowerCase()===f.brand.toLowerCase())&&
    (!f.category||p.category===f.category)&&
    (!f.color||p.color===f.color)&&
    (!f.code||p.code.toUpperCase().includes(f.code))
  );
  $('#searchSummary').textContent=[f.brand,f.category,f.color,f.code?`Código: ${f.code}`:''].filter(Boolean).join(' · ');
  $('#activeFilters').innerHTML=[f.brand,f.category,f.color,f.code?`Código ${f.code}`:''].filter(Boolean).map(x=>`<span class="chip">${x}</span>`).join('');
  const gallery=$('#gallery');gallery.innerHTML='';
  $('#emptyState').classList.toggle('hidden',result.length>0);
  result.forEach(p=>{
    const card=document.createElement('div');card.className='product-card';
    card.innerHTML=`<button type="button"><div class="product-image">👟</div><strong>${p.code}</strong><small>${p.brand} · ${p.color}</small></button>`;
    card.querySelector('button').onclick=()=>selectProduct(p);
    gallery.appendChild(card);
  });
}

function selectProduct(p){
  state.selected=p;
  $('#registerPhoto').textContent='👟';$('#registerCode').textContent=p.code;$('#registerName').textContent=`${p.brand} · ${p.category} · ${p.color}`;
  $('#purchaseNumber').textContent=`CP-${String(state.nextPurchase).padStart(4,'0')}`;
  $('#purchaseDate').value=today;
  buildSizes('#sizesExisting',p.category,'totalPairs');
  $('#priceInput').value='';$('#notesInput').value='';show('screen-register');
}

function buildSizes(selector,category,totalId){
  const el=$(selector);el.innerHTML='';const sizes=state.sizes[category]||[17,18,19,20,21,22];
  sizes.forEach(size=>{
    const box=document.createElement('div');box.className='size-control';
    box.innerHTML=`<strong>${size}</strong><div class="stepper-control"><button type="button" data-delta="-1">−</button><span>0</span><button type="button" data-delta="1">+</button></div>`;
    const span=box.querySelector('span');box.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{let n=Math.max(0,Number(span.textContent)+Number(btn.dataset.delta));span.textContent=n;updateTotal(selector,totalId)});el.appendChild(box);
  });
}
function readSizes(selector){return [...$(selector).querySelectorAll('.size-control')].map(b=>({size:b.querySelector('strong').textContent,qty:Number(b.querySelector('span').textContent)})).filter(x=>x.qty>0)}
function updateTotal(selector,id){$(id).textContent=readSizes(selector).reduce((a,x)=>a+x.qty,0)}

function addPurchase(product,selector,price,date,notes){
  const sizes=readSizes(selector), pairs=sizes.reduce((a,x)=>a+x.qty,0);
  if(!pairs){toast('Ingresa al menos una cantidad.');return false}
  if(price===''||Number(price)<0){toast('Ingresa el precio de compra.');return false}
  const cp=`CP-${String(state.nextPurchase).padStart(4,'0')}`;state.nextPurchase++;
  state.session.push({purchase:cp,date,product, sizes,pairs,price:Number(price),notes});
  toast(`${cp} registrado correctamente`);return true;
}

function openNewProduct(){
  const f=state.filters;const code='A'+String(state.nextProduct++).padStart(3,'0');
  $('#newCode').textContent=code;$('#newBrand').textContent=f.brand||'Kelly';$('#newCategory').textContent=f.category||'Pibe Niño';$('#newColor').textContent=f.color||'Azul';
  buildSizes('#sizesNew',f.category||'Pibe Niño','totalNewPairs');$('#newPrice').value='';$('#newNotes').value='';show('screen-new');
}

function finishSummary(){
  const item=state.session.at(-1);
  if(!item){return}
  const product=item.product;
  const material=product.material||'Cuero';
  const sizeText=item.sizes.map(s=>s.qty>1?`${s.size} (${s.qty})`:s.size).join(', ')||'—';
  const totalMoney=item.pairs*item.price;

  $('#summaryBrand').textContent=product.brand||'—';
  $('#summarySizes').textContent=sizeText;
  $('#summaryPairs').textContent=item.pairs;
  $('#summaryMoney').textContent=`S/ ${totalMoney.toFixed(2)}`;
  $('#summaryCode').textContent=product.code||'—';
  $('#summaryProductInfo').textContent=`${product.category||'—'} · ${material} · ${product.color||'—'}`;
  $('#summaryUnitPrice').textContent=`S/ ${item.price.toFixed(2)}`;
  $('#summaryProductImage').src='producto-a255.png';
  $('#summaryProductImage').alt=`Imagen del producto ${product.code||''}`;
  show('screen-success');
}

function resetConsultFilters(){
  $('#consultDate').value='';
  $('#consultBrand').value='';
  $('#consultProductCode').value='';
  $('#consultPurchaseCode').value='';
}

function resetRegistrationForm(){
  state.selected=null;
  state.filters={brand:'',category:'',color:'',code:''};
  $('#brandInput').value='';
  $('#categorySelect').value='';
  updateColors();
  $('#codeInput').value='';
  $('#brandSuggestions').innerHTML='';
  $('#priceInput').value='';
  $('#notesInput').value='';
  $('#purchaseDate').value=today;
}

function exitToPurchases(){
  resetConsultFilters();
  resetRegistrationForm();
  state.detailPurchase=null;
  show('screen-home');
}

$('#btnBack').onclick=()=>{
  if(state.screen==='screen-identify' || state.screen==='screen-success'){exitToPurchases();return;}
  const map={'screen-gallery':'screen-identify','screen-register':'screen-gallery','screen-new':'screen-gallery'};
  show(map[state.screen]||'screen-home');
};
$$('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
$('#brandInput').addEventListener('input',setBrandSuggestions);
$('#categorySelect').addEventListener('change',()=>{updateColors();state.filters.category=$('#categorySelect').value;});
document.addEventListener('click',e=>{if(!e.target.closest('.autocomplete'))$('#brandSuggestions').innerHTML=''});
$('#btnSearch').onclick=()=>{currentFilters();if(!state.filters.brand||!state.filters.category){toast('Selecciona marca y categoría para buscar.');return}renderGallery();show('screen-gallery')};
$('#btnNewProduct').onclick=openNewProduct;
$('#btnRegisterExisting').onclick=()=>{if(!state.selected)return;const ok=addPurchase(state.selected,'#sizesExisting',$('#priceInput').value,$('#purchaseDate').value,$('#notesInput').value);if(ok)finishSummary();};
$('#btnRegisterNew').onclick=()=>{const p={code:$('#newCode').textContent,brand:$('#newBrand').textContent,category:$('#newCategory').textContent,color:$('#newColor').textContent};const ok=addPurchase(p,'#sizesNew',$('#newPrice').value,today,$('#newNotes').value);if(ok){state.products.push(p);finishSummary();}};
$('#btnFinish').onclick=()=>{state.session=[];exitToPurchases();toast('Sesión finalizada.')};
$('#btnContinueFromSummary').onclick=()=>{state.filters={brand:'',category:'',color:'',code:''};$('#brandInput').value='';$('#categorySelect').value='';updateColors();$('#codeInput').value='';show('screen-identify')};
$('#btnConsult').onclick=()=>toast('En este prototipo, Consultar Compras aún no está conectado.');
$('#photoUpload').onclick=()=>toast('Carga de fotografía simulada en este prototipo.');

$('#purchaseDate').value=today;$('#btnBack').style.visibility='hidden';

/* =========================================================
   CONSULTAR COMPRAS - DATOS FICTICIOS PARA PROTOTIPO
   ========================================================= */
state.purchaseHistory = [
  {purchase:'CP-0012',date:'2026-08-15',product:{code:'A123',brand:'Ericka',category:'Pibe Niña',color:'Rosado',material:'Cuero'},sizes:[{size:'18',qty:1},{size:'19',qty:2},{size:'20',qty:1}],pairs:4,price:19,notes:'Compra de reposición.'},
  {purchase:'CP-0013',date:'2026-08-15',product:{code:'A028',brand:'Ericka',category:'Pibe Niña',color:'Rosado',material:'Cuero'},sizes:[{size:'18',qty:1},{size:'19',qty:1},{size:'20',qty:1}],pairs:3,price:20,notes:'Sin observaciones.'},
  {purchase:'CP-0014',date:'2026-08-15',product:{code:'A076',brand:'Kelly',category:'Pibe Niño',color:'Azul',material:'Cuero'},sizes:[{size:'19',qty:1},{size:'20',qty:1},{size:'21',qty:1}],pairs:3,price:20,notes:'Sin observaciones.'}
];
state.detailPurchase = null;

function formatDateEs(v){if(!v)return '—';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`}
function sizesText(sizes){return sizes.map(s=>s.qty>1?`${s.size} (${s.qty})`:s.size).join(', ')}
function allPurchases(){return [...state.purchaseHistory,...state.session]}
function renderPurchases(){
  const date=$('#consultDate').value, brand=$('#consultBrand').value;
  const pc=$('#consultProductCode').value.trim().toUpperCase(), cp=$('#consultPurchaseCode').value.trim().toUpperCase();
  const rows=allPurchases().filter(x=>(!date||x.date===date)&&(!brand||x.product.brand===brand)&&(!pc||x.product.code.toUpperCase().includes(pc))&&(!cp||x.purchase.toUpperCase().includes(cp)));
  const list=$('#purchaseList');list.innerHTML='';$('#consultEmpty').classList.toggle('hidden',rows.length>0);$('#consultCount').textContent=`${rows.length} ${rows.length===1?'registro':'registros'}`;
  rows.slice().sort((a,b)=>{
    const byDate=b.date.localeCompare(a.date);
    return byDate!==0?byDate:b.purchase.localeCompare(a.purchase);
  }).forEach(x=>{
    const el=document.createElement('article');el.className='purchase-row';
    el.innerHTML=`<div class="purchase-thumb"><img src="producto-a255.png" alt="${x.product.code}"></div><div class="purchase-main"><div class="purchase-top"><strong>${x.purchase}</strong><span class="purchase-date">📅 ${formatDateEs(x.date)}</span><span class="purchase-brand">${x.product.brand}</span>${(x.history&&x.history.length)?'<span class="edited-tag">⚠ Editada</span>':''}</div><h3>${x.product.code}</h3><p>${x.pairs} pares · Tallas ${sizesText(x.sizes)}</p><p>Total S/ ${(x.pairs*x.price).toFixed(2)}</p></div><button class="secondary-btn purchase-view">Ver detalle →</button>`;
    el.querySelector('.purchase-view').onclick=()=>openPurchaseDetail(x);list.appendChild(el);
  });
}
function snapshotPurchase(x){
  return {
    date:x.date,
    sizes:x.sizes.map(s=>({size:String(s.size),qty:Number(s.qty)})),
    pairs:Number(x.pairs),
    price:Number(x.price),
    notes:x.notes||''
  };
}
function sameSizes(a,b){
  if(a.length!==b.length)return false;
  const norm=v=>v.map(s=>({size:String(s.size),qty:Number(s.qty)})).filter(s=>s.qty>0).sort((x,y)=>x.size.localeCompare(y.size));
  const aa=norm(a),bb=norm(b);
  return aa.length===bb.length&&aa.every((s,i)=>s.size===bb[i].size&&s.qty===bb[i].qty);
}
function changeList(before,after){
  const changes=[];
  if(before.date!==after.date)changes.push(`Fecha: ${formatDateEs(before.date)} → ${formatDateEs(after.date)}`);
  if(!sameSizes(before.sizes,after.sizes))changes.push(`Tallas: ${sizesText(before.sizes)} → ${sizesText(after.sizes)}`);
  if(before.pairs!==after.pairs)changes.push(`Pares: ${before.pairs} → ${after.pairs}`);
  if(before.price!==after.price)changes.push(`Precio unitario: S/ ${before.price.toFixed(2)} → S/ ${after.price.toFixed(2)}`);
  if((before.notes||'')!==(after.notes||''))changes.push(`Observaciones: ${(before.notes||'Sin observaciones.')} → ${(after.notes||'Sin observaciones.')}`);
  return changes;
}
function renderHistory(x){
  const history=x.history||[];
  const wrap=$('#editHistory'),list=$('#historyList');
  wrap.classList.toggle('hidden',history.length===0);
  list.innerHTML='';
  if(!history.length)return;
  const last=history.at(-1);
  $('#editHistoryText').textContent=`Última corrección: ${last.changes.join(' · ')}. Motivo: ${last.reason}`;
  history.slice().reverse().forEach((h,idx)=>{
    const el=document.createElement('div');el.className='history-entry';
    el.innerHTML=`<div class="history-entry-head"><strong>Corrección ${history.length-idx}</strong><small>${h.timestamp}</small></div><ul>${h.changes.map(c=>`<li>${c}</li>`).join('')}</ul><div class="history-reason"><strong>Motivo:</strong> ${h.reason}</div>`;
    list.appendChild(el);
  });
}
function openPurchaseDetail(x){
  state.detailPurchase=x;
  $('#detailSubtitle').textContent=`${x.purchase} · ${formatDateEs(x.date)}`;
  $('#detailProductCode').textContent=x.product.code;
  $('#detailProductInfo').textContent=`${x.product.category} · ${x.product.material||'Cuero'} · ${x.product.color}`;
  $('#detailUnitPrice').textContent=`S/ ${x.price.toFixed(2)}`;
  $('#detailBrand').textContent=x.product.brand;
  $('#detailSizes').textContent=sizesText(x.sizes);
  $('#detailPairs').textContent=x.pairs;
  $('#detailMoney').textContent=`S/ ${(x.pairs*x.price).toFixed(2)}`;
  $('#detailPurchase').textContent=x.purchase;
  $('#detailDate').textContent=formatDateEs(x.date);
  $('#detailNotes').textContent=x.notes||'Sin observaciones.';
  renderHistory(x);
  $('#historyList').classList.add('hidden');
  $('#btnToggleHistory').textContent='Ver historial de cambios';
  show('screen-purchase-detail');
}
function buildEditSizes(x){
  buildSizes('#sizesEdit',x.product.category,'editTotalPairs');
  [...$('#sizesEdit').querySelectorAll('.size-control')].forEach(box=>{const size=box.querySelector('strong').textContent;const found=x.sizes.find(s=>String(s.size)===String(size));box.querySelector('span').textContent=found?found.qty:0});
  updateTotal('#sizesEdit','editTotalPairs');
}
function fillOriginalCard(x){
  $('#originalDate').textContent=formatDateEs(x.date);
  $('#originalSizes').textContent=sizesText(x.sizes)||'—';
  $('#originalPairs').textContent=x.pairs;
  $('#originalPrice').textContent=`S/ ${x.price.toFixed(2)}`;
  $('#originalTotal').textContent=`S/ ${(x.pairs*x.price).toFixed(2)}`;
  $('#originalNotes').textContent=x.notes||'Sin observaciones.';
}
function openEdit(){
  const x=state.detailPurchase;if(!x)return;
  $('#editProductCode').textContent=x.product.code;
  $('#editProductName').textContent=`${x.product.brand} · ${x.product.category} · ${x.product.color}`;
  $('#editPurchaseCode').textContent=x.purchase;
  $('#editDate').value=x.date;
  $('#editPrice').value=x.price;
  $('#editNotes').value=x.notes||'';
  $('#editReason').value='';
  buildEditSizes(x);
  fillOriginalCard(x);
  state.editBaseline=snapshotPurchase(x);
  show('screen-edit-purchase');
}
function saveEdit(){
  const x=state.detailPurchase;if(!x)return;
  const newSizes=readSizes('#sizesEdit'),pairs=newSizes.reduce((a,s)=>a+s.qty,0),price=Number($('#editPrice').value);
  if(!pairs){toast('Debe quedar al menos un par.');return}
  if(!Number.isFinite(price)||price<0){toast('Ingresa un precio válido.');return}
  const before=state.editBaseline||snapshotPurchase(x);
  const after={date:$('#editDate').value,sizes:newSizes,pairs,price,notes:$('#editNotes').value.trim()};
  const changes=changeList(before,after);
  if(!changes.length){toast('No se detectaron cambios.');return}
  const reason=$('#editReason').value.trim();
  if(!reason){toast('Indica el motivo de la corrección.');return}
  if(!x.history)x.history=[];
  const stamp=new Date().toLocaleString('es-PE',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  x.history.push({timestamp:stamp,reason,changes,before,after});
  x.sizes=after.sizes;x.pairs=after.pairs;x.price=after.price;x.date=after.date;x.notes=after.notes;
  toast('Corrección guardada.');
  openPurchaseDetail(x);
}

$('#btnRunConsult').onclick=renderPurchases;$('#btnClearConsult').onclick=()=>{resetConsultFilters();renderPurchases()};$('#btnEditPurchase').onclick=openEdit;$('#btnSaveEdit').onclick=saveEdit;$('#btnCancelEdit').onclick=()=>openPurchaseDetail(state.detailPurchase);$('#btnToggleHistory').onclick=()=>{const list=$('#historyList');const hidden=list.classList.toggle('hidden');$('#btnToggleHistory').textContent=hidden?'Ver historial de cambios':'Ocultar historial';};

// Conecta la consulta desde la pantalla de confirmación.
$('#btnConsult').onclick=()=>{renderPurchases();show('screen-consult')};

// Extiende Volver para las pantallas de consulta.
const originalBack=$('#btnBack').onclick;
$('#btnBack').onclick=()=>{
  if(state.screen==='screen-consult'){exitToPurchases();return}
  const extra={'screen-purchase-detail':'screen-consult','screen-edit-purchase':'screen-purchase-detail'};
  if(extra[state.screen]){show(extra[state.screen]);return}
  originalBack();
};

$('#btnExitConsult').onclick=exitToPurchases;

renderPurchases();
