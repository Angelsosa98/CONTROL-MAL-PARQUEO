/* ============================================================================
 * ARCHIVO: captura.js
 * RESPONSABILIDAD: Controlador principal de la aplicación web Control Vial
 * Santa Marta. Orquesta las 3 vistas (Captura, Registros, Resumen), GPS,
 * selección de ubicación en mapa/buscador, asignación de cuadra, pixelado en
 * canvas, guardado/edición/eliminación y sincronización de filtros y resumen.
 * ============================================================================ */

var AppEstado = {
  vias: null,
  criterios: null,
  reportesPrecargados: [],
  reportesLocales: [],
  reportesUnificados: [],
  ubicacionActual: null, // { lat, lng, cuadraId, distanciaM, fueraDeZona }
  seleccionManualCuadra: false,
  categoriaSeleccionada: "",
  actorSeleccionado: "",
  editandoId: null,
  imagenOriginalDataUrl: null,
  imagenProcesadaDataUrl: null,
  regionAnonimizacion: null, // { x, y, w, h } en coordenadas del canvas
  arrastrandoAnonimizacion: false,
  inicioArrastre: null,
  filtros: {
    texto: "",
    cuadra: "",
    categoria: "",
    actor: "",
    nivel: "",
    franja: ""
  }
};

/**
 * Carga un archivo JSON relativo mediante fetch con respaldo seguro.
 */
function cargarJSON(ruta, valorDefecto) {
  return fetch(ruta + "?v=" + Date.now())
    .then(function (resp) {
      if (!resp.ok) {
        throw new Error("No se pudo cargar " + ruta + " (HTTP " + resp.status + ")");
      }
      return resp.json();
    })
    .catch(function (err) {
      console.warn("Aviso cargando " + ruta + ":", err.message);
      if (typeof valorDefecto !== "undefined") {
        return valorDefecto;
      }
      throw err;
    });
}

/**
 * Garantiza un objeto vias con arreglo 'cuadras' válido para evitar errores
 * en módulos que requieren vias.cuadras.
 */
function normalizarViasSeguras(vias) {
  if (vias && Array.isArray(vias.cuadras)) {
    return vias;
  }
  return {
    zona: (vias && vias.zona) || {
      nombre: "Santa Marta",
      centro: [11.2232, -74.1885],
      zoom: 15
    },
    cuadras: []
  };
}

/**
 * Calcula la distancia en metros entre un punto (lat, lng) y un segmento
 * definido por dos puntos [lat1, lng1] y [lat2, lng2] usando proyección
 * equirectangular local (precisa a escala urbana).
 */
function distanciaPuntoASegmentoMetros(lat, lng, p1, p2) {
  var latRad = (lat * Math.PI) / 180;
  var metrosPorLat = 111320;
  var metrosPorLng = 111320 * Math.cos(latRad);

  var px = (lng - p1[1]) * metrosPorLng;
  var py = (lat - p1[0]) * metrosPorLat;
  var ax = 0;
  var ay = 0;
  var bx = (p2[1] - p1[1]) * metrosPorLng;
  var by = (p2[0] - p1[0]) * metrosPorLat;

  var abx = bx - ax;
  var aby = by - ay;
  var apx = px - ax;
  var apy = py - ay;
  var abLenSq = abx * abx + aby * aby;

  var t = 0;
  if (abLenSq > 0) {
    t = (apx * abx + apy * aby) / abLenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;
  }

  var closestX = ax + abx * t;
  var closestY = ay + aby * t;
  var dx = px - closestX;
  var dy = py - closestY;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calcula la distancia mínima en metros desde (lat, lng) a la polilínea de una cuadra.
 */
function distanciaACuadraMetros(lat, lng, cuadra) {
  if (!cuadra || !Array.isArray(cuadra.extremos) || cuadra.extremos.length < 2) {
    return Infinity;
  }
  var minDist = Infinity;
  for (var i = 0; i < cuadra.extremos.length - 1; i++) {
    var d = distanciaPuntoASegmentoMetros(lat, lng, cuadra.extremos[i], cuadra.extremos[i + 1]);
    if (d < minDist) {
      minDist = d;
    }
  }
  return minDist;
}

/**
 * Busca la cuadra más cercana a (lat, lng) dentro de vias.cuadras.
 * Siempre permite reportar en cualquier punto sin mostrar advertencia de fuera de zona.
 */
function encontrarCuadraMasCercana(lat, lng, vias) {
  var viasSeguras = normalizarViasSeguras(vias);
  if (viasSeguras.cuadras.length === 0) {
    return { cuadra: null, distanciaM: null, fueraDeZona: false };
  }

  var mejorCuadra = null;
  var mejorDistancia = Infinity;

  for (var i = 0; i < viasSeguras.cuadras.length; i++) {
    var c = viasSeguras.cuadras[i];
    var dist = distanciaACuadraMetros(lat, lng, c);
    if (dist < mejorDistancia) {
      mejorDistancia = dist;
      mejorCuadra = c;
    }
  }

  return {
    cuadra: mejorCuadra,
    distanciaM: Math.round(mejorDistancia),
    fueraDeZona: false
  };
}

/**
 * Verifica si (lat, lng) está dentro de los límites generales definidos en vias.json.
 */
function estaDentroDeLimitesZona(lat, lng, vias) {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return false;
  }
  if (!vias || !vias.zona || !vias.zona.limites) {
    return true;
  }
  var lim = vias.zona.limites;
  return (
    lat >= lim.lat_min &&
    lat <= lim.lat_max &&
    lng >= lim.lng_min &&
    lng <= lim.lng_max
  );
}

/**
 * Busca un objeto cuadra por su id.
 */
function obtenerCuadraPorId(cuadraId) {
  var viasSeguras = normalizarViasSeguras(AppEstado.vias);
  for (var i = 0; i < viasSeguras.cuadras.length; i++) {
    if (viasSeguras.cuadras[i].id === cuadraId) {
      return viasSeguras.cuadras[i];
    }
  }
  return null;
}

/**
 * Recalcula criticidad de todos los reportes usando los criterios vigentes y
 * garantizando que 'vias' tenga arreglo 'cuadras'.
 */
function recalcularTodosLosReportes(lista, criterios, vias) {
  var viasSeguras = normalizarViasSeguras(vias);
  var resultado = [];

  for (var i = 0; i < lista.length; i++) {
    var item = Object.assign({}, lista[i]);
    var cuadraObj = obtenerCuadraPorId(item.cuadra);
    var tipoVia = cuadraObj ? cuadraObj.tipo_via : "secundaria";

    if (typeof calcularCriticidad === "function" && criterios && viasSeguras.cuadras.length > 0) {
      try {
        item.criticidad = calcularCriticidad(item, criterios, tipoVia);
      } catch (err) {
        item.criticidad = item.criticidad || { puntaje: 5, nivel: "Medio", franja: "valle" };
      }
    } else if (!item.criticidad) {
      item.criticidad = { puntaje: 5, nivel: "Medio", franja: "valle" };
    }

    resultado.push(item);
  }

  return resultado;
}

