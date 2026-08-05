/*==================================================
  APP CALZADO
  Version 1.0
==================================================*/


/*=========================================
=            VARIABLES GLOBALES           =
=========================================*/

let marcaSeleccionada = "";
let categoriaSeleccionada = "";
let tipoSeleccionado = "";
let colorSeleccionado = "";

let modeloSeleccionado = null;

let modelosFiltrados = [];



/*=========================================
=            REFERENCIAS DOM              =
=========================================*/

const pantallaInicio =
document.getElementById("pantallaInicio");

const pantallaGaleria =
document.getElementById("pantallaGaleria");

const pantallaRegistro =
document.getElementById("pantallaRegistroCompra");



const listaMarcas =
document.getElementById("listaMarcas");

const galeriaModelos =
document.getElementById("galeriaModelos");



const filtroCategoria =
document.getElementById("filtroCategoria");

const filtroTipo =
document.getElementById("filtroTipo");

const filtroColor =
document.getElementById("filtroColor");



const btnContinuar =
document.getElementById("btnContinuar");

const btnVolverInicio =
document.getElementById("btnVolverInicio");

const btnVolverGaleria =
document.getElementById("volverGaleria");



const templateTarjeta =
document.getElementById("templateTarjeta");

const templateTalla =
document.getElementById("templateTalla");



/*=========================================
=            INICIALIZACION               =
=========================================*/

document.addEventListener("DOMContentLoaded", iniciarAplicacion);



function iniciarAplicacion(){

    mostrarPantalla("inicio");

    cargarMarcas();

    cargarFiltros();

    asignarEventos();

}

/*=========================================
=         CAMBIO DE PANTALLAS             =
=========================================*/

function mostrarPantalla(nombre){

    pantallaInicio.style.display = "none";
    pantallaGaleria.style.display = "none";
    pantallaRegistro.style.display = "none";

    switch(nombre){

        case "inicio":
            pantallaInicio.style.display = "block";
            break;

        case "galeria":
            pantallaGaleria.style.display = "block";
            break;

        case "registro":
            pantallaRegistro.style.display = "block";
            break;

    }

}




/*=========================================
=            CARGAR MARCAS                =
=========================================*/

function cargarMarcas(){

    if(typeof marcas === "undefined") return;

    listaMarcas.innerHTML = "";

    marcas.forEach(function(marca){

        const boton = document.createElement("button");

        boton.className = "btnMarca";

        boton.textContent = marca;

        boton.onclick = function(){

            seleccionarMarca(marca,boton);

        };

        listaMarcas.appendChild(boton);

    });

}




/*=========================================
=         SELECCIONAR MARCA               =
=========================================*/

function seleccionarMarca(marca,boton){

    marcaSeleccionada = marca;

    document
        .querySelectorAll(".btnMarca")
        .forEach(function(b){

            b.classList.remove("marcaActiva");

        });

    boton.classList.add("marcaActiva");

}




/*=========================================
=          CARGAR FILTROS                 =
=========================================*/

function cargarFiltros(){

    llenarSelect(filtroCategoria,categorias);

    llenarSelect(filtroTipo,tipos);

    llenarSelect(filtroColor,colores);

}




function llenarSelect(select,datos){

    if(!select) return;

    select.innerHTML = "";

    const opcion =
    document.createElement("option");

    opcion.value = "";

    opcion.textContent = "Todos";

    select.appendChild(opcion);

    datos.forEach(function(item){

        const op =
        document.createElement("option");

        op.value = item;

        op.textContent = item;

        select.appendChild(op);

    });

}




/*=========================================
=            EVENTOS                      =
=========================================*/

function asignarEventos(){

    btnContinuar.addEventListener("click",function(){

        if(marcaSeleccionada===""){

            alert("Selecciona una marca.");

            return;

        }

        aplicarFiltros();

        mostrarPantalla("galeria");

    });





    btnVolverInicio.addEventListener("click",function(){

        mostrarPantalla("inicio");

    });





    btnVolverGaleria.addEventListener("click",function(){

        mostrarPantalla("galeria");

    });





    filtroCategoria.addEventListener("change",aplicarFiltros);

    filtroTipo.addEventListener("change",aplicarFiltros);

    filtroColor.addEventListener("change",aplicarFiltros);

}

/*=========================================
=          FILTRAR MODELOS                =
=========================================*/

