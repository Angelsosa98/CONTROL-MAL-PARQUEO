/* ============================================================================
 * ARCHIVO: captura.js
 * RESPONSABILIDAD: Controlador principal de Control Vial Santa Marta. Conecta
 * index.html con los módulos: criticidad.js, almacenamiento.js, filtros.js,
 * resumen.js y mapa.js. Aquí NO se repiten funciones de esos módulos.
 * ============================================================================ */

var AppEstado = {
  vias: null,
  criterios: null,
  reportesPrecargados: [],
  reportesLocales: [],
  reportesUnificados: [],
  evidenciasFotograficas: [],
  ubicacion: null,          // { lat, lng }
  cuadraId: "",
  categoria: "",
  actor: "",
  fechaManual: false,
  inicioCaptura: null,      // para medir el tiempo de registro
  foto: null,               // objeto Image con la foto cargada
  regiones: [],             // zonas pixeladas [{ x, y, w, h }]
  trazo: null,              // zona que se está dibujando
  reportePendiente: null    // reporte que no cupo en localStorage
};

/* ---------------------------- Utilidades de DOM --------------------------- */

function porId(id) {
  return document.getElementById(id);
}

/** Muestra un texto en un elemento; si el texto está vacío, lo oculta. */
function mostrarTexto(id, texto) {
  var el = porId(id);
  if (!el) return;
  el.textContent = texto || "";
  el.hidden = !texto;
}

function alPulsar(id, accion) {
  var el = porId(id);
  if (el) el.addEventListener("click", accion);
}

function crear(etiqueta, clase, texto) {
  var el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function etiquetaCategoria(valor) {
  var nombres = {
    doble_fila: "Doble fila / vía prohibida",
    bloqueo_rampa_cebra_paradero: "Bloqueo rampa, cebra o paradero",
    invasion_anden: "Invasión de andén"
  };
  return nombres[valor] || valor || "—";
}

function etiquetaActor(valor) {
  var nombres = {
    vehiculo_particular: "Vehículo particular",
    motocicleta: "Motocicleta",
    vehiculo_carga: "Vehículo de carga",
    mobiliario_comercial: "Mobiliario comercial"
  };
  return nombres[valor] || valor || "—";
}

/** Fecha y hora LOCAL como "AAAA-MM-DDTHH:MM" (sin toISOString, que usa UTC). */
function obtenerFechaHoraLocalActual() {
  var d = new Date();
  function dos(n) { return String(n).padStart(2, "0"); }
  return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()) +
    "T" + dos(d.getHours()) + ":" + dos(d.getMinutes());
}

/** Carga un JSON; devuelve null si falla. */
function cargarJSON(ruta) {
  return fetch(ruta + "?v=" + Date.now())
    .then(function (resp) {
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      return resp.json();
    })
    .catch(function (err) {
      console.error("No se pudo cargar " + ruta + ":", err.message);
      return null;
    });
}

/* ------------------------------ Cuadras ----------------------------------- */

function listaCuadras() {
  return AppEstado.vias && Array.isArray(AppEstado.vias.cuadras) ? AppEstado.vias.cuadras : [];
}

