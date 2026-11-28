# Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo

Aplicación web estática desarrollada con HTML, CSS, JavaScript y Leaflet para registrar reportes de mal parqueo, georreferenciarlos y calcular su criticidad en el entorno de la Universidad del Magdalena, Villa Marbella y Cañaveral, Santa Marta, Colombia.

**Publicación:** GitHub Pages se administra desde la configuración de este repositorio. La dirección activa debe consultarse en `Settings → Pages`.

## Estado real de los datos

- `datos/reportes.json` contiene actualmente **0 reportes precargados**.
- `datos/evidencias_nuevas.json` contiene **30 fotografías** conservadas para revisión.
- Las 30 fotografías se conservan en la galería con metadatos de ubicación sectorial aproximada. Esas coordenadas no se dibujan como puntos en el mapa ni se utilizan para generar el mapa de calor; no son coordenadas GPS individuales.
- Las coordenadas y puntajes sintéticos anteriores fueron retirados del archivo de evidencias.
- Las fotografías se consultan únicamente en la galería Evidencias. Los marcadores y el mapa de calor de Registros usan exclusivamente reportes reales con nivel de criticidad válido (Alto, Medio o Bajo). Si todavía no hay reportes clasificados, el mapa no muestra puntos ni calor; conserva el recorrido de campo como referencia.
- Los seis registros históricos del Mercado Público no forman parte del conjunto activo.

**Importante:** la configuración de 10 cuadras en `datos/vias.json` utiliza segmentos de referencia aproximados. El límite de 30 m comprueba distancia a esos segmentos, no demuestra que el punto esté sobre la calzada. Antes de usar los registros como evidencia espacial del estudio, deben verificarse las geometrías viales y los puntos con cartografía y trabajo de campo.

## Funcionalidades

- Captura de reportes mediante selección en mapa o GPS.
- Asignación de cuadra por proximidad a segmentos configurados.
- Validación de límites del área y distancia máxima al segmento asignado.
- Clasificación de criticidad según categoría, tipo de vía y franja horaria.
- Evidencia fotográfica opcional y herramienta de pixelado.
- Almacenamiento local, exportación e importación JSON y paquete ZIP.
- Mapa de puntos y mapa de calor basados exclusivamente en reportes con coordenadas y clasificación válida Alto, Medio o Bajo.
- Línea verde del circuito aproximado del equipo. Con conexión, intenta ajustar la geometría a la red vial de OpenStreetMap mediante OSRM; si el servicio no responde o no logra un ajuste cercano, conserva el trazado manual.
- Galería independiente de evidencias fotográficas.

## Capas del mapa

Los mapas de Captura y Registros permiten alternar entre mapa de calles de OpenStreetMap, satélite sin rótulos y satélite con la capa transparente World Transportation de Esri, que agrega referencias de carreteras y nombres de vías. En Registros hay una casilla independiente para mostrar u ocultar únicamente la línea verde del recorrido. Las capas externas requieren conexión a internet y conservan sus atribuciones.

## Recorrido cartográfico\n\nEl circuito se dibuja directamente con la geometría manual reconstruida a partir de la referencia satelital del equipo. Incluye el recorrido exterior y tres tramos transversales interiores de Villa Marbella. No se usa enrutamiento automático para evitar que un servicio externo cambie el camino realizado por el equipo. La geometría es una referencia cartográfica aproximada, no un levantamiento GPS.\n\n## Criterios de criticidad

`Puntaje = Peso(Categoría) + Peso(Tipo de vía) + Peso(Franja horaria)`

Los rangos configurados son Bajo (0–4), Medio (5–6) y Alto (7–9). Los pesos y las franjas pico se administran en `datos/criterios.json`. Estos criterios solo se aplican a reportes con sus datos completos; no se asignan a fotografías sin clasificación verificada.

## Estructura

```text
CONTROL-MAL-PARQUEO/
├── index.html
├── estilos.css
├── captura.js
├── mapa.js
├── almacenamiento.js
├── criticidad.js
├── filtros.js
├── resumen.js
├── pruebas.html
├── datos/
│   ├── criterios.json
│   ├── vias.json
│   ├── reportes.json
│   ├── evidencias_nuevas.json
│   └── fotos/
└── documentos/
    ├── anexo-campo.md
    ├── arquitectura.md
    └── bitacora-ingenieria.md
```

