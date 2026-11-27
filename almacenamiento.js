/* ============================================================================
 * ARCHIVO: almacenamiento.js
 * DEPENDENCIAS: criticidad.js (calcularCriticidad, horaAMinutos)
 * RESPONSABILIDAD: Gestión segura de localStorage ("mp_reportes" y "mp_config"),
 * manejo de QuotaExceededError, generación de IDs consecutivos, exportación
 * (JSON con/sin fotos y ZIP opcional) e importación con validación estricta y
 * control de duplicados/conflictos.
 * ============================================================================ */

var CLAVE_REPORTES = "mp_reportes";
var CLAVE_CONFIG = "mp_config";

var CATEGORIAS_PERMITIDAS = [
  "doble_fila",
  "bloqueo_rampa_cebra_paradero",
  "invasion_anden"
];

var ACTORES_PERMITIDOS = [
  "vehiculo_particular",
  "motocicleta",
  "vehiculo_carga",
  "mobiliario_comercial"
];

function formatearFechaArchivoLocal(fecha) {
  var d = fecha || new Date();
  var anio = String(d.getFullYear());
  var mes = String(d.getMonth() + 1).padStart(2, "0");
  var dia = String(d.getDate()).padStart(2, "0");
  var hora = String(d.getHours()).padStart(2, "0");
  var min = String(d.getMinutes()).padStart(2, "0");
  return anio + mes + dia + "-" + hora + min;
}

function cargarConfiguracion() {
  var defecto = { iniciales: "", origen: "campo" };
  try {
    var crudo = localStorage.getItem(CLAVE_CONFIG);
    if (!crudo) return defecto;
    var parsed = JSON.parse(crudo);
    return {
      iniciales: typeof parsed.iniciales === "string" ? parsed.iniciales.toUpperCase() : "",
      origen: parsed.origen === "ciudadano" ? "ciudadano" : "campo"
    };
  } catch (err) {
    console.error("Error leyendo mp_config:", err);
    return defecto;
  }
}

function guardarConfiguracion(config) {
  var ini = (config.iniciales || "").trim().toUpperCase().replace(/[^A-ZÑ]/g, "");
  if (ini.length < 2 || ini.length > 3) {
    return { ok: false, mensaje: "Las iniciales deben tener entre 2 y 3 letras." };
  }
  var origenValido = config.origen === "ciudadano" ? "ciudadano" : "campo";
  var objetoGuardar = { iniciales: ini, origen: origenValido };

  try {
    localStorage.setItem(CLAVE_CONFIG, JSON.stringify(objetoGuardar));
    return { ok: true, config: objetoGuardar };
  } catch (err) {
    return { ok: false, mensaje: "No se pudo guardar la configuración: " + err.message };
  }
}

function cargarReportesLocales() {
  try {
    var crudo = localStorage.getItem(CLAVE_REPORTES);
    if (!crudo) return [];
    var lista = JSON.parse(crudo);
    return Array.isArray(lista) ? lista : [];
  } catch (err) {
    console.error("Error leyendo mp_reportes:", err);
    return [];
  }
}

function guardarListaReportesLocales(listaReportes) {
  try {
    localStorage.setItem(CLAVE_REPORTES, JSON.stringify(listaReportes));
    return { ok: true };
  } catch (err) {
    var esCuotaLlena =
      err &&
      (err.name === "QuotaExceededError" ||
        err.code === 22 ||
        err.code === 1014 ||
        String(err.message).toLowerCase().indexOf("quota") !== -1);

    if (esCuotaLlena) {
      return {
        ok: false,
        errorQuota: true,
        mensaje: "Almacenamiento lleno: exporta y borra registros locales."
      };
    }
    return {
      ok: false,
      errorQuota: false,
      mensaje: "Error al guardar en el navegador: " + err.message
    };
  }
}

function agregarReporteLocal(nuevoReporte) {
  var actuales = cargarReportesLocales();
  var nuevaLista = actuales.concat([nuevoReporte]);
  var res = guardarListaReportesLocales(nuevaLista);
  if (!res.ok) {
    res.reportePendiente = nuevoReporte;
  }
  return res;
}

