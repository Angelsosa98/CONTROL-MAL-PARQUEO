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
var marcadoresEvidenciasMapa = [];
var promesaGeometriasVialesOSM = null;
var modoVisualizacionRegistros = "puntos"; // "ambos" | "calor" | "puntos"
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

  // Servicio transparente de referencia: dibuja carreteras y rótulos sobre la imagen.
  var callesSobreSatelite = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
    {
      maxZoom: 19,
      zIndex: 2,
      opacity: 0.92,
      attribution: "Roads & labels: Sources Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
    }
  );

  var sateliteConCalles = L.layerGroup([mapaSatelital, callesSobreSatelite]);

  // La vista de trabajo abre en satélite con calles. El usuario puede cambiarla.
  sateliteConCalles.addTo(mapa);
  return {
    "Satélite + calles": sateliteConCalles,
    "Satélite (sin rótulos)": mapaSatelital,
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

  var mapasBaseRegistros = crearCapasBaseMapa(mapaRegistros);

  capaMarcadoresRegistros = L.layerGroup().addTo(mapaRegistros);
  capaPuntosEvidencias = L.layerGroup().addTo(mapaRegistros);
  dibujarRecorridoCampo(vias);
  agregarControlCapasMapa(mapaRegistros, mapasBaseRegistros, {});
  configurarControlRecorridoCampo();

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
function obtenerRecorridoAjustadoAViasOSRM(coordenadas) {
  if (typeof fetch !== "function" || !Array.isArray(coordenadas) || coordenadas.length < 2) {
    return Promise.reject(new Error("No hay puntos suficientes para ajustar el recorrido."));
  }

  var lista = coordenadas.map(function (p) {
    return Number(p[1]) + "," + Number(p[0]);
  }).join(";");
  var radios = coordenadas.map(function () { return "35"; }).join(";");
  var url = "https://router.project-osrm.org/route/v1/driving/" + lista +
    "?overview=full&geometries=geojson&steps=false&continue_straight=true&radiuses=" + radios;

  return fetch(url, { method: "GET", mode: "cors" }).then(function (respuesta) {
    if (!respuesta.ok) throw new Error("El servicio de geometría vial no respondió.");
    return respuesta.json();
  }).then(function (datos) {
    if (!datos || datos.code !== "Ok" || !datos.routes || !datos.routes.length ||
        !datos.routes[0].geometry || !Array.isArray(datos.routes[0].geometry.coordinates)) {
      throw new Error("No se obtuvo una geometría vial válida.");
    }
    var puntos = datos.routes[0].geometry.coordinates.map(function (p) {
      return [Number(p[1]), Number(p[0])];
    }).filter(function (p) {
      return Number.isFinite(p[0]) && Number.isFinite(p[1]);
    });
    if (puntos.length < coordenadas.length) {
      throw new Error("La geometría vial devuelta no tiene suficiente detalle.");
    }
    return puntos;
  });
}

function dibujarRecorridoCampo(vias) {
  if (!leafletDisponible() || !mapaRegistros) return;
  if (capaRecorridoCampo) mapaRegistros.removeLayer(capaRecorridoCampo);

  capaRecorridoCampo = L.layerGroup();
  var recorrido = vias && vias.recorrido_campo;
  if (!recorrido) return;

  var hitos = Array.isArray(recorrido.hitos) ? recorrido.hitos : [];
  var puntos = Array.isArray(recorrido.trazado) && recorrido.trazado.length >= 2
    ? recorrido.trazado
    : hitos.map(function (h) { return h.coordenadas; });

  var tramos = [];
  if (puntos.length >= 2) {
    tramos.push({ nombre: "Recorrido exterior de campo", coordenadas: puntos });
  }

  var interiores = Array.isArray(recorrido.tramos_internos) ? recorrido.tramos_internos : [];
  interiores.forEach(function (tramo) {
    if (tramo && Array.isArray(tramo.coordenadas) && tramo.coordenadas.length >= 2) {
      tramos.push(tramo);
    }
  });

  tramos.forEach(function (tramo) {
    var coordenadas = tramo.coordenadas.filter(function (p) {
      return Array.isArray(p) && p.length >= 2 &&
        Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]));
    });
    if (coordenadas.length < 2) return;

    // La línea manual se pinta inmediatamente para que nunca desaparezca.
    var linea = L.polyline(coordenadas, {
      color: "#16a34a",
      weight: 3.2,
      opacity: 0.88,
      lineCap: "round",
      lineJoin: "round",
      smoothFactor: 0.35
    }).bindPopup(
      "<strong>" + (tramo.nombre || "Recorrido de campo") + "</strong><br>" +
      "Geometría ajustada a las calles siguiendo los puntos de control del recorrido."
    ).addTo(capaRecorridoCampo);

    // Cada tramo se ajusta por separado: no se conectan ramales independientes.
    obtenerRecorridoAjustadoAViasOSRM(coordenadas).then(function (ajustado) {
      linea.setLatLngs(ajustado);
    }).catch(function (error) {
      if (typeof console !== "undefined" && console.info) {
        console.info("Se conserva el trazado manual del recorrido:", error.message);
      }
    });
  });

  if (tramos.length) capaRecorridoCampo.addTo(mapaRegistros);
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
/**
 * Obtiene geometrías de calles del sector desde Overpass/OpenStreetMap.
 * Se consultan vías, no rutas calculadas; los marcadores se proyectan al eje vial.
 */
