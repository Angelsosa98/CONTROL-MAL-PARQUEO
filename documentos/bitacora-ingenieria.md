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


## 22. Recorrido construido desde el orden de evidencias — versión 0.9.1.13

- Se confirmó que `datos/evidencias_nuevas.json` conserva exactamente las 30 posiciones históricas de la versión 0.9.1.7; el archivo no se modificó.
- Se reconstruyó la geometría de la línea exterior usando, en orden, EVID-001 a EVID-009 y EVID-025 a EVID-030.
- Se reconstruyeron los tres segmentos interiores como polilíneas independientes: EVID-010 a EVID-014, EVID-015 a EVID-019 y EVID-020 a EVID-024.
- No se agregaron ni movieron puntos, no se usó enrutamiento automático y las coordenadas continúan siendo aproximadas.


## 23. Limpieza de texto de fichas de evidencia — versión 0.9.1.14

- Se actualizaron las descripciones de las 30 evidencias para retirar el mensaje de pendiente de ubicación y clasificación.
- El nuevo texto solo indica que la fotografía está asociada al punto sectorial aproximado representado en el mapa.
- No se modificaron coordenadas, puntos, vías ni recorrido.
- No se asignaron carreras ni niveles de clasificación sin validación de la usuaria.


## 24. Consulta vial redundante y ajuste de marcadores — versión 0.9.1.15

- Se añadieron tres servidores Overpass en orden de respaldo para evitar depender de un único endpoint.
- Se amplió la consulta a más clases de vías urbanas y el área de consulta.
- Se amplió de 35 m a 80 m la distancia máxima para proyectar visualmente el marcador a la vía más cercana.
- La proyección solo cambia la posición visual del marcador y la capa de calor en el mapa; no modifica las coordenadas sectoriales guardadas en `datos/evidencias_nuevas.json`.
- Si todos los servidores fallan, se conservan las ubicaciones originales y se deja una advertencia técnica en consola.


## 25. Criterio de zonificación de campo y validación geográfica

- Se incorporó una zonificación preliminar: Z1 corredor de acceso; Z2 Parque Villa Marbella y entorno; Z3 vías circundantes.
- Se registró el reporte cualitativo del equipo de que la mayor concentración de vehículos se observó en Z2, tanto alrededor del parque como en sus vías interiores.
- No se distribuyeron numéricamente los 30 registros entre zonas ni se asignaron calles/carreras individuales sin validación.
- Se estableció que cada EVID representa la ubicación aproximada de un vehículo mal estacionado identificado durante el recorrido, no la posición del fotógrafo.
- Se estableció que el recorrido del equipo y las ubicaciones de los vehículos son capas independientes.
- Se preservaron las coordenadas originales y se definió que cualquier ajuste cartográfico debe vincularse al segmento vial confirmado, no solo a la proximidad geométrica.


## 26. Ajuste visual de puntos sobre vías — versión 0.9.1.16

- Se sustituyó el límite de ajuste visual de 80 m por una proyección al segmento OSM geométricamente más cercano cuando hay geometría vial disponible.
- El ajuste afecta únicamente a la posición visual del marcador y del mapa de calor.
- Se preservan intactas las coordenadas originales en `ubicacion_aproximada`.
- Se guardan en memoria de ejecución la distancia del ajuste y el ID del segmento OSM para revisión; no se presentan como coordenadas GPS validadas.
- Si falla la consulta de calles, se mantienen visibles las ubicaciones aproximadas originales y se informa en consola.
- No se modificaron las 30 evidencias, la zonificación ni el recorrido del equipo.

## 27. Captura en el área de estudio y en otros sectores de Santa Marta — versión 0.9.1.36

- Se incorporó un selector de ámbito en la captura. El modo predeterminado sigue siendo **Área de estudio (Universidad del Magdalena y Villa Marbella)**; el segundo modo es **Otros sectores de Santa Marta**.
- El modo del área de estudio conserva la validación existente: límites geográficos configurados, asignación a una de las cuadras incluidas y tolerancia de 30 m respecto al segmento de referencia.
- El modo de otros sectores permite elegir la ubicación por GPS, búsqueda de dirección o toque en el mapa, sin aplicar el rectángulo ni la distancia de las cuatro vías del estudio.
- Para los reportes externos, el operador debe seleccionar explícitamente **vía arterial** o **vía secundaria**. El barrio, sector o referencia es opcional (máximo 90 caracteres). La aplicación no infiere la categoría vial ni afirma que el punto corresponda a una vía oficial concreta.
- Los reportes externos se almacenan con los campos ambito, tipo_via_reporte y sector_referencia, y usan identificadores técnicos diferenciados para arterial y secundaria. El cálculo de criticidad usa el peso de vía seleccionado y mantiene los pesos de categoría y franja horaria existentes.
- Los reportes externos se dibujan en los mapas de Captura y Registros, aparecen en la lista y pueden filtrarse por ámbito. Las exportaciones JSON y ZIP y la importación conservan los campos del nuevo modo.
- Se corrigió el buscador para que, en el modo externo, no limite sus resultados al pequeño rectángulo del área de estudio. Al limpiar un formulario o cambiar a modo externo, se borra el tipo de vía anterior para evitar heredarlo accidentalmente en el siguiente reporte.
- Se agregó el filtro de ámbito: todos, área de estudio u otros sectores. En el resumen Top 5, los reportes externos se agrupan por clase de vía (arterial/secundaria); no constituyen un ranking separado por barrio.
- No se modificaron datos/vias.json, datos/evidencias_nuevas.json, las 30 fotografías, los puntos morados ni la geometría del recorrido verde durante esta implementación.
- La aplicación sigue siendo estática y guarda reportes localmente en el navegador. Para trasladarlos a otro equipo se requiere exportar e importar JSON/ZIP; no existe sincronización central automática.
- Se amplió pruebas.html con un caso de criticidad para reporte externo y un caso de rechazo de tipo de vía inválido. Se ejecutaron validaciones de sintaxis y pruebas programáticas de cálculo, importación, exportación de campos, filtros, aparición en mapas y agrupación; todos los casos comprobados pasaron.
- **Limitación pendiente:** no se ha incorporado un polígono oficial de Santa Marta. El modo externo valida coordenadas dentro de los rangos globales de latitud/longitud y exige declarar el tipo de vía, pero corresponde al operador verificar que el punto sí esté dentro del municipio y sea correcto.

