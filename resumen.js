/* ============================================================================
 * ARCHIVO: resumen.js
 * RESPONSABILIDAD: Agrupa reportes por cuadra, suma puntajes de criticidad,
 * ordena de mayor a menor para obtener el Top 5 de cuadras más críticas y
 * aplica reglas explícitas de recomendación operativa (RF-05 y CU-03).
 * No usa DOM, ni fetch, ni localStorage.
 * ============================================================================ */

/**
 * Evalúa las reglas escritas sobre las métricas de una cuadra y devuelve
 * la recomendación operativa junto con la regla exacta que la produjo.
 */
function evaluarReglaOperativa(stats) {
  var total = stats.totalReportes;
  var altoEnPico = stats.altoEnPico;
  var invAnden = stats.porCategoria.invasion_anden || 0;
  var vehCarga = stats.porActor.vehiculo_carga || 0;
  var bloqueoAcc = stats.porCategoria.bloqueo_rampa_cebra_paradero || 0;
  var dobleFila = stats.porCategoria.doble_fila || 0;

  // Regla 1 (RF-05): 3 o más reportes de nivel Alto en hora pico
  if (altoEnPico >= 3) {
    return {
      recomendacion: "Patrullaje prioritario en hora pico",
      reglaAplicada:
        "Regla R1 (RF-05): 3 o más reportes de nivel Alto en hora pico (" +
        altoEnPico + " reportes Alto en franja pico)."
    };
  }

  // Regla 2 (RF-05): Predominio de invasión de andén (mayoría estricta o categoría líder con >= 2)
  if (
    invAnden > total / 2 ||
    (invAnden >= 2 && invAnden > dobleFila && invAnden > bloqueoAcc)
  ) {
    var pctAnden = Math.round((invAnden / total) * 100);
    return {
      recomendacion: "Operativo de espacio público",
      reglaAplicada:
        "Regla R2 (RF-05): Predominio de invasión de andén (" +
        invAnden + " de " + total + " reportes, " + pctAnden + "%)."
    };
  }

  // Regla 3 (RF-05): Predominio de vehículo de carga
  var maxOtrosActores = Math.max(
    stats.porActor.vehiculo_particular || 0,
    stats.porActor.motocicleta || 0,
    stats.porActor.mobiliario_comercial || 0
  );
  if (
    vehCarga > total / 2 ||
    (vehCarga >= 2 && vehCarga > maxOtrosActores)
  ) {
    var pctCarga = Math.round((vehCarga / total) * 100);
    return {
      recomendacion: "Revisar horario de cargue y descargue",
      reglaAplicada:
        "Regla R3 (RF-05): Predominio de vehículo de carga (" +
        vehCarga + " de " + total + " reportes, " + pctCarga + "%)."
    };
  }

  // Regla 4: Predominio de bloqueo de rampa peatonal, cebra o paradero
  if (
    bloqueoAcc > total / 2 ||
    (bloqueoAcc >= 2 && bloqueoAcc > dobleFila && bloqueoAcc > invAnden)
  ) {
    var pctBloqueo = Math.round((bloqueoAcc / total) * 100);
    return {
      recomendacion: "Control de accesibilidad y paraderos",
      reglaAplicada:
        "Regla R4: Predominio de bloqueo de rampa, cebra o paradero (" +
        bloqueoAcc + " de " + total + " reportes, " + pctBloqueo + "%)."
    };
  }

  // Regla 5: Predominio de doble fila / vía prohibida o puntaje acumulado alto (>= 12)
  if (dobleFila >= 2 || stats.puntajeAcumulado >= 12) {
    return {
      recomendacion: "Control de doble fila y señalización restrictiva",
      reglaAplicada:
        "Regla R5: Reincidencia en doble fila / vía prohibida (" +
        dobleFila + " reportes; puntaje acumulado " + stats.puntajeAcumulado + " pts)."
    };
  }

  // Regla 6 (Respaldo): Incidencia moderada o mixta sin umbral crítico superado
  return {
    recomendacion: "Monitoreo preventivo y pedagogía vial",
    reglaAplicada:
      "Regla R6 (base): Incidencia moderada o mixta sin umbral crítico superado (" +
      total + " reporte(s), " + stats.puntajeAcumulado + " pts acumulados)."
  };
}

