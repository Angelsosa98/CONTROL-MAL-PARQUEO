# Anexo de Campo — Evidencias Fotográficas (Santa Marta)

**Proyecto:** Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo  
**Repositorio:** `Angelsosa98/CONTROL-MAL-PARQUEO`

---

## 1. Estado del material disponible

La revisión del repositorio encontró:

- **Reportes georreferenciados precargados:** 0 (`datos/reportes.json` contiene `[]`).
- **Fotografías conservadas:** 30 (`datos/evidencias_nuevas.json`).
- **Estado de las fotografías:** evidencia visual con ubicación sectorial aproximada y valoración visual preliminar Alto/Medio/Bajo; no equivale a GPS individual ni al índice formal de criticidad.
- **Vías registradas:** 14 en `datos/vias.json`: cuatro activas para el área de estudio y diez deshabilitadas como referencias históricas. Los segmentos activos son aproximados y aún no equivalen a cartografía oficial de calzada.

Las fotografías no incluyen coordenadas GPS individuales ni fecha/hora verificadas. Cada una tiene una valoración visual preliminar de la obstrucción visible, separada del cálculo formal de criticidad. Por ello no se calcula para ellas franja pico/valle ni puntaje formal, y no se incorporan a estadísticas o ranking de reportes.

## 2. Tratamiento de las fotografías

Las 30 fotografías se mantienen en el repositorio, la galería y el mapa como puntos sectoriales aproximados. La distribución actual es 9 evidencias en la calle de la Universidad del Magdalena y 21 en Villa Marbella. Los puntos indican dónde se observaron vehículos; no tienen que coincidir con el recorrido verde del equipo, que representa únicamente el camino realizado por los observadores. Ningún punto se ha desplazado para forzarlo a coincidir con esa ruta.

Antes de utilizar cada fotografía como evidencia de un reporte, el equipo debe documentar su ubicación real, fecha/hora, categoría, actor y observación de campo, y verificar la privacidad de las personas y placas visibles.

## 3. Limitaciones geográficas

La distancia máxima de 30 m implementada en la aplicación se calcula respecto a segmentos aproximados configurados en `datos/vias.json`. Esa regla no demuestra que el punto esté sobre la calzada ni excluye por sí sola predios, andenes, edificios o campus. La validación espacial definitiva requiere geometrías viales verificadas y revisión de campo.

## 4. Tabla de inventario fotográfico

