/* ============================================================================
 * ARCHIVO: mapa.js
 * RESPONSABILIDAD: Gestión de los mapas Leaflet (mapa de captura y mapa de
 * registros con capa de calor Leaflet.heat ponderada por criticidad y capa
 * de puntos individuales), dibujo de cuadras, geocodificación y marcador.
 * ============================================================================ */

var mapaCaptura = null;
var marcadorCaptura = null;
var capaCuadrasCaptura = null;
var capaReportesCaptura = null;
var polilineasCuadras = {};

var mapaRegistros = null;
var capaMarcadoresRegistros = null;
var capaCalorRegistros = null;
var modoVisualizacionRegistros = "ambos"; // "ambos" | "calor" | "puntos"
var ultimosReportesRegistros = [];
var ultimoViasRegistros = null;
var controladorBusquedaNominatim = null;

function leafletDisponible() {
  return typeof L !== "undefined" && L !== null;
}

function heatDisponible() {
  return leafletDisponible() && typeof L.heatLayer === "function";
}

function escaparTextoMapa(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function obtenerCentroideCuadra(cuadraObj) {
  if (!cuadraObj || !Array.isArray(cuadraObj.extremos) || cuadraObj.extremos.length === 0) {
    return null;
  }
  var sumaLat = 0;
  var sumaLng = 0;
  for (var i = 0; i < cuadraObj.extremos.length; i++) {
    sumaLat += Number(cuadraObj.extremos[i][0]);
    sumaLng += Number(cuadraObj.extremos[i][1]);
  }
  return {
    lat: Number((sumaLat / cuadraObj.extremos.length).toFixed(6)),
    lng: Number((sumaLng / cuadraObj.extremos.length).toFixed(6))
  };
}

function obtenerColorNivel(nivel) {
  var clave = String(nivel || "").toLowerCase();
  if (clave === "alto") return "#dc2626";
  if (clave === "medio") return "#d97706";
  return "#16a34a";
}

function iniciarMapaCaptura(idContenedor, vias, alElegirUbicacion) {
  if (!leafletDisponible()) {
    return false;
  }

  var centro = (vias && vias.zona && vias.zona.centro) ? vias.zona.centro : [11.2450, -74.2064];
  var zoom = (vias && vias.zona && vias.zona.zoom) ? vias.zona.zoom : 17;

  mapaCaptura = L.map(idContenedor, {
    zoomControl: true
  }).setView(centro, zoom);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapaCaptura);

  capaCuadrasCaptura = L.layerGroup().addTo(mapaCaptura);
  capaReportesCaptura = L.layerGroup().addTo(mapaCaptura);
  polilineasCuadras = {};

  if (vias && Array.isArray(vias.cuadras)) {
    for (var i = 0; i < vias.cuadras.length; i++) {
      var cuadra = vias.cuadras[i];
      if (!Array.isArray(cuadra.extremos) || cuadra.extremos.length < 2) continue;

      var linea = L.polyline(cuadra.extremos, {
        color: "#475569",
        weight: 5,
        opacity: 0.7
      });

      linea.bindTooltip(escaparTextoMapa(cuadra.nombre + " (" + cuadra.tipo_via + ")"), {
        sticky: true
      });

      linea.on("click", function (e) {
        if (typeof alElegirUbicacion === "function") {
          alElegirUbicacion(e.latlng.lat, e.latlng.lng);
        }
      });

      linea.addTo(capaCuadrasCaptura);
      polilineasCuadras[cuadra.id] = linea;
    }
  }

  mapaCaptura.on("click", function (e) {
    if (typeof alElegirUbicacion === "function") {
      alElegirUbicacion(e.latlng.lat, e.latlng.lng);
    }
  });

  return true;
}

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

function resaltarCuadraCaptura(cuadraId) {
  if (!leafletDisponible() || !mapaCaptura) return;

  var ids = Object.keys(polilineasCuadras);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var linea = polilineasCuadras[id];
    if (id === cuadraId) {
      linea.setStyle({
        color: "#0284c7",
        weight: 9,
        opacity: 1
      });
      linea.bringToFront();
    } else {
      linea.setStyle({
        color: "#64748b",
        weight: 5,
        opacity: 0.55
      });
    }
  }
}

