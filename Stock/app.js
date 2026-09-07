const READ_ONLY_MODE = true;

let products = [];

const STOCK_API_URL = (window.STOCK_CONFIG && window.STOCK_CONFIG.apiUrl || "").trim();
const STOCK_LOAD_TIMEOUT_MS = 15000;


/* =========================================================
   NORMALIZACIÓN DE PRODUCTOS
   Acepta tanto nombres en inglés como en español.
   ========================================================= */
function normalizeProduct(raw){

  const sourceSizes =
    raw.sizes ||
    raw.tallas ||
    {};

  const sizes = {};

  Object.entries(sourceSizes).forEach(([s,q])=>{
    const n = Number(
      String(q ?? 0).replace(",",".")
    );

    sizes[String(Number(s))] =
      Number.isFinite(n) ? n : 0;
  });

  return {
    code: String(
      raw.code ??
      raw.codigo ??
      ""
    ).trim(),

    brand: String(
      raw.brand ??
      raw.marca ??
      ""
    ).trim(),

    category: String(
      raw.category ??
      raw.categoria ??
      ""
    ).trim(),

    type: String(
      raw.type ??
      raw.tipo ??
      ""
    ).trim(),

    color: String(
      raw.color ??
      ""
    ).trim(),

    detail: String(
      raw.detail ??
      raw.detalle ??
      ""
    ).trim(),

    sizes,

    imageUrl: String(
      raw.imageUrl ??
      raw.imagen ??
      ""
    ).trim(),

    icon: "👟"
  };
}


/* =========================================================
   ESTADO DE CONEXIÓN
   ========================================================= */
function setDataStatus(message, kind="info"){
  const el=document.getElementById("dataStatus");

  if(!el) return;

  el.textContent=message;
  el.dataset.kind=kind;
}


/* =========================================================
   CARGA DE STOCK DESDE GOOGLE APPS SCRIPT
   Utiliza JSONP.
   ========================================================= */
function loadStockData(){

  return new Promise((resolve,reject)=>{

    if(!STOCK_API_URL){
      reject(
        new Error(
          "Falta configurar la URL de la API de Stock."
        )
      );
      return;
    }

    const callbackName =
      `__stockCallback_${Date.now()}`;

    const script =
      document.createElement("script");

    let finished=false;

    const cleanup=()=>{
      delete window[callbackName];
      script.remove();
    };

    const timer=setTimeout(()=>{

      if(finished) return;

      finished=true;
      cleanup();

      reject(
        new Error(
          "La consulta de Stock tardó demasiado."
        )
      );

    },STOCK_LOAD_TIMEOUT_MS);


    window[callbackName]=(payload)=>{

      if(finished) return;

      finished=true;

      clearTimeout(timer);

      cleanup();


      /*
       * La API actual devuelve:
       *
       * productos
       *
       * pero dejamos compatibilidad
       * con "products" por si más adelante
       * cambia la API.
       */
      const rows =
        Array.isArray(payload?.products)
          ? payload.products
          : Array.isArray(payload?.productos)
            ? payload.productos
            : null;


      if(
        !payload ||
        payload.ok !== true ||
        !rows
      ){

        reject(
          new Error(
            payload && payload.error
              ? payload.error
              : "Respuesta inválida de la API de Stock."
          )
        );

        return;
      }


      products = rows
        .map(normalizeProduct)
        .filter(p=>p.code);


      resolve(payload);
    };


    script.onerror=()=>{

      if(finished) return;

      finished=true;

      clearTimeout(timer);

      cleanup();

      reject(
        new Error(
          "No se pudo conectar con la API de Stock."
        )
      );
    };


    const sep =
      STOCK_API_URL.includes("?")
        ? "&"
        : "?";


    script.src =
      `${STOCK_API_URL}${sep}` +
      `callback=${encodeURIComponent(callbackName)}` +
      `&_=${Date.now()}`;


    document.head.appendChild(script);
  });
}


/* =========================================================
   REPRESENTACIÓN VISUAL DEL PRODUCTO
   ========================================================= */
function productVisual(p, thumb=false){

  if(p.imageUrl){

    return `
      <img
        class="product-image${thumb?" thumb":""}"
        src="${escapeHtml(p.imageUrl)}"
        alt="Código ${escapeHtml(p.code)}"
        loading="lazy"
        referrerpolicy="no-referrer"
      >
    `;
  }

  return p.icon || "👟";
}


