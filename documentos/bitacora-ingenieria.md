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


## 13. Reconstrucción según referencia satelital del equipo — versión 0.9.1.4

- Se retiró el enrutamiento automático OSRM incorporado en la versión 0.9.1.3 porque podía sustituir el recorrido realizado por el equipo por una ruta vehicular distinta.
- Se conservó la geometría manual del recorrido exterior, que coincide con el trazo perimetral marcado en la referencia satelital.
- Se añadieron tres tramos transversales interiores de Villa Marbella como líneas independientes, para conservar su forma sin crear conexiones no verificadas.
- Los tramos interiores se reconstruyeron visualmente tomando como referencia la imagen satelital y la geometría exterior existente; sus coordenadas son aproximadas y no GPS individual.
- Las 30 evidencias, sus estados y su distribución sectorial se mantienen sin cambios.
- La verificación visual final debe hacerse sobre el mapa publicado y compararse con la referencia satelital suministrada por el equipo.


## 14. Selector de mapas base — versión 0.9.1.5

- Se incorporó un control de capas en las vistas Captura y Registros.
- El usuario puede alternar entre mapa de calles de OpenStreetMap e imagen satelital de Esri World Imagery.
- En Registros se agregó la opción para mostrar u ocultar el recorrido de campo de forma independiente.
- La cartografía satelital se carga desde un servicio externo y requiere conexión a internet.
- Se incorporó la atribución de Esri, Vantor, Earthstar Geographics y GIS User Community según los metadatos del servicio.
- La distribución de evidencias permanece pendiente de ajustar sobre la geometría definitiva que entregará el equipo.


## 15. Calles sobre satélite, control del recorrido y redistribución de evidencias — versión 0.9.1.6

- Se incorporó la capa transparente World Transportation de Esri sobre World Imagery para visualizar trazos viales y rótulos de calles sobre la imagen satelital. Se conservan las capas Mapa de calles y Satélite sin rótulos como alternativas.
- En la vista Registros se agregó una casilla visible e independiente para mostrar u ocultar únicamente las líneas verdes del recorrido; la capa de puntos y el mapa de calor no dependen de esta opción.
- Se redistribuyeron las 30 ubicaciones sectoriales aproximadas: 5 en Calle 29H y 25 en el sector Villa Marbella, repartidas entre el borde occidental, tres tramos internos, el borde sur y el borde oriental.
- Se aplicaron intervalos desiguales y desplazamientos laterales pequeños para evitar que los marcadores aparezcan como una fila perfectamente alineada.
- Se mantiene `ubicacion: null` en todas las evidencias: las nuevas posiciones son aproximaciones cartográficas para visualización y no GPS individuales ni ubicaciones verificadas de cada fotografía.


## 17. Corrección de puntos sobre calzadas y mapa satelital — versión 0.9.1.7

- Se corrigió el host de teselas de World Transportation de Esri a `server.arcgisonline.com` para superponer calles y rótulos sobre World Imagery.
- El mapa de registros inicia en modo "Puntos" para evitar que el mapa de calor cubra las calzadas y los marcadores.
- Se incorporó consulta de geometrías de vías de OpenStreetMap mediante Overpass. Cada marcador se proyecta al segmento vial más cercano cuando la distancia no supera 35 m.
- Si el servicio no responde o no hay geometría vial dentro del umbral, se conserva la ubicación sectorial aproximada de origen.
- Se eliminó el texto informativo duplicado que aparecía debajo del mapa.
- Las ubicaciones continúan siendo aproximadas y no se consideran GPS individuales de las fotografías.


## 18. Ajuste de línea del recorrido a la red vial — versión 0.9.1.8

- Se modificó únicamente la geometría visual de la línea verde del recorrido.
- Cada tramo utiliza sus puntos de control manuales en el orden definido y solicita al servicio OSRM la geometría vial entre ellos.
- El circuito exterior y los tres ramales interiores se procesan por separado, sin conectar segmentos independientes.
- La línea manual se dibuja de inmediato y permanece como respaldo si el servicio no responde o no encuentra una ruta válida.
- No se modificaron las 30 evidencias, sus coordenadas sectoriales, ni el ajuste de marcadores a las calzadas.


## 18. Restauración del recorrido original — versión 0.9.1.9

- Se retiraron los tres tramos interiores adicionales de Villa Marbella.
- Se eliminó el ajuste automático OSRM de la línea de recorrido para conservar exclusivamente la geometría original trazada por el equipo.
- La línea verde representa solo el acceso por Calle 29H y el circuito perimetral original alrededor de Villa Marbella.
- Se reubicaron las 30 evidencias como posiciones aproximadas desde donde se tomaron las fotografías: 5 en el tramo de acceso y 25 sobre el circuito perimetral. Las fotografías pueden mostrar vehículos observados a distancia, por lo que el marcador no pretende representar la ubicación exacta del vehículo.
- Se mantienen las evidencias originales y su carácter aproximado; no se inventan GPS individuales.


## 19. Recuperación de posiciones de evidencias de 0.9.1.7 — versión 0.9.1.10

- Se restauró el archivo de 30 evidencias desde el commit de la configuración 0.9.1.7, recuperando las posiciones sectoriales que la usuaria identificó como correctas.
- Se conservó el ajuste cartográfico a calzadas OSM y la capa satelital con calles.
- La función de dibujo de recorrido se mantiene limitada a `recorrido_campo.trazado`, sin dibujar `tramos_internos` ni solicitar rutas OSRM.
- No se modificó la geometría original exterior del recorrido.
- Las posiciones siguen siendo aproximadas; no se presentan como GPS individuales.


## 20. Retiro de Satélite + calles — versión 0.9.1.11

- Se eliminó la capa combinada Satélite + calles y la llamada a World Transportation de Esri.
- Se mantienen las opciones independientes Satélite (imagen Esri) y Mapa de calles (OpenStreetMap).
- El mapa abre en Satélite sin superposiciones.
- No se modificaron las 30 evidencias, sus posiciones, el ajuste de marcadores a calles ni la geometría del recorrido original.


## 21. Recuperación de tres segmentos transversales originales — versión 0.9.1.12

- Se recuperaron exactamente los tres tramos transversales interiores desde la versión histórica de `datos/vias.json` que contenía el recorrido dibujado por el equipo.
- Se mantuvo intacto el trazado exterior original de 27 coordenadas.
- `dibujarRecorridoCampo` dibuja el perímetro como una línea y cada uno de los tres segmentos interiores como polilíneas independientes.
- No se generan circuitos cerrados, diagonales, ramales ni rutas automáticas adicionales.
- No se modificaron las 30 evidencias ni sus ubicaciones aproximadas.
