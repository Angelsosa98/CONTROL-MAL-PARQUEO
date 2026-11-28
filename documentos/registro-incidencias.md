# Registro de incidencias y errores — Control Vial Santa Marta

**Repositorio:** Angelsosa98/CONTROL-MAL-PARQUEO  
**Última actualización:** 27 de noviembre de 2026  
**Versión de la aplicación:** 0.9.1.36

Este archivo diferencia errores corregidos, limitaciones conocidas y pruebas realizadas. No se registran como resueltos los aspectos que todavía necesitan validación geográfica o una prueba en el navegador publicado.

## Incidencias corregidas

| ID | Incidencia | Causa / efecto | Corrección | Estado |
|---|---|---|---|---|
| INC-001 | Importación rechazaba fechas válidas | Las expresiones regulares de fecha quedaron con barras invertidas duplicadas al generar el validador. Fechas correctas como AAAA-MM-DDTHH:MM se rechazaban. | Se corrigieron los escapes de las expresiones regulares y se volvió a probar la validación e importación. | **Resuelta** |
| INC-002 | El tipo de vía podía heredarse entre reportes externos | Al limpiar el formulario o cambiar el ámbito, el selector podía conservar la opción arterial/secundaria anterior y aplicarla inadvertidamente al siguiente reporte. | Se limpia el selector al entrar al modo externo y al preparar un nuevo formulario. La validación exige elegir de nuevo el tipo. | **Resuelta** |
| INC-003 | Los reportes externos quedaban excluidos por reglas del área de estudio | El rectángulo geográfico, las cuatro cuadras y el cálculo de criticidad estaban ligados al modo local. | Se separó la validación por ámbito; los reportes externos requieren tipo de vía declarado y se conservan en mapas, filtros, resumen e intercambio de archivos. | **Resuelta** |

## Limitaciones conocidas / pendientes

| ID | Tema | Estado actual | Riesgo / acción pendiente |
|---|---|---|---|
| LIM-001 | Límite municipal de Santa Marta | El modo externo no cuenta con un polígono oficial municipal. Comprueba formato/rango de coordenadas y pide verificación al operador. | Un punto fuera del municipio podría registrarse si se marca manualmente. Incorporar un polígono oficial verificado cuando esté disponible. |
| LIM-002 | Clasificación vial externa | El operador selecciona arterial o secundaria; no se consulta una clasificación oficial automática de la vía. | El puntaje de criticidad depende de esa selección. Confirmar el tipo de vía con una fuente cartográfica/oficial antes de análisis formales. |
| LIM-003 | Persistencia entre dispositivos | Los reportes se guardan en localStorage del navegador. | No hay sincronización central. Exportar e importar JSON/ZIP para reunir datos de varios equipos. |
| LIM-004 | Agrupación externa del Top 5 | Los reportes externos se agrupan por clase de vía (arterial/secundaria), no por barrio o calle. | No interpretar ese Top 5 como ranking geográfico de barrios. Para ello habría que incorporar una clave de agrupación por sector normalizado. |
| LIM-005 | Validación espacial de calzadas | Los segmentos del área de estudio son geometrías de referencia, no un levantamiento oficial de calzadas. | La tolerancia de 30 m no demuestra que un punto esté dentro de la calzada. Mantener revisión cartográfica y de campo. |
| LIM-006 | Publicación web | Las pruebas de lógica se ejecutan antes de la validación en navegador. | Confirmar la versión publicada en GitHub Pages y probar GPS, buscador, guardado, mapas e importación/exportación en navegador real. |

## Pruebas realizadas en versión 0.9.1.36

- Sintaxis JavaScript de captura.js, mapa.js, criticidad.js, almacenamiento.js, filtros.js y resumen.js.
- Cálculo de criticidad de un reporte del área de estudio y uno de otros sectores.
- Rechazo de tipo de vía externo inválido y de ámbito de importación desconocido.
- Validación e importación de reporte externo y conservación de ambito, tipo_via_reporte y sector_referencia.
- Inclusión de reportes externos en los mapas y separación de resultados mediante el filtro de ámbito.
- Inclusión en resumen operativo y conservación de campos externos en exportación JSON/ZIP.
- Verificación de que los 30 registros fotográficos, la geometría del recorrido exterior y los tres tramos interiores no se modificaron en esta implementación.

La suite de navegador pruebas.html se amplió para incluir un caso de criticidad externa y un caso de rechazo de tipo de vía inválido. Las pruebas programáticas no sustituyen la comprobación visual y funcional de la versión desplegada.

## Incidencias corregidas — versión 0.9.1.37

| ID | Incidencia | Causa / efecto | Corrección | Estado |
|---|---|---|---|---|
| INC-004 | El mapa de calor permanecía rojo por las 30 evidencias | La capa de evidencias creaba 30 puntos de calor con intensidad constante 1.0, además de la capa ponderada por reportes. Las fotografías no tienen criticidad individual. | Se retiraron marcadores morados y calor de evidencias. El calor usa solo reportes clasificados: Alto 1.00, Medio 0.65 y Bajo 0.30. | **Resuelta en código; falta comprobar publicación visual** |

### Verificaciones de INC-004

- La actualización de evidencias no crea marcadores ni llama a Leaflet.heat.
- El mapa de reportes dibuja solamente niveles Alto, Medio y Bajo válidos.
- Intensidades simuladas verificadas: Alto 1.00, Medio 0.65, Bajo 0.30.
- Un reporte sin nivel o con nivel desconocido no se representa.
- Los modos Puntos, Calor y Ambos actúan solo sobre reportes.
- Con una lista vacía no se crea capa térmica y el mapa encuadra el recorrido.
- La galería fotográfica, los 30 registros de evidencia y las cuatro geometrías del recorrido permanecen intactos.