/* =========================================================
   ESTADO GENERAL DE LA APP
   ========================================================= */
const app = {
  current:"screenInicio",
  previous:"screenInicio",
  selectedProduct:null,
  selectedCoverage:null
};


/* =========================================================
   UTILIDADES DE STOCK
   ========================================================= */
function totalStock(p){
  return Object
    .values(p.sizes)
    .reduce(
      (a,b)=>a+Number(b||0),
      0
    );
}


function unique(field){

  return [
    ...new Set(
      products
        .map(p=>p[field])
        .filter(Boolean)
    )
  ]
  .sort(
    (a,b)=>
      String(a)
        .localeCompare(
          String(b),
          "es"
        )
  );
}


function allSizes(){

  return [
    ...new Set(
      products.flatMap(
        p=>
          Object
            .keys(p.sizes)
            .map(Number)
      )
    )
  ]
  .sort((a,b)=>a-b);
}


function fillSelect(id, values, first){

  const el=
    document.getElementById(id);

  el.innerHTML=
    `<option value="">${first}</option>`+
    values
      .map(
        v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`
      )
      .join("");
}


/* =========================================================
   FILTROS INICIALES
   ========================================================= */
function initFilters(){

  fillSelect(
    "cobCategoria",
    unique("category"),
    "Seleccionar"
  );

  fillSelect(
    "busMarca",
    unique("brand"),
    "Todas"
  );

  fillSelect(
    "busCategoria",
    unique("category"),
    "Todas"
  );

  fillSelect(
    "busTipo",
    unique("type"),
    "Todos"
  );

  fillSelect(
    "busTalla",
    allSizes(),
    "Todas"
  );

  updateSearchColors();
}


/* =========================================================
   NAVEGACIÓN
   ========================================================= */
function setBreadcrumb(screen){

  const map={

    screenInicio:
      "Inicio > Stock",

    screenCobertura:
      "Stock > Cobertura",

    screenBuscar:
      "Stock > Buscar producto",

    screenDetalle:
      "Stock > Detalle",

    screenAjuste:
      "Stock > Detalle > Ajuste",

    screenHistorial:
      "Stock > Detalle > Historial"
  };

  document
    .getElementById("breadcrumb")
    .textContent =
      map[screen] || "Stock";
}


function showScreen(id, preserve=true){

  if(!document.getElementById(id))
    return;

  app.previous =
    app.current;

  app.current =
    id;

  document
    .querySelectorAll(".screen")
    .forEach(
      s=>s.classList.remove("active")
    );

  document
    .getElementById(id)
    .classList.add("active");

  setBreadcrumb(id);

  window.scrollTo({
    top:0,
    behavior:"smooth"
  });
}


function resetTemporary(){

  document
    .getElementById("cobCategoria")
    .value="";

  updateCoverageColors();

  document
    .getElementById(
      "coberturaResultado"
    )
    .classList.add("hidden");

  clearSearch();

  app.selectedCoverage=null;
  app.selectedProduct=null;
}


/* =========================================================
   TOAST
   ========================================================= */
function toast(msg){

  const t=
    document.getElementById("toast");

  t.textContent=msg;

  t.classList.add("show");

  clearTimeout(toast.timer);

  toast.timer =
    setTimeout(
      ()=>t.classList.remove("show"),
      1900
    );
}


/* =========================================================
   BOTONES GENERALES
   ========================================================= */
document.addEventListener(
  "click",
  e=>{

    const go =
      e.target.closest("[data-go]");

    if(go){

      if(
        go.dataset.reset==="true"
      ){
        resetTemporary();
      }

      showScreen(
        go.dataset.go
      );
    }
  }
);


document
  .getElementById("btnHome")
  .addEventListener(
    "click",
    ()=>{
      resetTemporary();
      showScreen("screenInicio");
    }
  );


document
  .getElementById("btnBack")
  .addEventListener(
    "click",
    ()=>{

      if(
        app.current==="screenInicio"
      )
        return;

      if(
        app.current==="screenDetalle"
      )
        return showScreen(
          app.previous==="screenCobertura"
            ? "screenCobertura"
            : "screenBuscar"
        );

      if(
        app.current==="screenAjuste" ||
        app.current==="screenHistorial"
      )
        return showScreen(
          "screenDetalle"
        );

      showScreen(
        "screenInicio"
      );
    }
  );


/* =========================================================
   COBERTURA
   ========================================================= */
document
  .getElementById("cobCategoria")
  .addEventListener(
    "change",
    updateCoverageColors
  );


function updateCoverageColors(){

  const cat =
    document
      .getElementById("cobCategoria")
      .value;

  const color =
    document
      .getElementById("cobColor");


  if(!cat){

    color.disabled=true;

    color.innerHTML=
      '<option value="">Seleccionar categoría primero</option>';

    return;
  }


  const colors=[
    ...new Set(
      products
        .filter(
          p=>p.category===cat
        )
        .map(
          p=>p.color
        )
        .filter(Boolean)
    )
  ]
  .sort(
    (a,b)=>
      a.localeCompare(
        b,
        "es"
      )
  );


  color.disabled=false;

  color.innerHTML=
    '<option value="">Seleccionar</option>'+
    colors
      .map(
        c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      )
      .join("");
}


/* =========================================================
   COLORES DE BÚSQUEDA
   ========================================================= */
document
  .getElementById("busCategoria")
  .addEventListener(
    "change",
    updateSearchColors
  );


function updateSearchColors(){

  const cat =
    document
      .getElementById("busCategoria")
      .value;

  const color =
    document
      .getElementById("busColor");


  if(!cat){

    color.disabled=true;

    color.innerHTML=
      '<option value="">Seleccionar categoría primero</option>';

    return;
  }


  const colors=[
    ...new Set(
      products
        .filter(
          p=>p.category===cat
        )
        .map(
          p=>p.color
        )
        .filter(Boolean)
    )
  ]
  .sort(
    (a,b)=>
      a.localeCompare(
        b,
        "es"
      )
  );


  color.disabled=false;

  color.innerHTML=
    '<option value="">Todos</option>'+
    colors
      .map(
        c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`
      )
      .join("");
}


