/* ============================================================================
 * ARCHIVO: captura.js
 * DEPENDENCIAS: criticidad.js, almacenamiento.js, filtros.js, resumen.js, mapa.js
 * RESPONSABILIDAD: Controlador principal de la aplicación. Carga los JSON con fetch,
 * gestiona GPS, asignación geométrica de cuadra más cercana, validación del
 * formulario, procesamiento/pixelado irreversible de foto en canvas, armado
 * del reporte, guardado en localStorage y renderizado de la vista Registros.
 * ============================================================================ */

var AppEstado = {
  vias: null,
  criterios: null,
  reportesPrecargados: [],
  reportesLocales: [],
  reportesActivos: [],
  reportesFiltrados: [],
  filtrosActivos: { cuadra: "todas", franja: "todas", categoria: "todas", actor: "todas" },
  config: { iniciales: "", origen: "campo" },

  lat: null,
  lng: null,
  precisionGps: null,
  cuadraAsignada: "",
  seleccionManualCuadra: false,
  fueraDeZona: false,
  categoriaSeleccionada: "",
  actorSeleccionado: "",
  tieneFoto: false,
  fechaHoraManual: false,
  guardando: false,
  inicioCronometroMs: Date.now()
};

var MAX_HISTORIAL_CANVAS = 10;
var historialCanvas = [];
var dibujandoPixelado = false;
var puntoInicioPixel = null;
var idPendienteEliminar = null;

var ETIQUETAS_CATEGORIA = typeof CATALOGO_CATEGORIAS !== "undefined"
  ? CATALOGO_CATEGORIAS
  : {
      doble_fila: "Doble fila / vía prohibida",
      bloqueo_rampa_cebra_paradero: "Bloqueo rampa, cebra o paradero",
      invasion_anden: "Invasión de andén"
    };

var ETIQUETAS_ACTOR = typeof CATALOGO_ACTORES !== "undefined"
  ? CATALOGO_ACTORES
  : {
      vehiculo_particular: "Vehículo particular",
      motocicleta: "Motocicleta",
      vehiculo_carga: "Vehículo de carga",
      mobiliario_comercial: "Mobiliario comercial"
    };