## Ejecución y pruebas

Abrir desde un servidor HTTP local (por ejemplo, Live Server en VS Code) o GitHub Pages, porque la aplicación carga archivos JSON mediante `fetch`.

Para revisar el motor de criticidad, abrir `pruebas.html` y verificar los casos de prueba. La validación visual integral de mapas, filtros y captura debe realizarse también en navegador.


### Ajuste de puntos y mapa satelital — versión 0.9.1.7

- El mapa inicia en la vista "Puntos" para evitar que el mapa de calor oculte los marcadores y las calzadas.
- La capa transparente de calles y rótulos de Esri se sirve desde `server.arcgisonline.com`.
- Al cargar evidencias, el navegador consulta geometrías viales de OpenStreetMap mediante Overpass y proyecta cada punto al segmento vial más cercano si está a 35 m o menos.
- Si la consulta falla o no hay una vía próxima dentro del umbral, se conserva la coordenada sectorial aproximada original.
- Se eliminó el texto informativo duplicado que aparecía debajo del mapa.
- Las coordenadas ajustadas son referencias cartográficas aproximadas y no GPS individuales de las fotografías.


### Geometría vial del recorrido — versión 0.9.1.8

La línea verde se ajusta a la red vial mediante geometrías de OSRM, conservando el orden de los puntos de control del recorrido manual. El circuito exterior y cada ramal interior se procesan por separado para evitar conexiones inventadas entre tramos. La línea manual aparece primero y se conserva como respaldo si el servicio no está disponible. Este ajuste afecta exclusivamente a la visualización del recorrido; las 30 fotografías permanecen en su galería y no se dibujan como puntos en el mapa.


### Recorrido original y posiciones de toma fotográfica — versión 0.9.1.9

- Se conserva únicamente el trazado original: acceso por Calle 29H y circuito perimetral de Villa Marbella.
- Se eliminaron los tres tramos internos y el ajuste automático OSRM del recorrido.
- Las 30 evidencias se ubican como posiciones aproximadas desde donde se tomaron las fotografías: 5 en el tramo de acceso y 25 sobre el recorrido perimetral. No representan la ubicación exacta de los vehículos observados a distancia ni GPS individuales.
- No se agregan líneas ni marcadores adicionales en las calles interiores.


### Restauración de posiciones de evidencias — versión 0.9.1.10

Se recuperan las 30 posiciones sectoriales que estaban en la configuración de evidencias de la versión 0.9.1.7. Se conserva el ajuste cartográfico de marcadores a las calzadas de OpenStreetMap y la capa satelital con calles. La visualización de la línea verde sigue limitada al trazado original exterior; no se dibujan los tramos interiores adicionales ni se calcula una ruta alternativa.


### Retiro de la capa Satélite + calles — versión 0.9.1.11

Se eliminó la opción combinada Satélite + calles y su tesela transparente de referencia, que no se visualizaba correctamente. Se mantienen únicamente las capas independientes Satélite y Mapa de calles. El mapa abre en Satélite sin superposiciones.


### Recuperación de las tres líneas intermedias originales — versión 0.9.1.12

Se conservó sin cambios el trazado exterior original y se recuperaron únicamente los tres segmentos transversales interiores desde la geometría histórica del recorrido compartida por el equipo. Cada segmento se dibuja de forma independiente, sin cerrar circuitos ni crear ramales adicionales. No se modificaron las 30 evidencias.


### Recorrido trazado desde las evidencias 0.9.1.7 — versión 0.9.1.13

Las coordenadas de las 30 evidencias se mantienen intactas. La línea exterior se construye en el orden EVID-001 a EVID-009 y EVID-025 a EVID-030; las tres líneas interiores se construyen, por separado, con EVID-010 a EVID-014, EVID-015 a EVID-019 y EVID-020 a EVID-024. Así, cada línea verde sigue la misma secuencia de posiciones aproximadas que muestran los puntos morados. No se crean puntos nuevos ni se calculan rutas automáticas.


### Texto neutral de evidencias — versión 0.9.1.14