| Identificador | Archivo | Sector aproximado | Vía aproximada | Valoración visual preliminar | Dato individual pendiente |
|---|---|---|---|---|---|
| `EVID-001` | `fotos/evidencia-001.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-002` | `fotos/evidencia-002.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Bajo · estacionamiento_junto_a_borde (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-003` | `fotos/evidencia-003.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Medio · ocupacion_parcial_anden (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-004` | `fotos/evidencia-004.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Medio · detencion_en_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-005` | `fotos/evidencia-005.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Alto · obstruccion_transversal_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-006` | `fotos/evidencia-006.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-007` | `fotos/evidencia-009.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Medio · detencion_en_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-008` | `fotos/evidencia-010.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Medio · motocicleta_en_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-009` | `fotos/evidencia-011.jpg` | Calle de la Universidad del Magdalena | Calle de la Universidad del Magdalena | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-010` | `fotos/evidencia-012.jpg` | Villa Marbella | Tramo interno norte de Villa Marbella (referencia sectorial) | Medio · ocupacion_parcial_anden (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-011` | `fotos/evidencia-014.jpg` | Villa Marbella | Tramo interno norte de Villa Marbella (referencia sectorial) | Medio · ocupacion_anden (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-012` | `fotos/evidencia-015.jpg` | Villa Marbella | Tramo interno norte de Villa Marbella (referencia sectorial) | Bajo · estacionamiento_junto_a_borde (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-013` | `fotos/evidencia-016.jpg` | Villa Marbella | Tramo interno norte de Villa Marbella (referencia sectorial) | Bajo · estacionamiento_junto_a_borde (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-014` | `fotos/evidencia-017.jpg` | Villa Marbella | Tramo interno norte de Villa Marbella (referencia sectorial) | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-015` | `fotos/evidencia-018.jpg` | Villa Marbella | Tramo interno central de Villa Marbella (referencia sectorial) | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-016` | `fotos/evidencia-019.jpg` | Villa Marbella | Tramo interno central de Villa Marbella (referencia sectorial) | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-017` | `fotos/evidencia-020.jpg` | Villa Marbella | Tramo interno central de Villa Marbella (referencia sectorial) | Bajo · estacionamiento_junto_a_borde (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-018` | `fotos/evidencia-023.jpg` | Villa Marbella | Tramo interno central de Villa Marbella (referencia sectorial) | Medio · ocupacion_borde_calzada (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-019` | `fotos/evidencia-024.jpg` | Villa Marbella | Tramo interno central de Villa Marbella (referencia sectorial) | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-020` | `fotos/evidencia-025.jpg` | Villa Marbella | Tramo interno sur de Villa Marbella (referencia sectorial) | Medio · ocupacion_parcial_anden (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-021` | `fotos/evidencia-028.jpg` | Villa Marbella | Tramo interno sur de Villa Marbella (referencia sectorial) | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-022` | `fotos/evidencia-031.jpg` | Villa Marbella | Tramo interno sur de Villa Marbella (referencia sectorial) | Bajo · estacionamiento_junto_a_borde (baja) | GPS y fecha/hora individuales no disponibles |
| `EVID-023` | `fotos/evidencia-033.jpg` | Villa Marbella | Tramo interno sur de Villa Marbella (referencia sectorial) | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-024` | `fotos/evidencia-034.jpg` | Villa Marbella | Tramo interno sur de Villa Marbella (referencia sectorial) | Medio · ocupacion_parcial_anden (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-025` | `fotos/evidencia-035.jpg` | Villa Marbella | Calle 29J — tramo sur de Villa Marbella | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-026` | `fotos/evidencia-036.jpg` | Villa Marbella | Calle 29J — tramo sur de Villa Marbella | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-027` | `fotos/evidencia-037.jpg` | Villa Marbella | Calle 29J — tramo sur de Villa Marbella | Medio · obstruccion_parcial_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-028` | `fotos/evidencia-038.jpg` | Villa Marbella | Carrera 21D — retorno oriental de Villa Marbella | Alto · ocupacion_anden (alta) | GPS y fecha/hora individuales no disponibles |
| `EVID-029` | `fotos/evidencia-039.jpg` | Villa Marbella | Carrera 21D — retorno oriental de Villa Marbella | Medio · ocupacion_borde_calzada (media) | GPS y fecha/hora individuales no disponibles |
| `EVID-030` | `fotos/evidencia-040.jpg` | Villa Marbella | Carrera 21D — retorno oriental de Villa Marbella | Alto · ocupacion_ciclorruta (alta) | GPS y fecha/hora individuales no disponibles |


## 5. Distribución y separación del recorrido

| Sector | Evidencias |
|---|---:|
| Calle de la Universidad del Magdalena | 9 |
| Villa Marbella | 21 |
| **Total** | **30** |

El recorrido verde corresponde a la trayectoria del equipo de campo. Las ubicaciones de los vehículos observados son otra capa y pueden encontrarse fuera de la línea del recorrido. La distancia de un punto al recorrido no constituye por sí sola un error ni una regla para moverlo.

El archivo `datos/fotos/indice_evidencias.csv` fue contrastado fila por fila con el JSON: los 30 códigos, archivos, sectores, vías aproximadas y valoraciones visuales coinciden. La columna de GPS continúa indicando que el GPS individual no está disponible; las fechas sugeridas por nombre no se consideran fechas verificadas.