function obtenerCuadraPorId(cuadraId) {
  return listaCuadras().find(function (c) { return c.id === cuadraId; }) || null;
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

/** Devuelve la cuadra más cercana al punto, o null si no hay cuadras. */
function encontrarCuadraMasCercana(lat, lng) {
  var mejor = null;
  var mejorDistancia = Infinity;
  listaCuadras().forEach(function (c) {
    var d = distanciaACuadraMetros(lat, lng, c);
    if (d < mejorDistancia) {
      mejorDistancia = d;
      mejor = c;
    }
  });
  var radioMaximo = Number(AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.radio_max_m) || 90;
  return mejor && mejorDistancia <= radioMaximo ? mejor : null;
}

function poblarSelectoresCuadras() {
  var selCaptura = porId("select-cuadra");
  var selFiltro = porId("filtro-cuadra");
  listaCuadras().forEach(function (c) {
    [selCaptura, selFiltro].forEach(function (sel) {
      var opcion = crear("option", "", c.nombre);
      opcion.value = c.id;
      sel.appendChild(opcion);
    });
  });
}

function asignarCuadra(cuadraId) {
  var cuadra = obtenerCuadraPorId(cuadraId);
  AppEstado.cuadraId = cuadra ? cuadra.id : "";
  porId("select-cuadra").value = AppEstado.cuadraId;
  porId("cuadra-nombre-lectura").textContent = cuadra ? cuadra.nombre : "Marca un punto en el mapa";

  var tipo = porId("cuadra-tipo-lectura");
  tipo.className = "etiqueta-via" + (cuadra ? " via-" + cuadra.tipo_via : "");
  tipo.textContent = "Tipo de vía: " +
    (cuadra ? (cuadra.tipo_via === "arterial" ? "Arterial" : "Secundaria") : "—");
  if (cuadra) mostrarTexto("error-cuadra", "");
}

/* ----------------------------- Ubicación ---------------------------------- */

function marcarInicioCaptura() {
  if (!AppEstado.inicioCaptura) AppEstado.inicioCaptura = Date.now();
}

/** Guarda el punto, mueve el marcador y asigna la cuadra más cercana. */
function fijarUbicacion(lat, lng, opciones) {
  var opts = opciones || {};
  AppEstado.ubicacion = { lat: Number(Number(lat).toFixed(6)), lng: Number(Number(lng).toFixed(6)) };
  porId("texto-coordenadas").textContent =
    "Lat: " + AppEstado.ubicacion.lat.toFixed(6) + ", Lng: " + AppEstado.ubicacion.lng.toFixed(6);
  mostrarTexto("error-ubicacion", "");
  var dentroDeZona = estaDentroDeLimitesZona(lat, lng);
  var cuadraCercana = encontrarCuadraMasCercana(lat, lng);
  mostrarTexto("aviso-fuera-zona", !dentroDeZona
    ? "Este punto está fuera del área de estudio. Desplaza el marcador hacia una de las vías incluidas."
    : (!cuadraCercana ? "El punto no está suficientemente cerca de una cuadra del estudio. Ajusta el marcador a la vía." : ""));


  actualizarMarcadorCaptura(AppEstado.ubicacion.lat, AppEstado.ubicacion.lng, function (la, ln) {
    marcarInicioCaptura();
    fijarUbicacion(la, ln);
  });

  if (!opts.conservarCuadra) {
    asignarCuadra(cuadraCercana ? cuadraCercana.id : "");
  }
}

function estaDentroDeLimitesZona(lat, lng) {
  var lim = AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.limites;
  if (!lim) return true;
  return lat >= lim.lat_min && lat <= lim.lat_max && lng >= lim.lng_min && lng <= lim.lng_max;
}

function usarGPS() {
  marcarInicioCaptura();
  if (!navigator.geolocation) {
    mostrarTexto("error-ubicacion", "Tu navegador no soporta GPS. Toca el mapa o elige una cuadra.");
    return;
  }
  mostrarTexto("estado-gps", "Obteniendo ubicación GPS...");
  navigator.geolocation.getCurrentPosition(
    function (pos) {
      var precision = Math.round(pos.coords.accuracy);
      fijarUbicacion(pos.coords.latitude, pos.coords.longitude);
      mostrarTexto("estado-gps", "Ubicación GPS detectada (±" + precision + " m).");
      mostrarTexto("aviso-precision", precision > 30
        ? "La precisión es baja. Revisa el marcador y arrástralo si hace falta."
        : "");
    },
    function (err) {
      mostrarTexto("estado-gps", "");
      mostrarTexto("error-ubicacion", err.code === 1
        ? "Permiso de ubicación denegado. Toca el mapa o selecciona la cuadra."
        : "No se pudo obtener el GPS. Toca el mapa para marcar el punto.");
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
  );
}

/** Al elegir una cuadra a mano: se respeta; si no hay punto, usa su centro. */
function seleccionarCuadraManual(cuadraId) {
  marcarInicioCaptura();
  asignarCuadra(cuadraId);
  var cuadra = obtenerCuadraPorId(cuadraId);
  if (!cuadra || !Array.isArray(cuadra.extremos) || cuadra.extremos.length === 0) return;

  if (!AppEstado.ubicacion || !estaDentroDeLimitesZona(AppEstado.ubicacion.lat, AppEstado.ubicacion.lng) ||
      distanciaACuadraMetros(AppEstado.ubicacion.lat, AppEstado.ubicacion.lng, cuadra) >
      (AppEstado.vias.zona.radio_max_m || 90)) {
    var n = cuadra.extremos.length;
    var lat = cuadra.extremos.reduce(function (s, p) { return s + p[0]; }, 0) / n;
    var lng = cuadra.extremos.reduce(function (s, p) { return s + p[1]; }, 0) / n;
    fijarUbicacion(lat, lng, { conservarCuadra: true });
  }
}

function configurarBuscador() {
  var input = porId("input-buscar-direccion");
  var lista = porId("lista-sugerencias-direccion");
  var btnLimpiar = porId("btn-limpiar-busqueda");
  var temporizador = null;

  function ocultar() {
    lista.hidden = true;
    lista.innerHTML = "";
    mostrarTexto("estado-busqueda-direccion", "");
  }

  function buscar() {
    var consulta = input.value.trim();
    if (consulta.length < 3) return ocultar();
    mostrarTexto("estado-busqueda-direccion", "Buscando...");
    buscarDireccionesMapa(consulta, AppEstado.vias).then(function (items) {
      if (input.value.trim() !== consulta) return;
      ocultar();
      if (items.length === 0) {
        mostrarTexto("estado-busqueda-direccion", "Sin coincidencias. Prueba con otra calle, carrera o lugar.");
        return;
      }
      items.forEach(function (item) {
        var li = crear("li", "item-sugerencia");
        li.setAttribute("role", "option");
        li.appendChild(crear("span", "sugerencia-titulo", item.titulo));
        li.appendChild(crear("span", "sugerencia-sub", item.subtitulo));
        li.addEventListener("click", function () {
          input.value = item.titulo;
          ocultar();
          marcarInicioCaptura();
          fijarUbicacion(item.lat, item.lng);
        });
        lista.appendChild(li);
      });
      lista.hidden = false;
    });
  }

  input.addEventListener("input", function () {
    btnLimpiar.hidden = input.value.length === 0;
    clearTimeout(temporizador);
    if (input.value.trim().length < 3) return ocultar();
    temporizador = setTimeout(buscar, 800);
  });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      clearTimeout(temporizador);
      buscar();
    } else if (e.key === "Escape") {
      ocultar();
    }
  });
  btnLimpiar.addEventListener("click", function () {
    clearTimeout(temporizador);
    input.value = "";
    btnLimpiar.hidden = true;
    ocultar();
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".buscador-direccion")) ocultar();
  });
}

