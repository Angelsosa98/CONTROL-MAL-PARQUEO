# Bitácora de Ingeniería — Control Vial Santa Marta

**Equipo:** Angel Sosa Ospino (ASO), Adrian Jose Marquez Orozco (AMO), Johan David Acosta Peñaloza (JAP), Josue David Rodriguez (JDR)  
**Asignatura:** Ingeniería de Sistemas — Universidad del Magdalena

---

## 1. Estado verificado de los datos

En la revisión del repositorio se comprobó que `datos/reportes.json` contiene un arreglo vacío (`[]`) y que `datos/evidencias_nuevas.json` contiene 30 registros fotográficos. Estos dos conjuntos no deben confundirse: las fotografías no son reportes georreferenciados completos.

Las fotografías tenían coordenadas y puntajes identificados como simulados. Se retiraron esos campos para impedir que se presenten como ubicaciones GPS, criticidad calculada o resultados observados. Las 30 referencias fotográficas se conservan y quedan pendientes de georreferenciación y clasificación verificadas.

## 2. Ajustes de integridad aplicados

1. **Separación de fotografías y reportes:** la galería muestra las 30 fotografías pendientes; no las cuenta como reportes.
2. **Retiro de coordenadas sintéticas:** las fotografías ya no aportan puntos al mapa.
3. **Retiro de criticidad simulada:** no se calculan porcentajes, mapa de calor o ranking a partir de puntajes inventados.
4. **Mapa basado en reportes:** las capas de puntos y calor se alimentan únicamente de reportes con coordenadas y atributos de criticidad registrados.
5. **Mensajes de estado:** la interfaz informa cuando no existen reportes georreferenciados y aclara que las fotografías siguen en la galería.
6. **Documentación corregida:** README, arquitectura y anexo describen el estado real de los archivos de datos.

## 3. Limitación cartográfica pendiente

Las 10 cuadras de `datos/vias.json` siguen definidas por segmentos aproximados. La validación de 30 m mide distancia a esos segmentos y no acredita que una coordenada esté sobre la calzada ni fuera de propiedades privadas. La geometría vial debe verificarse contra cartografía fiable y recorridos de campo antes de interpretar los datos espacialmente.

## 4. Pruebas

La validación sintáctica de JavaScript y las pruebas unitarias de criticidad son verificaciones parciales. Debe completarse una prueba en navegador para comprobar mapas, GPS, controles, filtros, persistencia, galería, importación y exportación. No se declara aprobada una prueba visual que no se haya ejecutado.


## 5. Correcciones de integridad y visualización — 27 de noviembre de 2026

- Se sustituyeron los puntos de referencia del recorrido que estaban alejados de las vías por siete hitos colocados sobre los segmentos viales configurados. El circuito sigue siendo esquemático y debe contrastarse con el recorrido GPS real.
- El mapa mantiene visibles la línea del circuito y sus paradas numeradas; los controles muestran ambos, calor o puntos de reportes.
- Se corrigió la validación cartográfica para comprobar proximidad a la cuadra asignada, no a cualquier vía cercana.
- Se eliminó la limpieza automática de reportes locales al iniciar la aplicación, evitando borrar IDs con prefijo ASO.
- Se reforzó la validación de fechas y coordenadas en importaciones JSON y se protegió la importación ante fallos al recalcular criticidad.
- Se actualizó la versión de recursos locales para evitar que el navegador reutilice archivos JavaScript y CSS antiguos.
- Se mantuvieron las 30 evidencias como galería independiente; no se les asignan ubicaciones individuales ni puntajes inventados.

Las pruebas de esta actualización verifican sintaxis, integridad de IDs del HTML, existencia de archivos fotográficos, cálculos de criticidad, filtros y validaciones de importación. No sustituyen la comprobación visual final en un navegador real.


## 6. Ajustes adicionales de validación — 27 de noviembre de 2026

- La validación de ubicación ahora mantiene un único mensaje de error y diferencia entre ausencia de punto y distancia fuera de tolerancia.
- La tolerancia respecto al segmento de vía de referencia se ajustó a 30 m. Sigue siendo una aproximación geométrica y no equivale a verificar el polígono real de la calzada.
- Los paneles de filtros y ranking se muestran cuando existen reportes válidos; se mantienen ocultos si el conjunto está vacío.


## 9. Corrección cartográfica y versión 0.9.1 — 27 de noviembre de 2026

- Se alineó el recorrido con cuatro tramos del croquis: Calle 29H, Carrera 21C, Calle 29J y Carrera 21D.
- Se afinó y transparentó la línea verde para mantener visibles las calles y etiquetas del mapa.
- Las 30 evidencias se distribuyen sectorialmente: 5 sobre Calle 29H y 25 en los tres tramos del parque. Se conserva `ubicacion: null`; `ubicacion_aproximada` no se presenta como GPS individual.
- La geometría se calibró con referencias ATESA de Calle 29H y Parque Villa Marbella y con el croquis satelital del equipo.


## 10. Corrección de inicialización del mapa de calor — versión 0.9.1.1

Se impide crear la capa Leaflet.heat cuando el contenedor del mapa Registros tiene ancho o alto cero (al cargar la aplicación con esa pestaña oculta). La capa se construye al abrir la pestaña y recalcular el mapa después de invalidateSize(). Esto evita que Leaflet.heat ejecute getImageData() sobre un canvas sin dimensiones y bloquee el resto de la aplicación.


## 11. Ajuste fino de calzadas y mapa de calor — versión 0.9.1.2

- Se desplazó el trazado y las 30 posiciones sectoriales aproximadamente 2,8 m hacia el sur de la vista para centrarlos mejor sobre la calzada, manteniendo la forma de cada curva y giro.
- Se redujo el grosor y la opacidad de la línea de recorrido.
- Se redujeron radio y desenfoque de Leaflet.heat para que la concentración no se extienda tanto sobre las manzanas.
- Se conservaron 5 puntos en Calle 29H y 25 en las vías interiores de Villa Marbella. Las ubicaciones siguen identificadas como aproximadas, no GPS individual.


## 12. Ajuste de visualización sobre red vial — versión 0.9.1.3

- Se incorporó un ajuste cartográfico opcional del circuito mediante OSRM y la red vial de OpenStreetMap.
- La solicitud utiliza los vértices del recorrido en su orden original para conservar la secuencia de calles y los giros del circuito.
- Se limita el ajuste a 22 m por punto de paso. La geometría vial solo sustituye la línea manual si todos los puntos fueron ajustados dentro de esa tolerancia y el servicio devuelve una ruta completa.
- La línea manual se dibuja de inmediato y permanece como respaldo cuando no hay internet, falla el servicio o no se obtiene una geometría válida.
- La geometría ajustada se almacena localmente durante un máximo de 30 días para reducir solicitudes repetidas.
- El ajuste mejora la coincidencia visual con la cartografía vial, pero no convierte los puntos sectoriales en GPS reales ni acredita el recorrido exacto del trabajo de campo.
- La disponibilidad y coincidencia visual del servicio externo deben verificarse en navegador al abrir la aplicación publicada.
