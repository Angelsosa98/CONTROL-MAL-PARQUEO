/* ============================================================================
 * ARCHIVO: mapa.js
 * RESPONSABILIDAD: Gestión de los mapas Leaflet (mapa de captura y mapa de
 * registros con capa de calor Leaflet.heat ponderada por criticidad y capa
 * de puntos individuales), marcador arrastrable y búsqueda de direcciones.
 * ============================================================================ */

var mapaCaptura = null;
var marcadorCaptura = null;
var capaReportesCaptura = null;

var mapaRegistros = null;
var capaMarcadoresRegistros = null;
var capaCalorRegistros = null;
var ultimasEvidenciasMapa = [];
var promesaGeometriasVialesOSM = null;
var modoVisualizacionRegistros = "puntos"; // "ambos" | "calor" | "puntos"
var ultimosReportesRegistros = [];
var ultimoViasRegistros = null;
var capaRecorridoCampo = null;
var claveAlmacenamientoRecorridoLocal = "control-vial-santa-marta.recorrido.v1";
var segmentosRecorridoGuardadosLocal = null;
var segmentosRecorridoEnEdicion = [];
var puntosTramoRecorridoEnEdicion = [];
var modoEdicionRecorridoActivo = false;
var capaVistaPreviaEdicionRecorrido = null;

/**
 * Devuelve true si la librería Leaflet (L) está cargada en el navegador.
 */
function leafletDisponible() {
  return typeof L !== "undefined" && L !== null;
}

/**
 * Devuelve true si el plugin Leaflet.heat (L.heatLayer) está disponible.
 */
function heatDisponible() {
  return leafletDisponible() && typeof L.heatLayer === "function";
}

/**
 * Crea mapas base intercambiables: calles de OpenStreetMap y satélite Esri.
 * La capa satelital conserva la atribución requerida por el proveedor.
 */
function crearCapasBaseMapa(mapa) {
  var mapaCalles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });

  var mapaSatelital = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      zIndex: 1,
      attribution: "Imagery &copy; Esri, Vantor, Earthstar Geographics, and the GIS User Community"
    }
  );

  // Se abre en satélite sin superposiciones; las calles se consultan como base independiente.
  mapaSatelital.addTo(mapa);
  return {
    "Satélite": mapaSatelital,
    "Mapa de calles": mapaCalles
  };
}

/**
 * Agrega el selector de mapas base y las capas superpuestas disponibles.
 */
function agregarControlCapasMapa(mapa, mapasBase, superpuestas) {
  if (!leafletDisponible() || !mapa || !L.control || typeof L.control.layers !== "function") return;
  L.control.layers(mapasBase, superpuestas || {}, {
    collapsed: true,
    position: "topright"
  }).addTo(mapa);
}

/**
 * Conecta la casilla visible "Mostrar recorrido" con la capa verde.
 * Separa el control del recorrido del selector de mapa base.
 */
function configurarControlRecorridoCampo() {
  var casilla = document.getElementById("toggle-recorrido-campo");
  if (!casilla) return;

  casilla.checked = !!(
    mapaRegistros && capaRecorridoCampo && mapaRegistros.hasLayer(capaRecorridoCampo)
  );

  casilla.onchange = function () {
    if (!mapaRegistros || !capaRecorridoCampo) return;
    if (casilla.checked) {
      capaRecorridoCampo.addTo(mapaRegistros);
    } else {
      mapaRegistros.removeLayer(capaRecorridoCampo);
    }
  };
}


/**
 * Devuelve el color hexadecimal asociado a cada nivel de criticidad.
 */
function obtenerColorNivel(nivel) {
  var clave = String(nivel || "").toLowerCase();
  if (clave === "alto") return "#dc2626";   // Rojo
  if (clave === "medio") return "#d97706";  // Ámbar / Naranja
  return "#16a34a";                         // Verde (Bajo)
}

/**
 * Inicializa el mapa de la vista Captura con OpenStreetMap (sin dibujar líneas
 * de cuadras) y permite elegir ubicación tocando el mapa o arrastrando el pin.
 */
function iniciarMapaCaptura(idContenedor, vias, alElegirUbicacion) {
  if (!leafletDisponible()) {
    return false;
  }

  var centro = (vias && vias.zona && vias.zona.centro) ? vias.zona.centro : [11.2335, -74.1972];
  var zoom = (vias && vias.zona && vias.zona.zoom) ? vias.zona.zoom : 15;

  mapaCaptura = L.map(idContenedor, {
    zoomControl: true
  }).setView(centro, zoom);

  var mapasBaseCaptura = crearCapasBaseMapa(mapaCaptura);

  capaReportesCaptura = L.layerGroup().addTo(mapaCaptura);
  agregarControlCapasMapa(mapaCaptura, mapasBaseCaptura, {
    "Reportes registrados": capaReportesCaptura
  });

  mapaCaptura.on("click", function (e) {
    if (typeof alElegirUbicacion === "function") {
      alElegirUbicacion(e.latlng.lat, e.latlng.lng);
    }
  });

  return true;
}

/**
 * Crea o mueve el marcador arrastrable de ubicación en el mapa de captura.
 */