/* =========================================================
   LIMPIAR COBERTURA
   ========================================================= */
document
  .getElementById(
    "btnLimpiarCobertura"
  )
  .addEventListener(
    "click",
    ()=>{

      document
        .getElementById(
          "cobCategoria"
        )
        .value="";

      updateCoverageColors();

      document
        .getElementById(
          "coberturaResultado"
        )
        .classList.add(
          "hidden"
        );
    }
  );


/* =========================================================
   VER COBERTURA
   ========================================================= */
document
  .getElementById(
    "btnVerCobertura"
  )
  .addEventListener(
    "click",
    ()=>{

      const cat =
        document
          .getElementById(
            "cobCategoria"
          )
          .value;

      const color =
        document
          .getElementById(
            "cobColor"
          )
          .value;


      if(!cat || !color){

        return toast(
          "Selecciona categoría y color."
        );
      }


      const matches =
        products.filter(
          p=>
            p.category===cat &&
            p.color===color
        );


      if(!matches.length){

        return toast(
          "No hay productos para esa combinación."
        );
      }


      const sizes={};


      matches.forEach(
        p=>
          Object
            .entries(p.sizes)
            .forEach(
              ([s,q])=>
                sizes[s]=
                  (sizes[s]||0)+
                  Number(q||0)
            )
      );


      const sorted =
        Object
          .keys(sizes)
          .map(Number)
          .sort(
            (a,b)=>a-b
          );


      const total =
        Object
          .values(sizes)
          .reduce(
            (a,b)=>a+b,
            0
          );


      app.selectedCoverage={
        cat,
        color,
        matches,
        sizes
      };


      document
        .getElementById(
          "coberturaNombre"
        )
        .textContent=
          `${cat} · ${color}`;


      document
        .getElementById(
          "coberturaTotal"
        )
        .textContent=
          `${total} ${
            total===1
              ? "par"
              : "pares"
          }`;


      document
        .getElementById(
          "coberturaTallas"
        )
        .innerHTML=
          sorted.map(
            s=>`
              <div class="size-box ${
                sizes[s]===0
                  ? "zero"
                  : ""
              }">
                <span>
                  Talla ${s}
                </span>
                <strong>
                  ${sizes[s]}
                </strong>
                <span>
                  ${
                    sizes[s]===1
                      ? "par"
                      : "pares"
                  }
                </span>
              </div>
            `
          ).join("");


      const zero=
        sorted.filter(
          s=>sizes[s]===0
        );


      const low=
        sorted.filter(
          s=>sizes[s]===1
        );


      document
        .getElementById(
          "coberturaLectura"
        )
        .textContent=
          zero.length
            ?
              `Sin stock en tallas: ${zero.join(", ")}. ${
                low.length
                  ? `Con solo 1 par: ${low.join(", ")}.`
                  : ""
              }`
            :
          low.length
            ?
              `Todas las tallas tienen cobertura, pero solo queda 1 par en: ${low.join(", ")}.`
            :
              "La combinación tiene cobertura en todas las tallas mostradas.";


      document
        .getElementById(
          "coberturaCodigos"
        )
        .classList.add(
          "hidden"
        );


      document
        .getElementById(
          "coberturaResultado"
        )
        .classList.remove(
          "hidden"
        );
    }
  );


