const state = {
  screen: 'screen-home',
  brands: ['Kelly','Ericka','Brakedi','Pibe Shoes'],
  products: [
    {code:'A076',brand:'Kelly',category:'Pibe Niño',color:'Azul'},
    {code:'A255',brand:'Kelly',category:'Pibe Niño',color:'Azul'},
    {code:'A291',brand:'Kelly',category:'Pibe Niño',color:'Marrón'},
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
  const products=state.session.length,pairs=state.session.reduce((a,x)=>a+x.pairs,0),money=state.session.reduce((a,x)=>a+x.pairs*x.price,0);
  $('#sessionProducts').textContent=`${products} productos · ${pairs} pares`;
  $('#summaryProducts').textContent=products;$('#summaryPairs').textContent=pairs;$('#summaryMoney').textContent=`S/ ${money.toFixed(2)}`;$('#summaryPurchases').textContent=products;
  const byBrand={};state.session.forEach(x=>{const b=x.product.brand;byBrand[b]??={products:0,pairs:0,total:0};byBrand[b].products++;byBrand[b].pairs+=x.pairs;byBrand[b].total+=x.pairs*x.price});
  $('#brandSummary').innerHTML=Object.entries(byBrand).map(([b,v])=>`<div class="brand-box"><div><strong>${b}</strong><small>${v.products} productos · ${v.pairs} pares</small></div><span class="brand-total">S/ ${v.total.toFixed(2)}</span></div>`).join('');
  $('#summaryTable').innerHTML=state.session.map(x=>`<tr><td><strong>${x.purchase}</strong><br><small>${x.date}</small></td><td><strong>${x.product.code}</strong><br><small>${x.product.category} · ${x.product.color}</small></td><td>${x.product.brand}</td><td>${x.sizes.map(s=>`${s.size}:${s.qty}`).join(' · ')}</td><td>${x.pairs}</td><td>S/ ${x.price.toFixed(2)}</td><td>S/ ${(x.pairs*x.price).toFixed(2)}</td></tr>`).join('');
  show('screen-success');
}

$('#btnBack').onclick=()=>{
  const map={'screen-identify':'screen-home','screen-gallery':'screen-identify','screen-register':'screen-gallery','screen-new':'screen-gallery','screen-success':'screen-home'};
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
$('#btnFinish').onclick=()=>{state.session=[];show('screen-home');toast('Sesión finalizada.')};
$('#btnContinueFromSummary').onclick=()=>{state.filters={brand:'',category:'',color:'',code:''};$('#brandInput').value='';$('#categorySelect').value='';updateColors();$('#codeInput').value='';show('screen-identify')};
$('#btnConsult').onclick=()=>toast('En este prototipo, Consultar Compras aún no está conectado.');
$('#photoUpload').onclick=()=>toast('Carga de fotografía simulada en este prototipo.');

$('#purchaseDate').value=today;$('#btnBack').style.visibility='hidden';
