/* ============================================================================
 * ARCHIVO: filtros.js
 * RESPONSABILIDAD: Lógica pura para filtrar la lista de reportes por cuadra,
 * franja horaria, categoría y tipo de actor sin recargar la página (RF-04),
 * y calcular conteos y porcentajes de participación por categoría (CU-02).
 * No usa DOM, ni fetch, ni localStorage.
 * ============================================================================ */

/**
 * Filtra un arreglo de reportes según los criterios activos.
 * Entradas:
 *   - listaReportes: Array de reportes
 *   - filtros: { cuadra, franja, categoria, actor } ("" o "todas" = sin filtro)
 *   - criterios: Objeto criterios.json (usado si el reporte no tiene _franja)
 * Salida: Nuevo arreglo con los reportes que cumplen todos los filtros activos.
 */
function filtrarReportes(listaReportes, filtros, criterios) {
  if (!Array.isArray(listaReportes)) {
    return [];
  }

  var f = filtros || {};
  var cuadraFiltro = f.cuadra && f.cuadra !== "todas" ? String(f.cuadra) : "";
  var ambitoFiltro = f.ambito && f.ambito !== "todas" ? String(f.ambito) : "";
  var franjaFiltro = f.franja && f.franja !== "todas" ? String(f.franja) : "";
  var categoriaFiltro = f.categoria && f.categoria !== "todas" ? String(f.categoria) : "";
  var actorFiltro = f.actor && f.actor !== "todas" ? String(f.actor) : "";

  var resultado = [];

  for (var i = 0; i < listaReportes.length; i++) {
    var r = listaReportes[i];
    if (!r || typeof r !== "object") continue;

    if (cuadraFiltro && r.cuadra !== cuadraFiltro) {
      continue;
    }

    var ambitoReporte = r.ambito || "area_estudio";
    if (ambitoFiltro && ambitoReporte !== ambitoFiltro) {
      continue;
    }

    if (categoriaFiltro && r.categoria !== categoriaFiltro) {
      continue;
    }

    if (actorFiltro && r.actor !== actorFiltro) {
      continue;
    }

    if (franjaFiltro) {
      var franjaReporte = r._franja;
      if (!franjaReporte && typeof deducirFranja === "function" && criterios) {
        franjaReporte = deducirFranja(r.fecha_hora, criterios);
      }
      if (franjaReporte !== franjaFiltro) {
        continue;
      }
    }

    resultado.push(r);
  }

  return resultado;
}

/**
 * Calcula conteos y porcentajes por categoría sobre la lista filtrada (CU-02).
 * Salida:
 *   {
 *     total: number,
 *     categorias: [
 *       { clave: "doble_fila", etiqueta: "...", conteo: number, porcentaje: number },
 *       ...
 *     ]
 *   }
 */
function calcularEstadisticasFiltradas(listaFiltrada) {
  var lista = Array.isArray(listaFiltrada) ? listaFiltrada : [];
  var total = lista.length;

  var definiciones = [
    { clave: "doble_fila", etiqueta: "Doble fila / vía prohibida" },
    { clave: "bloqueo_rampa_cebra_paradero", etiqueta: "Bloqueo rampa, cebra o paradero" },
    { clave: "invasion_anden", etiqueta: "Invasión de andén" }
  ];

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
  for (var j = 0; j < definiciones.length; j++) {
    var def = definiciones[j];
    var c = conteos[def.clave];
    var pct = total > 0 ? Number(((c / total) * 100).toFixed(1)) : 0;
    categorias.push({
      clave: def.clave,
      etiqueta: def.etiqueta,
      conteo: c,
      porcentaje: pct
    });
  }

  return {
    total: total,
    categorias: categorias
  };
}