/* =========================================================
   MOSTRAR CÓDIGOS DE COBERTURA
   ========================================================= */
document
  .getElementById(
    "btnVerCodigosCobertura"
  )
  .addEventListener(
    "click",
    ()=>{

      if(
        !app.selectedCoverage
      )
        return;

      renderCoverageProducts();

      document
        .getElementById(
          "coberturaCodigos"
        )
        .classList.toggle(
          "hidden"
        );
    }
  );


function renderCoverageProducts(){

  const box=
    document.getElementById(
      "listaCodigosCobertura"
    );


  box.innerHTML=
    app.selectedCoverage.matches
      .map(
        p=>`
          <div class="product-row">

            <div class="product-thumb">
              ${productVisual(p,true)}
            </div>

            <div>

              <strong>
                Código ${escapeHtml(p.code)}
              </strong>
              <br>

              <small>
                <b>${escapeHtml(p.brand)}</b>
              </small>
              <br>

              <small>
                ${escapeHtml(p.type)}
              </small>
              <br>

              <small>
                <b>Tallas:</b>
                ${formatStock(p.sizes)}
              </small>

            </div>

            <button
              data-open="${escapeHtml(p.code)}"
              data-origin="coverage"
            >
              Ver detalle
            </button>

          </div>
        `
      )
      .join("");
}


document
  .getElementById(
    "listaCodigosCobertura"
  )
  .addEventListener(
    "click",
    e=>{

      const btn=
        e.target.closest(
          "[data-open]"
        );

      if(btn){

        openProduct(
          btn.dataset.open,
          "screenCobertura"
        );
      }
    }
  );


/* =========================================================
   BÚSQUEDA
   ========================================================= */
function clearSearch(){

  [
    "busCodigo",
    "busMarca",
    "busCategoria",
    "busTipo",
    "busColor",
    "busTalla"
  ]
  .forEach(
    id=>{

      const el=
        document.getElementById(id);

      if(el)
        el.value="";
    }
  );


  document
    .getElementById(
      "busIncluirCero"
    )
    .checked=true;


  updateSearchColors();


  document
    .getElementById(
      "buscarResultado"
    )
    .classList.add(
      "hidden"
    );


  document
    .getElementById(
      "galeriaProductos"
    )
    .innerHTML="";
}


document
  .getElementById(
    "btnLimpiarBusqueda"
  )
  .addEventListener(
    "click",
    clearSearch
  );


