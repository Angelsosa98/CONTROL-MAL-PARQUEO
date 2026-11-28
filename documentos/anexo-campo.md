# Anexo de Campo — Evidencias Fotográficas (Santa Marta)

**Proyecto:** Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo  
**Repositorio:** `Angelsosa98/CONTROL-MAL-PARQUEO`

---

## 1. Estado del material disponible

La revisión del repositorio encontró:

- **Reportes georreferenciados precargados:** 0 (`datos/reportes.json` contiene `[]`).
- **Fotografías conservadas:** 30 (`datos/evidencias_nuevas.json`).
- **Estado de las fotografías:** evidencia visual con ubicación sectorial aproximada y valoración visual preliminar Alto/Medio/Bajo; no equivale a GPS individual ni al índice formal de criticidad.
- **Cuadras de referencia configuradas:** 10 en `datos/vias.json`, con segmentos aproximados aún no validados como geometría oficial de calzada.

Las fotografías no incluyen coordenadas GPS individuales ni fecha/hora verificadas. Cada una tiene una valoración visual preliminar de la obstrucción visible, separada del cálculo formal de criticidad. Por ello no se calcula para ellas franja pico/valle ni puntaje formal, y no se incorporan a estadísticas o ranking de reportes.

## 2. Tratamiento de las fotografías

Las 30 fotografías se mantienen en el repositorio, la galería y el mapa como puntos sectoriales aproximados. La distribución actual es 9 evidencias en la calle de la Universidad del Magdalena y 21 en Villa Marbella. Los puntos indican dónde se observaron vehículos; no tienen que coincidir con el recorrido verde del equipo, que representa únicamente el camino realizado por los observadores. Ningún punto se ha desplazado para forzarlo a coincidir con esa ruta.

Antes de utilizar cada fotografía como evidencia de un reporte, el equipo debe documentar su ubicación real, fecha/hora, categoría, actor y observación de campo, y verificar la privacidad de las personas y placas visibles.

## 3. Limitaciones geográficas

La distancia máxima de 30 m implementada en la aplicación se calcula respecto a segmentos aproximados configurados en `datos/vias.json`. Esa regla no demuestra que el punto esté sobre la calzada ni excluye por sí sola predios, andenes, edificios o campus. La validación espacial definitiva requiere geometrías viales verificadas y revisión de campo.

## 4. Tabla de inventario fotográfico

| Identificador | Archivo | Estado |
|---|---|---|
| `EVID-001` | `fotos/evidencia-001.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-002` | `fotos/evidencia-002.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-003` | `fotos/evidencia-003.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-004` | `fotos/evidencia-004.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-005` | `fotos/evidencia-005.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-006` | `fotos/evidencia-006.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-007` | `fotos/evidencia-009.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-008` | `fotos/evidencia-010.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-009` | `fotos/evidencia-011.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-010` | `fotos/evidencia-012.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-011` | `fotos/evidencia-014.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-012` | `fotos/evidencia-015.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-013` | `fotos/evidencia-016.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-014` | `fotos/evidencia-017.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-015` | `fotos/evidencia-018.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-016` | `fotos/evidencia-019.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-017` | `fotos/evidencia-020.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-018` | `fotos/evidencia-023.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-019` | `fotos/evidencia-024.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-020` | `fotos/evidencia-025.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-021` | `fotos/evidencia-028.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-022` | `fotos/evidencia-031.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-023` | `fotos/evidencia-033.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-024` | `fotos/evidencia-034.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-025` | `fotos/evidencia-035.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-026` | `fotos/evidencia-036.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-027` | `fotos/evidencia-037.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-028` | `fotos/evidencia-038.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-029` | `fotos/evidencia-039.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |
| `EVID-030` | `fotos/evidencia-040.jpg` | Ubicación sectorial aproximada; GPS individual no disponible |



## 5. Distribución y separación del recorrido

| Sector | Evidencias |
|---|---:|
| Calle de la Universidad del Magdalena | 9 |
| Villa Marbella | 21 |
| **Total** | **30** |

El recorrido verde corresponde a la trayectoria del equipo de campo. Las ubicaciones de los vehículos observados son otra capa y pueden encontrarse fuera de la línea del recorrido. La distancia de un punto al recorrido no constituye por sí sola un error ni una regla para moverlo.

El archivo `datos/fotos/indice_evidencias.csv` refleja el sector, la vía aproximada y la valoración visual del JSON. La columna de GPS continúa indicando que el GPS individual no está disponible.