/* ------------------------- Categoría y actor ------------------------------ */

function marcarOpcion(idGrupo, valor) {
  porId(idGrupo).querySelectorAll(".btn-opcion").forEach(function (boton) {
    var activo = boton.getAttribute("data-valor") === valor;
    boton.classList.toggle("activo", activo);
    boton.setAttribute("aria-pressed", activo ? "true" : "false");
  });
}

function configurarOpciones(idGrupo, propiedad, idError) {
  porId(idGrupo).querySelectorAll(".btn-opcion").forEach(function (boton) {
    boton.addEventListener("click", function () {
      marcarInicioCaptura();
      AppEstado[propiedad] = boton.getAttribute("data-valor");
      marcarOpcion(idGrupo, AppEstado[propiedad]);
      mostrarTexto(idError, "");
    });
  });
}

/* -------------------------- Foto y pixelado ------------------------------- */

/** Pixela una zona promediando el color de cada bloque (irreversible). */
function pixelarRegion(ctx, canvas, region) {
  var x0 = Math.max(0, Math.floor(region.x));
  var y0 = Math.max(0, Math.floor(region.y));
  var x1 = Math.min(canvas.width, Math.ceil(region.x + region.w));
  var y1 = Math.min(canvas.height, Math.ceil(region.y + region.h));
  var bloque = Math.max(12, Math.round(canvas.width / 45));

  for (var y = y0; y < y1; y += bloque) {
    for (var x = x0; x < x1; x += bloque) {
      var bw = Math.min(bloque, x1 - x);
      var bh = Math.min(bloque, y1 - y);
      var datos = ctx.getImageData(x, y, bw, bh).data;
      var r = 0, g = 0, b = 0, n = datos.length / 4;
      for (var i = 0; i < datos.length; i += 4) {
        r += datos[i];
        g += datos[i + 1];
        b += datos[i + 2];
      }
      ctx.fillStyle = "rgb(" + Math.round(r / n) + "," + Math.round(g / n) + "," + Math.round(b / n) + ")";
      ctx.fillRect(x, y, bw, bh);
    }
  }
}

function dibujarFoto() {
  var canvas = porId("canvas-foto");
  if (!AppEstado.foto) return;
  var ctx = canvas.getContext("2d");
  ctx.drawImage(AppEstado.foto, 0, 0, canvas.width, canvas.height);
  AppEstado.regiones.forEach(function (reg) { pixelarRegion(ctx, canvas, reg); });
  if (AppEstado.trazo) {
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 3;
    ctx.strokeRect(AppEstado.trazo.x, AppEstado.trazo.y, AppEstado.trazo.w, AppEstado.trazo.h);
  }
}

function quitarFoto() {
  AppEstado.foto = null;
  AppEstado.regiones = [];
  AppEstado.trazo = null;
  porId("input-foto-camara").value = "";
  porId("input-foto-galeria").value = "";
  porId("check-privacidad-foto").checked = false;
  porId("zona-edicion-foto").hidden = true;
  mostrarTexto("error-foto", "");
}

function cargarFoto(archivo) {
  if (!archivo) return;
  var url = URL.createObjectURL(archivo);
  var img = new Image();
  img.onload = function () {
    URL.revokeObjectURL(url);
    quitarFoto();
    AppEstado.foto = img;
    // Reducir a 800 px de ancho para ahorrar espacio en localStorage
    var escala = Math.min(1, 800 / img.width);
    var canvas = porId("canvas-foto");
    canvas.width = Math.round(img.width * escala);
    canvas.height = Math.round(img.height * escala);
    porId("zona-edicion-foto").hidden = false;
    dibujarFoto();
  };
  img.onerror = function () {
    URL.revokeObjectURL(url);
    mostrarTexto("error-foto", "No se pudo abrir esa imagen. Prueba con una foto JPG o PNG.");
  };
  img.src = url;
}