function escaparHtml(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function obtenerFechaHoraLocal() {
  var d = new Date();
  var anio = String(d.getFullYear());
  var mes = String(d.getMonth() + 1).padStart(2, "0");
  var dia = String(d.getDate()).padStart(2, "0");
  var hora = String(d.getHours()).padStart(2, "0");
  var min = String(d.getMinutes()).padStart(2, "0");
  return anio + "-" + mes + "-" + dia + "T" + hora + ":" + min;
}

function distanciaPuntoASegmentoMetros(latP, lngP, extremoA, extremoB) {
  var lat1 = extremoA[0];
  var lng1 = extremoA[1];
  var lat2 = extremoB[0];
  var lng2 = extremoB[1];

  var latRef = (lat1 + lat2 + latP) / 3;
  var metrosPorLat = 111320;
  var metrosPorLng = 111320 * Math.cos((latRef * Math.PI) / 180);

  var xB = (lng2 - lng1) * metrosPorLng;
  var yB = (lat2 - lat1) * metrosPorLat;
  var xP = (lngP - lng1) * metrosPorLng;
  var yP = (latP - lat1) * metrosPorLat;

  var largoCuadrado = xB * xB + yB * yB;
  if (largoCuadrado === 0) {
    return Math.sqrt(xP * xP + yP * yP);
  }

  var t = (xP * xB + yP * yB) / largoCuadrado;
  t = Math.max(0, Math.min(1, t));

  var proyX = t * xB;
  var proyY = t * yB;
  var dx = xP - proyX;
  var dy = yP - proyY;

  return Math.sqrt(dx * dx + dy * dy);
}

function buscarCuadraMasCercana(lat, lng, vias) {
  if (!vias || !Array.isArray(vias.cuadras) || vias.cuadras.length === 0) {
    return { cuadra: null, distanciaMetros: Infinity };
  }

  var mejorCuadra = null;
  var menorDistancia = Infinity;

  for (var i = 0; i < vias.cuadras.length; i++) {
    var c = vias.cuadras[i];
    if (!Array.isArray(c.extremos) || c.extremos.length < 2) continue;

    for (var j = 0; j < c.extremos.length - 1; j++) {
      var dist = distanciaPuntoASegmentoMetros(lat, lng, c.extremos[j], c.extremos[j + 1]);
      if (dist < menorDistancia) {
        menorDistancia = dist;
        mejorCuadra = c;
      }
    }
  }

  return { cuadra: mejorCuadra, distanciaMetros: menorDistancia };
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

function sincronizarListaUnicaReportes() {
  AppEstado.reportesLocales = cargarReportesLocales();

  var idsPrecargados = {};
  for (var i = 0; i < AppEstado.reportesPrecargados.length; i++) {
    var repPre = Object.assign({}, AppEstado.reportesPrecargados[i], { _origenArchivo: "precargado" });
    idsPrecargados[repPre.id] = repPre;
  }

  var combinados = [];
  for (var j = 0; j < AppEstado.reportesPrecargados.length; j++) {
    if (obtenerCuadraPorId(AppEstado.reportesPrecargados[j].cuadra)) {
      combinados.push(
        Object.assign({}, AppEstado.reportesPrecargados[j], { _esLocal: false })
      );
    }
  }

  for (var k = 0; k < AppEstado.reportesLocales.length; k++) {
    var repLoc = AppEstado.reportesLocales[k];
    if (!idsPrecargados[repLoc.id] && obtenerCuadraPorId(repLoc.cuadra)) {
      combinados.push(Object.assign({}, repLoc, { _esLocal: true }));
    }
  }

  AppEstado.reportesActivos = recalcularTodosLosReportes(
    combinados,
    AppEstado.criterios,
    AppEstado.vias
  );

  actualizarPuntosEnMapaCaptura(AppEstado.reportesActivos);
  aplicarFiltrosYActualizarRegistros();
}

function aplicarFiltrosYActualizarRegistros() {
  var filtrados = typeof filtrarReportes === "function"
    ? filtrarReportes(AppEstado.reportesActivos, AppEstado.filtrosActivos, AppEstado.criterios)
    : AppEstado.reportesActivos.slice();

  AppEstado.reportesFiltrados = filtrados;

  renderizarEstadisticasFiltros(filtrados, AppEstado.reportesActivos.length);
  actualizarMarcadoresRegistros(filtrados, AppEstado.vias);
  renderizarResumenOperativoTop5(filtrados);
  renderizarVistaRegistros();
}

function renderizarEstadisticasFiltros(listaFiltrada, totalGeneral) {
  var conteoEl = document.getElementById("conteo-filtrado-texto");
  if (conteoEl) {
    conteoEl.textContent =
      "Mostrando " + listaFiltrada.length + " de " + totalGeneral + " reportes";
  }

  var contenedorPct = document.getElementById("desglose-porcentajes-categoria");
  if (!contenedorPct || typeof calcularEstadisticasFiltradas !== "function") return;

  var stats = calcularEstadisticasFiltradas(listaFiltrada);
  contenedorPct.innerHTML = "";

  for (var i = 0; i < stats.categorias.length; i++) {
    var cat = stats.categorias[i];
    var pctTexto = cat.porcentaje.toFixed(1).replace(".", ",") + "%";
    var fila = document.createElement("div");
    fila.className = "item-porcentaje";
    fila.innerHTML =
      '<div class="fila-texto-porcentaje">' +
        '<span><strong>' + escaparHtml(cat.etiqueta) + '</strong></span>' +
        '<span class="texto-mono">' + cat.conteo + ' (' + pctTexto + ')</span>' +
      '</div>' +
      '<div class="barra-progreso-fondo">' +
        '<div class="barra-progreso-relleno" style="width:' + Math.min(100, cat.porcentaje) + '%"></div>' +
      '</div>';
    contenedorPct.appendChild(fila);
  }
}

function renderizarResumenOperativoTop5(listaBase) {
  var contenedor = document.getElementById("lista-top-5-cuadras");
  if (!contenedor || typeof generarResumenOperativo !== "function") return;

  var subtitulo = document.getElementById("subtitulo-resumen-operativo");
  if (subtitulo) {
    var hayFiltro =
      AppEstado.filtrosActivos.cuadra !== "todas" ||
      AppEstado.filtrosActivos.franja !== "todas" ||
      AppEstado.filtrosActivos.categoria !== "todas" ||
      AppEstado.filtrosActivos.actor !== "todas";

    subtitulo.textContent = hayFiltro
      ? "Calculado sobre los " + listaBase.length + " reporte(s) que cumplen los filtros activos."
      : "Calculado sobre los " + listaBase.length + " reporte(s) activos, ordenados por puntaje acumulado.";
  }

  var top5 = generarResumenOperativo(listaBase, AppEstado.vias, AppEstado.criterios);
  contenedor.innerHTML = "";

  if (top5.length === 0) {
    contenedor.innerHTML =
      '<p class="texto-suave">No hay reportes en la selección actual para generar el Top 5 operativo.</p>';
    return;
  }

  for (var i = 0; i < top5.length; i++) {
    var item = top5[i];
    var claseSeveridad = "";
    if (item.conteoNivel.Alto >= 3 || item.puntajeAcumulado >= 15) {
      claseSeveridad = " top5-critico";
    } else if (item.puntajeAcumulado >= 7) {
      claseSeveridad = " top5-medio";
    }

    var tipoViaTexto = item.tipoVia === "arterial" ? "Vía arterial" : "Vía secundaria";

    var card = document.createElement("article");
    card.className = "tarjeta-top5" + claseSeveridad;
    card.innerHTML =
      '<div class="top5-cabecera">' +
        '<div>' +
          '<span class="top5-puesto">#' + (i + 1) + '</span>' +
          '<strong>' + escaparHtml(item.nombreCuadra) + '</strong> ' +
          '<span class="texto-mono">(' + escaparHtml(item.cuadraId) + ')</span>' +
        '</div>' +
        '<span class="top5-puntaje">' + item.puntajeAcumulado + ' pts</span>' +
      '</div>' +
      '<div class="top5-metricas">' +
        tipoViaTexto + ' · ' + item.totalReportes + ' reporte(s) ' +
        '(Alto: ' + item.conteoNivel.Alto + ', Medio: ' + item.conteoNivel.Medio + ', Bajo: ' + item.conteoNivel.Bajo + ') · ' +
        'Pico: ' + item.porFranja.pico + ' / Valle: ' + item.porFranja.valle +
      '</div>' +
      '<div class="caja-recomendacion-top5">' +
        '<div class="titulo-recomendacion">Recomendación: ' + escaparHtml(item.recomendacion) + '</div>' +
        '<div class="texto-regla-aplicada">' + escaparHtml(item.reglaAplicada) + '</div>' +
      '</div>';

    contenedor.appendChild(card);
  }
}

function cargarDatosIniciales() {
  return Promise.all([
    fetch("datos/vias.json").then(function (r) {
      if (!r.ok) throw new Error("No se pudo cargar datos/vias.json");
      return r.json();
    }),
    fetch("datos/criterios.json").then(function (r) {
      if (!r.ok) throw new Error("No se pudo cargar datos/criterios.json");
      return r.json();
    }),
    fetch("datos/reportes.json").then(function (r) {
      if (!r.ok) throw new Error("No se pudo cargar datos/reportes.json");
      return r.json();
    })
  ]);
}

function fijarUbicacion(lat, lng, precisionMetros) {
  var latRedondeada = Number(Number(lat).toFixed(6));
  var lngRedondeada = Number(Number(lng).toFixed(6));

  AppEstado.lat = latRedondeada;
  AppEstado.lng = lngRedondeada;
  AppEstado.precisionGps = typeof precisionMetros === "number" ? Math.round(precisionMetros) : null;

  var textoCoords = document.getElementById("texto-coordenadas");
  textoCoords.textContent = "Lat: " + latRedondeada.toFixed(6) + ", Lng: " + lngRedondeada.toFixed(6);

  var avisoPrec = document.getElementById("aviso-precision");
  if (AppEstado.precisionGps !== null) {
    if (AppEstado.precisionGps > 50) {
      avisoPrec.textContent =
        "Precisión GPS baja (±" + AppEstado.precisionGps + " m). Ajusta el marcador en el mapa si es necesario.";
      avisoPrec.className = "aviso-alerta";
      avisoPrec.hidden = false;
    } else {
      avisoPrec.textContent = "Precisión GPS: ±" + AppEstado.precisionGps + " m.";
      avisoPrec.className = "aviso-info";
      avisoPrec.hidden = false;
    }
  } else {
    avisoPrec.hidden = true;
  }

  actualizarMarcadorCaptura(latRedondeada, lngRedondeada, function (nuevaLat, nuevaLng) {
    fijarUbicacion(nuevaLat, nuevaLng, null);
  });

  var resultadoCuadra = buscarCuadraMasCercana(latRedondeada, lngRedondeada, AppEstado.vias);
  var radioMax = (AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.radio_max_m) || 60;
  var avisoZona = document.getElementById("aviso-fuera-zona");

  if (resultadoCuadra.cuadra && resultadoCuadra.distanciaMetros <= radioMax) {
    AppEstado.fueraDeZona = false;
    avisoZona.hidden = true;
    asignarCuadraEnFormulario(resultadoCuadra.cuadra.id);
  } else {
    AppEstado.fueraDeZona = true;
    var distTexto = isFinite(resultadoCuadra.distanciaMetros)
      ? Math.round(resultadoCuadra.distanciaMetros) + " m"
      : "distancia desconocida";
    avisoZona.textContent =
      "Punto fuera de la zona de estudio (a " + distTexto + " de la cuadra más cercana). Elige una cuadra manualmente abajo.";
    avisoZona.hidden = false;
    asignarCuadraEnFormulario("");
  }

  limpiarErrorCampo("error-ubicacion");
}

function asignarCuadraEnFormulario(cuadraId) {
  AppEstado.cuadraAsignada = cuadraId || "";
  var selectCuadra = document.getElementById("select-cuadra");
  selectCuadra.value = AppEstado.cuadraAsignada;

  var nombreEl = document.getElementById("cuadra-nombre-lectura");
  var tipoEl = document.getElementById("cuadra-tipo-lectura");

  var cuadraObj = obtenerCuadraPorId(AppEstado.cuadraAsignada);
  if (cuadraObj) {
    nombreEl.textContent = cuadraObj.nombre + " (" + cuadraObj.id + ")";
    tipoEl.textContent = cuadraObj.tipo_via === "arterial" ? "Vía arterial" : "Vía secundaria";
    tipoEl.className = "etiqueta-via " + (cuadraObj.tipo_via === "arterial" ? "via-arterial" : "via-secundaria");
    limpiarErrorCampo("error-cuadra");
  } else {
    nombreEl.textContent = "Sin cuadra asignada";
    tipoEl.textContent = "Tipo de vía: —";
    tipoEl.className = "etiqueta-via";
  }

  resaltarCuadraCaptura(AppEstado.cuadraAsignada);
}

function seleccionarCuadraManual(cuadraId) {
  AppEstado.seleccionManualCuadra = Boolean(cuadraId);
  asignarCuadraEnFormulario(cuadraId);

  var cuadraObj = obtenerCuadraPorId(cuadraId);
  var centro = typeof obtenerCentroideCuadra === "function" ? obtenerCentroideCuadra(cuadraObj) : null;
  if (!centro) return;

  AppEstado.lat = centro.lat;
  AppEstado.lng = centro.lng;
  AppEstado.precisionGps = null;
  AppEstado.fueraDeZona = false;

  var textoCoords = document.getElementById("texto-coordenadas");
  if (textoCoords) {
    textoCoords.textContent = "Lat: " + centro.lat.toFixed(6) + ", Lng: " + centro.lng.toFixed(6);
  }

  var avisoZona = document.getElementById("aviso-fuera-zona");
  if (avisoZona) avisoZona.hidden = true;

  var avisoPrec = document.getElementById("aviso-precision");
  if (avisoPrec) avisoPrec.hidden = true;

  limpiarErrorCampo("error-ubicacion");

  actualizarMarcadorCaptura(centro.lat, centro.lng, function (nuevaLat, nuevaLng) {
    AppEstado.seleccionManualCuadra = false;
    fijarUbicacion(nuevaLat, nuevaLng, null);
  });

  if (leafletDisponible() && mapaCaptura) {
    mapaCaptura.setView([centro.lat, centro.lng], 18);
  }
}

function solicitarGpsDispositivo(esAutomaticoAlInicio) {
  var estadoGps = document.getElementById("estado-gps");
  estadoGps.hidden = false;
  estadoGps.className = "aviso-info";
  estadoGps.textContent = "Buscando señal GPS...";

  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    estadoGps.className = "aviso-alerta";
    estadoGps.textContent = "El GPS requiere HTTPS o localhost. Marca el punto tocando el mapa.";
    return;
  }

  if (!("geolocation" in navigator)) {
    estadoGps.className = "aviso-alerta";
    estadoGps.textContent = "Este navegador no soporta geolocalización. Marca el punto en el mapa.";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (posicion) {
      estadoGps.hidden = true;
      if (esAutomaticoAlInicio && AppEstado.seleccionManualCuadra) {
        return;
      }
      fijarUbicacion(
        posicion.coords.latitude,
        posicion.coords.longitude,
        posicion.coords.accuracy
      );
    },
    function (error) {
      estadoGps.className = "aviso-alerta";
      if (error.code === 1) {
        estadoGps.textContent = "Permiso de ubicación denegado. Marca el punto tocando el mapa.";
      } else if (error.code === 2) {
        estadoGps.textContent = "Sin señal GPS disponible en este punto. Marca la ubicación en el mapa.";
      } else if (error.code === 3) {
        estadoGps.textContent = "Tiempo de espera agotado al obtener GPS. Intenta de nuevo o marca en el mapa.";
      } else {
        estadoGps.textContent = "No se pudo obtener la ubicación (" + error.message + "). Marca en el mapa.";
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function guardarPasoHistorialCanvas(ctx, ancho, alto) {
  historialCanvas.push(ctx.getImageData(0, 0, ancho, alto));
  while (historialCanvas.length > MAX_HISTORIAL_CANVAS) {
    historialCanvas.splice(1, 1);
  }
}

function procesarArchivoFoto(archivo) {
  if (!archivo) return;

  var canvas = document.getElementById("canvas-foto");
  var ctx = canvas.getContext("2d");

  function dibujarEnCanvas(fuenteImagen, anchoOriginal, altoOriginal) {
    var anchoMax = 800;
    var escala = anchoOriginal > anchoMax ? anchoMax / anchoOriginal : 1;
    var nuevoAncho = Math.round(anchoOriginal * escala);
    var nuevoAlto = Math.round(altoOriginal * escala);

    canvas.width = nuevoAncho;
    canvas.height = nuevoAlto;
    ctx.clearRect(0, 0, nuevoAncho, nuevoAlto);
    ctx.drawImage(fuenteImagen, 0, 0, nuevoAncho, nuevoAlto);

    historialCanvas = [ctx.getImageData(0, 0, nuevoAncho, nuevoAlto)];
    AppEstado.tieneFoto = true;

    document.getElementById("zona-edicion-foto").hidden = false;
    document.getElementById("check-privacidad-foto").checked = false;
    limpiarErrorCampo("error-foto");
  }

  if (typeof createImageBitmap === "function") {
    createImageBitmap(archivo)
      .then(function (bitmap) {
        dibujarEnCanvas(bitmap, bitmap.width, bitmap.height);
        if (typeof bitmap.close === "function") bitmap.close();
      })
      .catch(function () {
        cargarConFileReader(archivo, dibujarEnCanvas);
      });
  } else {
    cargarConFileReader(archivo, dibujarEnCanvas);
  }
}

function cargarConFileReader(archivo, callback) {
  var lector = new FileReader();
  lector.onload = function (ev) {
    var img = new Image();
    img.onload = function () {
      callback(img, img.width, img.height);
    };
    img.src = ev.target.result;
  };
  lector.readAsDataURL(archivo);
}

function configurarHerramientaPixelado() {
  var canvas = document.getElementById("canvas-foto");
  var ctx = canvas.getContext("2d");

  function obtenerCoordsCanvas(evento) {
    var rect = canvas.getBoundingClientRect();
    var escalaX = canvas.width / rect.width;
    var escalaY = canvas.height / rect.height;
    return {
      x: Math.max(0, Math.min(canvas.width, (evento.clientX - rect.left) * escalaX)),
      y: Math.max(0, Math.min(canvas.height, (evento.clientY - rect.top) * escalaY))
    };
  }

  canvas.addEventListener("pointerdown", function (e) {
    if (!AppEstado.tieneFoto || historialCanvas.length === 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    dibujandoPixelado = true;
    puntoInicioPixel = obtenerCoordsCanvas(e);
  });

  canvas.addEventListener("pointermove", function (e) {
    if (!dibujandoPixelado || !puntoInicioPixel) return;
    e.preventDefault();
    var actual = obtenerCoordsCanvas(e);

    var estadoActual = historialCanvas[historialCanvas.length - 1];
    ctx.putImageData(estadoActual, 0, 0);

    var rx = Math.min(puntoInicioPixel.x, actual.x);
    var ry = Math.min(puntoInicioPixel.y, actual.y);
    var rw = Math.abs(actual.x - puntoInicioPixel.x);
    var rh = Math.abs(actual.y - puntoInicioPixel.y);

    ctx.save();
    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = Math.max(2, Math.round(canvas.width / 250));
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.restore();
  });

  function finalizarTrazoPixelado(e) {
    if (!dibujandoPixelado || !puntoInicioPixel) return;
    dibujandoPixelado = false;
    var fin = obtenerCoordsCanvas(e);

    var estadoActual = historialCanvas[historialCanvas.length - 1];
    ctx.putImageData(estadoActual, 0, 0);

    var rx = Math.floor(Math.min(puntoInicioPixel.x, fin.x));
    var ry = Math.floor(Math.min(puntoInicioPixel.y, fin.y));
    var rw = Math.floor(Math.abs(fin.x - puntoInicioPixel.x));
    var rh = Math.floor(Math.abs(fin.y - puntoInicioPixel.y));
    puntoInicioPixel = null;

    if (rw < 4 || rh < 4) return;

    var miniW = Math.max(1, Math.floor(rw / 12));
    var miniH = Math.max(1, Math.floor(rh / 12));

    var aux = document.createElement("canvas");
    aux.width = miniW;
    aux.height = miniH;
    var auxCtx = aux.getContext("2d");
    auxCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, miniW, miniH);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.drawImage(aux, 0, 0, miniW, miniH, rx, ry, rw, rh);
    ctx.restore();

    guardarPasoHistorialCanvas(ctx, canvas.width, canvas.height);
  }

  canvas.addEventListener("pointerup", finalizarTrazoPixelado);
  canvas.addEventListener("pointercancel", finalizarTrazoPixelado);
}

function exportarCanvasComprimido() {
  if (!AppEstado.tieneFoto) return null;

  var canvas = document.getElementById("canvas-foto");
  var calidad = 0.6;
  var dataUrl = canvas.toDataURL("image/jpeg", calidad);

  function calcularBytesBase64(url) {
    var base64 = url.split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  }

  var maxBytes = 80 * 1024;
  while (calcularBytesBase64(dataUrl) > maxBytes && calidad > 0.25) {
    calidad = Number((calidad - 0.1).toFixed(2));
    dataUrl = canvas.toDataURL("image/jpeg", calidad);
  }

  if (calcularBytesBase64(dataUrl) > maxBytes) {
    var reducido = document.createElement("canvas");
    reducido.width = Math.round(canvas.width * 0.8);
    reducido.height = Math.round(canvas.height * 0.8);
    reducido.getContext("2d").drawImage(canvas, 0, 0, reducido.width, reducido.height);
    dataUrl = reducido.toDataURL("image/jpeg", 0.55);
  }

  return dataUrl;
}

function quitarFotoFormulario() {
  var canvas = document.getElementById("canvas-foto");
  var ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  historialCanvas = [];
  AppEstado.tieneFoto = false;
  document.getElementById("input-foto-camara").value = "";
  document.getElementById("input-foto-galeria").value = "";
  document.getElementById("check-privacidad-foto").checked = false;
  document.getElementById("zona-edicion-foto").hidden = true;
  limpiarErrorCampo("error-foto");
}

function mostrarErrorCampo(idElemento, mensaje) {
  var el = document.getElementById(idElemento);
  if (el) {
    el.textContent = mensaje;
    el.hidden = false;
  }
}

function limpiarErrorCampo(idElemento) {
  var el = document.getElementById(idElemento);
  if (el) {
    el.textContent = "";
    el.hidden = true;
  }
}

function validarFormularioCaptura() {
  var esValido = true;

  if (!AppEstado.config.iniciales || AppEstado.config.iniciales.length < 2) {
    abrirModalAjustes();
    return false;
  }

  var lim = AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.limites;
  if (AppEstado.lat === null || AppEstado.lng === null) {
    mostrarErrorCampo("error-ubicacion", "Marca el punto en el mapa o usa tu ubicación GPS.");
    esValido = false;
  } else if (
    lim &&
    (AppEstado.lat < lim.lat_min ||
      AppEstado.lat > lim.lat_max ||
      AppEstado.lng < lim.lng_min ||
      AppEstado.lng > lim.lng_max)
  ) {
    mostrarErrorCampo("error-ubicacion", "El punto está fuera de los límites permitidos de Santa Marta.");
    esValido = false;
  } else {
    limpiarErrorCampo("error-ubicacion");
  }

  if (!AppEstado.cuadraAsignada || !obtenerCuadraPorId(AppEstado.cuadraAsignada)) {
    mostrarErrorCampo("error-cuadra", "Selecciona una cuadra válida de la zona de estudio.");
    esValido = false;
  } else {
    limpiarErrorCampo("error-cuadra");
  }

  if (!AppEstado.categoriaSeleccionada) {
    mostrarErrorCampo("error-categoria", "Selecciona una categoría de obstrucción.");
    esValido = false;
  } else {
    limpiarErrorCampo("error-categoria");
  }

  if (!AppEstado.actorSeleccionado) {
    mostrarErrorCampo("error-actor", "Selecciona el tipo de actor.");
    esValido = false;
  } else {
    limpiarErrorCampo("error-actor");
  }

  if (AppEstado.tieneFoto && !document.getElementById("check-privacidad-foto").checked) {
    mostrarErrorCampo("error-foto", "Debes confirmar que no se ven placas ni rostros antes de guardar.");
    esValido = false;
  } else {
    limpiarErrorCampo("error-foto");
  }

  return esValido;
}

function guardarNuevoReporte() {
  if (AppEstado.guardando) return;

  if (!validarFormularioCaptura()) {
    return;
  }

  AppEstado.guardando = true;
  var btnGuardar = document.getElementById("btn-guardar");
  btnGuardar.disabled = true;
  btnGuardar.textContent = "Guardando...";

  try {
    var fechaHoraValor = AppEstado.fechaHoraManual
      ? document.getElementById("input-fecha-hora").value
      : obtenerFechaHoraLocal();

    if (!fechaHoraValor || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaHoraValor)) {
      fechaHoraValor = obtenerFechaHoraLocal();
    }

    var nuevoId = generarSiguienteId(AppEstado.config.iniciales, AppEstado.reportesActivos);
    var fotoComprimida = exportarCanvasComprimido();
    var obsTexto = (document.getElementById("input-observaciones").value || "").trim().slice(0, 140);

    var borradorReporte = {
      id: nuevoId,
      origen: AppEstado.config.origen || "campo",
      fecha_hora: fechaHoraValor,
      lat: AppEstado.lat,
      lng: AppEstado.lng,
      cuadra: AppEstado.cuadraAsignada,
      categoria: AppEstado.categoriaSeleccionada,
      actor: AppEstado.actorSeleccionado,
      foto: fotoComprimida,
      observaciones: obsTexto
    };

    var calculo = calcularCriticidad(borradorReporte, AppEstado.criterios, AppEstado.vias);
    borradorReporte.criticidad = {
      puntaje: calculo.puntaje,
      nivel: calculo.nivel
    };

    var resultadoGuardado = agregarReporteLocal(borradorReporte);

    if (!resultadoGuardado.ok) {
      if (resultadoGuardado.errorQuota) {
        mostrarAlertaAlmacenamientoLleno(borradorReporte);
      } else {
        alert(resultadoGuardado.mensaje);
      }
      return;
    }

    var segundosLlenado = Math.max(1, Math.round((Date.now() - AppEstado.inicioCronometroMs) / 1000));

    sincronizarListaUnicaReportes();
    mostrarConfirmacionGuardado(borradorReporte, calculo, segundosLlenado);
  } catch (err) {
    alert("Error al procesar el reporte: " + err.message);
  } finally {
    AppEstado.guardando = false;
    btnGuardar.disabled = false;
    btnGuardar.textContent = "Guardar reporte";
  }
}

function mostrarConfirmacionGuardado(reporte, calculo, segundos) {
  var tarjeta = document.getElementById("tarjeta-confirmacion");
  var textoDesglose = document.getElementById("confirmacion-desglose");
  var badgeNivel = document.getElementById("confirmacion-badge-nivel");
  var metaTiempo = document.getElementById("confirmacion-tiempo");

  var nivelMayus = String(calculo.nivel).toUpperCase();
  textoDesglose.textContent =
    reporte.id + " · Categoría " + calculo.desglose.categoria +
    " + Vía " + calculo.desglose.via +
    " + Franja " + calculo.desglose.franja +
    " = " + calculo.puntaje + " → ";

  badgeNivel.textContent = nivelMayus;
  badgeNivel.className = "badge-nivel nivel-" + String(calculo.nivel).toLowerCase();

  metaTiempo.textContent = "Tiempo de registro: " + segundos + " s (no se guarda en los datos).";
  tarjeta.hidden = false;
  tarjeta.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function prepararSiguienteRegistro() {
  AppEstado.categoriaSeleccionada = "";
  AppEstado.actorSeleccionado = "";

  var botonesCat = document.querySelectorAll("#grupo-categoria .btn-opcion");
  for (var i = 0; i < botonesCat.length; i++) {
    botonesCat[i].classList.remove("activo");
    botonesCat[i].setAttribute("aria-pressed", "false");
  }

  var botonesAct = document.querySelectorAll("#grupo-actor .btn-opcion");
  for (var j = 0; j < botonesAct.length; j++) {
    botonesAct[j].classList.remove("activo");
    botonesAct[j].setAttribute("aria-pressed", "false");
  }

  quitarFotoFormulario();

  document.getElementById("input-observaciones").value = "";
  document.getElementById("contador-obs").textContent = "0 / 140";

  AppEstado.fechaHoraManual = false;
  var ahora = obtenerFechaHoraLocal();
  document.getElementById("input-fecha-hora").value = ahora;
  document.getElementById("texto-fecha-actual").textContent = ahora.replace("T", " ");
  document.getElementById("detalle-fecha-hora").open = false;

  document.getElementById("tarjeta-confirmacion").hidden = true;
  AppEstado.inicioCronometroMs = Date.now();
}

function mostrarAlertaAlmacenamientoLleno(reportePendiente) {
  var aviso = document.getElementById("aviso-quota");
  aviso.hidden = false;
  var btnExportarEmergencia = document.getElementById("btn-exportar-emergencia");
  btnExportarEmergencia.onclick = function () {
    var listaConPendiente = AppEstado.reportesLocales.concat([reportePendiente]);
    exportarReportesJSON(listaConPendiente, AppEstado.config.iniciales, true);
  };
}

function abrirModalConfirmarEliminar(idReporte) {
  idPendienteEliminar = idReporte;
  var modal = document.getElementById("modal-confirmar-eliminar");
  var textoEl = document.getElementById("texto-confirmar-eliminar");
  if (!modal || !textoEl) {
    if (confirm("¿Seguro que deseas eliminar el reporte local " + idReporte + "?")) {
      eliminarReporteLocal(idReporte);
      sincronizarListaUnicaReportes();
    }
    return;
  }
  textoEl.textContent =
    "¿Seguro que deseas eliminar el reporte local " + idReporte + "? Esta acción no se puede deshacer.";
  modal.hidden = false;
}

function cerrarModalConfirmarEliminar() {
  idPendienteEliminar = null;
  var modal = document.getElementById("modal-confirmar-eliminar");
  if (modal) modal.hidden = true;
}

function renderizarVistaRegistros() {
  var todos = AppEstado.reportesActivos;

  var totalCampo = 0;
  var conteoFranja = { pico: 0, valle: 0 };
  var conteoPorCuadra = {};

  for (var i = 0; i < todos.length; i++) {
    var r = todos[i];
    if (r.origen === "campo") {
      totalCampo++;
      var fr = r._franja || deducirFranja(r.fecha_hora, AppEstado.criterios);
      if (fr === "pico") conteoFranja.pico++;
      else conteoFranja.valle++;

      conteoPorCuadra[r.cuadra] = (conteoPorCuadra[r.cuadra] || 0) + 1;
    }
  }

  document.getElementById("contador-meta-30").textContent = totalCampo + " de 30";
  document.getElementById("desglose-franjas").textContent =
    "Hora pico: " + conteoFranja.pico + " · Hora valle: " + conteoFranja.valle;

  var listaCuadrasEl = document.getElementById("desglose-cuadras");
  listaCuadrasEl.innerHTML = "";
  var cuadrasKeys = Object.keys(conteoPorCuadra);
  if (cuadrasKeys.length === 0) {
    listaCuadrasEl.innerHTML = "<span class='texto-suave'>Aún no hay registros de campo.</span>";
  } else {
    for (var cIdx = 0; cIdx < cuadrasKeys.length; cIdx++) {
      var cid = cuadrasKeys[cIdx];
      var chip = document.createElement("span");
      chip.className = "chip-conteo";
      chip.textContent = cid + ": " + conteoPorCuadra[cid];
      listaCuadrasEl.appendChild(chip);
    }
  }

  var uso = calcularUsoAlmacenamiento();
  document.getElementById("uso-almacenamiento").textContent = "Almacenamiento: " + uso.texto;
  document.getElementById("badge-total-registros").textContent = String(todos.length);

  var listaParaTarjetas = Array.isArray(AppEstado.reportesFiltrados)
    ? AppEstado.reportesFiltrados
    : todos;
  var ordenados = listaParaTarjetas.slice().sort(function (a, b) {
    if (a.fecha_hora < b.fecha_hora) return 1;
    if (a.fecha_hora > b.fecha_hora) return -1;
    return 0;
  });

  var contenedorLista = document.getElementById("lista-registros");
  contenedorLista.innerHTML = "";

  if (ordenados.length === 0) {
    contenedorLista.innerHTML =
      '<p class="texto-suave tarjeta-vacia">No hay reportes registrados todavía.</p>';
    return;
  }

  for (var idx = 0; idx < ordenados.length; idx++) {
    var item = ordenados[idx];
    var nivel = item.criticidad ? item.criticidad.nivel : "Bajo";
    var puntaje = item.criticidad ? item.criticidad.puntaje : 0;

    var infoCuadra = obtenerCuadraPorId(item.cuadra);
    var direccionCompleta = infoCuadra
      ? infoCuadra.nombre + " (" + item.cuadra + ")"
      : item.cuadra;
    var etiquetaTipoVia = infoCuadra
      ? (infoCuadra.tipo_via === "arterial" ? "Vía arterial" : "Vía secundaria")
      : "";

    var franjaItem = item._franja || (AppEstado.criterios ? deducirFranja(item.fecha_hora, AppEstado.criterios) : "");
    var textoFranja = franjaItem === "pico" ? "Hora pico" : (franjaItem === "valle" ? "Hora valle" : "");
    var textoDesglose = item._desglose
      ? " [Cat " + item._desglose.categoria + " + Vía " + item._desglose.via + " + Franja " + item._desglose.franja + "]"
      : "";

    var card = document.createElement("article");
    card.className = "tarjeta-registro";

    var htmlMiniatura = "";
    var srcFoto = "";
    if (item.foto) {
      if (item.foto.indexOf("data:") === 0 || item.foto.indexOf("http") === 0 || item.foto.indexOf("datos/") === 0) {
        srcFoto = item.foto;
      } else {
        srcFoto = "datos/" + item.foto;
      }
      htmlMiniatura =
        '<div class="contenedor-foto-registro">' +
          '<img class="miniatura-registro" src="' + escaparHtml(srcFoto) + '" alt="Evidencia ' + escaparHtml(item.id) + '" loading="lazy" />' +
          '<span class="pie-ampliar-foto">🔍 Ver foto</span>' +
        '</div>';
    } else {
      htmlMiniatura = '<div class="miniatura-vacia">Sin foto</div>';
    }

    var botonEliminarHtml = "";
    if (item._esLocal) {
      botonEliminarHtml =
        '<button type="button" class="btn-eliminar-registro" data-id="' + escaparHtml(item.id) + '">Eliminar</button>';
    } else {
      botonEliminarHtml = '<span class="etiqueta-precargado">Precargado</span>';
    }

    var coordsTexto = (typeof item.lat === "number" && typeof item.lng === "number")
      ? item.lat.toFixed(6) + ", " + item.lng.toFixed(6)
      : "Sin coordenadas";

    card.innerHTML =
      '<div class="registro-cabecera">' +
        '<div>' +
          '<strong>' + escaparHtml(item.id) + '</strong> · <span class="texto-mono">' + escaparHtml(item.fecha_hora.replace("T", " ")) + '</span>' +
          (textoFranja ? ' <span class="chip-franja">' + textoFranja + '</span>' : '') +
        '</div>' +
        '<span class="badge-nivel nivel-' + escaparHtml(String(nivel).toLowerCase()) + '">' +
          escaparHtml(nivel) + ' (' + puntaje + ' pts)' +
        '</span>' +
      '</div>' +
      '<div class="registro-cuerpo">' +
        htmlMiniatura +
        '<div class="registro-detalles">' +
          '<div class="linea-detalle-reg"><strong>Dirección:</strong> ' + escaparHtml(direccionCompleta) +
            (etiquetaTipoVia ? ' · <em>' + etiquetaTipoVia + '</em>' : '') + '</div>' +
          '<div class="linea-detalle-reg"><strong>Categoría:</strong> ' + escaparHtml(ETIQUETAS_CATEGORIA[item.categoria] || item.categoria) + '</div>' +
          '<div class="linea-detalle-reg"><strong>Vehículo / Actor:</strong> ' + escaparHtml(ETIQUETAS_ACTOR[item.actor] || item.actor) + '</div>' +
          '<div class="linea-detalle-reg"><strong>Fecha y hora:</strong> ' + escaparHtml(item.fecha_hora.replace("T", " ")) +
            (textoFranja ? ' (' + textoFranja + ')' : '') + '</div>' +
          '<div class="linea-detalle-reg"><strong>Ubicación GPS:</strong> <span class="texto-mono">' + coordsTexto + '</span></div>' +
          '<div class="linea-detalle-reg texto-suave"><strong>Criticidad:</strong> ' + escaparHtml(nivel) + ' · ' + puntaje + ' puntos' + textoDesglose + '</div>' +
          (item.observaciones ? '<div class="obs-texto"><strong>Observaciones:</strong> "' + escaparHtml(item.observaciones) + '"</div>' : '') +
        '</div>' +
      '</div>' +
      '<div class="registro-pie">' +
        '<span class="texto-suave">Origen: ' + escaparHtml(item.origen) + '</span>' +
        botonEliminarHtml +
      '</div>';

    if (srcFoto) {
      (function (urlImagen, rep, dirTexto) {
        var boxFoto = card.querySelector(".contenedor-foto-registro");
        if (boxFoto) {
          boxFoto.addEventListener("click", function () {
            abrirModalFoto(
              urlImagen,
              rep.id + " · " + rep.fecha_hora.replace("T", " "),
              dirTexto + " | " + (ETIQUETAS_CATEGORIA[rep.categoria] || rep.categoria) + " | " + (ETIQUETAS_ACTOR[rep.actor] || rep.actor)
            );
          });
        }
      })(srcFoto, item, direccionCompleta);
    }

    contenedorLista.appendChild(card);
  }

  var botonesEliminar = contenedorLista.querySelectorAll(".btn-eliminar-registro");
  for (var b = 0; b < botonesEliminar.length; b++) {
    botonesEliminar[b].addEventListener("click", function () {
      var idBorrar = this.getAttribute("data-id");
      abrirModalConfirmarEliminar(idBorrar);
    });
  }
}

function abrirModalFoto(srcImagen, titulo, descripcion) {
  var modal = document.getElementById("modal-foto");
  if (!modal) return;
  document.getElementById("titulo-modal-foto").textContent = titulo || "Evidencia fotográfica";
  document.getElementById("img-modal-foto").src = srcImagen;
  document.getElementById("detalle-modal-foto").textContent = descripcion || "";
  modal.hidden = false;
}

function cerrarModalFoto() {
  var modal = document.getElementById("modal-foto");
  if (!modal) return;
  modal.hidden = true;
  document.getElementById("img-modal-foto").src = "";
}

function abrirModalAjustes() {
  var modal = document.getElementById("modal-ajustes");
  document.getElementById("input-iniciales").value = AppEstado.config.iniciales || "";
  document.getElementById("select-origen").value = AppEstado.config.origen || "campo";
  document.getElementById("error-ajustes").hidden = true;
  modal.hidden = false;
}

function cerrarModalAjustes() {
  document.getElementById("modal-ajustes").hidden = true;
}

function cambiarVista(nombreVista) {
  var vistaCaptura = document.getElementById("vista-captura");
  var vistaRegistros = document.getElementById("vista-registros");
  var tabCaptura = document.getElementById("tab-captura");
  var tabRegistros = document.getElementById("tab-registros");

  if (nombreVista === "registros") {
    vistaCaptura.hidden = true;
    vistaRegistros.hidden = false;
    tabCaptura.classList.remove("activo");
    tabRegistros.classList.add("activo");
    redimensionarMapaRegistros();
  } else {
    vistaRegistros.hidden = true;
    vistaCaptura.hidden = false;
    tabRegistros.classList.remove("activo");
    tabCaptura.classList.add("activo");
    redimensionarMapaCaptura();
  }
}

document.addEventListener("DOMContentLoaded", function () {
  AppEstado.config = cargarConfiguracion();
  actualizarIndicadorUsuario();

  var ahora = obtenerFechaHoraLocal();
  var inputFecha = document.getElementById("input-fecha-hora");
  inputFecha.value = ahora;
  document.getElementById("texto-fecha-actual").textContent = ahora.replace("T", " ");

  inputFecha.addEventListener("change", function () {
    AppEstado.fechaHoraManual = true;
    document.getElementById("texto-fecha-actual").textContent = inputFecha.value.replace("T", " ");
  });

  var botonesCategoria = document.querySelectorAll("#grupo-categoria .btn-opcion");
  for (var i = 0; i < botonesCategoria.length; i++) {
    botonesCategoria[i].addEventListener("click", function () {
      for (var k = 0; k < botonesCategoria.length; k++) {
        botonesCategoria[k].classList.remove("activo");
        botonesCategoria[k].setAttribute("aria-pressed", "false");
      }
      this.classList.add("activo");
      this.setAttribute("aria-pressed", "true");
      AppEstado.categoriaSeleccionada = this.getAttribute("data-valor");
      limpiarErrorCampo("error-categoria");
    });
  }

  var botonesActor = document.querySelectorAll("#grupo-actor .btn-opcion");
  for (var j = 0; j < botonesActor.length; j++) {
    botonesActor[j].addEventListener("click", function () {
      for (var k = 0; k < botonesActor.length; k++) {
        botonesActor[k].classList.remove("activo");
        botonesActor[k].setAttribute("aria-pressed", "false");
      }
      this.classList.add("activo");
      this.setAttribute("aria-pressed", "true");
      AppEstado.actorSeleccionado = this.getAttribute("data-valor");
      limpiarErrorCampo("error-actor");
    });
  }

  document.getElementById("btn-tomar-foto").addEventListener("click", function () {
    document.getElementById("input-foto-camara").click();
  });
  document.getElementById("btn-galeria-foto").addEventListener("click", function () {
    document.getElementById("input-foto-galeria").click();
  });
  document.getElementById("input-foto-camara").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) procesarArchivoFoto(e.target.files[0]);
  });
  document.getElementById("input-foto-galeria").addEventListener("change", function (e) {
    if (e.target.files && e.target.files[0]) procesarArchivoFoto(e.target.files[0]);
  });

  configurarHerramientaPixelado();

  document.getElementById("btn-deshacer-pixel").addEventListener("click", function () {
    if (historialCanvas.length > 1) {
      historialCanvas.pop();
      var canvas = document.getElementById("canvas-foto");
      var anterior = historialCanvas[historialCanvas.length - 1];
      canvas.getContext("2d").putImageData(anterior, 0, 0);
    }
  });

  document.getElementById("btn-quitar-foto").addEventListener("click", quitarFotoFormulario);

  var inputObs = document.getElementById("input-observaciones");
  inputObs.addEventListener("input", function () {
    document.getElementById("contador-obs").textContent = inputObs.value.length + " / 140";
  });

  document.getElementById("select-cuadra").addEventListener("change", function () {
    seleccionarCuadraManual(this.value);
  });

  configurarBuscadorDireccion();

  document.getElementById("btn-usar-gps").addEventListener("click", function () {
    AppEstado.seleccionManualCuadra = false;
    solicitarGpsDispositivo(false);
  });
  document.getElementById("btn-guardar").addEventListener("click", guardarNuevoReporte);
  document.getElementById("btn-registrar-otro").addEventListener("click", prepararSiguienteRegistro);

  document.getElementById("tab-captura").addEventListener("click", function () {
    cambiarVista("captura");
  });
  document.getElementById("tab-registros").addEventListener("click", function () {
    cambiarVista("registros");
  });

  var botonesCapaMapa = document.querySelectorAll("#grupo-capas-mapa .btn-capa-mapa");
  for (var cm = 0; cm < botonesCapaMapa.length; cm++) {
    botonesCapaMapa[cm].addEventListener("click", function () {
      for (var k = 0; k < botonesCapaMapa.length; k++) {
        botonesCapaMapa[k].classList.remove("activo");
        botonesCapaMapa[k].setAttribute("aria-pressed", "false");
      }
      this.classList.add("activo");
      this.setAttribute("aria-pressed", "true");
      cambiarModoMapaRegistros(this.getAttribute("data-modo"));
    });
  }

  var idsFiltros = [
    { id: "filtro-cuadra", clave: "cuadra" },
    { id: "filtro-franja", clave: "franja" },
    { id: "filtro-categoria", clave: "categoria" },
    { id: "filtro-actor", clave: "actor" }
  ];
  for (var fIdx = 0; fIdx < idsFiltros.length; fIdx++) {
    (function (cfg) {
      var el = document.getElementById(cfg.id);
      if (el) {
        el.addEventListener("change", function () {
          AppEstado.filtrosActivos[cfg.clave] = this.value;
          aplicarFiltrosYActualizarRegistros();
        });
      }
    })(idsFiltros[fIdx]);
  }

  var btnLimpiarFiltros = document.getElementById("btn-limpiar-filtros");
  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener("click", function () {
      AppEstado.filtrosActivos = {
        cuadra: "todas",
        franja: "todas",
        categoria: "todas",
        actor: "todas"
      };
      for (var k = 0; k < idsFiltros.length; k++) {
        var sel = document.getElementById(idsFiltros[k].id);
        if (sel) sel.value = "todas";
      }
      aplicarFiltrosYActualizarRegistros();
    });
  }

  var btnImprimirResumen = document.getElementById("btn-imprimir-resumen");
  if (btnImprimirResumen) {
    btnImprimirResumen.addEventListener("click", function () {
      window.print();
    });
  }

  var btnCerrarModalFoto = document.getElementById("btn-cerrar-modal-foto");
  if (btnCerrarModalFoto) {
    btnCerrarModalFoto.addEventListener("click", cerrarModalFoto);
  }
  var modalFotoEl = document.getElementById("modal-foto");
  if (modalFotoEl) {
    modalFotoEl.addEventListener("click", function (ev) {
      if (ev.target === modalFotoEl) cerrarModalFoto();
    });
  }

  var btnCancelarEliminar = document.getElementById("btn-cancelar-eliminar");
  if (btnCancelarEliminar) {
    btnCancelarEliminar.addEventListener("click", cerrarModalConfirmarEliminar);
  }
  var btnConfirmarEliminar = document.getElementById("btn-confirmar-eliminar");
  if (btnConfirmarEliminar) {
    btnConfirmarEliminar.addEventListener("click", function () {
      if (idPendienteEliminar) {
        eliminarReporteLocal(idPendienteEliminar);
        cerrarModalConfirmarEliminar();
        sincronizarListaUnicaReportes();
      }
    });
  }
  var modalEliminarEl = document.getElementById("modal-confirmar-eliminar");
  if (modalEliminarEl) {
    modalEliminarEl.addEventListener("click", function (ev) {
      if (ev.target === modalEliminarEl) cerrarModalConfirmarEliminar();
    });
  }

  document.getElementById("btn-abrir-ajustes").addEventListener("click", abrirModalAjustes);
  document.getElementById("btn-cerrar-ajustes").addEventListener("click", cerrarModalAjustes);
  document.getElementById("btn-guardar-ajustes").addEventListener("click", function () {
    var res = guardarConfiguracion({
      iniciales: document.getElementById("input-iniciales").value,
      origen: document.getElementById("select-origen").value
    });
    if (!res.ok) {
      var errEl = document.getElementById("error-ajustes");
      errEl.textContent = res.mensaje;
      errEl.hidden = false;
      return;
    }
    AppEstado.config = res.config;
    actualizarIndicadorUsuario();
    cerrarModalAjustes();
  });

  document.getElementById("btn-exportar-con-fotos").addEventListener("click", function () {
    exportarReportesJSON(AppEstado.reportesLocales, AppEstado.config.iniciales, true);
  });
  document.getElementById("btn-exportar-sin-fotos").addEventListener("click", function () {
    exportarReportesJSON(AppEstado.reportesLocales, AppEstado.config.iniciales, false);
  });
  document.getElementById("btn-exportar-zip").addEventListener("click", function () {
    exportarPaqueteZIP(AppEstado.reportesLocales, AppEstado.config.iniciales).catch(function (err) {
      alert(err.message);
    });
  });

  document.getElementById("btn-importar-json").addEventListener("click", function () {
    document.getElementById("input-importar-json").click();
  });

  document.getElementById("input-importar-json").addEventListener("change", function (e) {
    var archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    var lector = new FileReader();
    lector.onload = function (ev) {
      var res = importarReportesDesdeTexto(
        ev.target.result,
        AppEstado.reportesPrecargados,
        AppEstado.criterios,
        AppEstado.vias
      );

      var cajaResultado = document.getElementById("resultado-importacion");
      cajaResultado.hidden = false;

      if (!res.ok) {
        cajaResultado.className = "aviso-alerta";
        cajaResultado.textContent = res.mensaje;
        return;
      }

      cajaResultado.className = "aviso-info";
      var html =
        "<strong>" + res.nuevos + " nuevos · " + res.repetidos + " repetidos · " + res.invalidos + " inválidos</strong>";

      if (res.conflictos > 0) {
        html += "<br><strong>Conflictos (" + res.conflictos + "):</strong><ul>";
        for (var c = 0; c < res.detallesConflictos.length; c++) {
          html += "<li>" + escaparHtml(res.detallesConflictos[c].id) + ": " + escaparHtml(res.detallesConflictos[c].motivo) + "</li>";
        }
        html += "</ul>";
      }

      if (res.detallesInvalidos.length > 0) {
        html += "<br><strong>Motivos de inválidos:</strong><ul>";
        for (var inv = 0; inv < res.detallesInvalidos.length; inv++) {
          html += "<li>" + escaparHtml(res.detallesInvalidos[inv].id) + ": " + escaparHtml(res.detallesInvalidos[inv].motivo) + "</li>";
        }
        html += "</ul>";
      }

      cajaResultado.innerHTML = html;
      sincronizarListaUnicaReportes();
      e.target.value = "";
    };
    lector.readAsText(archivo, "utf-8");
  });

  cargarDatosIniciales()
    .then(function (datos) {
      AppEstado.vias = datos[0];
      AppEstado.criterios = datos[1];
      AppEstado.reportesPrecargados = Array.isArray(datos[2]) ? datos[2] : [];

      document.getElementById("nombre-zona-header").textContent = AppEstado.vias.zona.nombre;

      var selectCuadra = document.getElementById("select-cuadra");
      var filtroCuadra = document.getElementById("filtro-cuadra");
      selectCuadra.innerHTML = '<option value="">-- Selecciona una cuadra --</option>';
      if (filtroCuadra) {
        filtroCuadra.innerHTML = '<option value="todas">Todas las cuadras</option>';
      }
      for (var i = 0; i < AppEstado.vias.cuadras.length; i++) {
        var c = AppEstado.vias.cuadras[i];
        var opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.nombre + " (" + c.tipo_via + ")";
        selectCuadra.appendChild(opt);

        if (filtroCuadra) {
          var optF = document.createElement("option");
          optF.value = c.id;
          optF.textContent = c.nombre + " (" + c.id + ")";
          filtroCuadra.appendChild(optF);
        }
      }

      var mapaCapOk = iniciarMapaCaptura("mapa-captura", AppEstado.vias, function (lat, lng) {
        fijarUbicacion(lat, lng, null);
      });
      var mapaRegOk = iniciarMapaRegistros("mapa-registros", AppEstado.vias);

      if (!mapaCapOk || !mapaRegOk) {
        document.getElementById("aviso-sin-mapa").hidden = false;
      }

      sincronizarListaUnicaReportes();

      if (!AppEstado.config.iniciales) {
        abrirModalAjustes();
      }

      solicitarGpsDispositivo(true);
    })
    .catch(function (err) {
      console.error("Error cargando JSON:", err);
      var avisoFetch = document.getElementById("aviso-fetch");
      avisoFetch.hidden = false;
    });
});

function actualizarIndicadorUsuario() {
  var badge = document.getElementById("indicador-iniciales");
  if (AppEstado.config.iniciales) {
    badge.textContent = AppEstado.config.iniciales + " · " + AppEstado.config.origen;
  } else {
    badge.textContent = "Configurar iniciales";
  }
}

function configurarBuscadorDireccion() {
  var inputBuscar = document.getElementById("input-buscar-direccion");
  var btnLimpiar = document.getElementById("btn-limpiar-busqueda");
  var listaSug = document.getElementById("lista-sugerencias-direccion");
  var estadoEl = document.getElementById("estado-busqueda-direccion");

  if (!inputBuscar || !listaSug) return;

  var temporizador = null;
  var tokenBusqueda = 0;

  function ocultarSugerencias() {
    listaSug.innerHTML = "";
    listaSug.hidden = true;
  }

  function mostrarEstado(texto, esError) {
    if (!estadoEl) return;
    if (!texto) {
      estadoEl.textContent = "";
      estadoEl.hidden = true;
      return;
    }
    estadoEl.textContent = texto;
    estadoEl.className = esError ? "aviso-alerta" : "texto-suave";
    estadoEl.hidden = false;
  }

  function elegirSugerencia(sug) {
    AppEstado.seleccionManualCuadra = false;
    inputBuscar.value = sug.titulo;
    if (btnLimpiar) btnLimpiar.hidden = false;
    ocultarSugerencias();
    mostrarEstado("", false);

    fijarUbicacion(sug.lat, sug.lng, null);

    if (leafletDisponible() && mapaCaptura) {
      mapaCaptura.setView([sug.lat, sug.lng], 18);
    }
  }

  inputBuscar.addEventListener("input", function () {
    var valor = inputBuscar.value.trim();
    if (btnLimpiar) btnLimpiar.hidden = valor.length === 0;

    if (temporizador) clearTimeout(temporizador);

    if (valor.length < 2) {
      ocultarSugerencias();
      mostrarEstado("", false);
      return;
    }

    var tokenActual = ++tokenBusqueda;
    temporizador = setTimeout(function () {
      mostrarEstado("Buscando ubicación...", false);
      buscarDireccionesMapa(valor, AppEstado.vias).then(function (resp) {
        if (tokenActual !== tokenBusqueda || (resp && resp.abortado)) return;

        var sugerencias = resp && Array.isArray(resp.resultados) ? resp.resultados : [];
        var sinConexionExt = resp && resp.sinConexionExterno;

        listaSug.innerHTML = "";
        if (sugerencias.length === 0) {
          listaSug.hidden = true;
          mostrarEstado(
            sinConexionExt
              ? "Sin conexión para buscar calles externas. Elige una cuadra local o toca el mapa."
              : "No se encontraron coincidencias. Toca el mapa para marcar el punto.",
            true
          );
          return;
        }

        mostrarEstado(
          sinConexionExt ? "Mostrando solo cuadras locales (sin conexión a internet)." : "",
          sinConexionExt
        );

        for (var i = 0; i < sugerencias.length; i++) {
          (function (sug) {
            var li = document.createElement("li");
            li.className = "item-sugerencia";
            li.setAttribute("role", "option");
            li.innerHTML =
              '<span class="sugerencia-titulo">' + escaparHtml(sug.titulo) + '</span>' +
              '<span class="sugerencia-sub">' + escaparHtml(sug.subtitulo) + '</span>';
            li.addEventListener("click", function () {
              elegirSugerencia(sug);
            });
            listaSug.appendChild(li);
          })(sugerencias[i]);
        }
        listaSug.hidden = false;
      });
    }, 300);
  });

  if (btnLimpiar) {
    btnLimpiar.addEventListener("click", function () {
      inputBuscar.value = "";
      btnLimpiar.hidden = true;
      ocultarSugerencias();
      mostrarEstado("", false);
      inputBuscar.focus();
    });
  }

  document.addEventListener("click", function (ev) {
    if (!listaSug.contains(ev.target) && ev.target !== inputBuscar) {
      ocultarSugerencias();
    }
  });
}