function eliminarReporteLocal(idReporte) {
  var actuales = cargarReportesLocales();
  var filtrados = [];
  for (var i = 0; i < actuales.length; i++) {
    if (actuales[i].id !== idReporte) {
      filtrados.push(actuales[i]);
    }
  }
  return guardarListaReportesLocales(filtrados);
}

function limpiarReportesLocales() {
  try {
    localStorage.removeItem(CLAVE_REPORTES);
    return { ok: true };
  } catch (err) {
    return { ok: false, mensaje: err.message };
  }
}

function calcularUsoAlmacenamiento() {
  try {
    var totalCaracteres = 0;
    for (var i = 0; i < localStorage.length; i++) {
      var clave = localStorage.key(i);
      var valor = localStorage.getItem(clave) || "";
      totalCaracteres += clave.length + valor.length;
    }
    var bytes = totalCaracteres * 2;
    var megas = bytes / (1024 * 1024);
    var textoMegas = megas.toFixed(2).replace(".", ",") + " de 5 MB";
    return { megasUsados: megas, texto: textoMegas };
  } catch (e) {
    return { megasUsados: 0, texto: "0,00 de 5 MB" };
  }
}

function generarSiguienteId(iniciales, todosLosReportes) {
  var ini = (iniciales || "XX").toUpperCase();
  var prefijo = "MP-" + ini + "-";
  var mayorConsecutivo = 0;

  for (var i = 0; i < todosLosReportes.length; i++) {
    var idActual = String(todosLosReportes[i].id || "").toUpperCase();
    if (idActual.indexOf(prefijo) === 0) {
      var sufijo = idActual.substring(prefijo.length);
      var numero = parseInt(sufijo, 10);
      if (!isNaN(numero) && numero > mayorConsecutivo) {
        mayorConsecutivo = numero;
      }
    }
  }

  var siguiente = mayorConsecutivo + 1;
  return prefijo + String(siguiente).padStart(3, "0");
}