/**
 * Sincroniza la lista unificada de reportes (locales + precargados), evitando
 * duplicar ids si un reporte local edita o sobrescribe uno precargado.
 */
function sincronizarListaUnicaReportes() {
  var mapaPorId = {};

  for (var i = 0; i < AppEstado.reportesPrecargados.length; i++) {
    var pre = AppEstado.reportesPrecargados[i];
    if (pre && pre.id) {
      mapaPorId[pre.id] = Object.assign({ origen: pre.origen || "precargado" }, pre);
    }
  }

  for (var j = 0; j < AppEstado.reportesLocales.length; j++) {
    var loc = AppEstado.reportesLocales[j];
    if (loc && loc.id) {
      mapaPorId[loc.id] = Object.assign({ origen: loc.origen || "campo" }, loc);
    }
  }

  var lista = [];
  for (var clave in mapaPorId) {
    if (Object.prototype.hasOwnProperty.call(mapaPorId, clave)) {
      lista.push(mapaPorId[clave]);
    }
  }

  AppEstado.reportesUnificados = recalcularTodosLosReportes(lista, AppEstado.criterios, AppEstado.vias);
}

/**
 * Formatea fecha y hora local actual como "AAAA-MM-DDTHH:MM" para <input type="datetime-local">.
 */
function obtenerFechaHoraLocalActual() {
  var ahora = new Date();
  var anio = ahora.getFullYear();
  var mes = String(ahora.getMonth() + 1).padStart(2, "0");
  var dia = String(ahora.getDate()).padStart(2, "0");
  var horas = String(ahora.getHours()).padStart(2, "0");
  var mins = String(ahora.getMinutes()).padStart(2, "0");
  return anio + "-" + mes + "-" + dia + "T" + horas + ":" + mins;
}

/**
 * Escapa caracteres HTML básicos para evitar inyección en plantillas.
 */
function escaparHTML(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Actualiza el subtítulo de zona en la cabecera superior si existe.
 */
function actualizarSubtituloZona(vias) {
  var subEl = document.getElementById("subtitulo-zona") || document.querySelector(".subtitulo-app");
  if (!subEl) return;
  if (vias && vias.zona && vias.zona.nombre) {
    subEl.textContent = vias.zona.nombre;
  } else {
    subEl.textContent = "Santa Marta";
  }
}

/**
 * Actualiza el texto de coordenadas bajo el mapa de captura.
 */
function mostrarCoordenadasTexto(lat, lng) {
  var el = document.getElementById("texto-coordenadas");
  if (!el) return;
  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    el.textContent = "Lat: " + lat.toFixed(6) + ", Lng: " + lng.toFixed(6);
  } else {
    el.textContent = "Lat: —, Lng: —";
  }
}

/**
 * Actualiza la tarjeta de cuadra asignada manteniendo oculto el aviso de fuera de zona.
 */
function actualizarUIAsignacionCuadra(cuadraId) {
  var nombreEl = document.getElementById("nombre-cuadra-asignada");
  var tipoEl = document.getElementById("badge-tipo-via");
  var avisoEl = document.getElementById("aviso-fuera-zona");
  var selectCuadra = document.getElementById("select-cuadra-manual");

  if (avisoEl) {
    avisoEl.hidden = true;
    avisoEl.textContent = "";
  }

  var cuadra = obtenerCuadraPorId(cuadraId);

  if (cuadra) {
    if (nombreEl) nombreEl.textContent = cuadra.nombre;
    if (tipoEl) {
      tipoEl.textContent = "Tipo de vía: " + (cuadra.tipo_via === "arterial" ? "Arterial" : "Secundaria");
    }
    if (selectCuadra && selectCuadra.value !== cuadra.id) {
      selectCuadra.value = cuadra.id;
    }
  } else {
    if (nombreEl) nombreEl.textContent = "Sin cuadra asignada";
    if (tipoEl) tipoEl.textContent = "Tipo de vía: —";
    if (selectCuadra) selectCuadra.value = "";
  }
}

/**
 * Fija una ubicación (lat, lng) en el formulario de captura, actualiza el mapa
 * y asigna la cuadra más cercana sin mostrar advertencias de zona.
 */
function fijarUbicacion(lat, lng, opciones) {
  var opts = opciones || {};
  var latNum = Number(lat);
  var lngNum = Number(lng);
  if (isNaN(latNum) || isNaN(lngNum)) return;

  if (!opts.conservarManual) {
    AppEstado.seleccionManualCuadra = false;
  }

  mostrarCoordenadasTexto(latNum, lngNum);

  if (!opts.sinMoverMapa && typeof actualizarMarcadorCaptura === "function") {
    actualizarMarcadorCaptura(latNum, lngNum, function (nuevaLat, nuevaLng) {
      fijarUbicacion(nuevaLat, nuevaLng, { conservarManual: false, sinMoverMapa: true });
    });
  }

  var cuadraAsignadaId = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.cuadraId : "";
  var distancia = null;

  if (!AppEstado.seleccionManualCuadra || !cuadraAsignadaId) {
    var det = encontrarCuadraMasCercana(latNum, lngNum, AppEstado.vias);
    cuadraAsignadaId = det.cuadra ? det.cuadra.id : "";
    distancia = det.distanciaM;
  } else {
    var cManual = obtenerCuadraPorId(cuadraAsignadaId);
    if (cManual) {
      distancia = Math.round(distanciaACuadraMetros(latNum, lngNum, cManual));
    }
  }

  AppEstado.ubicacionActual = {
    lat: Number(latNum.toFixed(6)),
    lng: Number(lngNum.toFixed(6)),
    cuadraId: cuadraAsignadaId,
    distanciaM: distancia,
    fueraDeZona: false
  };

  actualizarUIAsignacionCuadra(cuadraAsignadaId);
  if (typeof resaltarCuadraCaptura === "function") {
    resaltarCuadraCaptura(cuadraAsignadaId);
  }
}

/**
 * Solicita geolocalización del dispositivo mediante Geolocation API.
 */
function solicitarGeolocalizacion(esAutomaticaAlInicio) {
  var estadoGps = document.getElementById("estado-gps");

  if (!navigator.geolocation) {
    if (estadoGps && !esAutomaticaAlInicio) {
      estadoGps.textContent = "Tu navegador no soporta GPS. Toca el mapa o elige una cuadra.";
    }
    return;
  }

  if (estadoGps && !esAutomaticaAlInicio) {
    estadoGps.textContent = "Obteniendo ubicación GPS...";
  }

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;

      if (esAutomaticaAlInicio && AppEstado.seleccionManualCuadra) {
        return;
      }

      if (estadoGps) {
        estadoGps.textContent = "Ubicación GPS detectada (±" + Math.round(pos.coords.accuracy || 15) + " m).";
      }

      fijarUbicacion(lat, lng, { conservarManual: AppEstado.seleccionManualCuadra });
    },
    function (err) {
      if (estadoGps && !esAutomaticaAlInicio) {
        if (err.code === 1) {
          estadoGps.textContent = "Permiso de ubicación denegado. Toca el mapa o selecciona la cuadra.";
        } else {
          estadoGps.textContent = "No se pudo obtener GPS. Toca el mapa para marcar el punto.";
        }
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 8000,
      maximumAge: 30000
    }
  );
}

