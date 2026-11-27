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
var capaPuntosEvidencias = null;
var capaCalorEvidencias = null;
var ultimasEvidenciasMapa = [];
var modoVisualizacionRegistros = "ambos"; // "ambos" | "calor" | "puntos"
var ultimosReportesRegistros = [];
var ultimoViasRegistros = null;
var capaRecorridoCampo = null;

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

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapaCaptura);

  capaReportesCaptura = L.layerGroup().addTo(mapaCaptura);

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
        "<strong>" + r.id + "</strong><br>" +
        "Cuadra: " + r.cuadra + "<br>" +
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
  if (!reporte || typeof reporte.lat !== "number" || typeof reporte.lng !== "number") return false;
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
  var centro = (vias && vias.zona && vias.zona.centro) ? vias.zona.centro : [11.2335, -74.1972];
  var zoom = (vias && vias.zona && vias.zona.zoom) ? vias.zona.zoom : 15;

  mapaRegistros = L.map(idContenedor, {
    zoomControl: true
  }).setView(centro, zoom);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapaRegistros);

  capaMarcadoresRegistros = L.layerGroup().addTo(mapaRegistros);
  capaPuntosEvidencias = L.layerGroup().addTo(mapaRegistros);
  dibujarRecorridoCampo(vias);

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
      '<div><span class="punto-leyenda" style="background:#7c3aed"></span> 30 evidencias (aprox.)</div>' +
      '<div><span class="punto-leyenda" style="background:#dc2626"></span> Reportes altos</div>' +
      '<div><span class="punto-leyenda" style="background:#d97706"></span> Reportes medios</div>' +
      '<div><span class="punto-leyenda" style="background:#16a34a"></span> Reportes bajos</div>';
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
function dibujarRecorridoCampo(vias) {
  if (!leafletDisponible() || !mapaRegistros) return;
  if (capaRecorridoCampo) mapaRegistros.removeLayer(capaRecorridoCampo);
  capaRecorridoCampo = L.layerGroup();
  var recorrido = vias && vias.recorrido_campo;
  var hitos = recorrido && Array.isArray(recorrido.hitos) ? recorrido.hitos : [];
  var puntos = recorrido && Array.isArray(recorrido.trazado) && recorrido.trazado.length >= 2
    ? recorrido.trazado : hitos.map(function (h) { return h.coordenadas; });
  if (puntos.length < 2) return;

  // Línea verde: referencia del recorrido. Los puntos rojos son las 30 evidencias.
  L.polyline(puntos, {
    color: "#15803d",
    weight: 3,
    opacity: 0.7,
    lineCap: "round",
    lineJoin: "round"
  }).bindPopup(
    "<strong>Recorrido de campo</strong><br>" +
    "Trazado aproximado reconstruido a partir de la línea verde aportada por el equipo."
  ).addTo(capaRecorridoCampo);

  capaRecorridoCampo.addTo(mapaRegistros);
}
function aplicarModoCapasRegistros() {
  if (!leafletDisponible() || !mapaRegistros) return;
  var mostrarCalor = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "calor";
  var mostrarPuntos = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "puntos";

  // El circuito permanece visible en los tres modos; los botones alternan puntos y calor de evidencias y reportes.
  if (capaCalorRegistros) {
    if (mostrarCalor && !mapaRegistros.hasLayer(capaCalorRegistros)) mapaRegistros.addLayer(capaCalorRegistros);
    if (!mostrarCalor && mapaRegistros.hasLayer(capaCalorRegistros)) mapaRegistros.removeLayer(capaCalorRegistros);
  }
  if (capaMarcadoresRegistros) {
    if (mostrarPuntos && !mapaRegistros.hasLayer(capaMarcadoresRegistros)) mapaRegistros.addLayer(capaMarcadoresRegistros);
    if (!mostrarPuntos && mapaRegistros.hasLayer(capaMarcadoresRegistros)) mapaRegistros.removeLayer(capaMarcadoresRegistros);
  }
  if (capaCalorEvidencias) {
    if (mostrarCalor && !mapaRegistros.hasLayer(capaCalorEvidencias)) mapaRegistros.addLayer(capaCalorEvidencias);
    if (!mostrarCalor && mapaRegistros.hasLayer(capaCalorEvidencias)) mapaRegistros.removeLayer(capaCalorEvidencias);
  }
  if (capaPuntosEvidencias) {
    if (mostrarPuntos && !mapaRegistros.hasLayer(capaPuntosEvidencias)) mapaRegistros.addLayer(capaPuntosEvidencias);
    if (!mostrarPuntos && mapaRegistros.hasLayer(capaPuntosEvidencias)) mapaRegistros.removeLayer(capaPuntosEvidencias);
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
 * Actualiza tanto la capa de calor (Leaflet.heat ponderada por criticidad.puntaje)
 * como los marcadores individuales en el mapa de Registros.
 */
/**
 * Dibuja las evidencias usando ubicaciones sectoriales aproximadas acordadas
 * con el equipo (5 corredor universitario, 25 parque y alrededores).
 * No son coordenadas GPS originales ni ubicaciones exactas de cada fotografía.
 */
function actualizarMarcadoresEvidencias(evidencias, vias) {
  ultimasEvidenciasMapa = Array.isArray(evidencias) ? evidencias : [];
  if (!leafletDisponible() || !mapaRegistros || !capaPuntosEvidencias) return;

  capaPuntosEvidencias.clearLayers();
  if (capaCalorEvidencias && mapaRegistros.hasLayer(capaCalorEvidencias)) {
    mapaRegistros.removeLayer(capaCalorEvidencias);
  }
  capaCalorEvidencias = null;

  var puntosCalor = [];
  ultimasEvidenciasMapa.forEach(function (e) {
    var u = e && e.ubicacion_aproximada;
    if (!u || !Number.isFinite(Number(u.lat)) || !Number.isFinite(Number(u.lng))) return;
    var lat = Number(u.lat), lng = Number(u.lng);
    var lim = vias && vias.zona && vias.zona.limites;
    if (lim && (lat < lim.lat_min || lat > lim.lat_max || lng < lim.lng_min || lng > lim.lng_max)) return;
    puntosCalor.push([lat, lng, 1]);

    var marcador = L.circleMarker([lat, lng], {
      radius: 6,
      fillColor: "#7c3aed",
      color: "#ffffff",
      weight: 1.5,
      opacity: 1,
      fillOpacity: 0.9
    });
    marcador.bindPopup(
      "<strong>" + String(e.id || "Evidencia") + "</strong><br>" +
      String(u.sector || "Recorrido de campo") + "<br>" +
      "<em>Ubicación sectorial aproximada; no es GPS individual.</em>"
    );
    marcador.addTo(capaPuntosEvidencias);
  });

  if (heatDisponible() && puntosCalor.length > 0) {
    capaCalorEvidencias = L.heatLayer(puntosCalor, {
      radius: 34,
      blur: 24,
      maxZoom: 19,
      max: 1,
      minOpacity: 0.4,
      gradient: { 0.25: "#a78bfa", 0.55: "#f59e0b", 0.85: "#ef4444", 1: "#991b1b" }
    });
  }
  aplicarModoCapasRegistros();
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

  for (var i = 0; i < ultimosReportesRegistros.length; i++) {
    var r = ultimosReportesRegistros[i];
    if (!reporteDentroZonaMapa(r, ultimoViasRegistros)) continue;

    var nivel = r.criticidad ? r.criticidad.nivel : "Bajo";
    var puntaje = r.criticidad && typeof r.criticidad.puntaje === "number" ? r.criticidad.puntaje : 1;
    var color = obtenerColorNivel(nivel);

    var intensidad = Math.max(0.25, Math.min(1.0, puntaje / 9));
    puntosCalor.push([r.lat, r.lng, intensidad]);

    var marcador = L.circleMarker([r.lat, r.lng], {
      radius: 7,
      fillColor: color,
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });

    marcador.bindPopup(
      "<strong>" + r.id + "</strong> (" + r.origen + ")<br>" +
      "Fecha: " + r.fecha_hora.replace("T", " ") + "<br>" +
      "Cuadra: " + r.cuadra + "<br>" +
      "Nivel: <strong>" + nivel + " (" + puntaje + " pts)</strong>"
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
        0.65: "#f59e0b",
        1.00: "#dc2626"
      }
    });
  }

  aplicarModoCapasRegistros();

  if (coordenadas.length > 0) {
    var limites = L.latLngBounds(coordenadas);
    mapaRegistros.fitBounds(limites, { padding: [26, 26], maxZoom: 17 });
  } else {
    var puntosEvidencia = ultimasEvidenciasMapa.map(function (e) {
      return e && e.ubicacion_aproximada
        ? [Number(e.ubicacion_aproximada.lat), Number(e.ubicacion_aproximada.lng)] : null;
    }).filter(function (p) { return p && isFinite(p[0]) && isFinite(p[1]); });
    if (puntosEvidencia.length > 0) {
      mapaRegistros.fitBounds(L.latLngBounds(puntosEvidencia), { padding: [32, 32], maxZoom: 17 });
    } else if (ultimoViasRegistros && ultimoViasRegistros.zona && ultimoViasRegistros.zona.centro) {
      mapaRegistros.setView(ultimoViasRegistros.zona.centro, ultimoViasRegistros.zona.zoom || 15);
    }
  }
}

/**
 * Recalcula el tamaño del mapa de registros cuando se abre la pestaña Registros
 * y reconstruye la capa de calor para evitar el lienzo 0x0 al estar oculto.
 */
function redimensionarMapaRegistros() {
  if (leafletDisponible() && mapaRegistros) {
    setTimeout(function () {
      mapaRegistros.invalidateSize();
      // Leaflet se inicializa mientras la vista Registros está oculta.
      // Volver a dibujar asegura que la línea y sus puntos aparezcan al abrir la pestaña.
      dibujarRecorridoCampo(ultimoViasRegistros);
      actualizarMarcadoresEvidencias(ultimasEvidenciasMapa, ultimoViasRegistros);
      actualizarMarcadoresRegistros(ultimosReportesRegistros, ultimoViasRegistros);
    }, 120);
  }
}

/**
 * Busca coincidencias en las cuadras de vias.json y en Nominatim (OpenStreetMap)
 * priorizando Santa Marta / zona de estudio.
 * Devuelve Promise<Array<{ titulo, subtitulo, lat, lng, origen }>>.
 */
function buscarDireccionesMapa(textoConsulta, vias) {
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

  var lim = vias && vias.zona && vias.zona.limites;
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