/**
 * Agrupa los reportes por cuadra, suma puntajes, ordena descendentemente y
 * devuelve el Top 5 de cuadras más críticas con su recomendación y regla.
 * Entradas:
 *   - listaReportes: Array de reportes con criticidad calculada
 *   - vias: Objeto vias.json
 *   - criterios: Objeto criterios.json
 * Salida: Array de hasta 5 objetos ordenados de mayor a menor puntaje acumulado.
 */
function generarResumenOperativo(listaReportes, vias, criterios) {
  if (!Array.isArray(listaReportes) || listaReportes.length === 0) {
    return [];
  }

  // Mapa rápido de metadatos de cuadras desde vias.json
  var infoCuadras = {};
  if (vias && Array.isArray(vias.cuadras)) {
    for (var i = 0; i < vias.cuadras.length; i++) {
      var c = vias.cuadras[i];
      infoCuadras[c.id] = c;
    }
  }

  var agrupado = {};

  for (var j = 0; j < listaReportes.length; j++) {
    var r = listaReportes[j];
    if (!r || !r.cuadra) continue;

    if (!agrupado[r.cuadra]) {
      var meta = infoCuadras[r.cuadra];
      agrupado[r.cuadra] = {
        cuadraId: r.cuadra,
        nombreCuadra: meta ? meta.nombre : r.cuadra,
        tipoVia: meta ? meta.tipo_via : "desconocida",
        puntajeAcumulado: 0,
        totalReportes: 0,
        conteoNivel: { Alto: 0, Medio: 0, Bajo: 0 },
        altoEnPico: 0,
        porFranja: { pico: 0, valle: 0 },
        porCategoria: {
          doble_fila: 0,
          bloqueo_rampa_cebra_paradero: 0,
          invasion_anden: 0
        },
        porActor: {
          vehiculo_particular: 0,
          motocicleta: 0,
          vehiculo_carga: 0,
          mobiliario_comercial: 0
        }
      };
    }

    var grupo = agrupado[r.cuadra];
    var puntaje = r.criticidad && typeof r.criticidad.puntaje === "number" ? r.criticidad.puntaje : 0;
    var nivel = r.criticidad && r.criticidad.nivel ? r.criticidad.nivel : "Bajo";

    var franja = r._franja;
    if (!franja && typeof deducirFranja === "function" && criterios) {
      franja = deducirFranja(r.fecha_hora, criterios);
    }

    grupo.puntajeAcumulado += puntaje;
    grupo.totalReportes += 1;

    if (Object.prototype.hasOwnProperty.call(grupo.conteoNivel, nivel)) {
      grupo.conteoNivel[nivel] += 1;
    }

    if (franja === "pico") {
      grupo.porFranja.pico += 1;
      if (nivel === "Alto") {
        grupo.altoEnPico += 1;
      }
    } else if (franja === "valle") {
      grupo.porFranja.valle += 1;
    }

    if (Object.prototype.hasOwnProperty.call(grupo.porCategoria, r.categoria)) {
      grupo.porCategoria[r.categoria] += 1;
    }

    if (Object.prototype.hasOwnProperty.call(grupo.porActor, r.actor)) {
      grupo.porActor[r.actor] += 1;
    }
  }

  var listaCuadras = [];
  var ids = Object.keys(agrupado);
  for (var k = 0; k < ids.length; k++) {
    var item = agrupado[ids[k]];
    var decision = evaluarReglaOperativa(item);
    item.recomendacion = decision.recomendacion;
    item.reglaAplicada = decision.reglaAplicada;
    listaCuadras.push(item);
  }

  // Ordenar de mayor a menor puntaje acumulado (desempate: reportes Alto, luego total)
  listaCuadras.sort(function (a, b) {
    if (b.puntajeAcumulado !== a.puntajeAcumulado) {
      return b.puntajeAcumulado - a.puntajeAcumulado;
    }
    if (b.conteoNivel.Alto !== a.conteoNivel.Alto) {
      return b.conteoNivel.Alto - a.conteoNivel.Alto;
    }
    return b.totalReportes - a.totalReportes;
  });

  return listaCuadras.slice(0, 5);
}