/**
 * Pobla el selector manual de cuadras y el filtro de cuadras en Registros.
 */
function poblarSelectoresCuadras(vias) {
  var viasSeguras = normalizarViasSeguras(vias);
  var selectManual = document.getElementById("select-cuadra-manual");
  var filtroCuadra = document.getElementById("filtro-cuadra");

  if (selectManual) {
    selectManual.innerHTML = '<option value="">-- Selecciona una cuadra --</option>';
  }
  if (filtroCuadra) {
    filtroCuadra.innerHTML = '<option value="">Todas las cuadras</option>';
  }

  for (var i = 0; i < viasSeguras.cuadras.length; i++) {
    var c = viasSeguras.cuadras[i];

    if (selectManual) {
      var opt1 = document.createElement("option");
      opt1.value = c.id;
      opt1.textContent = c.nombre;
      selectManual.appendChild(opt1);
    }

    if (filtroCuadra) {
      var opt2 = document.createElement("option");
      opt2.value = c.id;
      opt2.textContent = c.nombre;
      filtroCuadra.appendChild(opt2);
    }
  }
}

/**
 * Maneja el cambio manual en el <select> de cuadra.
 */
function seleccionarCuadraManual(cuadraId) {
  AppEstado.seleccionManualCuadra = Boolean(cuadraId);

  var cuadra = obtenerCuadraPorId(cuadraId);
  if (!cuadra) {
    if (AppEstado.ubicacionActual) {
      AppEstado.ubicacionActual.cuadraId = "";
      AppEstado.ubicacionActual.fueraDeZona = false;
    }
    actualizarUIAsignacionCuadra("");
    if (typeof resaltarCuadraCaptura === "function") resaltarCuadraCaptura("");
    return;
  }

  var lat = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lat : null;
  var lng = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lng : null;

  if ((typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) && Array.isArray(cuadra.extremos) && cuadra.extremos.length > 0) {
    var sumaLat = 0;
    var sumaLng = 0;
    for (var i = 0; i < cuadra.extremos.length; i++) {
      sumaLat += Number(cuadra.extremos[i][0]);
      sumaLng += Number(cuadra.extremos[i][1]);
    }
    lat = Number((sumaLat / cuadra.extremos.length).toFixed(6));
    lng = Number((sumaLng / cuadra.extremos.length).toFixed(6));
  }

  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    AppEstado.ubicacionActual = {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      cuadraId: cuadra.id,
      distanciaM: Math.round(distanciaACuadraMetros(lat, lng, cuadra)),
      fueraDeZona: false
    };
    mostrarCoordenadasTexto(lat, lng);
    if (typeof actualizarMarcadorCaptura === "function") {
      actualizarMarcadorCaptura(lat, lng, function (nuevaLat, nuevaLng) {
        fijarUbicacion(nuevaLat, nuevaLng, { conservarManual: false, sinMoverMapa: true });
      });
    }
  } else {
    AppEstado.ubicacionActual = {
      lat: null,
      lng: null,
      cuadraId: cuadra.id,
      distanciaM: null,
      fueraDeZona: false
    };
  }

  actualizarUIAsignacionCuadra(cuadra.id);
  if (typeof resaltarCuadraCaptura === "function") resaltarCuadraCaptura(cuadra.id);
}

/**
 * Configura el buscador de direcciones / calles / puntos de interés en Santa Marta.
 */
function configurarBuscadorDireccion() {
  var input = document.getElementById("input-buscar-direccion");
  var btnLimpiar = document.getElementById("btn-limpiar-direccion");
  var listaEl = document.getElementById("resultados-direccion");
  if (!input || !listaEl) return;

  var temporizador = null;

  function ocultarResultados() {
    listaEl.hidden = true;
    listaEl.innerHTML = "";
  }

  function renderizarResultados(items) {
    listaEl.innerHTML = "";
    if (!Array.isArray(items) || items.length === 0) {
      var vacio = document.createElement("div");
      vacio.className = "resultado-direccion-vacio";
      vacio.textContent = "Sin coincidencias en Santa Marta. Prueba con otra calle, carrera o lugar.";
      listaEl.appendChild(vacio);
      listaEl.hidden = false;
      return;
    }

    for (var i = 0; i < items.length; i++) {
      (function (item) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "resultado-direccion-item";
        btn.innerHTML =
          '<span class="resultado-direccion-titulo">' + escaparHTML(item.titulo) + "</span>" +
          '<span class="resultado-direccion-sub">' + escaparHTML(item.subtitulo) + "</span>";

        btn.addEventListener("click", function () {
          input.value = item.titulo;
          if (btnLimpiar) btnLimpiar.hidden = false;
          ocultarResultados();
          AppEstado.seleccionManualCuadra = false;
          fijarUbicacion(item.lat, item.lng, { conservarManual: false });
        });

        listaEl.appendChild(btn);
      })(items[i]);
    }
    listaEl.hidden = false;
  }

  input.addEventListener("input", function () {
    var val = input.value.trim();
    if (btnLimpiar) btnLimpiar.hidden = val.length === 0;

    if (temporizador) clearTimeout(temporizador);
    if (val.length < 2) {
      ocultarResultados();
      return;
    }

    temporizador = setTimeout(function () {
      if (typeof buscarDireccionesMapa === "function") {
        buscarDireccionesMapa(val, AppEstado.vias).then(function (items) {
          if (input.value.trim() === val) {
            renderizarResultados(items);
          }
        });
      }
    }, 280);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      var val = input.value.trim();
      if (val.length >= 2 && typeof buscarDireccionesMapa === "function") {
        buscarDireccionesMapa(val, AppEstado.vias).then(function (items) {
          renderizarResultados(items);
        });
      }
    } else if (e.key === "Escape") {
      ocultarResultados();
    }
  });

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", function () {
      input.value = "";
      btnLimpiar.hidden = true;
      ocultarResultados();
      input.focus();
    });
  }

  document.addEventListener("click", function (e) {
    if (!e.target.closest(".buscador-direccion-wrapper")) {
      ocultarResultados();
    }
  });
}

/**
 * Configura los botones de categoría y actor en la vista Captura.
 */
function configurarBotonesSeleccion() {
  var botonesCat = document.querySelectorAll(".btn-categoria");
  for (var i = 0; i < botonesCat.length; i++) {
    botonesCat[i].addEventListener("click", function () {
      var val = this.getAttribute("data-categoria") || "";
      seleccionarCategoria(val);
    });
  }

  var botonesActor = document.querySelectorAll(".btn-actor");
  for (var j = 0; j < botonesActor.length; j++) {
    botonesActor[j].addEventListener("click", function () {
      var val = this.getAttribute("data-actor") || "";
      seleccionarActor(val);
    });
  }
}