document
  .getElementById(
    "btnBuscar"
  )
  .addEventListener(
    "click",
    ()=>{

      const code=
        document
          .getElementById(
            "busCodigo"
          )
          .value
          .trim()
          .toLowerCase();


      const includeZero=
        document
          .getElementById(
            "busIncluirCero"
          )
          .checked;


      let result=[
        ...products
      ];


      if(code){

        result=
          result.filter(
            p=>
              p.code
                .toLowerCase()
                .includes(code)
          );

      }else{

        const filters={

          brand:
            document
              .getElementById(
                "busMarca"
              )
              .value,

          category:
            document
              .getElementById(
                "busCategoria"
              )
              .value,

          type:
            document
              .getElementById(
                "busTipo"
              )
              .value,

          color:
            document
              .getElementById(
                "busColor"
              )
              .value
        };


        Object
          .entries(filters)
          .forEach(
            ([k,v])=>{

              if(v){

                result=
                  result.filter(
                    p=>p[k]===v
                  );
              }
            }
          );


        const talla=
          document
            .getElementById(
              "busTalla"
            )
            .value;


        if(talla){

          result=
            result.filter(
              p=>
                Number(
                  p.sizes[talla] || 0
                ) > 0
            );
        }
      }


      result=
        result.filter(
          p=>{

            if(totalStock(p)>0)
              return true;

            return includeZero;
          }
        );


      result.sort(
        (a,b)=>
          totalStock(b)-
          totalStock(a) ||
          a.code.localeCompare(
            b.code
          )
      );


      renderSearch(result);
    }
  );


function renderSearch(result){

  const wrap=
    document.getElementById(
      "buscarResultado"
    );

  const gal=
    document.getElementById(
      "galeriaProductos"
    );


  document
    .getElementById(
      "resultadoCantidad"
    )
    .textContent=
      `${result.length} ${
        result.length===1
          ? "resultado"
          : "resultados"
      }`;


  if(!result.length){

    gal.innerHTML=
      `
        <div
          class="info-card"
          style="grid-column:1/-1"
        >
          <strong>
            Sin coincidencias
          </strong>

          <p>
            Prueba con menos filtros
            o revisa el código.
          </p>

        </div>
      `;

  }else{

    gal.innerHTML=
      result
        .map(
          p=>`

            <button
              class="product-card ${
                totalStock(p)===0
                  ? "zero-stock"
                  : ""
              }"
              data-product="${escapeHtml(p.code)}"
            >

              <div class="shoe-art">
                ${productVisual(p)}
              </div>

              <strong>
                Código ${escapeHtml(p.code)}
              </strong>

              <small>
                <b>${escapeHtml(p.brand)}</b>
              </small>

              <small>
                ${escapeHtml(p.type)}
              </small>

              <small>
                <b>Tallas:</b>
                ${formatStock(p.sizes)}
              </small>

            </button>

          `
        )
        .join("");
  }


  wrap.classList.remove(
    "hidden"
  );
}


document
  .getElementById(
    "galeriaProductos"
  )
  .addEventListener(
    "click",
    e=>{

      const card=
        e.target.closest(
          "[data-product]"
        );

      if(card){

        openProduct(
          card.dataset.product,
          "screenBuscar"
        );
      }
    }
  );


function formatStock(sizes){

  const parts=
    Object
      .entries(sizes)

      .filter(
        ([,q])=>
          Number(q)>0
      )

      .sort(
        (a,b)=>
          Number(a[0])-
          Number(b[0])
      )

      .map(
        ([s,q])=>
          q===1
            ? `${s}`
            : `${s} (${q})`
      );


  return parts.length
    ? parts.join(", ")
    : "Sin stock";
}


/* =========================================================
   DETALLE
   ========================================================= */
function openProduct(
  code,
  origin="screenBuscar"
){

  const p=
    products.find(
      x=>x.code===code
    );


  if(!p)
    return;


  app.selectedProduct=p;
  app.previous=origin;


  document
    .getElementById(
      "detalleArte"
    )
    .innerHTML=
      productVisual(p);


  document
    .getElementById(
      "detalleCodigo"
    )
    .textContent=
      `Código ${p.code}`;


  document
    .getElementById(
      "detalleMarca"
    )
    .textContent=
      p.brand;


  document
    .getElementById(
      "detalleCategoria"
    )
    .textContent=
      p.category;


  document
    .getElementById(
      "detalleTipo"
    )
    .textContent=
      p.type;


  document
    .getElementById(
      "detalleTotal"
    )
    .textContent=
      totalStock(p);


  document
    .getElementById(
      "detalleTexto"
    )
    .textContent=
      p.detail ||
      "Sin detalle adicional";


  document
    .getElementById(
      "detalleTallas"
    )
    .innerHTML=
      Object
        .keys(p.sizes)
        .map(Number)
        .sort(
          (a,b)=>a-b
        )
        .map(
          s=>`

            <div
              class="size-box ${
                p.sizes[s]===0
                  ? "zero"
                  : ""
              }"
            >

              <span>
                Talla ${s}
              </span>

              <strong>
                ${p.sizes[s]}
              </strong>

              <span>
                ${
                  p.sizes[s]===1
                    ? "par"
                    : "pares"
                }
              </span>

            </div>

          `
        )
        .join("");


  const total=
    totalStock(p);


  document
    .getElementById(
      "detalleEstado"
    )
    .textContent=
      total>0
        ?
          "Código activo con existencias disponibles."
        :
          "Código sin existencias. Se muestra porque está activada la opción de incluir stock cero.";


  const btnAjustar=
    document.getElementById(
      "btnAjustar"
    );


  const btnHistorial=
    document.getElementById(
      "btnHistorial"
    );


  btnAjustar.disabled=
    READ_ONLY_MODE;


  btnHistorial.disabled=
    READ_ONLY_MODE;


  btnHistorial
    .classList
    .remove("hidden");


  showScreen(
    "screenDetalle"
  );
}