function actualizarMarcadorCaptura(lat, lng, alArrastrar) {
  if (!leafletDisponible() || !mapaCaptura) return;

  var posicion = [lat, lng];

  if (!marcadorCaptura) {
    marcadorCaptura = L.marker(posicion, {
      draggable: true,
      title: "Arrastra para ajustar la ubicación exacta"
    }).addTo(mapaCaptura);

    marcadorCaptura.on("dragend", function () {
      var pos = marcadorCaptura.getLatLng();
      if (typeof alArrastrar === "function") {
        alArrastrar(pos.lat, pos.lng);
      }
    });
  } else {
    marcadorCaptura.setLatLng(posicion);
  }

  mapaCaptura.panTo(posicion);
}

/**
 * Mantenida por compatibilidad sin dibujar líneas de cuadras.
 */
function resaltarCuadraCaptura(cuadraId) {
  return cuadraId;
}

/**
 * Dibuja los puntos de los reportes ya guardados en el mapa de captura.
 */
function actualizarPuntosEnMapaCaptura(listaReportes, vias) {
  if (!leafletDisponible() || !mapaCaptura || !capaReportesCaptura) return;

  capaReportesCaptura.clearLayers();

  for (var i = 0; i < listaReportes.length; i++) {
    var r = listaReportes[i];
    if (!reporteDentroZonaMapa(r, vias || ultimoViasRegistros)) continue;

    var nivel = r.criticidad ? r.criticidad.nivel : "Bajo";
    var color = obtenerColorNivel(nivel);

    L.circleMarker([r.lat, r.lng], {
      radius: 6,
      fillColor: color,
      color: "#ffffff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.85
    })
      .bindPopup(
        "<strong>" + escaparTextoMapa(r.id) + "</strong><br>" +
        (r.ambito === "otros_sectores_santa_marta"
          ? "Otros sectores de Santa Marta · " + (r.tipo_via_reporte === "arterial" ? "Vía arterial" : "Vía secundaria")
          : "Cuadra: " + escaparTextoMapa(r.cuadra || "—")) + "<br>" +
        "Nivel: " + nivel + " (" + (r.criticidad ? r.criticidad.puntaje : "-") + ")"
      )
      .addTo(capaReportesCaptura);
  }
}

/**
 * Recalcula el tamaño del mapa de captura cuando su contenedor pasa de oculto a visible.
 */
function redimensionarMapaCaptura() {
  if (leafletDisponible() && mapaCaptura) {
    setTimeout(function () {
      mapaCaptura.invalidateSize();
    }, 60);
  }
}

/**
 * Valida si un reporte pertenece al ámbito cartográfico activo.
 * Comprueba límites y proximidad a una de las cuadras configuradas.
 * No elimina registros: solo evita dibujar puntos ajenos al área en el mapa.
 */
function reporteDentroZonaMapa(reporte, vias) {
  if (!reporte || typeof reporte.lat !== "number" || typeof reporte.lng !== "number" ||
      !isFinite(reporte.lat) || !isFinite(reporte.lng) ||
      reporte.lat < -90 || reporte.lat > 90 || reporte.lng < -180 || reporte.lng > 180) return false;

  // Los reportes externos se muestran sin aplicarles los límites del área de estudio.
  if (reporte.ambito === "otros_sectores_santa_marta") {
    return reporte.tipo_via_reporte === "arterial" || reporte.tipo_via_reporte === "secundaria";
  }

  var zona = vias && vias.zona;
  var limites = zona && zona.limites;
  if (!limites) return true;
  if (reporte.lat < limites.lat_min || reporte.lat > limites.lat_max ||
      reporte.lng < limites.lng_min || reporte.lng > limites.lng_max) return false;

  var cuadras = vias && Array.isArray(vias.cuadras)
    ? vias.cuadras.filter(function (c) { return c.activa !== false; }) : [];
  if (!cuadras.length) return true;
  var radioMaximo = Number(zona.radio_max_m) || 90;
  var latRad = reporte.lat * Math.PI / 180;
  var metrosLat = 111320;
  var metrosLng = 111320 * Math.cos(latRad);

  // Exigir que la coordenada esté cerca de la cuadra declarada por el reporte.
  // Evita dibujar un punto en una vía distinta a la seleccionada.
  var cuadraObjetivo = null;
  for (var k = 0; k < cuadras.length; k++) {
    if (cuadras[k].id === reporte.cuadra) {
      cuadraObjetivo = cuadras[k];
      break;
    }
  }
  if (!cuadraObjetivo || !Array.isArray(cuadraObjetivo.extremos)) return false;

  var extremos = cuadraObjetivo.extremos;
  for (var j = 0; j < extremos.length - 1; j++) {
      var p1 = extremos[j], p2 = extremos[j + 1];
      var px = (reporte.lng - p1[1]) * metrosLng;
      var py = (reporte.lat - p1[0]) * metrosLat;
      var bx = (p2[1] - p1[1]) * metrosLng;
      var by = (p2[0] - p1[0]) * metrosLat;
      var t = Math.max(0, Math.min(1, (px * bx + py * by) / (bx * bx + by * by || 1)));
      if (Math.hypot(px - bx * t, py - by * t) <= radioMaximo) return true;
  }
  return false;
}