function configurarFoto() {
  var canvas = porId("canvas-foto");
  var inicio = null;

  alPulsar("btn-tomar-foto", function () { porId("input-foto-camara").click(); });
  alPulsar("btn-galeria-foto", function () { porId("input-foto-galeria").click(); });
  ["input-foto-camara", "input-foto-galeria"].forEach(function (id) {
    porId(id).addEventListener("change", function () {
      marcarInicioCaptura();
      cargarFoto(this.files && this.files[0]);
    });
  });
  alPulsar("btn-quitar-foto", quitarFoto);
  alPulsar("btn-deshacer-pixel", function () {
    AppEstado.regiones.pop();
    porId("check-privacidad-foto").checked = false;
    dibujarFoto();
  });

  function punto(e) {
    var caja = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - caja.left) * canvas.width / caja.width,
      y: (e.clientY - caja.top) * canvas.height / caja.height
    };
  }

  // Los eventos "pointer" sirven igual para dedo y para ratón
  canvas.addEventListener("pointerdown", function (e) {
    if (!AppEstado.foto) return;
    canvas.setPointerCapture(e.pointerId);
    inicio = punto(e);
  });
  canvas.addEventListener("pointermove", function (e) {
    if (!inicio) return;
    var p = punto(e);
    AppEstado.trazo = {
      x: Math.min(inicio.x, p.x), y: Math.min(inicio.y, p.y),
      w: Math.abs(p.x - inicio.x), h: Math.abs(p.y - inicio.y)
    };
    dibujarFoto();
  });
  function terminar() {
    if (AppEstado.trazo && AppEstado.trazo.w > 4 && AppEstado.trazo.h > 4) {
      AppEstado.regiones.push(AppEstado.trazo);
    }
    inicio = null;
    AppEstado.trazo = null;
    dibujarFoto();
  }
  canvas.addEventListener("pointerup", terminar);
  canvas.addEventListener("pointercancel", terminar);
}

/* --------------------------- Estado y guardado ---------------------------- */

/** Une precargados y locales (sin duplicar ids) y calcula su criticidad. */
function sincronizarReportes() {
  var porClave = new Map();
  AppEstado.reportesPrecargados.concat(AppEstado.reportesLocales).forEach(function (r) {
    if (r && r.id) porClave.set(r.id, r);
  });

  var resultado = [];
  porClave.forEach(function (reporte) {
    try {
      resultado.push(recalcularTodosLosReportes([reporte], AppEstado.criterios, AppEstado.vias)[0]);
    } catch (err) {
      // Un reporte dañado no debe tumbar la app, pero tampoco se le inventa un nivel
      console.error("Reporte " + reporte.id + " omitido:", err.message);
    }
  });
  AppEstado.reportesUnificados = resultado;
}

function limpiarFormulario() {
  AppEstado.ubicacion = null;
  AppEstado.categoria = "";
  AppEstado.actor = "";
  AppEstado.fechaManual = false;
  AppEstado.inicioCaptura = null;
  asignarCuadra("");
  marcarOpcion("grupo-categoria", "");
  marcarOpcion("grupo-actor", "");
  quitarFoto();
  porId("input-observaciones").value = "";
  porId("contador-obs").textContent = "0 / 140";
  porId("input-buscar-direccion").value = "";
  porId("btn-limpiar-busqueda").hidden = true;
  porId("detalle-fecha-hora").open = false;
  porId("texto-coordenadas").textContent = "Sin ubicación marcada";
  ["estado-gps", "aviso-precision", "aviso-fuera-zona", "error-ubicacion",
    "error-cuadra", "error-categoria", "error-actor"].forEach(function (id) { mostrarTexto(id, ""); });
  quitarMarcadorCaptura();
  actualizarReloj();
}

function quitarMarcadorCaptura() {
  if (marcadorCaptura) {
    marcadorCaptura.remove();
    marcadorCaptura = null;
  }
}

function actualizarReloj() {
  if (!AppEstado.fechaManual) porId("input-fecha-hora").value = obtenerFechaHoraLocalActual();
  porId("texto-fecha-actual").textContent = porId("input-fecha-hora").value.replace("T", " ");
}

/** Revisa los campos obligatorios y muestra el error junto a cada uno. */
function validarFormulario() {
  var errores = [
    ["error-ubicacion", !AppEstado.ubicacion, "Marca el punto en el mapa, usa el GPS o elige una cuadra."],
    ["error-ubicacion", AppEstado.ubicacion && (!estaDentroDeLimitesZona(AppEstado.ubicacion.lat, AppEstado.ubicacion.lng) ||
      !AppEstado.cuadraId || distanciaACuadraMetros(AppEstado.ubicacion.lat, AppEstado.ubicacion.lng, obtenerCuadraPorId(AppEstado.cuadraId)) >
      (Number(AppEstado.vias && AppEstado.vias.zona && AppEstado.vias.zona.radio_max_m) || 90)),
      "La ubicación debe estar dentro del área de estudio y a máximo 90 m de una cuadra configurada."],
    ["error-cuadra", !AppEstado.cuadraId, "Selecciona una cuadra."],
    ["error-categoria", !AppEstado.categoria, "Selecciona una categoría."],
    ["error-actor", !AppEstado.actor, "Selecciona el tipo de actor."],
    ["error-foto", AppEstado.foto && !porId("check-privacidad-foto").checked,
      "Pixela placas y rostros y marca la casilla de confirmación."]
  ];
  var primero = null;
  errores.forEach(function (e) {
    mostrarTexto(e[0], e[1] ? e[2] : "");
    if (e[1] && !primero) primero = porId(e[0]);
  });
  if (primero) primero.scrollIntoView({ behavior: "smooth", block: "center" });
  return !primero;
}