function actualizarPuntosEnMapaCaptura(listaReportes) {
  if (!leafletDisponible() || !mapaCaptura || !capaReportesCaptura) return;

  capaReportesCaptura.clearLayers();

  for (var i = 0; i < listaReportes.length; i++) {
    var r = listaReportes[i];
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
        "Cuadra: " + escaparTextoMapa(r.cuadra) + "<br>" +
        "Nivel: " + escaparTextoMapa(nivel) + " (" + escaparTextoMapa(r.criticidad ? r.criticidad.puntaje : "-") + ")"
      )
      .addTo(capaReportesCaptura);
  }
}

function redimensionarMapaCaptura() {
  if (leafletDisponible() && mapaCaptura) {
    setTimeout(function () {
      mapaCaptura.invalidateSize();
    }, 60);
  }
}

function iniciarMapaRegistros(idContenedor, vias) {
  if (!leafletDisponible()) {
    return false;
  }

  ultimoViasRegistros = vias;
  var centro = (vias && vias.zona && vias.zona.centro) ? vias.zona.centro : [11.2450, -74.2064];
  var zoom = (vias && vias.zona && vias.zona.zoom) ? vias.zona.zoom : 17;

  mapaRegistros = L.map(idContenedor, {
    zoomControl: true
  }).setView(centro, zoom);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapaRegistros);

  capaMarcadoresRegistros = L.layerGroup().addTo(mapaRegistros);

  var avisoCalor = document.getElementById("aviso-sin-calor");
  if (avisoCalor && !heatDisponible()) {
    avisoCalor.hidden = false;
  }

  var leyenda = L.control({ position: "bottomright" });
  leyenda.onAdd = function () {
    var div = L.DomUtil.create("div", "leyenda-mapa");
    div.innerHTML =
      "<strong>Criticidad / Calor</strong>" +
      '<div><span class="punto-leyenda" style="background:#dc2626"></span> Alto (7–9)</div>' +
      '<div><span class="punto-leyenda" style="background:#d97706"></span> Medio (5–6)</div>' +
      '<div><span class="punto-leyenda" style="background:#16a34a"></span> Bajo (0–4)</div>';
    return div;
  };
  leyenda.addTo(mapaRegistros);

  return true;
}

function aplicarModoCapasRegistros() {
  if (!leafletDisponible() || !mapaRegistros) return;

  var mostrarCalor = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "calor";
  var mostrarPuntos = modoVisualizacionRegistros === "ambos" || modoVisualizacionRegistros === "puntos";

  if (capaCalorRegistros) {
    if (mostrarCalor) {
      if (!mapaRegistros.hasLayer(capaCalorRegistros)) {
        capaCalorRegistros.addTo(mapaRegistros);
      }
    } else if (mapaRegistros.hasLayer(capaCalorRegistros)) {
      mapaRegistros.removeLayer(capaCalorRegistros);
    }
  }

  if (capaMarcadoresRegistros) {
    if (mostrarPuntos) {
      if (!mapaRegistros.hasLayer(capaMarcadoresRegistros)) {
        capaMarcadoresRegistros.addTo(mapaRegistros);
      }
    } else if (mapaRegistros.hasLayer(capaMarcadoresRegistros)) {
      mapaRegistros.removeLayer(capaMarcadoresRegistros);
    }
  }
}

function cambiarModoMapaRegistros(nuevoModo) {
  if (nuevoModo !== "ambos" && nuevoModo !== "calor" && nuevoModo !== "puntos") {
    return;
  }
  modoVisualizacionRegistros = nuevoModo;
  aplicarModoCapasRegistros();
}

