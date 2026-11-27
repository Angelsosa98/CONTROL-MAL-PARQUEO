/* ============================================================================
 * ARCHIVO: filtros.js
 * DEPENDENCIAS OPCIONALES: criticidad.js (deducirFranja, CATALOGO_CATEGORIAS)
 * RESPONSABILIDAD: Lógica pura para filtrar la lista de reportes por cuadra,
 * franja horaria, categoría y tipo de actor sin recargar la página (RF-04),
 * y calcular conteos y porcentajes de participación por categoría (CU-02).
 * ============================================================================ */

function filtrarReportes(listaReportes, filtros, criterios) {
  if (!Array.isArray(listaReportes)) {
    return [];
  }

  var f = filtros || {};
  var cuadraFiltro = f.cuadra && f.cuadra !== "todas" ? String(f.cuadra) : "";
  var franjaFiltro = f.franja && f.franja !== "todas" ? String(f.franja) : "";
  var categoriaFiltro = f.categoria && f.categoria !== "todas" ? String(f.categoria) : "";
  var actorFiltro = f.actor && f.actor !== "todas" ? String(f.actor) : "";

  var resultado = [];

  for (var i = 0; i < listaReportes.length; i++) {
    var r = listaReportes[i];
    if (!r || typeof r !== "object") continue;

    if (cuadraFiltro && r.cuadra !== cuadraFiltro) continue;
    if (categoriaFiltro && r.categoria !== categoriaFiltro) continue;
    if (actorFiltro && r.actor !== actorFiltro) continue;

    if (franjaFiltro) {
      var franjaReporte = r._franja;
      if (!franjaReporte && typeof deducirFranja === "function" && criterios) {
        franjaReporte = deducirFranja(r.fecha_hora, criterios);
      }
      if (franjaReporte !== franjaFiltro) continue;
    }

    resultado.push(r);
  }

  return resultado;
}

function calcularEstadisticasFiltradas(listaFiltrada) {
  var lista = Array.isArray(listaFiltrada) ? listaFiltrada : [];
  var total = lista.length;

  var etiquetas = typeof CATALOGO_CATEGORIAS !== "undefined"
    ? CATALOGO_CATEGORIAS
    : {
        doble_fila: "Doble fila / vía prohibida",
        bloqueo_rampa_cebra_paradero: "Bloqueo rampa, cebra o paradero",
        invasion_anden: "Invasión de andén"
      };

  var claves = ["doble_fila", "bloqueo_rampa_cebra_paradero", "invasion_anden"];
  var conteos = {
    doble_fila: 0,
    bloqueo_rampa_cebra_paradero: 0,
    invasion_anden: 0
  };

  for (var i = 0; i < lista.length; i++) {
    var cat = lista[i] && lista[i].categoria;
    if (Object.prototype.hasOwnProperty.call(conteos, cat)) {
      conteos[cat]++;
    }
  }

  var categorias = [];
  for (var j = 0; j < claves.length; j++) {
    var clave = claves[j];
    var c = conteos[clave];
    var pct = total > 0 ? Number(((c / total) * 100).toFixed(1)) : 0;
    categorias.push({
      clave: clave,
      etiqueta: etiquetas[clave] || clave,
      conteo: c,
      porcentaje: pct
    });
  }

  return {
    total: total,
    categorias: categorias
  };
}