function guardarReporte() {
  if (!validarFormulario()) return;

  var config = cargarConfiguracion();
  if (!config.iniciales) {
    abrirAjustes("Escribe tus iniciales y vuelve a pulsar Guardar reporte.");
    return;
  }

  actualizarReloj();
  var foto = null;
  if (AppEstado.foto) {
    AppEstado.trazo = null;
    dibujarFoto();
    foto = porId("canvas-foto").toDataURL("image/jpeg", 0.75);
  }

  var reporte = {
    id: generarSiguienteId(config.iniciales, AppEstado.reportesUnificados),
    origen: config.origen,
    fecha_hora: porId("input-fecha-hora").value.slice(0, 16),
    lat: AppEstado.ubicacion.lat,
    lng: AppEstado.ubicacion.lng,
    cuadra: AppEstado.cuadraId,
    categoria: AppEstado.categoria,
    actor: AppEstado.actor,
    foto: foto,
    observaciones: porId("input-observaciones").value.trim()
  };

  var calculo;
  try {
    calculo = calcularCriticidad(reporte, AppEstado.criterios, AppEstado.vias);
  } catch (err) {
    mostrarTexto("error-ubicacion", "No se pudo calcular la criticidad: " + err.message);
    porId("error-ubicacion").scrollIntoView({ block: "center" });
    return;
  }
  reporte.criticidad = { puntaje: calculo.puntaje, nivel: calculo.nivel };

  var nuevaLista = AppEstado.reportesLocales.concat([reporte]);
  var guardado = guardarListaReportesLocales(nuevaLista);
  if (!guardado.ok) {
    AppEstado.reportePendiente = reporte;
    porId("aviso-quota").hidden = false;
    porId("aviso-quota").querySelector("strong").textContent = guardado.mensaje;
    window.scrollTo(0, 0);
    return;
  }

  var segundos = AppEstado.inicioCaptura ? Math.round((Date.now() - AppEstado.inicioCaptura) / 1000) : null;
  AppEstado.reportesLocales = nuevaLista;
  AppEstado.reportePendiente = null;
  porId("aviso-quota").hidden = true;
  refrescarTodo();
  limpiarFormulario();

  var d = calculo.desglose;
  porId("confirmacion-desglose").textContent = reporte.id + " · Categoría " + d.categoria +
    " + Vía " + d.via + " + Franja " + d.franja + " = " + calculo.puntaje + " ";
  var badge = porId("confirmacion-badge-nivel");
  badge.className = "badge-nivel nivel-" + calculo.nivel.toLowerCase();
  badge.textContent = calculo.nivel;
  porId("confirmacion-tiempo").textContent = segundos === null ? "" : "Registrado en " + segundos + " s.";
  porId("tarjeta-confirmacion").hidden = false;
  window.scrollTo(0, 0);
}

function eliminarReporte(id) {
  if (!window.confirm("¿Eliminar el reporte " + id + "?")) return;
  var filtrados = AppEstado.reportesLocales.filter(function (r) { return r.id !== id; });
  var res = guardarListaReportesLocales(filtrados);
  if (!res.ok) {
    window.alert(res.mensaje);
    return;
  }
  AppEstado.reportesLocales = filtrados;
  refrescarTodo();
}

/* --------------------------- Vista Registros ------------------------------ */

function leerFiltros() {
  return {
    cuadra: porId("filtro-cuadra").value,
    franja: porId("filtro-franja").value,
    categoria: porId("filtro-categoria").value,
    actor: porId("filtro-actor").value
  };
}

function renderizarAvance() {
  var totalEvidencias = AppEstado.evidenciasFotograficas.length;
  porId("contador-meta-30").textContent = totalEvidencias + " de 30";
  porId("desglose-franjas").textContent = "Evidencias fotográficas seleccionadas para la nueva muestra.";
  porId("desglose-cuadras").textContent = "Las ubicaciones no forman parte de esta versión de la muestra.";
  porId("uso-almacenamiento").textContent = "Reportes georreferenciados: " + AppEstado.reportesUnificados.length;
  porId("badge-total-registros").textContent = totalEvidencias;
}

function renderizarGaleriaEvidencias() {
  var contenedor = porId("galeria-evidencias");
  if (!contenedor) return;
  contenedor.innerHTML = "";
  AppEstado.evidenciasFotograficas.forEach(function (e) {
    var tarjeta = crear("article", "tarjeta-evidencia");
    var img = crear("img", "imagen-evidencia");
    img.src = "datos/" + e.foto;
    img.alt = "Evidencia fotográfica " + e.id;
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.alt = "No se pudo cargar " + e.foto;
      img.classList.add("imagen-evidencia-error");
    });
    tarjeta.appendChild(img);
    var info = crear("div", "detalle-evidencia");
    info.appendChild(crear("strong", "", e.id));
    info.appendChild(crear("span", "estado-evidencia", "Evidencia fotográfica · ubicación no registrada"));
    tarjeta.appendChild(info);
    contenedor.appendChild(tarjeta);
  });
  porId("titulo-galeria-evidencias").textContent = "Evidencias fotográficas (" + AppEstado.evidenciasFotograficas.length + ")";
}