document
  .getElementById(
    "btnDetalleVolver"
  )
  .addEventListener(
    "click",
    ()=>
      showScreen(
        app.previous ||
        "screenBuscar"
      )
  );


/* =========================================================
   AJUSTE
   ========================================================= */
document
  .getElementById(
    "btnAjustar"
  )
  .addEventListener(
    "click",
    ()=>{

      if(READ_ONLY_MODE){

        return toast(
          "Función no disponible en modo solo consulta."
        );
      }


      const p=
        app.selectedProduct;


      if(!p)
        return;


      document
        .getElementById(
          "ajusteTitulo"
        )
        .textContent=
          `Ajustar código ${p.code}`;


      document
        .getElementById(
          "ajusteOriginal"
        )
        .textContent=
          formatAllStock(
            p.sizes
          );


      const s=
        document
          .getElementById(
            "ajusteTalla"
          );


      s.innerHTML=
        Object
          .keys(p.sizes)
          .map(Number)
          .sort(
            (a,b)=>a-b
          )
          .map(
            n=>`<option>${n}</option>`
          )
          .join("");


      s.value=
        Object
          .keys(p.sizes)[0];


      syncAdjustmentQty();


      document
        .getElementById(
          "ajusteMotivo"
        )
        .value="";


      showScreen(
        "screenAjuste"
      );
    }
  );


function formatAllStock(sizes){

  return Object
    .keys(sizes)
    .map(Number)
    .sort(
      (a,b)=>a-b
    )
    .map(
      s=>`${s}: ${sizes[s]}`
    )
    .join(" · ");
}


function syncAdjustmentQty(){

  const p=
    app.selectedProduct;

  const t=
    document
      .getElementById(
        "ajusteTalla"
      )
      .value;


  document
    .getElementById(
      "ajusteCantidad"
    )
    .value=
      Number(
        p.sizes[t] || 0
      );
}


document
  .getElementById(
    "ajusteTalla"
  )
  .addEventListener(
    "change",
    syncAdjustmentQty
  );


document
  .getElementById(
    "ajusteMenos"
  )
  .addEventListener(
    "click",
    ()=>{

      const el=
        document
          .getElementById(
            "ajusteCantidad"
          );

      el.value=
        Math.max(
          0,
          Number(el.value||0)-1
        );
    }
  );


document
  .getElementById(
    "ajusteMas"
  )
  .addEventListener(
    "click",
    ()=>{

      const el=
        document
          .getElementById(
            "ajusteCantidad"
          );

      el.value=
        Number(
          el.value || 0
        ) + 1;
    }
  );


document
  .getElementById(
    "btnCancelarAjuste"
  )
  .addEventListener(
    "click",
    ()=>showScreen(
      "screenDetalle"
    )
  );