function seleccionarCategoria(valor) {
  AppEstado.categoriaSeleccionada = valor;
  var inputHidden = document.getElementById("categoria-seleccionada");
  if (inputHidden) inputHidden.value = valor;

  var botones = document.querySelectorAll(".btn-categoria");
  for (var i = 0; i < botones.length; i++) {
    var activo = botones[i].getAttribute("data-categoria") === valor;
    botones[i].classList.toggle("activo", activo);
    botones[i].setAttribute("aria-pressed", activo ? "true" : "false");
  }
}

function seleccionarActor(valor) {
  AppEstado.actorSeleccionado = valor;
  var inputHidden = document.getElementById("actor-seleccionada");
  if (inputHidden) inputHidden.value = valor;

  var botones = document.querySelectorAll(".btn-actor");
  for (var i = 0; i < botones.length; i++) {
    var activo = botones[i].getAttribute("data-actor") === valor;
    botones[i].classList.toggle("activo", activo);
    botones[i].setAttribute("aria-pressed", activo ? "true" : "false");
  }
}

/**
 * Dibuja en el <canvas> la imagen base y, si existe, la región pixelada.
 */
function renderizarCanvasAnonimizacion() {
  var canvas = document.getElementById("canvas-foto");
  if (!canvas || !AppEstado.imagenOriginalDataUrl) return;

  var img = new Image();
  img.onload = function () {
    var maxAncho = 900;
    var ancho = img.width;
    var alto = img.height;

    if (ancho > maxAncho) {
      var escala = maxAncho / ancho;
      ancho = maxAncho;
      alto = Math.round(img.height * escala);
    }

    canvas.width = ancho;
    canvas.height = alto;

    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, ancho, alto);
    ctx.drawImage(img, 0, 0, ancho, alto);

    var reg = AppEstado.regionAnonimizacion;
    if (reg && reg.w > 2 && reg.h > 2) {
      aplicarPixeladoEnRegion(ctx, canvas, reg.x, reg.y, reg.w, reg.h, 12);

      ctx.save();
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(reg.x, reg.y, reg.w, reg.h);
      ctx.restore();
    }

    var tempCanvas = document.createElement("canvas");
    tempCanvas.width = ancho;
    tempCanvas.height = alto;
    var tempCtx = tempCanvas.getContext("2d");
    tempCtx.drawImage(img, 0, 0, ancho, alto);
    if (reg && reg.w > 2 && reg.h > 2) {
      aplicarPixeladoEnRegion(tempCtx, tempCanvas, reg.x, reg.y, reg.w, reg.h, 12);
    }
    AppEstado.imagenProcesadaDataUrl = tempCanvas.toDataURL("image/jpeg", 0.78);
  };
  img.src = AppEstado.imagenOriginalDataUrl;
}

/**
 * Aplica pixelado irreversible (mosaico de bloques) sobre un rectángulo del canvas.
 */
function aplicarPixeladoEnRegion(ctx, canvas, rx, ry, rw, rh, tamBloque) {
  var x0 = Math.max(0, Math.floor(rx));
  var y0 = Math.max(0, Math.floor(ry));
  var x1 = Math.min(canvas.width, Math.ceil(rx + rw));
  var y1 = Math.min(canvas.height, Math.ceil(ry + rh));
  var w = x1 - x0;
  var h = y1 - y0;
  if (w <= 0 || h <= 0) return;

  var bloque = tamBloque || 12;
  for (var y = y0; y < y1; y += bloque) {
    for (var x = x0; x < x1; x += bloque) {
      var bw = Math.min(bloque, x1 - x);
      var bh = Math.min(bloque, y1 - y);
      var pixel = ctx.getImageData(x, y, 1, 1).data;
      ctx.fillStyle = "rgb(" + pixel[0] + "," + pixel[1] + "," + pixel[2] + ")";
      ctx.fillRect(x, y, bw, bh);
    }
  }
}

function obtenerCoordenadasCanvas(evento, canvas) {
  var rect = canvas.getBoundingClientRect();
  var clientX = evento.touches && evento.touches.length > 0 ? evento.touches[0].clientX : evento.clientX;
  var clientY = evento.touches && evento.touches.length > 0 ? evento.touches[0].clientY : evento.clientY;

  var escalaX = canvas.width / (rect.width || 1);
  var escalaY = canvas.height / (rect.height || 1);

  return {
    x: (clientX - rect.left) * escalaX,
    y: (clientY - rect.top) * escalaY
  };
}

function configurarAnonimizacionCanvas() {
  var inputFoto = document.getElementById("input-foto");
  var canvas = document.getElementById("canvas-foto");
  var editorEl = document.getElementById("editor-anonimizacion");
  var btnLimpiar = document.getElementById("btn-limpiar-anonimizacion");
  var chkConfirmacion = document.getElementById("chk-confirmar-anonimizacion");

  if (inputFoto) {
    inputFoto.addEventListener("change", function () {
      var archivo = inputFoto.files && inputFoto.files[0];
      if (!archivo) return;

      var lector = new FileReader();
      lector.onload = function (e) {
        AppEstado.imagenOriginalDataUrl = e.target.result;
        AppEstado.regionAnonimizacion = null;
        if (chkConfirmacion) chkConfirmacion.checked = false;
        if (editorEl) editorEl.hidden = false;
        renderizarCanvasAnonimizacion();
      };
      lector.readAsDataURL(archivo);
    });
  }

  if (!canvas) return;

  function iniciarTrazo(e) {
    if (!AppEstado.imagenOriginalDataUrl) return;
    e.preventDefault();
    var pt = obtenerCoordenadasCanvas(e, canvas);
    AppEstado.arrastrandoAnonimizacion = true;
    AppEstado.inicioArrastre = pt;
    AppEstado.regionAnonimizacion = { x: pt.x, y: pt.y, w: 1, h: 1 };
  }

  function moverTrazo(e) {
    if (!AppEstado.arrastrandoAnonimizacion || !AppEstado.inicioArrastre) return;
    e.preventDefault();
    var pt = obtenerCoordenadasCanvas(e, canvas);
    var x = Math.min(AppEstado.inicioArrastre.x, pt.x);
    var y = Math.min(AppEstado.inicioArrastre.y, pt.y);
    var w = Math.abs(pt.x - AppEstado.inicioArrastre.x);
    var h = Math.abs(pt.y - AppEstado.inicioArrastre.y);
    AppEstado.regionAnonimizacion = { x: x, y: y, w: w, h: h };
    renderizarCanvasAnonimizacion();
  }

  function finalizarTrazo() {
    if (!AppEstado.arrastrandoAnonimizacion) return;
    AppEstado.arrastrandoAnonimizacion = false;
    AppEstado.inicioArrastre = null;
    renderizarCanvasAnonimizacion();
  }

  canvas.addEventListener("mousedown", iniciarTrazo);
  canvas.addEventListener("mousemove", moverTrazo);
  window.addEventListener("mouseup", finalizarTrazo);

  canvas.addEventListener("touchstart", iniciarTrazo, { passive: false });
  canvas.addEventListener("touchmove", moverTrazo, { passive: false });
  window.addEventListener("touchend", finalizarTrazo);

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", function () {
      AppEstado.regionAnonimizacion = null;
      renderizarCanvasAnonimizacion();
    });
  }
}