function renderizarPorcentajes(filtrados) {
  var stats = calcularEstadisticasFiltradas(filtrados);
  porId("conteo-filtrado-texto").textContent =
    "Mostrando " + stats.total + " de " + AppEstado.reportesUnificados.length + " reportes";
  var caja = porId("desglose-porcentajes-categoria");
  caja.innerHTML = "";
  stats.categorias.forEach(function (cat) {
    var item = crear("div", "item-porcentaje");
    var fila = crear("div", "fila-texto-porcentaje");
    fila.appendChild(crear("span", "", cat.etiqueta));
    fila.appendChild(crear("strong", "", cat.conteo + " (" + cat.porcentaje + " %)"));
    var fondo = crear("div", "barra-progreso-fondo");
    var relleno = crear("div", "barra-progreso-relleno");
    relleno.style.width = cat.porcentaje + "%";
    fondo.appendChild(relleno);
    item.appendChild(fila);
    item.appendChild(fondo);
    caja.appendChild(item);
  });
}

function renderizarTop5(filtrados) {
  var caja = porId("lista-top-5-cuadras");
  var top = generarResumenOperativo(filtrados, AppEstado.vias, AppEstado.criterios); // devuelve un arreglo
  caja.innerHTML = "";
  if (top.length === 0) {
    caja.appendChild(crear("p", "texto-suave", "No hay reportes para calcular el ranking."));
    return;
  }
  top.forEach(function (item, i) {
    var clase = item.conteoNivel.Alto > 0 ? " top5-critico" : (item.conteoNivel.Medio > 0 ? " top5-medio" : "");
    var tarjeta = crear("article", "tarjeta-top5" + clase);
    var cabecera = crear("div", "top5-cabecera");
    var titulo = crear("div");
    titulo.appendChild(crear("span", "top5-puesto", "#" + (i + 1)));
    titulo.appendChild(crear("strong", "", item.nombreCuadra));
    cabecera.appendChild(titulo);
    cabecera.appendChild(crear("span", "top5-puntaje", item.puntajeAcumulado + " pts"));
    tarjeta.appendChild(cabecera);
    tarjeta.appendChild(crear("div", "top5-metricas", item.totalReportes + " reportes · Alto: " +
      item.conteoNivel.Alto + " · Medio: " + item.conteoNivel.Medio + " · Bajo: " + item.conteoNivel.Bajo));
    var rec = crear("div", "caja-recomendacion-top5");
    rec.appendChild(crear("div", "titulo-recomendacion", item.recomendacion));
    rec.appendChild(crear("div", "texto-regla-aplicada", item.reglaAplicada));
    tarjeta.appendChild(rec);
    caja.appendChild(tarjeta);
  });
}

/** Ruta segura de la foto: capturada (data:) o archivo dentro de datos/fotos/. */
function rutaFoto(foto) {
  if (typeof foto !== "string") return null;
  if (foto.indexOf("data:image/") === 0) return foto;
  return /^fotos\/[\w-]+\.(jpe?g|png|webp)$/i.test(foto) ? "datos/" + foto : null;
}

function abrirFoto(src, detalle) {
  porId("img-modal-foto").src = src;
  porId("detalle-modal-foto").textContent = detalle;
  porId("modal-foto").hidden = false;
}

function crearBloqueFoto(r) {
  var src = rutaFoto(r.foto);
  if (!src) return crear("div", "miniatura-vacia", "Sin foto");

  var caja = crear("div", "contenedor-foto-registro");
  var img = crear("img", "miniatura-registro");
  img.alt = "Evidencia " + r.id;
  img.loading = "lazy";
  img.onerror = function () { caja.replaceWith(crear("div", "miniatura-vacia", "Foto no hallada")); };
  img.src = src;
  caja.appendChild(img);
  caja.appendChild(crear("span", "pie-ampliar-foto", "Ampliar"));
  caja.addEventListener("click", function () {
    abrirFoto(src, r.id + " · " + r.fecha_hora.replace("T", " "));
  });
  return caja;
}