/**
 * Inicializa el mapa de la vista Registros con soporte para capa de calor
 * (Leaflet.heat) y capa de puntos individuales coloreados por criticidad.
 */
function iniciarMapaRegistros(idContenedor, vias) {
  if (!leafletDisponible()) {
    return false;
  }

  ultimoViasRegistros = vias;
  cargarRecorridoLocalGuardado(vias);
  var centro = (vias && vias.zona && vias.zona.centro) ? vias.zona.centro : [11.2335, -74.1972];
  var zoom = (vias && vias.zona && vias.zona.zoom) ? vias.zona.zoom : 15;

  mapaRegistros = L.map(idContenedor, {
    zoomControl: true
  }).setView(centro, zoom);

  var mapasBaseRegistros = crearCapasBaseMapa(mapaRegistros);

  capaMarcadoresRegistros = L.layerGroup().addTo(mapaRegistros);
  dibujarRecorridoCampo(vias);
  agregarControlCapasMapa(mapaRegistros, mapasBaseRegistros, {});
  configurarControlRecorridoCampo();
  mapaRegistros.on("click", agregarPuntoAlRecorrido);

  var avisoCalor = document.getElementById("aviso-sin-calor");
  if (avisoCalor && !heatDisponible()) {
    avisoCalor.hidden = false;
  }

  var leyenda = L.control({ position: "bottomright" });
  leyenda.onAdd = function () {
    var div = L.DomUtil.create("div", "leyenda-mapa");
    div.innerHTML =
      "<strong>Leyenda del mapa</strong>" +
      '<div><span class="linea-leyenda-recorrido"></span> Recorrido de campo</div>' +
      '<div><span class="punto-leyenda" style="background:#dc2626"></span> Alto</div>' +
      '<div><span class="punto-leyenda" style="background:#d97706"></span> Medio</div>' +
      '<div><span class="punto-leyenda" style="background:#16a34a"></span> Bajo</div>';
    return div;
  };
  leyenda.addTo(mapaRegistros);

  return true;
}

/**
 * Aplica la visibilidad de las capas del mapa de registros según el modo elegido:
 * "ambos" (mapa de calor + puntos), "calor" (solo mapa de calor) o "puntos" (solo marcadores).
 */

/**
 * Circuito aproximado de trabajo de campo, separado de los reportes.
 * Los hitos son referencias del sector, no GPS exacto de cada evidencia.
 */
/**
 * Calcula una clave estable para cachear el ajuste cartográfico del recorrido.
 * El contenido base son puntos sectoriales aproximados, no una traza GPS.
 */
/**
 * Dibuja el recorrido de campo conforme al trazo satelital suministrado por el
 * equipo. No solicita rutas automáticas: el orden, las curvas y los ramales
 * se conservan exactamente según la geometría manual de datos/vias.json.
 */
/**
 * Ajusta una línea manual a la red vial siguiendo sus puntos de control en orden.
 * OSRM devuelve la geometría de las calles entre esos puntos; si falla, queda
 * visible el trazo manual original. No cambia las ubicaciones de las evidencias.
 */

function obtenerSegmentosRecorridoBase(vias) {
  var recorrido = vias && vias.recorrido_campo;
  if (!recorrido) return [];
  var segmentos = [];
  function validar(lista) {
    return (Array.isArray(lista) ? lista : []).filter(function (p) {
      return Array.isArray(p) && p.length >= 2 &&
        Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
    }).map(function (p) { return [Number(p[0]), Number(p[1])]; });
  }
  var principal = validar(recorrido.trazado);
  if (principal.length >= 2) segmentos.push(principal);
  (Array.isArray(recorrido.tramos_internos) ? recorrido.tramos_internos : []).forEach(function (tramo) {
    var puntos = validar(tramo.coordenadas);
    if (puntos.length >= 2) segmentos.push(puntos);
  });
  return segmentos;
}

function validarSegmentosRecorrido(lista) {
  if (!Array.isArray(lista)) return [];
  return lista.map(function (segmento) {
    if (!Array.isArray(segmento)) return [];
    return segmento.filter(function (p) {
      return Array.isArray(p) && p.length >= 2 &&
        Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])) &&
        Number(p[0]) >= -90 && Number(p[0]) <= 90 &&
        Number(p[1]) >= -180 && Number(p[1]) <= 180;
    }).map(function (p) { return [Number(p[0]), Number(p[1])]; });
  }).filter(function (segmento) { return segmento.length >= 2; });
}

function cargarRecorridoLocalGuardado(vias) {
  segmentosRecorridoGuardadosLocal = null;
  try {
    var contenido = localStorage.getItem(claveAlmacenamientoRecorridoLocal);
    if (!contenido) {
      actualizarEstadoEditorRecorrido("Usando el recorrido inicial. Puedes dibujar uno nuevo y guardarlo en este navegador.");
      return;
    }
    var guardado = JSON.parse(contenido);
    var segmentos = validarSegmentosRecorrido(guardado && guardado.segmentos);
    if (segmentos.length) {
      segmentosRecorridoGuardadosLocal = segmentos;
      actualizarEstadoEditorRecorrido("Recorrido guardado cargado desde este navegador · " + segmentos.length + " tramos.");
    } else {
      actualizarEstadoEditorRecorrido("No se pudo leer el recorrido guardado. Se muestra el recorrido inicial.");
    }
  } catch (error) {
    actualizarEstadoEditorRecorrido("El navegador no permitió leer el recorrido guardado. Puedes dibujar y descargar una copia.");
  }
}