function aplicarFiltros(){

    categoriaSeleccionada = filtroCategoria.value;
    tipoSeleccionado = filtroTipo.value;
    colorSeleccionado = filtroColor.value;

    modelosFiltrados = modelos.filter(function(modelo){

        if(modelo.marca !== marcaSeleccionada)
            return false;

        if(categoriaSeleccionada !== "" &&
           modelo.categoria !== categoriaSeleccionada)
            return false;

        if(tipoSeleccionado !== "" &&
           modelo.tipo !== tipoSeleccionado)
            return false;

        if(colorSeleccionado !== "" &&
           modelo.color !== colorSeleccionado)
            return false;

        return true;

    });

    mostrarModelos();

}





/*=========================================
=          MOSTRAR GALERIA                =
=========================================*/

function mostrarModelos(){

    galeriaModelos.innerHTML = "";

    if(modelosFiltrados.length === 0){

        galeriaModelos.innerHTML = `
            <div class="sinResultados">
                No se encontraron modelos.
            </div>
        `;

        return;

    }

    modelosFiltrados.forEach(function(modelo){

        crearTarjetaModelo(modelo);

    });

}





/*=========================================
=        CREAR TARJETA MODELO             =
=========================================*/

function crearTarjetaModelo(modelo){

    const tarjeta =
        templateTarjeta.content.cloneNode(true);





    const foto =
        tarjeta.querySelector(".fotoModelo");

    foto.src = modelo.imagen;

    foto.alt = modelo.codigo;





    tarjeta.querySelector(".codigoModelo").textContent =
        modelo.codigo;

    tarjeta.querySelector(".marcaModelo").textContent =
        modelo.marca;

    tarjeta.querySelector(".tipoModelo").textContent =
        modelo.tipo;

    tarjeta.querySelector(".stockModelo").textContent =
        "Stock: " + modelo.stock;





    const boton =
        tarjeta.querySelector(".btnSeleccionarModelo");

    boton.addEventListener("click",function(){

        seleccionarModelo(modelo);

    });





    galeriaModelos.appendChild(tarjeta);

}





/*=========================================
=      SELECCIONAR UN MODELO              =
=========================================*/

function seleccionarModelo(modelo){

    modeloSeleccionado = modelo;

    cargarFichaModelo();

    mostrarPantalla("registro");

}

/*=========================================
=      CARGAR FICHA DEL MODELO            =
=========================================*/

function cargarFichaModelo(){

    if(modeloSeleccionado == null)
        return;

    document.getElementById("codigoSeleccionado").textContent =
        modeloSeleccionado.codigo;

    document.getElementById("descripcionSeleccionada").textContent =
        modeloSeleccionado.marca;

    document.getElementById("colorSeleccionado").textContent =
        modeloSeleccionado.color;

    document.getElementById("imagenSeleccionada").src =
        modeloSeleccionado.imagen;

    document.getElementById("fechaCompra").value =
        obtenerFechaHoy();

    document.getElementById("tipoIngreso").value =
        "Reposición";

    document.getElementById("costoCompra").value = "";

    document.getElementById("observaciones").value = "";

    generarTallas();

}





/*=========================================
=      GENERAR TALLAS                     =
=========================================*/

function generarTallas(){

    const contenedor =
        document.getElementById("contenedorTallas");

    contenedor.innerHTML = "";



    let tallas = obtenerTallasCategoria(
        modeloSeleccionado.categoria
    );



    tallas.forEach(function(talla){

        const fila =
            templateTalla.content.cloneNode(true);

        fila.querySelector(".nombreTalla").textContent =
            talla;

        fila.querySelector(".cantidadTalla").dataset.talla =
            talla;

        fila.querySelector(".cantidadTalla").value = 0;

        contenedor.appendChild(fila);

    });

}





/*=========================================
=     TALLAS SEGUN CATEGORIA              =
=========================================*/

function obtenerTallasCategoria(categoria){

    switch(categoria){

        case "Pibe Niño":
            return [17,18,19,20,21,22];

        case "Pibe Niña":
            return [17,18,19,20,21,22];

        case "Zapato Niño":
            return [22,23,24,25,26];

        case "Zapato Niña":
            return [22,23,24,25,26];

        case "Zapato Niña27":
            return [27,28,29,30,31,32];

        default:
            return [];

    }

}





/*=========================================
=      FECHA ACTUAL                       =
=========================================*/

function obtenerFechaHoy(){

    const hoy = new Date();

    const año = hoy.getFullYear();

    const mes = String(
        hoy.getMonth()+1
    ).padStart(2,"0");

    const dia = String(
        hoy.getDate()
    ).padStart(2,"0");

    return año + "-" + mes + "-" + dia;

}

/*=========================================
=        GUARDAR COMPRA                   =
=========================================*/