Se retiró de las 30 fichas el texto de pendiente de ubicación y clasificación. Cada ficha indica únicamente que es una fotografía de evidencia asociada al punto sectorial aproximado mostrado en el mapa. No se asignan todavía carreras ni niveles de clasificación; esos datos se completarán cuando el equipo confirme la correspondencia de cada punto.


### Ajuste robusto de puntos a calles — versión 0.9.1.15

Se amplió la consulta de geometría vial a tres servidores Overpass alternativos y se incluyeron más clases de vías urbanas. Cada punto del mapa se proyecta al segmento de calle más cercano hasta 80 m; se mantienen intactas las coordenadas sectoriales originales de las evidencias. Si todos los servicios fallan, la aplicación conserva los puntos originales y registra una advertencia en consola.


## Zonificación y validación geográfica del trabajo de campo

La zonificación preliminar se divide en tres áreas: Z1, corredor de acceso; Z2, Parque Villa Marbella y entorno; y Z3, vías circundantes. Según el equipo de campo, la mayor concentración de vehículos mal estacionados se observó en Z2, tanto en las calles perimetrales como en las vías interiores. Este hallazgo es cualitativo: no se asignan cantidades por zona ni zonas individuales a los registros EVID hasta verificar cada ubicación. Las 30 fichas conservan referencias sectoriales aproximadas comunicadas por el equipo, pero no se trazan como puntos de vehículo ni alimentan el mapa de calor. El recorrido del equipo se mantiene como geometría independiente.


### Ajuste visual de marcadores a calzadas — versión 0.9.1.16

Histórico de la versión 0.9.1.16: se probó la proyección visual de marcadores de evidencias a la vía OSM más cercana. Esta representación fue retirada del mapa en la versión 0.9.1.37 porque las fotografías no tienen clasificación de criticidad y no deben alimentar el mapa de calor.

## Captura en otros sectores de Santa Marta — versión 0.9.1.36

La captura tiene dos ámbitos seleccionables:

- **Área de estudio:** conserva la asignación a las cuadras configuradas, el rectángulo geográfico y la tolerancia de 30 m respecto a los segmentos de referencia.
- **Otros sectores de Santa Marta:** permite ubicar el reporte mediante GPS, buscador o toque en el mapa, sin exigir que pertenezca al rectángulo de Universidad del Magdalena y Villa Marbella. El operador debe seleccionar vía arterial o secundaria y puede indicar un barrio o referencia.

Los reportes externos se guardan con el ámbito, el tipo de vía y la referencia opcional. Se incluyen en los mapas, lista, filtros, cálculo de criticidad y exportaciones/importaciones JSON y ZIP. El filtro de análisis permite separar ambos ámbitos. El Top 5 agrupa los reportes externos por tipo de vía, no por barrio.

**Limitaciones:** todavía no existe un polígono oficial de Santa Marta para validar automáticamente el límite municipal. El tipo de vía externo se declara manualmente. Los reportes se guardan localmente en el navegador y no se sincronizan automáticamente entre dispositivos; usa exportación/importación para compartirlos.

## Registro de incidencias

Los problemas detectados durante el desarrollo y su estado se documentan en [documentos/registro-incidencias.md](documentos/registro-incidencias.md). La bitácora técnica de cambios se encuentra en [documentos/bitacora-ingenieria.md](documentos/bitacora-ingenieria.md).

### Separación de evidencias y reportes clasificados — versión 0.9.1.37

- Se retiraron del mapa los 30 marcadores morados y la capa de calor construida a partir de fotografías.
- Las 30 fotografías permanecen disponibles en la galería; sus archivos y metadatos no se eliminaron.
- La leyenda cartográfica muestra el recorrido de campo y los tres niveles de reportes: Alto, Medio y Bajo.
- Los puntos individuales y el mapa de calor se generan exclusivamente con reportes que tengan un nivel de criticidad válido.
- La intensidad térmica usa la categoría: Alto = 1.00 (rojo), Medio = 0.65 (ámbar) y Bajo = 0.30 (verde).
- Los reportes sin clasificación válida no se representan como Bajo.
- Si no hay reportes clasificados, no se crea una capa de calor. El mapa encuadra el recorrido de campo.
- La geometría verde, los 30 registros fotográficos, sus ubicaciones guardadas y las funcionalidades de captura/importación/exportación permanecen sin cambios.