function mostrarMensajeFormulario(texto, tipo) {
  var el = document.getElementById("mensaje-formulario");
  if (!el) return;
  el.textContent = texto;
  el.className = "mensaje-estado " + (tipo || "info");
  el.hidden = !texto;
}

function limpiarFormularioCaptura() {
  AppEstado.editandoId = null;
  AppEstado.seleccionManualCuadra = false;
  AppEstado.categoriaSeleccionada = "";
  AppEstado.actorSeleccionado = "";
  AppEstado.imagenOriginalDataUrl = null;
  AppEstado.imagenProcesadaDataUrl = null;
  AppEstado.regionAnonimizacion = null;

  var fechaInput = document.getElementById("input-fecha-hora");
  if (fechaInput) fechaInput.value = obtenerFechaHoraLocalActual();

  var obsInput = document.getElementById("input-observaciones");
  if (obsInput) obsInput.value = "";

  var inputFoto = document.getElementById("input-foto");
  if (inputFoto) inputFoto.value = "";

  var editorEl = document.getElementById("editor-anonimizacion");
  if (editorEl) editorEl.hidden = true;

  var chkConf = document.getElementById("chk-confirmar-anonimizacion");
  if (chkConf) chkConf.checked = false;

  var btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");
  if (btnCancelarEdicion) btnCancelarEdicion.hidden = true;

  var tituloForm = document.getElementById("titulo-form-captura");
  if (tituloForm) tituloForm.textContent = "Nuevo reporte de mal parqueo";

  seleccionarCategoria("");
  seleccionarActor("");

  var viasSeguras = normalizarViasSeguras(AppEstado.vias);
  var centro = (viasSeguras.zona && viasSeguras.zona.centro)
    ? viasSeguras.zona.centro
    : [11.2232, -74.1885];
  fijarUbicacion(centro[0], centro[1], { conservarManual: false });
}

function cargarReporteEnFormulario(reporte) {
  if (!reporte) return;

  AppEstado.editandoId = reporte.id;
  AppEstado.seleccionManualCuadra = true;

  var fechaInput = document.getElementById("input-fecha-hora");
  if (fechaInput) fechaInput.value = reporte.fecha_hora || obtenerFechaHoraLocalActual();

  fijarUbicacion(reporte.lat, reporte.lng, { conservarManual: true });
  seleccionarCuadraManual(reporte.cuadra || "");
  seleccionarCategoria(reporte.categoria || "");
  seleccionarActor(reporte.actor || "");

  var obsInput = document.getElementById("input-observaciones");
  if (obsInput) obsInput.value = reporte.observaciones || "";

  var editorEl = document.getElementById("editor-anonimizacion");
  var chkConf = document.getElementById("chk-confirmar-anonimizacion");
  if (reporte.foto && String(reporte.foto).indexOf("data:image/") === 0) {
    AppEstado.imagenOriginalDataUrl = reporte.foto;
    AppEstado.imagenProcesadaDataUrl = reporte.foto;
    AppEstado.regionAnonimizacion = null;
    if (editorEl) editorEl.hidden = false;
    if (chkConf) chkConf.checked = true;
    renderizarCanvasAnonimizacion();
  } else {
    AppEstado.imagenOriginalDataUrl = null;
    AppEstado.imagenProcesadaDataUrl = null;
    AppEstado.regionAnonimizacion = null;
    if (editorEl) editorEl.hidden = true;
    if (chkConf) chkConf.checked = false;
  }

  var btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");
  if (btnCancelarEdicion) btnCancelarEdicion.hidden = false;

  var tituloForm = document.getElementById("titulo-form-captura");
  if (tituloForm) tituloForm.textContent = "Editando reporte " + reporte.id;

  cambiarVista("vista-captura");
  mostrarMensajeFormulario("Editando " + reporte.id + ". Modifica los campos y pulsa Guardar reporte.", "info");
}

function guardarReporteDesdeFormulario(evento) {
  evento.preventDefault();

  var fechaHora = (document.getElementById("input-fecha-hora") || {}).value || obtenerFechaHoraLocalActual();
  var observaciones = ((document.getElementById("input-observaciones") || {}).value || "").trim();
  var chkAnon = document.getElementById("chk-confirmar-anonimizacion");

  var lat = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lat : null;
  var lng = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lng : null;
  var cuadraId = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.cuadraId : "";

  if (!cuadraId) {
    var selectC = document.getElementById("select-cuadra-manual");
    if (selectC && selectC.value) cuadraId = selectC.value;
  }

  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    mostrarMensajeFormulario("Selecciona primero un punto en el mapa o usa tu ubicación.", "error");
    return;
  }

  if (!cuadraId) {
    mostrarMensajeFormulario("Selecciona una cuadra en el desplegable.", "error");
    return;
  }

  if (!AppEstado.categoriaSeleccionada) {
    mostrarMensajeFormulario("Selecciona una categoría de obstrucción.", "error");
    return;
  }

  if (!AppEstado.actorSeleccionado) {
    mostrarMensajeFormulario("Selecciona el tipo de vehículo o actor.", "error");
    return;
  }

  var tieneFotoNueva = Boolean(AppEstado.imagenOriginalDataUrl);
  if (tieneFotoNueva && (!chkAnon || !chkAnon.checked)) {
    mostrarMensajeFormulario("Confirma que revisaste la foto y pixelaste placas o rostros visibles antes de guardar.", "error");
    return;
  }

  var cuadraObj = obtenerCuadraPorId(cuadraId);
  var tipoVia = cuadraObj ? cuadraObj.tipo_via : "secundaria";

  var fotoFinal = "fotos/captura-local.jpg";
  if (tieneFotoNueva) {
    fotoFinal = AppEstado.imagenProcesadaDataUrl || AppEstado.imagenOriginalDataUrl;
  } else if (AppEstado.editandoId) {
    var anterior = null;
    for (var i = 0; i < AppEstado.reportesUnificados.length; i++) {
      if (AppEstado.reportesUnificados[i].id === AppEstado.editandoId) {
        anterior = AppEstado.reportesUnificados[i];
        break;
      }
    }
    if (anterior && anterior.foto) {
      fotoFinal = anterior.foto;
    }
  }

  var idReporte = AppEstado.editandoId || (typeof generarIdReporteLocal === "function"
    ? generarIdReporteLocal(AppEstado.reportesUnificados)
    : "MP-LOC-" + Date.now());

  var reporteObjeto = {
    id: idReporte,
    origen: "campo",
    fecha_hora: fechaHora,
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    cuadra: cuadraId,
    categoria: AppEstado.categoriaSeleccionada,
    actor: AppEstado.actorSeleccionado,
    foto: fotoFinal,
    observaciones: observaciones
  };

  var viasSeguras = normalizarViasSeguras(AppEstado.vias);
  if (typeof calcularCriticidad === "function" && AppEstado.criterios && viasSeguras.cuadras.length > 0) {
    reporteObjeto.criticidad = calcularCriticidad(reporteObjeto, AppEstado.criterios, tipoVia);
  } else {
    reporteObjeto.criticidad = { puntaje: 5, nivel: "Medio", franja: "valle" };
  }

  var nuevaListaLocal = [];
  var reemplazado = false;
  for (var j = 0; j < AppEstado.reportesLocales.length; j++) {
    if (AppEstado.reportesLocales[j].id === idReporte) {
      nuevaListaLocal.push(reporteObjeto);
      reemplazado = true;
    } else {
      nuevaListaLocal.push(AppEstado.reportesLocales[j]);
    }
  }
  if (!reemplazado) {
    nuevaListaLocal.unshift(reporteObjeto);
  }

  var resGuardado = typeof guardarReportesLocales === "function"
    ? guardarReportesLocales(nuevaListaLocal)
    : { ok: true };

  if (!resGuardado.ok && resGuardado.motivo === "cuota_excedida" && tieneFotoNueva) {
    reporteObjeto.foto = "fotos/sin-foto-por-cuota.jpg";
    nuevaListaLocal = [];
    var rep2 = false;
    for (var k = 0; k < AppEstado.reportesLocales.length; k++) {
      if (AppEstado.reportesLocales[k].id === idReporte) {
        nuevaListaLocal.push(reporteObjeto);
        rep2 = true;
      } else {
        nuevaListaLocal.push(AppEstado.reportesLocales[k]);
      }
    }
    if (!rep2) nuevaListaLocal.unshift(reporteObjeto);
    resGuardado = typeof guardarReportesLocales === "function"
      ? guardarReportesLocales(nuevaListaLocal)
      : { ok: true };

    if (resGuardado.ok) {
      AppEstado.reportesLocales = nuevaListaLocal;
      refrescarTodoElEstado();
      limpiarFormularioCaptura();
      mostrarMensajeFormulario(
        "Reporte " + idReporte + " guardado sin foto porque el almacenamiento local alcanzó su límite. Exporta JSON o borra reportes antiguos.",
        "warn"
      );
      return;
    }
  }

  if (!resGuardado.ok) {
    mostrarMensajeFormulario(
      "No se pudo guardar en el almacenamiento local. Exporta tus datos a JSON o libera espacio.",
      "error"
    );
    return;
  }

  AppEstado.reportesLocales = nuevaListaLocal;
  refrescarTodoElEstado();
  limpiarFormularioCaptura();
  mostrarMensajeFormulario(
    "Reporte " + idReporte + " guardado (" + reporteObjeto.criticidad.nivel + ", " + reporteObjeto.criticidad.puntaje + " pts).",
    "ok"
  );
}