function obtenerSegmentosRecorridoActual(vias) {
  if (Array.isArray(segmentosRecorridoGuardadosLocal) && segmentosRecorridoGuardadosLocal.length) {
    return segmentosRecorridoGuardadosLocal;
  }
  return obtenerSegmentosRecorridoBase(vias || ultimoViasRegistros);
}

function actualizarEstadoEditorRecorrido(mensaje) {
  var estado = document.getElementById("estado-editor-recorrido");
  if (estado && mensaje) estado.textContent = mensaje;
  actualizarControlesEditorRecorrido();
}

function actualizarControlesEditorRecorrido() {
  var puntos = puntosTramoRecorridoEnEdicion.length;
  var tramos = segmentosRecorridoEnEdicion.length;
  var activo = modoEdicionRecorridoActivo;
  var boton = function (id) { return document.getElementById(id); };
  var iniciar = boton("btn-iniciar-dibujo-recorrido");
  var terminar = boton("btn-terminar-tramo-recorrido");
  var deshacer = boton("btn-deshacer-punto-recorrido");
  var eliminar = boton("btn-eliminar-tramo-recorrido");
  var guardar = boton("btn-guardar-recorrido-local");
  var cancelar = boton("btn-cancelar-edicion-recorrido");
  var restaurar = boton("btn-restaurar-recorrido-inicial");
  var descargar = boton("btn-descargar-copia-recorrido");
  if (iniciar) iniciar.disabled = activo;
  if (terminar) terminar.disabled = !activo || puntos < 2;
  if (deshacer) deshacer.disabled = !activo || (!puntos && !tramos);
  if (eliminar) eliminar.disabled = !activo || !tramos;
  if (guardar) guardar.disabled = !activo || (!tramos && puntos < 2);
  if (cancelar) cancelar.disabled = !activo;
  if (restaurar) restaurar.disabled = !Array.isArray(segmentosRecorridoGuardadosLocal);
  if (descargar) descargar.disabled = !obtenerSegmentosRecorridoActual(ultimoViasRegistros).length;
}

function dibujarRecorridoCampo(vias) {
  if (!leafletDisponible() || !mapaRegistros) return;
  if (capaRecorridoCampo) mapaRegistros.removeLayer(capaRecorridoCampo);

  capaRecorridoCampo = L.layerGroup();
  var segmentos = obtenerSegmentosRecorridoActual(vias);
  segmentos.forEach(function (coordenadas, indice) {
    if (!Array.isArray(coordenadas) || coordenadas.length < 2) return;
    L.polyline(coordenadas, {
      color: "#16a34a",
      weight: 4,
      opacity: 0.96,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 0
    }).bindPopup("<strong>Recorrido de campo · Tramo " + (indice + 1) + "</strong>").addTo(capaRecorridoCampo);
  });
  capaRecorridoCampo.addTo(mapaRegistros);
  actualizarControlesEditorRecorrido();
}

function renderizarVistaPreviaEdicionRecorrido() {
  if (!mapaRegistros || !leafletDisponible()) return;
  if (capaVistaPreviaEdicionRecorrido) mapaRegistros.removeLayer(capaVistaPreviaEdicionRecorrido);
  capaVistaPreviaEdicionRecorrido = L.layerGroup();

  segmentosRecorridoEnEdicion.forEach(function (segmento) {
    if (segmento.length >= 2) {
      L.polyline(segmento, {
        color: "#2563eb", weight: 4, opacity: 0.95,
        dashArray: "7,6", lineCap: "round", lineJoin: "round"
      }).addTo(capaVistaPreviaEdicionRecorrido);
    }
  });
  if (puntosTramoRecorridoEnEdicion.length >= 2) {
    L.polyline(puntosTramoRecorridoEnEdicion, {
      color: "#2563eb", weight: 4, opacity: 1,
      dashArray: "7,6", lineCap: "round", lineJoin: "round"
    }).addTo(capaVistaPreviaEdicionRecorrido);
  }
  puntosTramoRecorridoEnEdicion.forEach(function (punto, indice) {
    L.circleMarker(punto, {
      radius: indice === puntosTramoRecorridoEnEdicion.length - 1 ? 7 : 5,
      color: "#ffffff", weight: 2,
      fillColor: "#2563eb", fillOpacity: 1
    }).addTo(capaVistaPreviaEdicionRecorrido);
  });
  capaVistaPreviaEdicionRecorrido.addTo(mapaRegistros);
}