const btnGuardarCompra =
document.getElementById("guardarCompra");

const btnCancelarGuardar =
document.getElementById("cancelarGuardar");

const btnConfirmarGuardar =
document.getElementById("confirmarGuardar");

const modalConfirmacion =
document.getElementById("modalConfirmacion");

const loading =
document.getElementById("loading");

const toast =
document.getElementById("toast");



btnGuardarCompra.addEventListener("click",validarCompra);

btnCancelarGuardar.addEventListener("click",function(){

    ocultarModal();

});

btnConfirmarGuardar.addEventListener("click",guardarCompra);





/*=========================================
=        VALIDAR COMPRA                   =
=========================================*/

function validarCompra(){

    if(modeloSeleccionado==null){

        alert("No hay un modelo seleccionado.");

        return;

    }

    const costo =
    parseFloat(document.getElementById("costoCompra").value);

    if(isNaN(costo) || costo<=0){

        alert("Ingresa el costo de la compra.");

        return;

    }

    const pares =
    calcularTotalPares();

    if(pares<=0){

        alert("Debes ingresar al menos un par.");

        return;

    }

    mostrarModal();

}





/*=========================================
=      TOTAL DE PARES                     =
=========================================*/

function calcularTotalPares(){

    let total=0;

    document
        .querySelectorAll(".cantidadTalla")
        .forEach(function(input){

            total += parseInt(input.value)||0;

        });

    return total;

}





/*=========================================
=       OBTENER TALLAS                    =
=========================================*/

function obtenerDetalleTallas(){

    const detalle=[];

    document
        .querySelectorAll(".cantidadTalla")
        .forEach(function(input){

            const cantidad =
            parseInt(input.value)||0;

            if(cantidad>0){

                detalle.push({

                    talla:input.dataset.talla,

                    cantidad:cantidad

                });

            }

        });

    return detalle;

}





/*=========================================
=       MOSTRAR MODAL                     =
=========================================*/

function mostrarModal(){

    modalConfirmacion.classList.remove("oculto");

}

function ocultarModal(){

    modalConfirmacion.classList.add("oculto");

}

/*=========================================
=        GUARDAR COMPRA                   =
=========================================*/

function guardarCompra(){

    ocultarModal();

    mostrarLoading();





    const compra = {

        fecha:

            document.getElementById("fechaCompra").value,

        codigo:

            modeloSeleccionado.codigo,

        marca:

            modeloSeleccionado.marca,

        categoria:

            modeloSeleccionado.categoria,

        tipo:

            modeloSeleccionado.tipo,

        color:

            modeloSeleccionado.color,

        ingreso:

            document.getElementById("tipoIngreso").value,

        costo:

            parseFloat(
                document.getElementById("costoCompra").value
            ),

        pares:

            calcularTotalPares(),

        tallas:

            obtenerDetalleTallas(),

        observaciones:

            document.getElementById("observaciones").value.trim()

    };





    console.clear();

    console.log("COMPRA");

    console.log(compra);





    setTimeout(function(){

        ocultarLoading();

        mostrarToast(
            "Compra registrada correctamente."
        );

        limpiarFormulario();

    },1200);

}





/*=========================================
=        LIMPIAR FORMULARIO               =
=========================================*/

function limpiarFormulario(){

    document
        .querySelectorAll(".cantidadTalla")
        .forEach(function(input){

            input.value=0;

        });





    document.getElementById("costoCompra").value="";

    document.getElementById("observaciones").value="";





    document.getElementById("tipoIngreso").value="Reposición";

}





/*=========================================
=      LOADING                            =
=========================================*/

function mostrarLoading(){

    loading.classList.remove("oculto");

}



function ocultarLoading(){

    loading.classList.add("oculto");

}





/*=========================================
=      TOAST                              =
=========================================*/

function mostrarToast(texto){

    toast.innerText=texto;

    toast.classList.add("mostrar");



    setTimeout(function(){

        toast.classList.remove("mostrar");

    },2500);

}

/*=========================================
=      NAVEGACIÓN ENTRE PANTALLAS         =
=========================================*/

const pantallaBusqueda =
document.getElementById("pantallaBusqueda");

const pantallaRegistro =
document.getElementById("pantallaRegistro");

const btnVolverBusqueda =
document.getElementById("volverBusqueda");



btnVolverBusqueda.addEventListener("click",volverBusqueda);





function abrirRegistro(){

    pantallaBusqueda.classList.add("oculto");

    pantallaRegistro.classList.remove("oculto");



    cargarFichaModelo();

}