function eliminarReportePorId(idReporte) {
  if (!idReporte) return;

  var filtrados = [];
  for (var i = 0; i < AppEstado.reportesLocales.length; i++) {
    if (AppEstado.reportesLocales[i].id !== idReporte) {
      filtrados.push(AppEstado.reportesLocales[i]);
    }
  }

  var res = typeof guardarReportesLocales === "function"
    ? guardarReportesLocales(filtrados)
    : { ok: true };

  if (res.ok) {
    AppEstado.reportesLocales = filtrados;
    if (AppEstado.editandoId === idReporte) {
      limpiarFormularioCaptura();
    }
    refrescarTodoElEstado();
    mostrarMensajeFormulario("Reporte " + idReporte + " eliminado de los registros locales.", "info");
  }
}

function etiquetaCategoria(cat) {
  if (cat === "doble_fila") return "Doble fila / vía prohibida";
  if (cat === "bloqueo_rampa_cebra_paradero") return "Bloqueo rampa, cebra o paradero";
  if (cat === "invasion_anden") return "Invasión de andén";
  return cat || "—";
}

function etiquetaActor(actor) {
  if (actor === "vehiculo_particular") return "Vehículo particular";
  if (actor === "motocicleta") return "Motocicleta";
  if (actor === "vehiculo_carga") return "Vehículo de carga";
  if (actor === "transporte_publico") return "Transporte público";
  return actor || "—";
}

function renderizarListaRegistros(listaFiltrada) {
  var contenedor = document.getElementById("lista-registros");
  var contadorEl = document.getElementById("contador-registros");

  if (contadorEl) {
    contadorEl.textContent = listaFiltrada.length + " reporte" + (listaFiltrada.length === 1 ? "" : "s");
  }

  if (!contenedor) return;
  contenedor.innerHTML = "";

  if (listaFiltrada.length === 0) {
    contenedor.innerHTML = '<p class="texto-vacio">No hay reportes que coincidan con los filtros seleccionados.</p>';
    return;
  }

  var ordenados = listaFiltrada.slice().sort(function (a, b) {
    if (a.fecha_hora < b.fecha_hora) return 1;
    if (a.fecha_hora > b.fecha_hora) return -1;
    return 0;
  });

  var idsLocales = {};
  for (var i = 0; i < AppEstado.reportesLocales.length; i++) {
    idsLocales[AppEstado.reportesLocales[i].id] = true;
  }

  for (var j = 0; j < ordenados.length; j++) {
    var r = ordenados[j];
    var cuadraObj = obtenerCuadraPorId(r.cuadra);
    var nombreCuadra = cuadraObj ? cuadraObj.nombre : r.cuadra;
    var nivel = r.criticidad ? r.criticidad.nivel : "Bajo";
    var puntaje = r.criticidad ? r.criticidad.puntaje : 0;
    var franja = r.criticidad ? r.criticidad.franja : (typeof deducirFranjaHoraria === "function" ? deducirFranjaHoraria(r.fecha_hora, AppEstado.criterios) : "valle");
    var claseNivel = "nivel-" + nivel.toLowerCase();
    var esLocal = Boolean(idsLocales[r.id]);

    var tieneMiniatura = r.foto && String(r.foto).indexOf("data:image/") === 0;
    var bloqueFoto = tieneMiniatura
      ? '<img class="miniatura-reporte" src="' + r.foto + '" alt="Evidencia ' + escaparHTML(r.id) + '">'
      : '<span class="etiqueta-foto-ref">' + escaparHTML(r.foto || "Sin foto") + "</span>";

    var botonesAccion = esLocal
      ? '<div class="acciones-tarjeta">' +
        '<button type="button" class="btn-secundario btn-sm btn-editar-rep" data-id="' + escaparHTML(r.id) + '">Editar</button>' +
        '<button type="button" class="btn-peligro btn-sm btn-eliminar-rep" data-id="' + escaparHTML(r.id) + '">Eliminar</button>' +
        "</div>"
      : '<span class="etiqueta-precargado">Precargado</span>';

    var tarjeta = document.createElement("article");
    tarjeta.className = "tarjeta-reporte";
    tarjeta.innerHTML =
      '<div class="tarjeta-cabecera">' +
        '<div>' +
          '<strong class="id-reporte">' + escaparHTML(r.id) + "</strong> " +
          '<span class="fecha-reporte">' + escaparHTML((r.fecha_hora || "").replace("T", " ")) + "</span>" +
        "</div>" +
        '<span class="badge-criticidad ' + claseNivel + '">' + escaparHTML(nivel) + " (" + puntaje + ")</span>" +
      "</div>" +
      '<p class="cuadra-reporte">' + escaparHTML(nombreCuadra) + "</p>" +
      '<div class="meta-reporte">' +
        "<span><strong>Categoría:</strong> " + escaparHTML(etiquetaCategoria(r.categoria)) + "</span>" +
        "<span><strong>Actor:</strong> " + escaparHTML(etiquetaActor(r.actor)) + "</span>" +
        "<span><strong>Franja:</strong> " + escaparHTML(franja === "pico" ? "Hora pico" : "Hora valle") + "</span>" +
      "</div>" +
      (r.observaciones ? '<p class="obs-reporte">' + escaparHTML(r.observaciones) + "</p>" : "") +
      '<div class="pie-tarjeta">' +
        bloqueFoto +
        botonesAccion +
      "</div>";

    contenedor.appendChild(tarjeta);
  }

  var btnsEditar = contenedor.querySelectorAll(".btn-editar-rep");
  for (var eIdx = 0; eIdx < btnsEditar.length; eIdx++) {
    btnsEditar[eIdx].addEventListener("click", function () {
      var idBuscado = this.getAttribute("data-id");
      for (var x = 0; x < AppEstado.reportesUnificados.length; x++) {
        if (AppEstado.reportesUnificados[x].id === idBuscado) {
          cargarReporteEnFormulario(AppEstado.reportesUnificados[x]);
          break;
        }
      }
    });
  }

  var btnsEliminar = contenedor.querySelectorAll(".btn-eliminar-rep");
  for (var dIdx = 0; dIdx < btnsEliminar.length; dIdx++) {
    btnsEliminar[dIdx].addEventListener("click", function () {
      var idElim = this.getAttribute("data-id");
      eliminarReportePorId(idElim);
    });
  }
}