function iniciarEdicionRecorrido() {
  if (!mapaRegistros) {
    actualizarEstadoEditorRecorrido("El mapa todavía no está disponible.");
    return;
  }
  modoEdicionRecorridoActivo = true;
  segmentosRecorridoEnEdicion = [];
  puntosTramoRecorridoEnEdicion = [];
  if (mapaRegistros.doubleClickZoom) mapaRegistros.doubleClickZoom.disable();
  renderizarVistaPreviaEdicionRecorrido();
  actualizarEstadoEditorRecorrido("Dibujo activo: haz clic sobre la calle para marcar los puntos del primer tramo.");
}

function agregarPuntoAlRecorrido(e) {
  if (!modoEdicionRecorridoActivo || !e || !e.latlng) return;
  puntosTramoRecorridoEnEdicion.push([
    Number(e.latlng.lat.toFixed(7)),
    Number(e.latlng.lng.toFixed(7))
  ]);
  renderizarVistaPreviaEdicionRecorrido();
  actualizarEstadoEditorRecorrido("Puntos del tramo actual: " + puntosTramoRecorridoEnEdicion.length +
    " · Tramos terminados: " + segmentosRecorridoEnEdicion.length +
    ". Haz clic siguiendo la calle; pulsa “Terminar tramo” al llegar al final.");
}

function terminarTramoRecorrido() {
  if (!modoEdicionRecorridoActivo) return;
  if (puntosTramoRecorridoEnEdicion.length < 2) {
    actualizarEstadoEditorRecorrido("Marca al menos dos puntos sobre la calle para terminar un tramo.");
    return;
  }
  segmentosRecorridoEnEdicion.push(puntosTramoRecorridoEnEdicion.slice());
  puntosTramoRecorridoEnEdicion = [];
  renderizarVistaPreviaEdicionRecorrido();
  actualizarEstadoEditorRecorrido("Tramo añadido. Puedes empezar a dibujar el siguiente tramo de calle.");
}

function deshacerPuntoRecorrido() {
  if (!modoEdicionRecorridoActivo) return;
  if (puntosTramoRecorridoEnEdicion.length) {
    puntosTramoRecorridoEnEdicion.pop();
  } else if (segmentosRecorridoEnEdicion.length) {
    var ultimo = segmentosRecorridoEnEdicion.pop();
    ultimo.pop();
    if (ultimo.length >= 2) {
      segmentosRecorridoEnEdicion.push(ultimo);
    } else {
      puntosTramoRecorridoEnEdicion = ultimo;
    }
  }
  renderizarVistaPreviaEdicionRecorrido();
  actualizarEstadoEditorRecorrido("Punto deshecho. Continúa dibujando sobre la calle.");
}

function eliminarUltimoTramoRecorrido() {
  if (!modoEdicionRecorridoActivo || !segmentosRecorridoEnEdicion.length) return;
  segmentosRecorridoEnEdicion.pop();
  renderizarVistaPreviaEdicionRecorrido();
  actualizarEstadoEditorRecorrido("Se eliminó el último tramo del borrador. El recorrido guardado sigue intacto.");
}

function guardarRecorridoLocal() {
  if (!modoEdicionRecorridoActivo) return;
  if (puntosTramoRecorridoEnEdicion.length === 1) {
    actualizarEstadoEditorRecorrido("El tramo actual tiene un solo punto. Añade otro o deshaz ese punto antes de guardar.");
    return;
  }
  if (puntosTramoRecorridoEnEdicion.length >= 2) {
    segmentosRecorridoEnEdicion.push(puntosTramoRecorridoEnEdicion.slice());
  }
  var segmentos = validarSegmentosRecorrido(segmentosRecorridoEnEdicion);
  if (!segmentos.length) {
    actualizarEstadoEditorRecorrido("No hay líneas para guardar. Dibuja al menos un tramo de dos puntos.");
    return;
  }
  try {
    localStorage.setItem(claveAlmacenamientoRecorridoLocal, JSON.stringify({
      formato: "control-vial-santa-marta-recorrido",
      version: 1,
      guardado: new Date().toISOString(),
      segmentos: segmentos
    }));
  } catch (error) {
    actualizarEstadoEditorRecorrido("No se pudo guardar en este navegador. Descarga una copia del recorrido.");
    return;
  }
  segmentosRecorridoGuardadosLocal = segmentos;
  modoEdicionRecorridoActivo = false;
  segmentosRecorridoEnEdicion = [];
  puntosTramoRecorridoEnEdicion = [];
  if (mapaRegistros.doubleClickZoom) mapaRegistros.doubleClickZoom.enable();
  if (capaVistaPreviaEdicionRecorrido) {
    mapaRegistros.removeLayer(capaVistaPreviaEdicionRecorrido);
    capaVistaPreviaEdicionRecorrido = null;
  }
  dibujarRecorridoCampo(ultimoViasRegistros);
  configurarControlRecorridoCampo();
  actualizarEstadoEditorRecorrido("¡Recorrido guardado en este navegador! Se conservará al cerrar y volver a abrir esta página.");
}