document
  .getElementById(
    "btnGuardarAjuste"
  )
  .addEventListener(
    "click",
    ()=>{

      if(READ_ONLY_MODE){

        return toast(
          "Los ajustes están deshabilitados en esta versión."
        );
      }


      const p=
        app.selectedProduct;


      const talla=
        document
          .getElementById(
            "ajusteTalla"
          )
          .value;


      const nueva=
        Math.max(
          0,
          Number(
            document
              .getElementById(
                "ajusteCantidad"
              )
              .value || 0
          )
        );


      const anterior=
        Number(
          p.sizes[talla] || 0
        );


      const motivo=
        document
          .getElementById(
            "ajusteMotivo"
          )
          .value
          .trim();


      if(
        nueva===anterior
      ){

        return toast(
          "No se detectaron cambios."
        );
      }


      if(!motivo){

        return toast(
          "Indica el motivo del ajuste."
        );
      }


      p.history=
        p.history || [];


      p.history.push({

        at:new Date(),

        size:talla,

        before:anterior,

        after:nueva,

        reason:motivo
      });


      p.sizes[talla]=
        nueva;


      toast(
        "Ajuste guardado correctamente."
      );


      openProduct(
        p.code,
        app.previous
      );
    }
  );


/* =========================================================
   HISTORIAL
   ========================================================= */
document
  .getElementById(
    "btnHistorial"
  )
  .addEventListener(
    "click",
    ()=>{

      if(READ_ONLY_MODE){

        return toast(
          "Historial no disponible en esta versión de consulta."
        );
      }


      renderHistory();

      showScreen(
        "screenHistorial"
      );
    }
  );


function renderHistory(){

  const p=
    app.selectedProduct;


  document
    .getElementById(
      "historialProducto"
    )
    .textContent=
      `Código ${p.code} · ${p.brand} · ${p.category} · ${p.color}`;


  document
    .getElementById(
      "historialLista"
    )
    .innerHTML=
      [...(p.history||[])]
        .reverse()
        .map(
          (h,i)=>{

            const n=
              (p.history||[])
                .length-i;


            const d=
              new Date(h.at);


            const fecha=
              d.toLocaleDateString(
                "es-PE",
                {
                  day:"2-digit",
                  month:"2-digit",
                  year:"2-digit"
                }
              );


            const hora=
              d.toLocaleTimeString(
                "es-PE",
                {
                  hour:"2-digit",
                  minute:"2-digit"
                }
              );


            return `

              <div class="history-card">

                <div class="history-title">
                  Ajuste ${n}
                  realizado el
                  ${fecha}
                  -
                  ${hora}
                </div>

                <div class="history-change">

                  <span>
                    Talla ${h.size}:
                    ${h.before}
                  </span>

                  <span>
                    →
                  </span>

                  <span>
                    ${h.after}
                  </span>

                </div>

                <div class="reason">
                  <b>Motivo:</b>
                  ${escapeHtml(h.reason)}
                </div>

              </div>

            `;
          }
        )
        .join("");
}


document
  .getElementById(
    "btnHistorialVolver"
  )
  .addEventListener(
    "click",
    ()=>
      showScreen(
        "screenDetalle"
      )
  );


/* =========================================================
   ESCAPE HTML
   ========================================================= */
function escapeHtml(s){

  return String(s).replace(
    /[&<>"']/g,
    c=>({
      "&":"&amp;",
      "<":"&lt;",
      ">":"&gt;",
      '"':"&quot;",
      "'":"&#039;"
    }[c])
  );
}


/* =========================================================
   INICIO DE LA APLICACIÓN
   ========================================================= */
setBreadcrumb(
  "screenInicio"
);


setDataStatus(
  "Conectando con Google Sheets…"
);


loadStockData()

  .then(
    payload=>{

      initFilters();


      setDataStatus(
        `Datos reales cargados: ${products.length} códigos.`,
        "ok"
      );


      /*
       * Nuestra API usa "actualizado".
       * Dejamos compatibilidad con
       * "generatedAt" por si más adelante cambia.
       */
      const fechaAPI =
        payload.actualizado ||
        payload.generatedAt ||
        null;


      const ts =
        fechaAPI
          ? new Date(fechaAPI)
          : null;


      if(
        ts &&
        !Number.isNaN(
          ts.getTime()
        )
      ){

        document
          .getElementById(
            "dataStatus"
          )
          .title=
            `Última lectura: ${
              ts.toLocaleString(
                "es-PE"
              )
            }`;
      }
    }
  )

  .catch(
    err=>{

      console.error(err);


      setDataStatus(
        `Sin conexión de datos: ${err.message}`,
        "error"
      );


      toast(
        "No se pudieron cargar los datos reales de Stock."
      );
    }
  );