function renderizarResumenOperativo(listaFiltrada) {
  var contenedorTop = document.getElementById("top5-cuadras");
  var contenedorStats = document.getElementById("estadisticas-resumen");
  var viasSeguras = normalizarViasSeguras(AppEstado.vias);
  if (!contenedorTop || !contenedorStats || typeof generarResumenOperativo !== "function" || viasSeguras.cuadras.length === 0) return;

  var resumen = generarResumenOperativo(listaFiltrada, viasSeguras, AppEstado.criterios);

  contenedorStats.innerHTML =
    '<div class="kpi-grid">' +
      '<div class="kpi-card"><span class="kpi-valor">' + resumen.totalReportes + '</span><span class="kpi-label">Reportes en vista</span></div>' +
      '<div class="kpi-card kpi-alto"><span class="kpi-valor">' + resumen.conteoNiveles.Alto + '</span><span class="kpi-label">Criticidad Alta</span></div>' +
      '<div class="kpi-card kpi-medio"><span class="kpi-valor">' + resumen.conteoNiveles.Medio + '</span><span class="kpi-label">Criticidad Media</span></div>' +
      '<div class="kpi-card kpi-bajo"><span class="kpi-valor">' + resumen.conteoNiveles.Bajo + '</span><span class="kpi-label">Criticidad Baja</span></div>' +
    "</div>";

  if (!resumen.top5 || resumen.top5.length === 0) {
    contenedorTop.innerHTML = '<p class="texto-vacio">No hay datos suficientes para calcular el ranking de cuadras.</p>';
    return;
  }

  var html = "";
  for (var i = 0; i < resumen.top5.length; i++) {
    var item = resumen.top5[i];
    html +=
      '<article class="tarjeta-top">' +
        '<div class="top-cabecera">' +
          '<span class="puesto-top">#' + (i + 1) + "</span>" +
          '<div class="top-titulo-wrap">' +
            "<strong>" + escaparHTML(item.nombre) + "</strong>" +
            '<span class="top-sub">' + item.totalReportes + " reportes · Puntaje acumulado: " + item.puntajeAcumulado + " · Promedio: " + item.promedioCriticidad + "</span>" +
          "</div>" +
        "</div>" +
        '<p class="recomendacion-top"><strong>Acción sugerida (' + escaparHTML(item.reglaAplicada) + "):</strong> " + escaparHTML(item.recomendacion) + "</p>" +
      "</article>";
  }
  contenedorTop.innerHTML = html;
}

function configurarControlesModoMapa() {
  var botonesModo = document.querySelectorAll(".btn-modo-mapa");
  for (var i = 0; i < botonesModo.length; i++) {
    botonesModo[i].addEventListener("click", function () {
      var modo = this.getAttribute("data-modo") || "ambos";
      if (typeof cambiarModoMapaRegistros === "function") {
        cambiarModoMapaRegistros(modo);
      }

      for (var j = 0; j < botonesModo.length; j++) {
        var activo = botonesModo[j].getAttribute("data-modo") === modo;
        botonesModo[j].classList.toggle("activo", activo);
        botonesModo[j].setAttribute("aria-pressed", activo ? "true" : "false");
      }
    });
  }
}

function configurarFiltros() {
  var inputTexto = document.getElementById("filtro-texto");
  var selCuadra = document.getElementById("filtro-cuadra");
  var selCat = document.getElementById("filtro-categoria");
  var selActor = document.getElementById("filtro-actor");
  var selNivel = document.getElementById("filtro-nivel");
  var selFranja = document.getElementById("filtro-franja");
  var btnLimpiar = document.getElementById("btn-limpiar-filtros");

  function alCambiarFiltro() {
    AppEstado.filtros = {
      texto: inputTexto ? inputTexto.value : "",
      cuadra: selCuadra ? selCuadra.value : "",
      categoria: selCat ? selCat.value : "",
      actor: selActor ? selActor.value : "",
      nivel: selNivel ? selNivel.value : "",
      franja: selFranja ? selFranja.value : ""
    };
    aplicarFiltrosYActualizarVistas();
  }

  if (inputTexto) inputTexto.addEventListener("input", alCambiarFiltro);
  if (selCuadra) selCuadra.addEventListener("change", alCambiarFiltro);
  if (selCat) selCat.addEventListener("change", alCambiarFiltro);
  if (selActor) selActor.addEventListener("change", alCambiarFiltro);
  if (selNivel) selNivel.addEventListener("change", alCambiarFiltro);
  if (selFranja) selFranja.addEventListener("change", alCambiarFiltro);

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", function () {
      if (inputTexto) inputTexto.value = "";
      if (selCuadra) selCuadra.value = "";
      if (selCat) selCat.value = "";
      if (selActor) selActor.value = "";
      if (selNivel) selNivel.value = "";
      if (selFranja) selFranja.value = "";
      AppEstado.filtros = {
        texto: "",
        cuadra: "",
        categoria: "",
        actor: "",
        nivel: "",
        franja: ""
      };
      aplicarFiltrosYActualizarVistas();
    });
  }
}

