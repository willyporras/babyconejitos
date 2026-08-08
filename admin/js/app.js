// Estado de la Aplicación
let AppState = {
  pantallaActual: "ventas",
  stock: [...MOCK_STOCK],
  compras: [...MOCK_COMPRAS],
  ventas: [...MOCK_VENTAS],
  productoSeleccionado: null,
  tallaSeleccionada: null
};

// Inicialización
document.addEventListener("DOMContentLoaded", () => {
  cargarOpcionesFiltros();
  renderizarGaleriaVentas();
  renderizarGaleriaCompras();
  renderizarTablaStock();
});

// Navegación por Pestañas
function navegar(pantalla) {
  AppState.pantallaActual = pantalla;
  document.querySelectorAll(".pantalla").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));

  document.getElementById(`pantalla-${pantalla}`).classList.add("active");
  event.currentTarget.classList.add("active");
}

// Carga de Filtros Dinámicos
function cargarOpcionesFiltros() {
  const marcas = [...new Set(AppState.stock.map(item => item.marca))];
  const colores = [...new Set(AppState.stock.map(item => item.color))];

  const selectMarcaVentas = document.getElementById("venta-filtro-marca");
  const selectColorVentas = document.getElementById("venta-filtro-color");
  const selectMarcaCompras = document.getElementById("compra-filtro-marca");
  const selectColorCompras = document.getElementById("compra-filtro-color");

  marcas.forEach(m => {
    selectMarcaVentas.add(new Option(m, m));
    selectMarcaCompras.add(new Option(m, m));
  });

  colores.forEach(c => {
    selectColorVentas.add(new Option(c, c));
    selectColorCompras.add(new Option(c, c));
  });
}

// Renderizado de Galería para Ventas
function renderizarGaleriaVentas(filtrados = null) {
  const contenedor = document.getElementById("galeria-ventas");
  contenedor.innerHTML = "";

  const lista = filtrados || AppState.stock.filter(item => item.codigo !== "S000");

  lista.forEach(prod => {
    const totalStock = Object.values(prod.tallas).reduce((a, b) => a + b, 0);
    const card = document.createElement("div");
    card.className = "card-producto";
    card.onclick = () => abrirModalVenta(prod);
    card.innerHTML = `
      <div class="card-img-placeholder">👟</div>
      <div class="card-title">${prod.codigo} - ${prod.marca}</div>
      <div class="card-subtitle">${prod.tipo} | ${prod.color}</div>
      <div class="card-subtitle" style="margin-top:4px; font-weight:bold; color: ${totalStock > 0 ? '#16a34a' : '#dc2626'}">
        Stock: ${totalStock} pares
      </div>
    `;
    contenedor.appendChild(card);
  });
}

// Filtrado en Ventas
function filtrarGaleriaVentas() {
  const marca = document.getElementById("venta-filtro-marca").value;
  const color = document.getElementById("venta-filtro-color").value;

  const resultado = AppState.stock.filter(item => {
    return (marca === "" || item.marca === marca) &&
           (color === "" || item.color === color) &&
           item.codigo !== "S000";
  });

  renderizarGaleriaVentas(resultado);
}

function resetFiltrosVentas() {
  document.getElementById("venta-filtro-marca").value = "";
  document.getElementById("venta-filtro-color").value = "";
  renderizarGaleriaVentas();
}

// Modal de Venta
function abrirModalVenta(producto) {
  AppState.productoSeleccionado = producto;
  AppState.tallaSeleccionada = null;

  const modalBody = document.getElementById("modal-body");
  
  let botonesTallasHTML = "";
  for (const [talla, cantidad] of Object.entries(producto.tallas)) {
    const disabled = cantidad <= 0 ? "disabled" : "";
    botonesTallasHTML += `
      <button class="btn-talla" ${disabled} onclick="seleccionarTallaVenta('${talla}', this)">
        T-${talla}<br><small>(${cantidad})</small>
      </button>
    `;
  }

  modalBody.innerHTML = `
    <h3>Vender: ${producto.codigo}</h3>
    <p class="subtitle">${producto.marca} | ${producto.tipo} | ${producto.color}</p>
    
    <label style="font-size:12px; font-weight:bold;">1. Selecciona Talla (Solo disponible > 0):</label>
    <div class="grid-tallas">${botonesTallasHTML}</div>

    <div class="form-group" style="margin-top:12px;">
      <label>2. Precio Final de Venta (S/):</label>
      <input type="number" id="venta-precio-input" value="${producto.precioReferencial}">
    </div>

    <button class="btn-primary" style="width:100%; margin-top:16px;" onclick="confirmarVenta()">Confirmar Venta</button>
  `;

  document.getElementById("modal-accion").classList.remove("hidden");
}

function seleccionarTallaVenta(talla, el) {
  document.querySelectorAll(".btn-talla").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  AppState.tallaSeleccionada = talla;
}