function cancelarEdicionRecorrido() {
  if (!modoEdicionRecorridoActivo) return;
  modoEdicionRecorridoActivo = false;
  segmentosRecorridoEnEdicion = [];
  puntosTramoRecorridoEnEdicion = [];
  if (mapaRegistros.doubleClickZoom) mapaRegistros.doubleClickZoom.enable();
  if (capaVistaPreviaEdicionRecorrido) {
    mapaRegistros.removeLayer(capaVistaPreviaEdicionRecorrido);
    capaVistaPreviaEdicionRecorrido = null;
  }
  actualizarEstadoEditorRecorrido("Edición cancelada. Se conserva el último recorrido guardado.");
}

function restaurarRecorridoInicial() {
  if (!Array.isArray(segmentosRecorridoGuardadosLocal)) return;
  if (!window.confirm("¿Restaurar el recorrido inicial? Se eliminará la copia guardada en este navegador.")) return;
  try { localStorage.removeItem(claveAlmacenamientoRecorridoLocal); } catch (error) {}
  segmentosRecorridoGuardadosLocal = null;
  cancelarEdicionRecorrido();
  dibujarRecorridoCampo(ultimoViasRegistros);
  actualizarEstadoEditorRecorrido("Se restauró el recorrido inicial del proyecto.");
}