function volverBusqueda(){

    pantallaRegistro.classList.add("oculto");

    pantallaBusqueda.classList.remove("oculto");



    document
        .getElementById("galeriaModelos")
        .scrollIntoView({

            behavior:"smooth",

            block:"start"

        });

}





/*=========================================
=      SELECCIONAR MODELO                =
=========================================*/

function seleccionarModelo(codigo){

    modeloSeleccionado = modelos.find(function(item){

        return item.codigo===codigo;

    });



    if(!modeloSeleccionado){

        alert("Modelo no encontrado.");

        return;

    }



    abrirRegistro();

}





/*=========================================
=      RESALTAR TARJETA                  =
=========================================*/

function resaltarModelo(codigo){

    document
        .querySelectorAll(".tarjetaModelo")
        .forEach(function(card){

            card.classList.remove("seleccionado");

        });



    const tarjeta = document.querySelector(

        '[data-codigo="'+codigo+'"]'

    );



    if(tarjeta){

        tarjeta.classList.add("seleccionado");

    }

}





/*=========================================
=      SCROLL AL MODELO                  =
=========================================*/

function enfocarModelo(codigo){

    const tarjeta = document.querySelector(

        '[data-codigo="'+codigo+'"]'

    );



    if(!tarjeta)

        return;



    tarjeta.scrollIntoView({

        behavior:"smooth",

        block:"center"

    });

}

/*=========================================
=      FILTROS EN TIEMPO REAL            =
=========================================*/

const filtroMarca =
document.getElementById("filtroMarca");

const filtroCategoria =
document.getElementById("filtroCategoria");

const filtroTipo =
document.getElementById("filtroTipo");

const filtroColor =
document.getElementById("filtroColor");

const contadorResultados =
document.getElementById("contadorResultados");



filtroMarca.addEventListener("change",filtrarModelos);
filtroCategoria.addEventListener("change",filtrarModelos);
filtroTipo.addEventListener("change",filtrarModelos);
filtroColor.addEventListener("change",filtrarModelos);





/*=========================================
=      FILTRAR GALERÍA                   =
=========================================*/

function filtrarModelos(){

    const marca =
        filtroMarca.value;

    const categoria =
        filtroCategoria.value;

    const tipo =
        filtroTipo.value;

    const color =
        filtroColor.value;



    const resultado = modelos.filter(function(item){

        if(marca && item.marca!==marca)
            return false;

        if(categoria && item.categoria!==categoria)
            return false;

        if(tipo && item.tipo!==tipo)
            return false;

        if(color && item.color!==color)
            return false;

        return true;

    });



    mostrarGaleria(resultado);

}





/*=========================================
=      MOSTRAR GALERÍA                   =
=========================================*/

function mostrarGaleria(lista){

    const galeria =
        document.getElementById("galeriaModelos");

    galeria.innerHTML="";



    contadorResultados.innerHTML =
        lista.length + " modelos encontrados";



    if(lista.length===0){

        galeria.innerHTML=`

            <div class="sinResultados">

                No se encontraron modelos.

            </div>

        `;

        return;

    }



    lista.forEach(function(item){

        galeria.appendChild(

            crearTarjeta(item)

        );

    });

}





/*=========================================
=      CREAR TARJETA                     =
=========================================*/

function crearTarjeta(item){

    const tarjeta =
        templateModelo.content.cloneNode(true);



    const card =
        tarjeta.querySelector(".tarjetaModelo");



    card.dataset.codigo =
        item.codigo;



    tarjeta.querySelector(".fotoModelo").src =
        item.imagen;



    tarjeta.querySelector(".codigoModelo").textContent =
        item.codigo;



    tarjeta.querySelector(".marcaModelo").textContent =
        item.marca;



    tarjeta.querySelector(".colorModelo").textContent =
        item.color;



    tarjeta.querySelector(".tipoModelo").textContent =
        item.tipo;



    tarjeta.querySelector(".btnSeleccionar")
        .addEventListener("click",function(){

            seleccionarModelo(item.codigo);

        });



    return tarjeta;

}





/*=========================================
=      CARGA INICIAL                     =
=========================================*/

document.addEventListener("DOMContentLoaded",function(){

    mostrarGaleria(modelos);

});

/*=========================================
=      BUSCADOR GENERAL                  =
=========================================*/

const txtBuscar =
document.getElementById("txtBuscar");



if(txtBuscar){

    txtBuscar.addEventListener("input",filtrarModelos);

}





/*=========================================
=      FILTRAR POR TEXTO                 =
=========================================*/