function obtenerGeometriasVialesOSM(vias) {
  if (promesaGeometriasVialesOSM) return promesaGeometriasVialesOSM;
  var limites = vias && vias.zona && vias.zona.limites;
  if (!limites) return Promise.reject(new Error("No hay límites geográficos para consultar calles."));
  var sur = Number(limites.lat_min) - 0.00015;
  var norte = Number(limites.lat_max) + 0.00015;
  var oeste = Number(limites.lng_min) - 0.00015;
  var este = Number(limites.lng_max) + 0.00015;
  var consulta = '[out:json][timeout:25];way["highway"~"^(primary|secondary|tertiary|unclassified|residential|living_street|service|road|pedestrian)$"](' +
    sur + "," + oeste + "," + norte + "," + este + ');out geom;';
  var url = "https://overpass-api.de/api/interpreter?data=" + encodeURIComponent(consulta);
  promesaGeometriasVialesOSM = fetch(url, { method: "GET", mode: "cors" })
    .then(function (respuesta) {
      if (!respuesta.ok) throw new Error("OpenStreetMap no respondió para la geometría vial.");
      return respuesta.json();
    })
    .then(function (datos) {
      var calles = (datos.elements || []).filter(function (elemento) {
        return elemento.type === "way" && Array.isArray(elemento.geometry) && elemento.geometry.length >= 2;
      });
      if (!calles.length) throw new Error("No se encontraron calles mapeadas en el sector.");
      return calles;
    })
    .catch(function (error) {
      promesaGeometriasVialesOSM = null;
      throw error;
    });
  return promesaGeometriasVialesOSM;
}

/** Proyecta una coordenada al segmento vial más cercano y calcula distancia métrica. */
function puntoMasCercanoSegmentoVial(punto, a, b) {
  var lat0 = Number(punto[0]);
  var escalaX = 111320 * Math.cos(lat0 * Math.PI / 180);
  var escalaY = 110540;
  var ax = (Number(a.lon) - Number(punto[1])) * escalaX;
  var ay = (Number(a.lat) - lat0) * escalaY;
  var bx = (Number(b.lon) - Number(punto[1])) * escalaX;
  var by = (Number(b.lat) - lat0) * escalaY;
  var dx = bx - ax, dy = by - ay;
  var den = dx * dx + dy * dy;
  var t = den ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / den)) : 0;
  var x = ax + t * dx, y = ay + t * dy;
  return {
    lat: lat0 + y / escalaY,
    lng: Number(punto[1]) + x / escalaX,
    distancia: Math.sqrt(x * x + y * y)
  };
}