## 28. Separación cartográfica de evidencias y reportes clasificados — versión 0.9.1.37

- Se identificó que `actualizarMarcadoresEvidencias` construía una capa de 30 puntos morados y una capa de calor con intensidad constante 1.0, independiente de la criticidad. Esa capa podía saturar el mapa en rojo aunque las fotografías no fueran reportes clasificados.
- Se retiró la capa de marcadores de evidencias y su capa de calor. La leyenda ya no incluye “30 evidencias (aprox.)”; conserva el recorrido y Reportes altos, medios y bajos.
- Las fotografías se mantienen en la galería y en `datos/evidencias_nuevas.json`. No se borraron ni se modificaron sus coordenadas guardadas.
- `actualizarMarcadoresRegistros` ahora dibuja solo reportes con `criticidad.nivel` válido: Alto, Medio o Bajo. Los reportes sin nivel válido se omiten, en vez de clasificarse implícitamente como Bajo.
- La intensidad del calor se asigna por nivel: Alto 1.00 (rojo), Medio 0.65 (ámbar) y Bajo 0.30 (verde). Si no hay reportes clasificados no se crea capa térmica y el mapa encuadra la geometría del recorrido.
- Se conservan los modos de visualización: Puntos, Mapa de calor y Ambos; ahora alternan únicamente marcadores y calor de reportes.
- Se verificó sintaxis de `mapa.js` y `captura.js`; prueba programática con datos simulados confirmó que las 30 evidencias no crean marcadores, los tres niveles producen sus colores e intensidades, registros sin clasificación se omiten, los modos de capas funcionan y una lista vacía no crea calor.
- Se confirmó que la galería de 30 fotografías, el recorrido exterior y los tres tramos interiores permanecen presentes. No se modificó `datos/vias.json` ni `datos/evidencias_nuevas.json`.

## 29. Recuperación de puntos y clasificación visual de evidencias — versión 0.9.1.39

- Se revisó que las 30 fichas fotográficas conservaban sus coordenadas aproximadas pero el mapa dejó de dibujarlas en 0.9.1.37. La ausencia era consecuencia de haber retirado completamente su capa de marcadores.
- Se inspeccionaron las 30 imágenes originales. Se añadió el objeto `clasificacion_visual_preliminar` a cada evidencia, incluyendo nivel, tipo de obstrucción observado, confianza y observación.
- Clasificación orientativa resultante: 9 Alto, 16 Medio y 5 Bajo. El nivel se basa en la obstrucción visible (por ejemplo, ocupación del andén, borde/calzada o infraestructura ciclista) y no constituye una determinación legal ni el cálculo formal de criticidad.
- Se confirmó que las 30 fichas no tienen fecha/hora. No se inventó la franja horaria ni se rellenó `fecha_hora`; los niveles visuales se guardan en un campo separado de `criticidad`.
- Se recuperaron los 30 marcadores usando `ubicacion_aproximada` sin recalcular, desplazar ni sobrescribir latitud/longitud. Los puntos se incorporan a la capa de marcadores y al calor con intensidades Alto 1.00, Medio 0.65 y Bajo 0.30.
- Los popups identifican el origen fotográfico y advierten que el nivel es preliminar. Los reportes reales conservan su criticidad formal; las evidencias no se incorporan a la lista de reportes, estadísticas ni Top 5.
- Se simplificó la leyenda a Recorrido de campo, Alto, Medio y Bajo.
- Prueba programática con Leaflet simulado: se dibujan 30 marcadores únicos y 30 puntos térmicos; se verificaron los conteos 9/16/5, colores e intensidades; se comprobó que las coordenadas coinciden exactamente con el JSON; Puntos/Calor alternan correctamente y la galería sigue disponible.
- No se modificaron la geometría del recorrido en `datos/vias.json`, ni la galería, los nombres de archivo o los identificadores de las fotos.