function actualizarMarcadoresRegistros(listaReportes, vias) {
  ultimosReportesRegistros = Array.isArray(listaReportes) ? listaReportes : [];
  if (vias) ultimoViasRegistros = vias;

  if (!leafletDisponible() || !mapaRegistros || !capaMarcadoresRegistros) return;

  capaMarcadoresRegistros.clearLayers();

  var coordenadas = [];
  var puntosCalor = [];

  for (var i = 0; i < ultimosReportesRegistros.length; i++) {
    var r = ultimosReportesRegistros[i];
    if (typeof r.lat !== "number" || typeof r.lng !== "number") continue;

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
      "<strong>" + escaparTextoMapa(r.id) + "</strong> (" + escaparTextoMapa(r.origen) + ")<br>" +
      "Fecha: " + escaparTextoMapa(r.fecha_hora.replace("T", " ")) + "<br>" +
      "Cuadra: " + escaparTextoMapa(r.cuadra) + "<br>" +
      "Nivel: <strong>" + escaparTextoMapa(nivel) + " (" + escaparTextoMapa(puntaje) + " pts)</strong>"
    );

    marcador.addTo(capaMarcadoresRegistros);
    coordenadas.push([r.lat, r.lng]);
  }

  var tamMapa = mapaRegistros.getSize();
  if (heatDisponible() && tamMapa.x > 0 && tamMapa.y > 0) {
    if (!capaCalorRegistros) {
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
    } else {
      capaCalorRegistros.setLatLngs(puntosCalor);
    }
  }

  aplicarModoCapasRegistros();

  if (coordenadas.length > 0) {
    var limites = L.latLngBounds(coordenadas);
    mapaRegistros.fitBounds(limites, { padding: [26, 26], maxZoom: 17 });
  } else if (ultimoViasRegistros && ultimoViasRegistros.zona && ultimoViasRegistros.zona.centro) {
    mapaRegistros.setView(ultimoViasRegistros.zona.centro, ultimoViasRegistros.zona.zoom || 17);
  }
}

function redimensionarMapaRegistros() {
  if (leafletDisponible() && mapaRegistros) {
    setTimeout(function () {
      mapaRegistros.invalidateSize();
      if (capaCalorRegistros && mapaRegistros.hasLayer(capaCalorRegistros)) {
        mapaRegistros.removeLayer(capaCalorRegistros);
        capaCalorRegistros = null;
      }
      actualizarMarcadoresRegistros(ultimosReportesRegistros, ultimoViasRegistros);
    }, 80);
  }
}

function buscarDireccionesMapa(textoConsulta, vias) {
  var q = String(textoConsulta || "").trim();
  if (q.length < 2) {
    return Promise.resolve({ resultados: [], sinConexionExterno: false });
  }

  var qLower = q.toLowerCase();
  var resultados = [];

  if (vias && Array.isArray(vias.cuadras)) {
    for (var i = 0; i < vias.cuadras.length; i++) {
      var c = vias.cuadras[i];
      var centroide = obtenerCentroideCuadra(c);
      if (!centroide) continue;

      var textoCuadra = (String(c.nombre || "") + " " + String(c.id || "") + " " + String(c.tipo_via || "")).toLowerCase();
      if (textoCuadra.indexOf(qLower) !== -1) {
        resultados.push({
          titulo: c.nombre + " (" + c.id + ")",
          subtitulo: "Cuadra en zona · " + (c.tipo_via === "arterial" ? "Vía arterial" : "Vía secundaria"),
          lat: centroide.lat,
          lng: centroide.lng,
          origen: "local"
        });
      }
    }
  }

  if (controladorBusquedaNominatim && typeof controladorBusquedaNominatim.abort === "function") {
    controladorBusquedaNominatim.abort();
  }
  controladorBusquedaNominatim = typeof AbortController !== "undefined" ? new AbortController() : null;

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

  var opcionesFetch = {
    headers: { "Accept": "application/json" }
  };
  if (controladorBusquedaNominatim) {
    opcionesFetch.signal = controladorBusquedaNominatim.signal;
  }

  return fetch(url, opcionesFetch)
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
      return { resultados: resultados.slice(0, 7), sinConexionExterno: false };
    })
    .catch(function (err) {
      if (err && err.name === "AbortError") {
        return { resultados: null, abortado: true, sinConexionExterno: false };
      }
      return { resultados: resultados.slice(0, 7), sinConexionExterno: true };
    });
}