function descargarCopiaRecorrido() {
  var segmentos = obtenerSegmentosRecorridoActual(ultimoViasRegistros);
  if (!segmentos.length) return;
  var copia = {
    formato: "control-vial-santa-marta-recorrido",
    version: 1,
    segmentos: segmentos
  };
  var blob = new Blob([JSON.stringify(copia, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "recorrido-control-vial-santa-marta.json";
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
  actualizarEstadoEditorRecorrido("Copia del recorrido descargada.");
}

function importarCopiaRecorrido(contenido) {
  try {
    var copia = JSON.parse(contenido);
    if (!copia || copia.formato !== "control-vial-santa-marta-recorrido" || copia.version !== 1) {
      throw new Error("El archivo no es una copia válida del recorrido.");
    }
    var segmentos = validarSegmentosRecorrido(copia.segmentos);
    if (!segmentos.length) throw new Error("El archivo no contiene tramos válidos.");
    localStorage.setItem(claveAlmacenamientoRecorridoLocal, JSON.stringify(copia));
    segmentosRecorridoGuardadosLocal = segmentos;
    cancelarEdicionRecorrido();
    dibujarRecorridoCampo(ultimoViasRegistros);
    configurarControlRecorridoCampo();
    actualizarEstadoEditorRecorrido("Copia cargada y guardada en este navegador · " + segmentos.length + " tramos.");
    return true;
  } catch (error) {
    actualizarEstadoEditorRecorrido(error.message || "No se pudo importar la copia.");
    return false;
  }
}

function redimensionarMapaRegistros() {
  if (leafletDisponible() && mapaRegistros) mapaRegistros.invalidateSize({ pan: false });
}
function aplicarModoCapasRegistros() {
  if (!leafletDisponible() || !mapaRegistros) return;
  var mostrarCalor = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "calor";
  var mostrarPuntos = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "puntos";

  // El mapa alterna exclusivamente el calor y los marcadores de reportes
  // que tienen una clasificación Alto, Medio o Bajo válida.
  if (capaCalorRegistros) {
    if (mostrarCalor && !mapaRegistros.hasLayer(capaCalorRegistros)) mapaRegistros.addLayer(capaCalorRegistros);
    if (!mostrarCalor && mapaRegistros.hasLayer(capaCalorRegistros)) mapaRegistros.removeLayer(capaCalorRegistros);
  }
  if (capaMarcadoresRegistros) {
    if (mostrarPuntos && !mapaRegistros.hasLayer(capaMarcadoresRegistros)) mapaRegistros.addLayer(capaMarcadoresRegistros);
    if (!mostrarPuntos && mapaRegistros.hasLayer(capaMarcadoresRegistros)) mapaRegistros.removeLayer(capaMarcadoresRegistros);
  }
}

function cambiarModoMapaRegistros(nuevoModo) {
  if (nuevoModo !== "ambos" && nuevoModo !== "calor" && nuevoModo !== "puntos") {
    return;
  }
  modoVisualizacionRegistros = nuevoModo;
  aplicarModoCapasRegistros();
}

/**
 * Actualiza el mapa usando exclusivamente reportes con criticidad válida.
 * Las fotografías permanecen en la galería y no crean puntos ni calor.
 */
function actualizarMarcadoresEvidencias(evidencias) {
  // Se conserva la fuente fotográfica por separado de los reportes ciudadanos.
  // Sus niveles visuales preliminares se dibujan en el mismo mapa, pero no se
  // agregan a las estadísticas ni se presentan como criticidad formal.
  ultimasEvidenciasMapa = Array.isArray(evidencias) ? evidencias : [];
  return ultimasEvidenciasMapa.length;
}

function escaparTextoMapa(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function actualizarMarcadoresRegistros(listaReportes, vias) {
  ultimosReportesRegistros = Array.isArray(listaReportes) ? listaReportes : [];
  if (vias) ultimoViasRegistros = vias;

  if (!leafletDisponible() || !mapaRegistros || !capaMarcadoresRegistros) return;

  capaMarcadoresRegistros.clearLayers();

  if (capaCalorRegistros && mapaRegistros.hasLayer(capaCalorRegistros)) {
    mapaRegistros.removeLayer(capaCalorRegistros);
  }
  capaCalorRegistros = null;

  var coordenadas = [];
  var puntosCalor = [];

  // Evidencias fotográficas: puntos por nivel visual preliminar.
  // Sus coordenadas sectoriales guardadas se respetan sin ningún ajuste.
  for (var e = 0; e < ultimasEvidenciasMapa.length; e++) {
    var evidencia = ultimasEvidenciasMapa[e];
    var ubicacion = evidencia && evidencia.ubicacion_aproximada;
    var evaluacion = evidencia && evidencia.clasificacion_visual_preliminar;
    if (!ubicacion || !Number.isFinite(Number(ubicacion.lat)) ||
        !Number.isFinite(Number(ubicacion.lng)) || !evaluacion) continue;

    var nivelVisual = String(evaluacion.nivel || "").trim().toLowerCase();
    if (nivelVisual !== "alto" && nivelVisual !== "medio" && nivelVisual !== "bajo") continue;

    var latVisual = Number(ubicacion.lat);
    var lngVisual = Number(ubicacion.lng);
    var intensidadVisual = nivelVisual === "alto" ? 1 : (nivelVisual === "medio" ? 0.65 : 0.30);
    var colorVisual = obtenerColorNivel(nivelVisual);
    puntosCalor.push([latVisual, lngVisual, intensidadVisual]);

    var marcadorEvidencia = L.circleMarker([latVisual, lngVisual], {
      radius: 7,
      fillColor: colorVisual,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.92
    });
    marcadorEvidencia.bindPopup(
      "<strong>" + escaparTextoMapa(evidencia.id || "Evidencia") + "</strong> · Evidencia fotográfica<br>" +
      "Nivel visual preliminar: <strong>" + escaparTextoMapa(evaluacion.nivel) + "</strong><br>" +
      "Observación: " + escaparTextoMapa(evaluacion.observacion || evaluacion.tipo_observado || "—") + "<br>" +
      "Confianza visual: " + escaparTextoMapa(evaluacion.confianza || "no indicada") + "<br>" +
      "<em>No es un puntaje formal de criticidad: falta fecha/hora para calcular franja.</em>"
    );
    marcadorEvidencia.addTo(capaMarcadoresRegistros);
    coordenadas.push([latVisual, lngVisual]);
  }

  for (var i = 0; i < ultimosReportesRegistros.length; i++) {
    var r = ultimosReportesRegistros[i];
    if (!reporteDentroZonaMapa(r, ultimoViasRegistros)) continue;

    // No representar registros incompletos como si fueran reportes de nivel Bajo.
    var claveNivel = String(r.criticidad && r.criticidad.nivel || "").trim().toLowerCase();
    var nivel = claveNivel === "alto" ? "Alto" :
      (claveNivel === "medio" ? "Medio" : (claveNivel === "bajo" ? "Bajo" : ""));
    if (!nivel) continue;

    var puntaje = r.criticidad && Number.isFinite(Number(r.criticidad.puntaje))
      ? Number(r.criticidad.puntaje) : null;
    var color = obtenerColorNivel(nivel);

    // Intensidad categórica: Alto=rojo, Medio=ámbar, Bajo=verde.
    // El mapa de calor usa exclusivamente reportes clasificados.
    var intensidad = claveNivel === "alto" ? 1 : (claveNivel === "medio" ? 0.65 : 0.30);
    puntosCalor.push([r.lat, r.lng, intensidad]);

    var marcador = L.circleMarker([r.lat, r.lng], {
      radius: 7,
      fillColor: color,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    var referenciaReporte = r.ambito === "otros_sectores_santa_marta"
      ? "Otros sectores de Santa Marta" +
        (r.sector_referencia ? " · " + escaparTextoMapa(r.sector_referencia) : "") +
        "<br>Vía " + (r.tipo_via_reporte === "arterial" ? "arterial" : "secundaria")
      : "Cuadra: " + escaparTextoMapa(r.cuadra || "—");
    marcador.bindPopup(
      "<strong>" + escaparTextoMapa(r.id) + "</strong> (" + escaparTextoMapa(r.origen) + ")<br>" +
      "Fecha: " + escaparTextoMapa(String(r.fecha_hora || "").replace("T", " ")) + "<br>" +
      referenciaReporte + "<br>" +
      "Nivel: <strong>" + escaparTextoMapa(nivel) +
      (puntaje === null ? "" : " (" + puntaje + " pts)") + "</strong>"
    );

    marcador.addTo(capaMarcadoresRegistros);
    coordenadas.push([r.lat, r.lng]);
  }

  var tamMapa = mapaRegistros.getSize();
  if (heatDisponible() && puntosCalor.length > 0 && tamMapa.x > 0 && tamMapa.y > 0) {
    capaCalorRegistros = L.heatLayer(puntosCalor, {
      radius: 28,
      blur: 20,
      maxZoom: 18,
      max: 1.0,
      minOpacity: 0.45,
      gradient: {
        0.30: "#16a34a",
        0.65: "#d97706",
        1.00: "#dc2626"
      }
    });
  }

  aplicarModoCapasRegistros();

  if (coordenadas.length > 0) {
    var limites = L.latLngBounds(coordenadas);
    mapaRegistros.fitBounds(limites, { padding: [26, 26], maxZoom: 17 });
  } else {
    // Sin reportes válidos, el mapa encuadra el recorrido; no usa las
    // coordenadas sectoriales de las fotografías como marcadores o calor.
    var puntosRecorrido = obtenerSegmentosRecorridoActual(ultimoViasRegistros)
      .reduce(function (acumulado, segmento) {
        return acumulado.concat(segmento);
      }, []);
    if (puntosRecorrido.length > 1) {
      mapaRegistros.fitBounds(L.latLngBounds(puntosRecorrido), { padding: [32, 32], maxZoom: 17 });
    } else if (ultimoViasRegistros && ultimoViasRegistros.zona && ultimoViasRegistros.zona.centro) {
      mapaRegistros.setView(ultimoViasRegistros.zona.centro, ultimoViasRegistros.zona.zoom || 15);
    }
  }
}

function redimensionarMapaRegistros() {
  if (leafletDisponible() && mapaRegistros) {
    setTimeout(function () {
      mapaRegistros.invalidateSize();
      // Leaflet se inicializa mientras la vista Registros está oculta.
      // Volver a dibujar asegura que la línea y sus puntos aparezcan al abrir la pestaña.
      dibujarRecorridoCampo(ultimoViasRegistros);
      actualizarMarcadoresRegistros(ultimosReportesRegistros, ultimoViasRegistros);
    }, 120);
  }
}

/**
 * Busca coincidencias en las cuadras de vias.json y en Nominatim (OpenStreetMap)
 * priorizando Santa Marta / zona de estudio.
 * Devuelve Promise<Array<{ titulo, subtitulo, lat, lng, origen }>>.
 */
function buscarDireccionesMapa(textoConsulta, vias, ambito) {
  var q = String(textoConsulta || "").trim();
  if (q.length < 2) {
    return Promise.resolve([]);
  }

  var qLower = q.toLowerCase();
  var resultados = [];

  if (vias && Array.isArray(vias.cuadras)) {
    for (var i = 0; i < vias.cuadras.length; i++) {
      var c = vias.cuadras[i];
      if (!Array.isArray(c.extremos) || c.extremos.length === 0) continue;

      var textoCuadra = (String(c.nombre || "") + " " + String(c.id || "") + " " + String(c.tipo_via || "")).toLowerCase();
      if (textoCuadra.indexOf(qLower) !== -1) {
        var sumaLat = 0;
        var sumaLng = 0;
        for (var j = 0; j < c.extremos.length; j++) {
          sumaLat += Number(c.extremos[j][0]);
          sumaLng += Number(c.extremos[j][1]);
        }
        resultados.push({
          titulo: c.nombre + " (" + c.id + ")",
          subtitulo: "Cuadra en zona · " + (c.tipo_via === "arterial" ? "Vía arterial" : "Vía secundaria"),
          lat: Number((sumaLat / c.extremos.length).toFixed(6)),
          lng: Number((sumaLng / c.extremos.length).toFixed(6)),
          origen: "local"
        });
      }
    }
  }

  var consultaConCiudad = qLower.indexOf("santa marta") === -1 ? q + ", Santa Marta, Colombia" : q;
  var url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=co&q=" +
    encodeURIComponent(consultaConCiudad);

  // En el área de estudio se prioriza su rectángulo pequeño; para otros
  // sectores se elimina ese sesgo y se busca en toda Santa Marta.
  var lim = ambito === "otros_sectores_santa_marta"
    ? null
    : (vias && vias.zona && vias.zona.limites);
  if (
    lim &&
    typeof lim.lng_min === "number" &&
    typeof lim.lat_min === "number" &&
    typeof lim.lng_max === "number" &&
    typeof lim.lat_max === "number"
  ) {
    url += "&viewbox=" + lim.lng_min + "," + lim.lat_max + "," + lim.lng_max + "," + lim.lat_min;
  }

  return fetch(url, {
    headers: {
      "Accept": "application/json"
    }
  })
    .then(function (resp) {
      if (!resp.ok) throw new Error("Error consultando servicio de direcciones");
      return resp.json();
    })
    .then(function (items) {
      if (Array.isArray(items)) {
        for (var k = 0; k < items.length; k++) {
          var item = items[k];
          var latNum = parseFloat(item.lat);
          var lngNum = parseFloat(item.lon);
          if (isNaN(latNum) || isNaN(lngNum)) continue;

          var partes = String(item.display_name || "").split(",");
          var tituloExt = item.name || partes[0] || q;
          var subExt = partes.slice(1, 4).join(",").trim() || "Santa Marta";

          resultados.push({
            titulo: tituloExt,
            subtitulo: subExt,
            lat: Number(latNum.toFixed(6)),
            lng: Number(lngNum.toFixed(6)),
            origen: "nominatim"
          });
        }
      }
      return resultados.slice(0, 7);
    })
    .catch(function () {
      return resultados.slice(0, 7);
    });
}
