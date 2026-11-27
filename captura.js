/* ============================================================================
 * ARCHIVO: captura.js
 * ============================================================================ */

var AppEstado = {
  vias: null,
  criterios: null,
  reportesPrecargados: [],
  reportesLocales: [],
  reportesUnificados: [],
  ubicacionActual: null,
  seleccionManualCuadra: false,
  categoriaSeleccionada: "",
  actorSeleccionado: "",
  editandoId: null,
  imagenOriginalDataUrl: null,
  imagenProcesadaDataUrl: null,
  regionAnonimizacion: null,
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

function cargarJSONSeguro(ruta, valorDefecto) {
  return fetch(ruta + "?v=" + Date.now())
    .then(function (resp) {
      if (!resp.ok) {
        throw new Error("HTTP " + resp.status + " en " + ruta);
      }
      return resp.json();
    })
    .catch(function (err) {
      console.warn("Aviso cargando " + ruta + ":", err.message);
      return valorDefecto;
    });
}

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

function encontrarCuadraMasCercana(lat, lng, vias) {
  if (!vias || !Array.isArray(vias.cuadras) || vias.cuadras.length === 0) {
    return { cuadra: null, distanciaM: null, fueraDeZona: false };
  }

  var mejorCuadra = null;
  var mejorDistancia = Infinity;

  for (var i = 0; i < vias.cuadras.length; i++) {
    var c = vias.cuadras[i];
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

function obtenerCuadraPorId(cuadraId) {
  if (!AppEstado.vias || !Array.isArray(AppEstado.vias.cuadras)) return null;
  for (var i = 0; i < AppEstado.vias.cuadras.length; i++) {
    if (AppEstado.vias.cuadras[i].id === cuadraId) {
      return AppEstado.vias.cuadras[i];
    }
  }
  return null;
}

function recalcularTodosLosReportes(lista, criterios, vias) {
  var resultado = [];
  for (var i = 0; i < lista.length; i++) {
    var item = Object.assign({}, lista[i]);
    var cuadraObj = obtenerCuadraPorId(item.cuadra);
    var tipoVia = cuadraObj ? cuadraObj.tipo_via : "secundaria";
    if (typeof calcularCriticidad === "function") {
      item.criticidad = calcularCriticidad(item, criterios, tipoVia);
    } else if (!item.criticidad) {
      item.criticidad = { puntaje: 5, nivel: "Medio", franja: "valle" };
    }
    resultado.push(item);
  }
  return resultado;
}

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

function obtenerFechaHoraLocalActual() {
  var ahora = new Date();
  var anio = ahora.getFullYear();
  var mes = String(ahora.getMonth() + 1).padStart(2, "0");
  var dia = String(ahora.getDate()).padStart(2, "0");
  var horas = String(ahora.getHours()).padStart(2, "0");
  var mins = String(ahora.getMinutes()).padStart(2, "0");
  return anio + "-" + mes + "-" + dia + "T" + horas + ":" + mins;
}

function escaparHTML(texto) {
  return String(texto || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mostrarCoordenadasTexto(lat, lng) {
  var el = document.getElementById("texto-coordenadas");
  if (!el) return;
  if (typeof lat === "number" && typeof lng === "number" && !isNaN(lat) && !isNaN(lng)) {
    el.textContent = "Lat: " + lat.toFixed(6) + ", Lng: " + lng.toFixed(6);
  } else {
    el.textContent = "Lat: —, Lng: —";
  }
}

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

function solicitarGeolocalizacion(esAutomaticaAlInicio) {
  var estadoGps = document.getElementById("estado-gps");
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    function (pos) {
      if (esAutomaticaAlInicio && AppEstado.seleccionManualCuadra) return;
      if (estadoGps) {
        estadoGps.textContent = "Ubicación GPS detectada (±" + Math.round(pos.coords.accuracy || 15) + " m).";
      }
      fijarUbicacion(pos.coords.latitude, pos.coords.longitude, { conservarManual: AppEstado.seleccionManualCuadra });
    },
    function () {
      if (estadoGps && !esAutomaticaAlInicio) {
        estadoGps.textContent = "Toca el mapa para marcar el punto.";
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

function poblarSelectoresCuadras(vias) {
  var selectManual = document.getElementById("select-cuadra-manual");
  var filtroCuadra = document.getElementById("filtro-cuadra");

  if (selectManual) selectManual.innerHTML = '<option value="">-- Selecciona una cuadra --</option>';
  if (filtroCuadra) filtroCuadra.innerHTML = '<option value="">Todas las cuadras</option>';

  if (!vias || !Array.isArray(vias.cuadras)) return;

  for (var i = 0; i < vias.cuadras.length; i++) {
    var c = vias.cuadras[i];
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

function seleccionarCuadraManual(cuadraId) {
  AppEstado.seleccionManualCuadra = Boolean(cuadraId);
  var cuadra = obtenerCuadraPorId(cuadraId);

  if (!cuadra) {
    if (AppEstado.ubicacionActual) AppEstado.ubicacionActual.cuadraId = "";
    actualizarUIAsignacionCuadra("");
    return;
  }

  var lat = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lat : null;
  var lng = AppEstado.ubicacionActual ? AppEstado.ubicacionActual.lng : null;

  if ((typeof lat !== "number" || isNaN(lat)) && Array.isArray(cuadra.extremos) && cuadra.extremos.length > 0) {
    lat = Number(cuadra.extremos[0][0]);
    lng = Number(cuadra.extremos[0][1]);
  }

  AppEstado.ubicacionActual = {
    lat: typeof lat === "number" && !isNaN(lat) ? Number(lat.toFixed(6)) : null,
    lng: typeof lng === "number" && !isNaN(lng) ? Number(lng.toFixed(6)) : null,
    cuadraId: cuadra.id,
    distanciaM: 0,
    fueraDeZona: false
  };

  if (AppEstado.ubicacionActual.lat !== null && AppEstado.ubicacionActual.lng !== null) {
    mostrarCoordenadasTexto(AppEstado.ubicacionActual.lat, AppEstado.ubicacionActual.lng);
    if (typeof actualizarMarcadorCaptura === "function") {
      actualizarMarcadorCaptura(AppEstado.ubicacionActual.lat, AppEstado.ubicacionActual.lng, function (nLat, nLng) {
        fijarUbicacion(nLat, nLng, { conservarManual: false, sinMoverMapa: true });
      });
    }
  }

  actualizarUIAsignacionCuadra(cuadra.id);
}

function aplicarFiltrosYActualizarVistas() {
  var filtrados = typeof filtrarReportes === "function"
    ? filtrarReportes(AppEstado.reportesUnificados, AppEstado.filtros, AppEstado.criterios)
    : AppEstado.reportesUnificados;

  var contadorEl = document.getElementById("contador-registros");
  if (contadorEl) {
    contadorEl.textContent = filtrados.length + " reporte" + (filtrados.length === 1 ? "" : "s");
  }

  if (typeof actualizarMarcadoresRegistros === "function") {
    actualizarMarcadoresRegistros(filtrados, AppEstado.vias);
  }
}

function refrescarTodoElEstado() {
  sincronizarListaUnicaReportes();
  if (typeof actualizarPuntosEnMapaCaptura === "function") {
    actualizarPuntosEnMapaCaptura(AppEstado.reportesUnificados);
  }
  aplicarFiltrosYActualizarVistas();
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
    var activa = pestanas[j].getAttribute("data-vista") === idVistaActiva;
    pestanas[j].classList.toggle("activa", activa);
    pestanas[j].setAttribute("aria-selected", activa ? "true" : "false");
  }

  if (idVistaActiva === "vista-captura" && typeof redimensionarMapaCaptura === "function") {
    redimensionarMapaCaptura();
  } else if (idVistaActiva === "vista-registros" && typeof redimensionarMapaRegistros === "function") {
    redimensionarMapaRegistros();
  }
}

function configurarPestanas() {
  var pestanas = document.querySelectorAll(".btn-pestana");
  for (var i = 0; i < pestanas.length; i++) {
    pestanas[i].addEventListener("click", function () {
      var vistaId = this.getAttribute("data-vista");
      if (vistaId) cambiarVista(vistaId);
    });
  }
}

function inicializarApp() {
  var fechaInput = document.getElementById("input-fecha-hora");
  if (fechaInput && !fechaInput.value) {
    fechaInput.value = obtenerFechaHoraLocalActual();
  }

  configurarPestanas();

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

  AppEstado.reportesLocales = typeof cargarReportesLocales === "function" ? cargarReportesLocales() : [];

  Promise.all([
    cargarJSONSeguro("datos/vias.json", {
      zona: { nombre: "Santa Marta", centro: [11.2232, -74.1885], zoom: 15 },
      cuadras: []
    }),
    cargarJSONSeguro("datos/criterios.json", null),
    cargarJSONSeguro("datos/reportes.json", [])
  ]).then(function (resultados) {
    AppEstado.vias = resultados[0];
    AppEstado.criterios = resultados[1];
    AppEstado.reportesPrecargados = Array.isArray(resultados[2]) ? resultados[2] : [];

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