function confirmarVenta() {
  if (!AppState.tallaSeleccionada) {
    alert("Por favor selecciona una talla disponible.");
    return;
  }

  const precio = parseFloat(document.getElementById("venta-precio-input").value);
  const prod = AppState.productoSeleccionado;

  // Registrar venta
  const nuevaVenta = {
    id: `V-${String(AppState.ventas.length + 1).padStart(4, '0')}`,
    fecha: new Date().toISOString().split('T')[0],
    codigo: prod.codigo,
    talla: AppState.tallaSeleccionada,
    precio: precio,
    socio: prod.socio
  };

  AppState.ventas.push(nuevaVenta);

  // Descontar del Stock
  prod.tallas[AppState.tallaSeleccionada] -= 1;

  cerrarModal();
  renderizarGaleriaVentas();
  renderizarTablaStock();
  alert(`✅ Venta registrada con éxito: ${nuevaVenta.id}`);
}

// Venta Especial S000 (Liquidación)
function abrirVentaS000() {
  const s000 = AppState.stock.find(i => i.codigo === "S000");
  abrirModalVenta(s000);
}

// Renderizado de Galería para Compras
function renderizarGaleriaCompras(filtrados = null) {
  const contenedor = document.getElementById("galeria-compras");
  contenedor.innerHTML = "";

  const lista = filtrados || AppState.stock.filter(item => item.codigo !== "S000");

  lista.forEach(prod => {
    const card = document.createElement("div");
    card.className = "card-producto";
    card.onclick = () => abrirModalReposicion(prod);
    card.innerHTML = `
      <div class="card-img-placeholder">📦</div>
      <div class="card-title">${prod.codigo} - ${prod.marca}</div>
      <div class="card-subtitle">${prod.tipo} | ${prod.color}</div>
      <button class="btn-secondary" style="margin-top:6px; font-size:11px; padding:4px 8px;">+ Reponer Tallas</button>
    `;
    contenedor.appendChild(card);
  });
}

function filtrarGaleriaCompras() {
  const marca = document.getElementById("compra-filtro-marca").value;
  const color = document.getElementById("compra-filtro-color").value;

  const resultado = AppState.stock.filter(item => {
    return (marca === "" || item.marca === marca) &&
           (color === "" || item.color === color) &&
           item.codigo !== "S000";
  });

  renderizarGaleriaCompras(resultado);
}