function aplicarFiltrosYActualizarVistas() {
  var filtrados = typeof filtrarReportes === "function"
    ? filtrarReportes(AppEstado.reportesUnificados, AppEstado.filtros, AppEstado.criterios)
    : AppEstado.reportesUnificados;

  renderizarListaRegistros(filtrados);
  if (typeof actualizarMarcadoresRegistros === "function") {
    actualizarMarcadoresRegistros(filtrados, normalizarViasSeguras(AppEstado.vias));
  }
  renderizarResumenOperativo(filtrados);
}

function refrescarTodoElEstado() {
  sincronizarListaUnicaReportes();
  if (typeof actualizarPuntosEnMapaCaptura === "function") {
    actualizarPuntosEnMapaCaptura(AppEstado.reportesUnificados);
  }
  aplicarFiltrosYActualizarVistas();
}

function configurarExportarImportar() {
  var btnExportar = document.getElementById("btn-exportar-json");
  var inputImportar = document.getElementById("input-importar-json");
  var msgEl = document.getElementById("mensaje-transferencia");

  if (btnExportar && typeof exportarReportesAJSON === "function") {
    btnExportar.addEventListener("click", function () {
      exportarReportesAJSON(AppEstado.reportesLocales);
      if (msgEl) {
        msgEl.textContent = "Archivo JSON exportado con " + AppEstado.reportesLocales.length + " reporte(s) local(es).";
        msgEl.hidden = false;
      }
    });
  }

  if (inputImportar && typeof importarReportesDesdeArchivo === "function") {
    inputImportar.addEventListener("change", function () {
      var archivo = inputImportar.files && inputImportar.files[0];
      if (!archivo) return;

      importarReportesDesdeArchivo(archivo, AppEstado.reportesLocales, normalizarViasSeguras(AppEstado.vias), function (res) {
        inputImportar.value = "";
        if (!msgEl) return;

        if (!res.ok) {
          msgEl.textContent = res.mensaje || "No se pudo importar el archivo.";
          msgEl.hidden = false;
          return;
        }

        AppEstado.reportesLocales = res.reportes;
        refrescarTodoElEstado();
        msgEl.textContent =
          "Importados " + res.importados + " reporte(s)" +
          (res.omitidos > 0 ? " (" + res.omitidos + " omitidos por duplicado o formato)" : "") + ".";
        msgEl.hidden = false;
      });
    });
  }
}

function cambiarVista(idVistaActiva) {
  var vistas = document.querySelectorAll(".vista-app");
  for (var i = 0; i < vistas.length; i++) {
    var esActiva = vistas[i].id === idVistaActiva;
    vistas[i].hidden = !esActiva;
    vistas[i].classList.toggle("activa", esActiva);
  }

  var pestanas = document.querySelectorAll(".btn-pestana");
  for (var j = 0; j < pestanas.length; j++) {
    var target = pestanas[j].getAttribute("data-vista");
    var activa = target === idVistaActiva;
    pestanas[j].classList.toggle("activa", activa);
    pestanas[j].setAttribute("aria-selected", activa ? "true" : "false");
  }

  if (idVistaActiva === "vista-captura" && typeof redimensionarMapaCaptura === "function") {
    redimensionarMapaCaptura();
  } else if (idVistaActiva === "vista-registros" && typeof redimensionarMapaRegistros === "function") {
    redimensionarMapaRegistros();
  } else if (idVistaActiva === "vista-resumen") {
    var filtrados = typeof filtrarReportes === "function"
      ? filtrarReportes(AppEstado.reportesUnificados, AppEstado.filtros, AppEstado.criterios)
      : AppEstado.reportesUnificados;
    renderizarResumenOperativo(filtrados);
  }
}

function configurarPestanas() {
  var pestanas = document.querySelectorAll(".btn-pestana");
  for (var i = 0; i < pestanas.length; i++) {
    pestanas[i].addEventListener("click", function () {
      var vistaId = this.getAttribute("data-vista");
      if (vistaId) {
        cambiarVista(vistaId);
      }
    });
  }
}

function inicializarApp() {
  var fechaInput = document.getElementById("input-fecha-hora");
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = obtenerFechaHoraLocalActual();
  }

  configurarPestanas();
  configurarBotonesSeleccion();
  configurarAnonimizacionCanvas();
  configurarControlesModoMapa();
  configurarFiltros();
  configurarExportarImportar();
  configurarBuscadorDireccion();

  var btnUbicacion = document.getElementById("btn-ubicacion");
  if (btnUbicacion) {
    btnUbicacion.addEventListener("click", function () {
      AppEstado.seleccionManualCuadra = false;
      solicitarGeolocalizacion(false);
    });
  }

  var selectManual = document.getElementById("select-cuadra-manual");
  if (selectManual) {
    selectManual.addEventListener("change", function () {
      seleccionarCuadraManual(this.value);
    });
  }

  var formCaptura = document.getElementById("form-captura");
  if (formCaptura) {
    formCaptura.addEventListener("submit", guardarReporteDesdeFormulario);
  }

  var btnLimpiarForm = document.getElementById("btn-limpiar-formulario");
  if (btnLimpiarForm) {
    btnLimpiarForm.addEventListener("click", function () {
      limpiarFormularioCaptura();
      mostrarMensajeFormulario("Formulario limpio.", "info");
    });
  }

  var btnCancelarEdicion = document.getElementById("btn-cancelar-edicion");
  if (btnCancelarEdicion) {
    btnCancelarEdicion.addEventListener("click", function () {
      limpiarFormularioCaptura();
      mostrarMensajeFormulario("Edición cancelada.", "info");
    });
  }

  AppEstado.reportesLocales = typeof cargarReportesLocales === "function" ? cargarReportesLocales() : [];

  Promise.all([
    cargarJSON("datos/vias.json", {
      zona: { nombre: "Santa Marta", centro: [11.2232, -74.1885], zoom: 15 },
      cuadras: []
    }),
    cargarJSON("datos/criterios.json", null),
    cargarJSON("datos/reportes.json", [])
  ]).then(function (resultados) {
    AppEstado.vias = normalizarViasSeguras(resultados[0]);
    AppEstado.criterios = resultados[1];
    AppEstado.reportesPrecargados = Array.isArray(resultados[2]) ? resultados[2] : [];

    actualizarSubtituloZona(AppEstado.vias);
    poblarSelectoresCuadras(AppEstado.vias);

    if (typeof iniciarMapaCaptura === "function") {
      iniciarMapaCaptura("mapa-captura", AppEstado.vias, function (lat, lng) {
        AppEstado.seleccionManualCuadra = false;
        fijarUbicacion(lat, lng, { conservarManual: false });
      });
    }

    if (typeof iniciarMapaRegistros === "function") {
      iniciarMapaRegistros("mapa-registros", AppEstado.vias);
    }

    var centro = (AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.centro)
      ? AppEstado.vias.zona.centro
      : [11.2232, -74.1885];
    fijarUbicacion(centro[0], centro[1], { conservarManual: false });

    refrescarTodoElEstado();
    solicitarGeolocalizacion(true);
  });
}

document.addEventListener("DOMContentLoaded", inicializarApp);