function descargarBlob(blob, nombreArchivo) {
  var url = URL.createObjectURL(blob);
  var enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function exportarReportesJSON(reportesLocales, iniciales, incluirFotos) {
  var ini = (iniciales || "equipo").toLowerCase();
  var sello = formatearFechaArchivoLocal(new Date());
  var sufijoModo = incluirFotos ? "" : "-sin-fotos";
  var nombreArchivo = "reportes-" + ini + "-" + sello + sufijoModo + ".json";

  var salida = [];
  for (var i = 0; i < reportesLocales.length; i++) {
    var r = reportesLocales[i];
    salida.push({
      id: r.id,
      origen: r.origen,
      fecha_hora: r.fecha_hora,
      lat: r.lat,
      lng: r.lng,
      cuadra: r.cuadra,
      categoria: r.categoria,
      actor: r.actor,
      foto: incluirFotos ? (r.foto || null) : null,
      observaciones: r.observaciones || "",
      criticidad: r.criticidad
    });
  }

  var jsonTexto = JSON.stringify(salida, null, 2);
  var blob = new Blob([jsonTexto], { type: "application/json;charset=utf-8" });
  descargarBlob(blob, nombreArchivo);
  return nombreArchivo;
}

function exportarPaqueteZIP(reportesLocales, iniciales) {
  if (typeof JSZip === "undefined") {
    return Promise.reject(new Error("La librería JSZip no está disponible (requiere conexión a internet)."));
  }

  var zip = new JSZip();
  var carpetaFotos = zip.folder("fotos");
  var jsonLimpio = [];

  for (var i = 0; i < reportesLocales.length; i++) {
    var r = reportesLocales[i];
    var rutaFoto = null;

    if (typeof r.foto === "string" && r.foto.indexOf("data:image/") === 0) {
      var nombreImg = String(r.id).toLowerCase() + ".jpg";
      rutaFoto = "fotos/" + nombreImg;
      var base64Datos = r.foto.split(",")[1];
      carpetaFotos.file(nombreImg, base64Datos, { base64: true });
    } else if (typeof r.foto === "string" && r.foto.length > 0) {
      rutaFoto = r.foto;
    }

    jsonLimpio.push({
      id: r.id,
      origen: r.origen,
      fecha_hora: r.fecha_hora,
      lat: r.lat,
      lng: r.lng,
      cuadra: r.cuadra,
      categoria: r.categoria,
      actor: r.actor,
      foto: rutaFoto,
      observaciones: r.observaciones || "",
      criticidad: r.criticidad
    });
  }

  zip.file("reportes.json", JSON.stringify(jsonLimpio, null, 2));

  var ini = (iniciales || "equipo").toLowerCase();
  var sello = formatearFechaArchivoLocal(new Date());
  var nombreZip = "paquete-datos-" + ini + "-" + sello + ".zip";

  return zip.generateAsync({ type: "blob" }).then(function (contenidoBlob) {
    descargarBlob(contenidoBlob, nombreZip);
    return nombreZip;
  });
}

function validarReporteImportado(item, criterios, vias) {
  if (!item || typeof item !== "object") {
    return { valido: false, motivo: "El elemento no es un objeto JSON válido." };
  }
  if (!item.id || typeof item.id !== "string" || item.id.trim().length === 0 || item.id.length > 32) {
    return { valido: false, motivo: "Campo 'id' ausente o inválido (máx. 32 caracteres)." };
  }
  if (item.origen !== "campo" && item.origen !== "ciudadano") {
    return { valido: false, motivo: "Origen inválido ('" + item.origen + "')." };
  }
  if (typeof item.fecha_hora !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(item.fecha_hora)) {
    return { valido: false, motivo: "Fecha/hora inválida ('" + item.fecha_hora + "')." };
  }

  var partesFH = item.fecha_hora.split("T");
  var partesFecha = partesFH[0].split("-");
  var anio = parseInt(partesFecha[0], 10);
  var mes = parseInt(partesFecha[1], 10);
  var dia = parseInt(partesFecha[2], 10);
  var fechaObj = new Date(anio, mes - 1, dia);
  if (
    fechaObj.getFullYear() !== anio ||
    fechaObj.getMonth() !== mes - 1 ||
    fechaObj.getDate() !== dia
  ) {
    return { valido: false, motivo: "Fecha inexistente en calendario ('" + partesFH[0] + "')." };
  }
  try {
    if (typeof horaAMinutos === "function") {
      horaAMinutos(partesFH[1]);
    }
  } catch (eHora) {
    return { valido: false, motivo: eHora.message };
  }

  if (
    typeof item.lat !== "number" ||
    typeof item.lng !== "number" ||
    !isFinite(item.lat) ||
    !isFinite(item.lng) ||
    item.lat < -90 ||
    item.lat > 90 ||
    item.lng < -180 ||
    item.lng > 180
  ) {
    return { valido: false, motivo: "Coordenadas lat/lng fuera de rango válido." };
  }

  var lim = vias && vias.zona && vias.zona.limites;
  if (lim) {
    if (item.lat < lim.lat_min || item.lat > lim.lat_max || item.lng < lim.lng_min || item.lng > lim.lng_max) {
      return {
        valido: false,
        motivo: "Coordenadas (" + item.lat + ", " + item.lng + ") fuera de zona.limites."
      };
    }
  }

  var cuadraExiste = false;
  if (vias && Array.isArray(vias.cuadras)) {
    for (var i = 0; i < vias.cuadras.length; i++) {
      if (vias.cuadras[i].id === item.cuadra) {
        cuadraExiste = true;
        break;
      }
    }
  }
  if (!cuadraExiste) {
    return { valido: false, motivo: "Cuadra inexistente en vias.json ('" + item.cuadra + "')." };
  }

  if (CATEGORIAS_PERMITIDAS.indexOf(item.categoria) === -1 || !(item.categoria in criterios.categoria)) {
    return { valido: false, motivo: "Categoría no permitida ('" + item.categoria + "')." };
  }
  if (ACTORES_PERMITIDOS.indexOf(item.actor) === -1) {
    return { valido: false, motivo: "Actor no permitido ('" + item.actor + "')." };
  }

  if (item.observaciones !== undefined && item.observaciones !== null) {
    if (typeof item.observaciones !== "string") {
      return { valido: false, motivo: "El campo 'observaciones' debe ser texto." };
    }
    if (item.observaciones.length > 140) {
      return { valido: false, motivo: "Observaciones supera los 140 caracteres (" + item.observaciones.length + ")." };
    }
  }

  if (item.criticidad !== undefined && item.criticidad !== null) {
    if (
      typeof item.criticidad !== "object" ||
      typeof item.criticidad.puntaje !== "number" ||
      !isFinite(item.criticidad.puntaje) ||
      typeof item.criticidad.nivel !== "string"
    ) {
      return { valido: false, motivo: "Estructura de 'criticidad' inválida en el JSON." };
    }
  }

  return { valido: true };
}

function sonReportesIdenticos(a, b) {
  var fotoA = typeof a.foto === "string" ? a.foto : "";
  var fotoB = typeof b.foto === "string" ? b.foto : "";

  return (
    a.origen === b.origen &&
    a.fecha_hora === b.fecha_hora &&
    Number(Number(a.lat).toFixed(6)) === Number(Number(b.lat).toFixed(6)) &&
    Number(Number(a.lng).toFixed(6)) === Number(Number(b.lng).toFixed(6)) &&
    a.cuadra === b.cuadra &&
    a.categoria === b.categoria &&
    a.actor === b.actor &&
    (a.observaciones || "").trim() === (b.observaciones || "").trim() &&
    fotoA === fotoB
  );
}

function importarReportesDesdeTexto(textoJson, reportesPrecargados, criterios, vias) {
  if (typeof calcularCriticidad !== "function") {
    return {
      ok: false,
      mensaje: "Error interno: el módulo criticidad.js no está cargado."
    };
  }

  var listaImportada;
  try {
    listaImportada = JSON.parse(textoJson);
  } catch (err) {
    return {
      ok: false,
      mensaje: "El archivo no contiene un JSON válido: " + err.message
    };
  }

  if (!Array.isArray(listaImportada)) {
    return {
      ok: false,
      mensaje: "El JSON importado debe ser un arreglo ([ ... ]) de reportes."
    };
  }

  var locales = cargarReportesLocales();
  var mapaExistentes = {};

  for (var i = 0; i < reportesPrecargados.length; i++) {
    mapaExistentes[reportesPrecargados[i].id] = reportesPrecargados[i];
  }
  for (var j = 0; j < locales.length; j++) {
    mapaExistentes[locales[j].id] = locales[j];
  }

  var nuevos = 0;
  var repetidos = 0;
  var invalidos = 0;
  var conflictos = 0;
  var detallesInvalidos = [];
  var detallesConflictos = [];

  for (var k = 0; k < listaImportada.length; k++) {
    var item = listaImportada[k];
    var validacion = validarReporteImportado(item, criterios, vias);

    if (!validacion.valido) {
      invalidos++;
      detallesInvalidos.push({
        id: (item && typeof item.id === "string" && item.id) ? item.id : "Fila #" + (k + 1),
        motivo: validacion.motivo
      });
      continue;
    }

    var idNormalizado = item.id.trim();

    if (mapaExistentes[idNormalizado]) {
      var existente = mapaExistentes[idNormalizado];
      if (sonReportesIdenticos(existente, item)) {
        repetidos++;
      } else {
        conflictos++;
        detallesConflictos.push({
          id: idNormalizado,
          motivo: "El ID ya existe con datos diferentes (ubicación, categoría, foto u observaciones); no se sobrescribió."
        });
      }
      continue;
    }

    var crit = calcularCriticidad(item, criterios, vias);
    var reporteNormalizado = {
      id: idNormalizado,
      origen: item.origen,
      fecha_hora: item.fecha_hora,
      lat: Number(Number(item.lat).toFixed(6)),
      lng: Number(Number(item.lng).toFixed(6)),
      cuadra: item.cuadra,
      categoria: item.categoria,
      actor: item.actor,
      foto: typeof item.foto === "string" && item.foto.length > 0 ? item.foto : null,
      observaciones: typeof item.observaciones === "string" ? item.observaciones.trim().slice(0, 140) : "",
      criticidad: {
        puntaje: crit.puntaje,
        nivel: crit.nivel
      }
    };

    locales.push(reporteNormalizado);
    mapaExistentes[reporteNormalizado.id] = reporteNormalizado;
    nuevos++;
  }

  var guardado = guardarListaReportesLocales(locales);
  if (!guardado.ok) {
    return guardado;
  }

  return {
    ok: true,
    nuevos: nuevos,
    repetidos: repetidos,
    invalidos: invalidos,
    detallesInvalidos: detallesInvalidos,
    conflictos: conflictos,
    detallesConflictos: detallesConflictos
  };
}
