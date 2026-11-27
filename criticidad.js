/* ============================================================================
 * ARCHIVO: criticidad.js
 * RESPONSABILIDAD: Lógica pura para deducir la franja horaria y calcular el
 * índice de criticidad de un reporte. No usa DOM, ni fetch, ni localStorage.
 * ============================================================================ */

var CATALOGO_CATEGORIAS = {
  doble_fila: "Doble fila / vía prohibida",
  bloqueo_rampa_cebra_paradero: "Bloqueo rampa, cebra o paradero",
  invasion_anden: "Invasión de andén"
};

var CATALOGO_ACTORES = {
  vehiculo_particular: "Vehículo particular",
  motocicleta: "Motocicleta",
  vehiculo_carga: "Vehículo de carga",
  mobiliario_comercial: "Mobiliario comercial"
};

function horaAMinutos(textoHora) {
  if (typeof textoHora !== "string" || !/^\d{2}:\d{2}$/.test(textoHora.trim())) {
    throw new Error("Formato de hora inválido: '" + textoHora + "'. Se esperaba HH:MM.");
  }

  var partes = textoHora.trim().split(":");
  var horas = parseInt(partes[0], 10);
  var minutos = parseInt(partes[1], 10);

  if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59) {
    throw new Error("Hora fuera de rango válido: '" + textoHora + "'.");
  }

  return horas * 60 + minutos;
}

function deducirFranja(fechaHora, criterios) {
  if (!fechaHora || typeof fechaHora !== "string") {
    throw new Error("Falta la fecha y hora del reporte para deducir la franja.");
  }
  if (!criterios || !Array.isArray(criterios.horas_pico)) {
    throw new Error("El objeto criterios no contiene el arreglo 'horas_pico'.");
  }

  var soloHora = fechaHora.indexOf("T") !== -1 ? fechaHora.split("T")[1] : fechaHora;
  var minutosReporte = horaAMinutos(soloHora);

  for (var i = 0; i < criterios.horas_pico.length; i++) {
    var rango = criterios.horas_pico[i];
    var limites = rango.split("-");

    if (limites.length !== 2) {
      throw new Error("Rango horario mal formado en criterios.json: '" + rango + "'.");
    }

    var inicioMin = horaAMinutos(limites[0]);
    var finMin = horaAMinutos(limites[1]);

    if (minutosReporte >= inicioMin && minutosReporte < finMin) {
      return "pico";
    }
  }

  return "valle";
}

function calcularCriticidad(reporte, criterios, vias) {
  if (!reporte || typeof reporte !== "object") {
    throw new Error("Reporte inválido o vacío.");
  }
  if (!criterios || !criterios.categoria || !criterios.via || !criterios.franja || !criterios.niveles) {
    throw new Error("Estructura de criterios.json incompleta.");
  }
  if (!vias || !Array.isArray(vias.cuadras)) {
    throw new Error("Estructura de vias.json incompleta: falta el arreglo 'cuadras'.");
  }

  if (!reporte.categoria) {
    throw new Error("El reporte no tiene categoría asignada.");
  }
  var pesoCategoria = criterios.categoria[reporte.categoria];
  if (typeof pesoCategoria !== "number") {
    throw new Error("Categoría desconocida en criterios.json: '" + reporte.categoria + "'.");
  }

  if (!reporte.cuadra) {
    throw new Error("El reporte no tiene cuadra asignada.");
  }
  var cuadraEncontrada = null;
  for (var i = 0; i < vias.cuadras.length; i++) {
    if (vias.cuadras[i].id === reporte.cuadra) {
      cuadraEncontrada = vias.cuadras[i];
      break;
    }
  }

  if (!cuadraEncontrada) {
    throw new Error("Cuadra desconocida en vias.json: '" + reporte.cuadra + "'.");
  }

  var tipoVia = cuadraEncontrada.tipo_via;
  var pesoVia = criterios.via[tipoVia];
  if (typeof pesoVia !== "number") {
    throw new Error("Tipo de vía desconocido en criterios.json: '" + tipoVia + "'.");
  }

  var franja = deducirFranja(reporte.fecha_hora, criterios);
  var pesoFranja = criterios.franja[franja];
  if (typeof pesoFranja !== "number") {
    throw new Error("Franja desconocida en criterios.json: '" + franja + "'.");
  }

  var puntaje = pesoCategoria + pesoVia + pesoFranja;

  var nivel = null;
  var nombresNiveles = Object.keys(criterios.niveles);
  var nivelSuperior = null;
  var maxGlobal = -Infinity;

  for (var j = 0; j < nombresNiveles.length; j++) {
    var nombre = nombresNiveles[j];
    var rangoNivel = criterios.niveles[nombre];
    var min = rangoNivel[0];
    var max = rangoNivel[1];

    if (max > maxGlobal) {
      maxGlobal = max;
      nivelSuperior = nombre;
    }

    if (puntaje >= min && puntaje <= max) {
      nivel = nombre;
    }
  }

  if (nivel === null && puntaje > maxGlobal && nivelSuperior !== null) {
    nivel = nivelSuperior;
  }

  if (nivel === null) {
    throw new Error("El puntaje " + puntaje + " no encaja en ningún rango de criterios.niveles.");
  }

  return {
    puntaje: puntaje,
    nivel: nivel,
    franja: franja,
    desglose: {
      categoria: pesoCategoria,
      via: pesoVia,
      franja: pesoFranja
    }
  };
}

function recalcularTodosLosReportes(listaReportes, criterios, vias) {
  if (!Array.isArray(listaReportes)) {
    return [];
  }

  var resultado = [];
  for (var i = 0; i < listaReportes.length; i++) {
    var original = listaReportes[i];
    var copia = Object.assign({}, original);
    var calc = calcularCriticidad(copia, criterios, vias);
    copia.criticidad = {
      puntaje: calc.puntaje,
      nivel: calc.nivel
    };
    copia._franja = calc.franja;
    copia._desglose = calc.desglose;
    resultado.push(copia);
  }
  return resultado;
}