/**
 * Mueve cada marcador al eje de la vía OSM más cercana si está a 35 m o menos.
 * Si Overpass falla o no hay una vía próxima, deja el punto sectorial sin alterar.
 */
function ajustarMarcadoresEvidenciasAViasOSM(registros, puntosCalor, vias) {
  if (!registros || !registros.length) return;
  obtenerGeometriasVialesOSM(vias).then(function (calles) {
    registros.forEach(function (registro, indice) {
      var u = registro.evidencia && registro.evidencia.ubicacion_aproximada;
      if (!u) return;
      var mejor = null;
      calles.forEach(function (calle) {
        var geometria = calle.geometry || [];
        for (var i = 0; i < geometria.length - 1; i++) {
          var candidato = puntoMasCercanoSegmentoVial(
            [Number(u.lat), Number(u.lng)], geometria[i], geometria[i + 1]
          );
          if (!mejor || candidato.distancia < mejor.distancia) mejor = candidato;
        }
      });
      if (mejor && mejor.distancia <= 35) {
        registro.marcador.setLatLng([mejor.lat, mejor.lng]);
        if (puntosCalor[indice]) puntosCalor[indice] = [mejor.lat, mejor.lng, 1];
      }
    });
    if (capaCalorEvidencias && typeof capaCalorEvidencias.setLatLngs === "function") {
      capaCalorEvidencias.setLatLngs(puntosCalor);
    }
  }).catch(function (error) {
    if (typeof console !== "undefined" && console.info) {
      console.info("Se conservan ubicaciones sectoriales aproximadas:", error.message);
    }
  });
}

function actualizarMarcadoresEvidencias(evidencias, vias) {
  ultimasEvidenciasMapa = Array.isArray(evidencias) ? evidencias : [];
  if (!leafletDisponible() || !mapaRegistros || !capaPuntosEvidencias) return;

  capaPuntosEvidencias.clearLayers();
  if (capaCalorEvidencias && mapaRegistros.hasLayer(capaCalorEvidencias)) {
    mapaRegistros.removeLayer(capaCalorEvidencias);
  }
  capaCalorEvidencias = null;

  var puntosCalor = [];
  marcadoresEvidenciasMapa = [];
  ultimasEvidenciasMapa.forEach(function (e) {
    var u = e && e.ubicacion_aproximada;
    if (!u || !Number.isFinite(Number(u.lat)) || !Number.isFinite(Number(u.lng))) return;
    var lat = Number(u.lat), lng = Number(u.lng);
    var lim = vias && vias.zona && vias.zona.limites;
    if (lim && (lat < lim.lat_min || lat > lim.lat_max || lng < lim.lng_min || lng > lim.lng_max)) return;
    puntosCalor.push([lat, lng, 1]);

    var marcador = L.circleMarker([lat, lng], {
      radius: 5,
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
    marcadoresEvidenciasMapa.push({ marcador: marcador, evidencia: e });
  });

  // No crear Leaflet.heat mientras la pestaña Registros está oculta.
  // En ese estado Leaflet informa 0x0 y heat.js puede llamar getImageData
  // sobre un canvas de ancho/alto cero, interrumpiendo el arranque completo.
  var tamMapa = mapaRegistros.getSize();
  if (heatDisponible() && puntosCalor.length > 0 && tamMapa.x > 0 && tamMapa.y > 0) {
    capaCalorEvidencias = L.heatLayer(puntosCalor, {
      radius: 22,
      blur: 14,
      maxZoom: 19,
      max: 1,
      minOpacity: 0.32,
      gradient: { 0.25: "#a78bfa", 0.55: "#f59e0b", 0.85: "#ef4444", 1: "#991b1b" }
    });
  }
  aplicarModoCapasRegistros();
  ajustarMarcadoresEvidenciasAViasOSM(marcadoresEvidenciasMapa, puntosCalor, vias);
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
