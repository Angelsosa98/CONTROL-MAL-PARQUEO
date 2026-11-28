# Auditoría técnica — Control Vial Santa Marta

**Versión auditada:** 0.9.1.41  
**Rama de trabajo:** `main`  
**Alcance:** revisión estática, consistencia de datos, búsqueda de vías y pruebas automatizadas simuladas.

## Resultado ejecutivo

No se detectaron errores de sintaxis JavaScript en los módulos revisados ni referencias DOM inexistentes en la comprobación estática. La distribución de evidencias y el inventario CSV ya eran correctos antes de esta depuración y se volvieron a validar.

## Hallazgos y estado

| Área | Resultado | Acción |
|---|---|---|
| Distribución de evidencias | 9 Universidad del Magdalena / 21 Villa Marbella | Confirmada desde JSON; indicador calculado dinámicamente. Sin mover puntos. |
| Buscador local | Solo cuatro vías activas; diez históricas excluidas | Se conserva el filtro. |
| Geocodificador en Área de estudio | `viewbox` no era estricto y podía devolver resultados de fuera o cercanos a vías desactivadas | Corregido con `bounded=1` y filtro por distancia a segmentos desactivados. |
| Otros sectores de Santa Marta | Debe permitir búsqueda en toda la ciudad | Se mantiene sin límite geográfico del área de estudio. |
| Inventario fotográfico | 30 filas CSV | Verificado campo por campo con JSON: código, archivo, GPS no disponible, sector, vía y valoración visual. |
| Recorrido y puntos de vehículos | Son geometrías distintas | No se movió EVID-030 ni ninguna otra evidencia por distancia al recorrido. |
| Importación JSON/ZIP | Ya implementada y con límites de seguridad | Se mantiene; las pruebas ZIP siguen incluidas. |
| Documentación | Había notas históricas de 5/25 y una tabla de anexo sin sector/clasificación | Se conserva el historial marcado como histórico y se actualiza el anexo con el inventario real 9/21. |

## Pruebas ejecutadas

- `pruebas.html`: 7/7 casos del motor de criticidad.
- `pruebas-integracion.html`: 11/11 casos de vías activas, geocodificación acotada, búsqueda externa, ZIP, consistencia CSV/JSON y distribución sectorial.
- Sintaxis de los módulos JavaScript revisados.
- Comparación de 30 registros JSON con 30 filas CSV.
- Verificación de 14 vías registradas: cuatro activas y diez históricas desactivadas.

## Limitaciones no resueltas por esta auditoría

- La cartografía del área sigue usando segmentos de referencia aproximados; la distancia a estos segmentos no prueba que un punto esté exactamente sobre la calzada.
- Otros sectores de Santa Marta no cuentan con un polígono municipal oficial para validación automática.
- Las fotos tienen ubicación sectorial aproximada y valoración visual preliminar; no tienen GPS ni fecha/hora individuales verificadas.
- El repositorio es público y algunas fotografías pueden mostrar placas legibles. Antes de difusión externa, se recomienda revisar y publicar copias anonimizadas o restringir el acceso.
- Las pruebas se ejecutaron en entorno simulado y no sustituyen una prueba manual en móvil y escritorio con GPS, conexión real a Nominatim/Leaflet, almacenamiento y despliegue público.