function coincideBusqueda(item,busqueda){

    if(busqueda==="")
        return true;

    busqueda = busqueda.toLowerCase();

    return (

        item.codigo.toLowerCase().includes(busqueda) ||

        item.marca.toLowerCase().includes(busqueda) ||

        item.color.toLowerCase().includes(busqueda) ||

        item.tipo.toLowerCase().includes(busqueda) ||

        item.categoria.toLowerCase().includes(busqueda)

    );

}





/*=========================================
=      REEMPLAZAR FILTRADO               =
=========================================*/

function filtrarModelos(){

    const marca =
        filtroMarca.value;

    const categoria =
        filtroCategoria.value;

    const tipo =
        filtroTipo.value;

    const color =
        filtroColor.value;

    const texto =
        txtBuscar
        ? txtBuscar.value.trim()
        : "";



    const resultado = modelos.filter(function(item){

        if(marca && item.marca!==marca)
            return false;

        if(categoria && item.categoria!==categoria)
            return false;

        if(tipo && item.tipo!==tipo)
            return false;

        if(color && item.color!==color)
            return false;

        if(!coincideBusqueda(item,texto))
            return false;

        return true;

    });



    mostrarGaleria(resultado);

}





/*=========================================
=      LIMPIAR BUSQUEDA                  =
=========================================*/

function limpiarBusqueda(){

    if(txtBuscar){

        txtBuscar.value="";

    }

    filtroMarca.value="";
    filtroCategoria.value="";
    filtroTipo.value="";
    filtroColor.value="";

    mostrarGaleria(modelos);

}





/*=========================================
=      ATAJO DE TECLADO                  =
=========================================*/

document.addEventListener("keydown",function(e){

    if(e.key==="Escape"){

        limpiarBusqueda();

    }

});





/*=========================================
=      DOBLE CLICK EN LOGO               =
=========================================*/

const logo =
document.getElementById("logo");

if(logo){

    logo.addEventListener("dblclick",function(){

        limpiarBusqueda();

    });

}

/*=========================================
=      PANEL DE INFORMACIÓN              =
=========================================*/

function actualizarPanelModelo(modelo){

    if(!modelo) return;

    document.getElementById("infoCodigo").textContent =
        modelo.codigo;

    document.getElementById("infoMarca").textContent =
        modelo.marca;

    document.getElementById("infoCategoria").textContent =
        modelo.categoria;

    document.getElementById("infoTipo").textContent =
        modelo.tipo;

    document.getElementById("infoColor").textContent =
        modelo.color;

    document.getElementById("infoImagen").src =
        modelo.imagen;



    cargarResumenModelo(modelo);

}





/*=========================================
=      RESUMEN DEL MODELO                =
=========================================*/

function cargarResumenModelo(modelo){

    /*
       Estos valores son simulados.

       Después vendrán desde
       Google Sheets.
    */

    const resumen={

        stock:8,

        ultimaCompra:"18/07/2026",

        ultimaVenta:"02/08/2026",

        compras:5,

        ventas:14

    };



    document.getElementById("infoStock").textContent =
        resumen.stock + " pares";



    document.getElementById("infoUltimaCompra").textContent =
        resumen.ultimaCompra;



    document.getElementById("infoUltimaVenta").textContent =
        resumen.ultimaVenta;



    document.getElementById("infoCompras").textContent =
        resumen.compras;



    document.getElementById("infoVentas").textContent =
        resumen.ventas;



    calcularRotacion(resumen);

}





/*=========================================
=      ROTACIÓN DEL MODELO               =
=========================================*/

function calcularRotacion(resumen){

    let texto="";



    if(resumen.ventas>=15){

        texto="Muy alta";

    }

    else if(resumen.ventas>=8){

        texto="Alta";

    }

    else if(resumen.ventas>=4){

        texto="Media";

    }

    else{

        texto="Baja";

    }



    document.getElementById("infoRotacion")
        .textContent=texto;

}





/*=========================================
=      MOSTRAR PANEL                     =
=========================================*/

function mostrarPanelModelo(){

    document
        .getElementById("panelInformacion")
        .classList.remove("oculto");

}





/*=========================================
=      OCULTAR PANEL                     =
=========================================*/

function ocultarPanelModelo(){

    document
        .getElementById("panelInformacion")
        .classList.add("oculto");

}





/*=========================================
=      REEMPLAZAR seleccionarModelo      =
=========================================*/

const seleccionarModeloOriginal =
seleccionarModelo;



seleccionarModelo=function(codigo){

    seleccionarModeloOriginal(codigo);



    actualizarPanelModelo(modeloSeleccionado);

    mostrarPanelModelo();

};