function renderizarLista(filtrados) {
  var contenedor = porId("lista-registros");
  contenedor.innerHTML = "";
  if (filtrados.length === 0) {
    contenedor.appendChild(crear("p", "texto-suave", "No hay reportes que coincidan con los filtros."));
    return;
  }
  var locales = new Set(AppEstado.reportesLocales.map(function (r) { return r.id; }));

  filtrados.slice().sort(function (a, b) {
    return String(b.fecha_hora).localeCompare(String(a.fecha_hora));
  }).forEach(function (r) {
    var cuadra = obtenerCuadraPorId(r.cuadra);
    var tarjeta = crear("article", "tarjeta-registro");

    var cabecera = crear("div", "registro-cabecera");
    cabecera.appendChild(crear("strong", "", r.id));
    cabecera.appendChild(crear("span", "badge-nivel nivel-" + r.criticidad.nivel.toLowerCase(),
      r.criticidad.nivel + " (" + r.criticidad.puntaje + ")"));
    tarjeta.appendChild(cabecera);

    var cuerpo = crear("div", "registro-cuerpo");
    cuerpo.appendChild(crearBloqueFoto(r));
    var det = crear("div", "registro-detalles");
    var fecha = crear("div", "linea-detalle-reg", r.fecha_hora.replace("T", " "));
    fecha.appendChild(crear("span", "chip-franja", r._franja === "pico" ? "Hora pico" : "Hora valle"));
    det.appendChild(fecha);
    det.appendChild(crear("div", "linea-detalle-reg", cuadra ? cuadra.nombre : r.cuadra));
    det.appendChild(crear("div", "linea-detalle-reg", etiquetaCategoria(r.categoria)));
    det.appendChild(crear("div", "linea-detalle-reg", etiquetaActor(r.actor)));
    if (r.observaciones) det.appendChild(crear("div", "obs-texto", r.observaciones));
    cuerpo.appendChild(det);
    tarjeta.appendChild(cuerpo);

    var pie = crear("div", "registro-pie");
    pie.appendChild(crear("span", "etiqueta-precargado", locales.has(r.id) ? "Guardado en este equipo" : "Precargado"));
    if (locales.has(r.id)) {
      var borrar = crear("button", "btn-eliminar-registro", "Eliminar");
      borrar.type = "button";
      borrar.addEventListener("click", function () { eliminarReporte(r.id); });
      pie.appendChild(borrar);
    }
    tarjeta.appendChild(pie);
    contenedor.appendChild(tarjeta);
  });
}

function aplicarFiltros() {
  var filtrados = filtrarReportes(AppEstado.reportesUnificados, leerFiltros(), AppEstado.criterios);
  renderizarPorcentajes(filtrados);
  actualizarMarcadoresRegistros(filtrados, AppEstado.vias);
  renderizarTop5(filtrados);
  renderizarLista(filtrados);
}

function refrescarTodo() {
  sincronizarReportes();
  actualizarPuntosEnMapaCaptura(AppEstado.reportesUnificados, AppEstado.vias);
  renderizarAvance();
  aplicarFiltros();
}

/* ------------------------- Exportar e importar ---------------------------- */

function mostrarResultadoTransferencia(texto) {
  mostrarTexto("resultado-importacion", texto);
}

function exportarJSON(incluirFotos) {
  if (AppEstado.reportesLocales.length === 0) {
    mostrarResultadoTransferencia("Todavía no hay reportes guardados en este equipo para exportar.");
    return;
  }
  var nombre = exportarReportesJSON(AppEstado.reportesLocales, cargarConfiguracion().iniciales, incluirFotos);
  mostrarResultadoTransferencia("Archivo exportado: " + nombre);
}

function exportarZIP() {
  if (AppEstado.reportesLocales.length === 0) {
    mostrarResultadoTransferencia("Todavía no hay reportes guardados en este equipo para exportar.");
    return;
  }
  exportarPaqueteZIP(AppEstado.reportesLocales, cargarConfiguracion().iniciales)
    .then(function (nombre) { mostrarResultadoTransferencia("Paquete exportado: " + nombre); })
    .catch(function (err) { mostrarResultadoTransferencia(err.message); });
}

function importarArchivo(archivo) {
  archivo.text().then(function (texto) {
    var res = importarReportesDesdeTexto(texto, AppEstado.reportesPrecargados, AppEstado.criterios, AppEstado.vias);
    if (!res.ok) {
      mostrarResultadoTransferencia(res.mensaje);
      return;
    }
    AppEstado.reportesLocales = cargarReportesLocales();
    refrescarTodo();
    var detalles = res.detallesInvalidos.concat(res.detallesConflictos)
      .slice(0, 5)
      .map(function (d) { return d.id + ": " + d.motivo; });
    mostrarResultadoTransferencia("Nuevos: " + res.nuevos + " · Repetidos: " + res.repetidos +
      " · Inválidos: " + res.invalidos + " · Conflictos: " + res.conflictos +
      (detalles.length ? " — " + detalles.join(" | ") : ""));
  }).catch(function (err) {
    mostrarResultadoTransferencia("No se pudo importar: " + err.message);
  });
}

/* ------------------------ Ajustes y navegación ---------------------------- */

function actualizarIndicadorIniciales() {
  porId("indicador-iniciales").textContent = cargarConfiguracion().iniciales || "Configurar";
}

function abrirAjustes(mensaje) {
  var config = cargarConfiguracion();
  porId("input-iniciales").value = config.iniciales;
  porId("select-origen").value = config.origen;
  mostrarTexto("error-ajustes", mensaje || "");
  porId("modal-ajustes").hidden = false;
  porId("input-iniciales").focus();
}

function guardarAjustes() {
  var res = guardarConfiguracion({
    iniciales: porId("input-iniciales").value,
    origen: porId("select-origen").value
  });
  if (!res.ok) {
    mostrarTexto("error-ajustes", res.mensaje);
    return;
  }
  porId("modal-ajustes").hidden = true;
  actualizarIndicadorIniciales();
}

function cambiarVista(vista) {
  var enCaptura = vista === "captura";
  porId("vista-captura").hidden = !enCaptura;
  porId("vista-registros").hidden = enCaptura;
  porId("tab-captura").classList.toggle("activo", enCaptura);
  porId("tab-registros").classList.toggle("activo", !enCaptura);
  window.scrollTo(0, 0);
  if (enCaptura) redimensionarMapaCaptura();
  else redimensionarMapaRegistros();
}