// Modal Reposición de Compras
function abrirModalReposicion(producto) {
  AppState.productoSeleccionado = producto;

  const modalBody = document.getElementById("modal-body");
  
  let inputsTallasHTML = "";
  for (const [talla, cantidad] of Object.entries(producto.tallas)) {
    inputsTallasHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:13px; font-weight:bold;">Talla ${talla} (Actual: ${cantidad}):</span>
        <input type="number" class="input-repo-talla" data-talla="${talla}" value="0" min="0" style="width:70px; text-align:center;">
      </div>
    `;
  }

  modalBody.innerHTML = `
    <h3>Reponer Stock: ${producto.codigo}</h3>
    <p class="subtitle">${producto.marca} | ${producto.color}</p>

    <div style="max-height:200px; overflow-y:auto; margin:10px 0;">
      ${inputsTallasHTML}
    </div>

    <div class="form-group">
      <label>Costo Total del Lote Comprado (S/):</label>
      <input type="number" id="compra-costo-input" value="0">
    </div>

    <button class="btn-primary" style="width:100%; margin-top:16px;" onclick="confirmarReposicion()">Guardar Entrada de Compras</button>
  `;

  document.getElementById("modal-accion").classList.remove("hidden");
}

function confirmarReposicion() {
  const inputs = document.querySelectorAll(".input-repo-talla");
  const prod = AppState.productoSeleccionado;
  let totalNuevosPares = 0;

  inputs.forEach(inp => {
    const talla = inp.dataset.talla;
    const cant = parseInt(inp.value) || 0;
    if (cant > 0) {
      prod.tallas[talla] += cant;
      totalNuevosPares += cant;
    }
  });

  if (totalNuevosPares === 0) {
    alert("Ingresa al menos 1 par en alguna talla.");
    return;
  }

  const costo = parseFloat(document.getElementById("compra-costo-input").value) || 0;

  AppState.compras.push({
    id: `C-${String(AppState.compras.length + 1).padStart(4, '0')}`,
    fecha: new Date().toISOString().split('T')[0],
    codigo: prod.codigo,
    ingreso: "Reposicion",
    pares: totalNuevosPares,
    costo: costo,
    socio: prod.socio
  });

  cerrarModal();
  renderizarTablaStock();
  alert(`✅ Reposición de ${totalNuevosPares} pares ingresada a inventario.`);
}

// Formulario Producto Nuevo
function abrirFormularioNuevoProducto() {
  const modalBody = document.getElementById("modal-body");

  modalBody.innerHTML = `
    <h3>Registrar Modelo Nuevo</h3>
    <div class="form-group" style="margin-top:8px;">
      <label>Categoría:</label>
      <select id="nuevo-cat">
        <option value="PibeNiña">PibeNiña (A000)</option>
        <option value="PibeNiño">PibeNiño (000)</option>
        <option value="ZapatoNiño">ZapatoNiño (ZN000)</option>
        <option value="ZapatoBebe">ZapatoBebe (B000)</option>
      </select>
    </div>
    <div class="form-group" style="margin-top:8px;">
      <label>Marca:</label>
      <input type="text" id="nuevo-marca" placeholder="Ej. Garley">
    </div>
    <div class="form-group" style="margin-top:8px;">
      <label>Tipo:</label>
      <input type="text" id="nuevo-tipo" placeholder="Ej. Sandalia">
    </div>
    <div class="form-group" style="margin-top:8px;">
      <label>Color:</label>
      <input type="text" id="nuevo-color" placeholder="Ej. Rosado">
    </div>
    <div class="form-group" style="margin-top:8px;">
      <label>Socio Asignado:</label>
      <select id="nuevo-socio">
        <option value="D">Socio D</option>
        <option value="W">Socio W</option>
      </select>
    </div>

    <button class="btn-primary" style="width:100%; margin-top:16px;" onclick="guardarNuevoProducto()">Generar Código y Guardar</button>
  `;

  document.getElementById("modal-accion").classList.remove("hidden");
}

function guardarNuevoProducto() {
  const cat = document.getElementById("nuevo-cat").value;
  const marca = document.getElementById("nuevo-marca").value || "Generica";
  const tipo = document.getElementById("nuevo-tipo").value || "Estandar";
  const color = document.getElementById("nuevo-color").value || "Varios";
  const socio = document.getElementById("nuevo-socio").value;

  // Autogenerar código según la regla
  let prefijo = "";
  if (cat === "PibeNiña") prefijo = "A";
  else if (cat === "ZapatoNiño") prefijo = "ZN";
  else if (cat === "ZapatoBebe") prefijo = "B";

  const num = Math.floor(100 + Math.random() * 899);
  const nuevoCodigo = prefijo ? `${prefijo}${num}` : String(num).padStart(3, '0');

  const nuevoItem = {
    codigo: nuevoCodigo,
    marca: marca,
    categoria: cat,
    tipo: tipo,
    color: color,
    socio: socio,
    precioReferencial: 35,
    tallas: { 17: 0, 18: 0, 19: 0, 20: 0, 21: 0, 22: 0 }
  };

  AppState.stock.push(nuevoItem);
  cerrarModal();
  renderizarGaleriaCompras();
  renderizarGaleriaVentas();
  renderizarTablaStock();
  alert(`✨ Nuevo modelo registrado con código asignado: ${nuevoCodigo}`);
}

// Renderizado de Tabla de Inventario
function renderizarTablaStock() {
  const contenedor = document.getElementById("tabla-stock-container");
  
  let rowsHTML = "";
  AppState.stock.forEach(item => {
    const total = Object.values(item.tallas).reduce((a, b) => a + b, 0);
    rowsHTML += `
      <tr>
        <td><strong>${item.codigo}</strong></td>
        <td>${item.marca}</td>
        <td>${item.tipo}</td>
        <td>${item.color}</td>
        <td>Socio ${item.socio}</td>
        <td><strong>${total}</strong></td>
      </tr>
    `;
  });

  contenedor.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Marca</th>
          <th>Tipo</th>
          <th>Color</th>
          <th>Socio</th>
          <th>Total Pares</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHTML}
      </tbody>
    </table>
  `;
}

function buscarEnStock() {
  const q = document.getElementById("input-buscar-stock").value.toLowerCase();
  const filtrados = AppState.stock.filter(i => 
    i.codigo.toLowerCase().includes(q) ||
    i.marca.toLowerCase().includes(q) ||
    i.color.toLowerCase().includes(q)
  );
  
  const contenedor = document.getElementById("tabla-stock-container");
  let rowsHTML = "";
  filtrados.forEach(item => {
    const total = Object.values(item.tallas).reduce((a, b) => a + b, 0);
    rowsHTML += `
      <tr>
        <td><strong>${item.codigo}</strong></td>
        <td>${item.marca}</td>
        <td>${item.tipo}</td>
        <td>${item.color}</td>
        <td>Socio ${item.socio}</td>
        <td><strong>${total}</strong></td>
      </tr>
    `;
  });

  contenedor.querySelector("tbody").innerHTML = rowsHTML;
}

function cerrarModal() {
  document.getElementById("modal-accion").classList.add("hidden");
}