function configurarEventos() {
  alPulsar("tab-captura", function () { cambiarVista("captura"); });
  alPulsar("tab-registros", function () { cambiarVista("registros"); });

  alPulsar("btn-abrir-ajustes", function () { abrirAjustes(); });
  alPulsar("btn-cerrar-ajustes", function () { porId("modal-ajustes").hidden = true; });
  alPulsar("btn-guardar-ajustes", guardarAjustes);
  alPulsar("btn-cerrar-modal-foto", function () { porId("modal-foto").hidden = true; });

  alPulsar("btn-usar-gps", usarGPS);
  porId("select-cuadra").addEventListener("change", function () { seleccionarCuadraManual(this.value); });
  configurarBuscador();
  configurarOpciones("grupo-categoria", "categoria", "error-categoria");
  configurarOpciones("grupo-actor", "actor", "error-actor");
  configurarFoto();

  porId("input-observaciones").addEventListener("input", function () {
    porId("contador-obs").textContent = this.value.length + " / 140";
  });
  porId("input-fecha-hora").addEventListener("change", function () {
    AppEstado.fechaManual = Boolean(this.value);
    actualizarReloj();
  });
  setInterval(actualizarReloj, 20000);

  alPulsar("btn-guardar", guardarReporte);
  alPulsar("btn-registrar-otro", function () { porId("tarjeta-confirmacion").hidden = true; });

  ["filtro-cuadra", "filtro-franja", "filtro-categoria", "filtro-actor"].forEach(function (id) {
    porId(id).addEventListener("change", aplicarFiltros);
  });
  alPulsar("btn-limpiar-filtros", function () {
    ["filtro-cuadra", "filtro-franja", "filtro-categoria", "filtro-actor"].forEach(function (id) {
      porId(id).value = "todas";
    });
    aplicarFiltros();
  });

  document.querySelectorAll(".btn-capa-mapa").forEach(function (boton) {
    boton.addEventListener("click", function () {
      var modo = boton.getAttribute("data-modo");
      cambiarModoMapaRegistros(modo);
      document.querySelectorAll(".btn-capa-mapa").forEach(function (b) {
        b.classList.toggle("activo", b === boton);
        b.setAttribute("aria-pressed", b === boton ? "true" : "false");
      });
    });
  });

  alPulsar("btn-imprimir-resumen", function () { window.print(); });
  alPulsar("btn-exportar-con-fotos", function () { exportarJSON(true); });
  alPulsar("btn-exportar-sin-fotos", function () { exportarJSON(false); });
  alPulsar("btn-exportar-zip", exportarZIP);
  alPulsar("btn-importar-json", function () { porId("input-importar-json").click(); });
  porId("input-importar-json").addEventListener("change", function () {
    if (this.files && this.files[0]) importarArchivo(this.files[0]);
    this.value = "";
  });
  alPulsar("btn-exportar-emergencia", function () {
    var lista = AppEstado.reportesLocales.concat(AppEstado.reportePendiente ? [AppEstado.reportePendiente] : []);
    exportarReportesJSON(lista, cargarConfiguracion().iniciales, true);
  });
}

function inicializarApp() {
  AppEstado.reportesLocales = cargarReportesLocales().filter(function (r) {
    return !/^MP-ASO-\\d{3}$/.test(String(r && r.id || ""));
  });
  guardarListaReportesLocales(AppEstado.reportesLocales);
  porId("btn-guardar").disabled = true; // hasta que carguen los datos

  Promise.all([
    cargarJSON("datos/vias.json"),
    cargarJSON("datos/criterios.json"),
    cargarJSON("datos/reportes.json"),
    cargarJSON("datos/evidencias_nuevas.json")
  ]).then(function (datos) {
    var vias = datos[0];
    var criterios = datos[1];
    if (!vias || !Array.isArray(vias.cuadras) || !criterios) {
      porId("aviso-fetch").hidden = false;
      porId("nombre-zona-header").textContent = "No se pudo cargar la zona de estudio";
      return;
    }
    if (!Array.isArray(datos[2])) porId("aviso-fetch").hidden = false;

    AppEstado.vias = vias;
    AppEstado.criterios = criterios;
    AppEstado.reportesPrecargados = Array.isArray(datos[2]) ? datos[2] : [];
    AppEstado.evidenciasFotograficas = Array.isArray(datos[3]) ? datos[3] : [];
    porId("nombre-zona-header").textContent = vias.zona.nombre;
    poblarSelectoresCuadras();

    var hayMapa = iniciarMapaCaptura("mapa-captura", vias, function (lat, lng) {
      marcarInicioCaptura();
      fijarUbicacion(lat, lng);
    });
    iniciarMapaRegistros("mapa-registros", vias);
    porId("aviso-sin-mapa").hidden = Boolean(hayMapa);

    configurarEventos();
    actualizarIndicadorIniciales();
    actualizarReloj();
    refrescarTodo();
    renderizarGaleriaEvidencias();
    porId("btn-guardar").disabled = false;
  });
}

document.addEventListener("DOMContentLoaded", inicializarApp);
