# Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo

Aplicación web estática con HTML, CSS, JavaScript y Leaflet para registrar reportes de mal parqueo, ubicarlos en el mapa y calcular su criticidad en Santa Marta, Colombia.

**Versión actual:** 0.9.1.40  
**Publicación:** GitHub Pages. La dirección activa y el estado de despliegue se consultan en la configuración y en Actions del repositorio.

## Estado actual de los datos

- `datos/reportes.json` contiene 0 reportes precargados. Los reportes nuevos se guardan en el almacenamiento local del navegador.
- `datos/evidencias_nuevas.json` contiene 30 fichas fotográficas: **9 en la calle de la Universidad del Magdalena y 21 en Villa Marbella**.
- Las fichas tienen ubicaciones sectoriales aproximadas, no coordenadas GPS individuales ni fecha/hora verificada.
- Cada fotografía tiene una valoración visual preliminar: **9 Alto, 16 Medio y 5 Bajo**. No es el índice formal de criticidad porque no se cuenta con franja horaria.
- El mapa muestra los puntos de vehículos y, por separado, el recorrido verde del equipo. El recorrido indica por dónde caminaron los observadores; los puntos indican dónde se observaron vehículos. No se deben mover los puntos para hacerlos coincidir con la ruta.
- El mapa de calor combina evidencias con valoración visual y reportes formales clasificados. Los popups identifican el origen de cada punto. Las fotografías no se incorporan a estadísticas ni al Top 5 de reportes.
- `datos/vias.json` contiene 14 vías: cuatro activas para la captura y diez registros históricos desactivados. Las vías desactivadas no aparecen en el buscador local.
- Los seis registros históricos del Mercado Público no forman parte del conjunto activo.

## Funcionalidades

- Captura por GPS, toque en mapa o búsqueda de dirección.
- Dos ámbitos de captura: área de estudio y otros sectores de Santa Marta.
- Asignación automática de cuadra y validación de proximidad a segmentos de referencia en el área de estudio.
- Cálculo formal de criticidad según categoría, tipo de vía y franja horaria para reportes completos.
- Evidencia fotográfica opcional y herramienta de pixelado.
- Almacenamiento local, exportación JSON/ZIP e importación JSON/ZIP.
- Mapa de puntos y mapa de calor con evidencias visuales preliminares y reportes formales, identificados en sus ventanas emergentes.
- Recorrido verde manual: trazado exterior y tres tramos interiores, independiente de las ubicaciones de vehículos.
- Galería independiente de las 30 fotografías.

## Criterios y límites metodológicos

`Puntaje = Peso(Categoría) + Peso(Tipo de vía) + Peso(Franja horaria)`

Los rangos son Bajo (0–4), Medio (5–6) y Alto (7–9), según `datos/criterios.json`. El cálculo formal requiere categoría, tipo de vía y fecha/hora. Las fotografías solo tienen niveles visuales preliminares y no se convierten en reportes formales.

Los segmentos de `datos/vias.json` son referencias aproximadas. La tolerancia de 30 m comprueba distancia a un segmento, pero no demuestra por sí sola que el punto esté dentro de la calzada. El modo externo tampoco tiene todavía un polígono municipal oficial de Santa Marta; el operador debe comprobar que el punto pertenece a la ciudad.

## Mapa y capas

Captura y Registros permiten alternar calles de OpenStreetMap y satélite Esri. En Registros hay una casilla independiente para mostrar u ocultar el recorrido verde. Las capas externas requieren conexión a internet y conservan sus atribuciones.

## Intercambio de datos

La aplicación guarda los reportes en el navegador local. No hay sincronización central automática entre dispositivos. Para reunir información de varios equipos, exporta JSON o ZIP e importa esos archivos en el otro equipo. El ZIP debe ser un paquete exportado por esta aplicación con `reportes.json` y su carpeta `fotos/`.

## Pruebas

- `pruebas.html`: siete casos del motor de criticidad.
- `pruebas-integracion.html`: siete casos de búsqueda de vías activas e importación ZIP.

Abrir las pruebas desde GitHub Pages o un servidor HTTP local. Las pruebas automatizadas no sustituyen una comprobación manual de GPS, mapas y almacenamiento en navegador.

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
├── pruebas-integracion.html
├── datos/
│   ├── criterios.json
│   ├── vias.json
│   ├── reportes.json
│   ├── evidencias_nuevas.json
│   └── fotos/
└── documentos/
    ├── anexo-campo.md
    ├── arquitectura.md
    ├── bitacora-ingenieria.md
    └── registro-incidencias.md
```

## Documentación y privacidad

La bitácora técnica está en `documentos/bitacora-ingenieria.md`; las incidencias y limitaciones conocidas, en `documentos/registro-incidencias.md`. El inventario CSV de fotografías se sincroniza con `datos/evidencias_nuevas.json`.

El repositorio es público. Algunas fotografías muestran placas legibles; las imágenes originales no se modificaron durante esta depuración. Antes de una difusión externa, anonimiza las placas y revisa los rostros identificables.

---

### Ajuste de puntos y mapa satelital — versión 0.9.1.7

- El mapa inicia en la vista "Puntos" para evitar que el mapa de calor oculte los marcadores y las calzadas.
- La capa transparente de calles y rótulos de Esri se sirve desde `server.arcgisonline.com`.
- Al cargar evidencias, el navegador consulta geometrías viales de OpenStreetMap mediante Overpass y proyecta cada punto al segmento vial más cercano si está a 35 m o menos.
- Si la consulta falla o no hay una vía próxima dentro del umbral, se conserva la coordenada sectorial aproximada original.
- Se eliminó el texto informativo duplicado que aparecía debajo del mapa.
- Las coordenadas ajustadas son referencias cartográficas aproximadas y no GPS individuales de las fotografías.


### Geometría vial del recorrido — versión 0.9.1.8

La línea verde se ajusta a la red vial mediante geometrías de OSRM, conservando el orden de los puntos de control del recorrido manual. El circuito exterior y cada ramal interior se procesan por separado para evitar conexiones inventadas entre tramos. La línea manual aparece primero y se conserva como respaldo si el servicio no está disponible. Este ajuste afecta exclusivamente a la visualización del recorrido; las 30 fichas fotográficas permanecen en su galería y sus ubicaciones sectoriales se muestran como puntos clasificados visualmente.


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

La zonificación preliminar se divide en tres áreas: Z1, corredor de acceso; Z2, Parque Villa Marbella y entorno; y Z3, vías circundantes. Según el equipo de campo, la mayor concentración de vehículos mal estacionados se observó en Z2, tanto en las calles perimetrales como en las vías interiores. Este hallazgo es cualitativo: no se asignan cantidades por zona ni zonas individuales a los registros EVID hasta verificar cada ubicación. Las 30 fichas conservan referencias sectoriales aproximadas comunicadas por el equipo y se muestran como puntos de severidad visual preliminar; sus niveles no son puntajes formales porque no existe fecha/hora. El recorrido del equipo se mantiene como geometría independiente.


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
- Los puntos de evidencias usan nivel visual preliminar; los puntos de reportes usan su criticidad formal. El calor combina ambas fuentes sin convertir las evidencias en reportes para estadísticas.
- La intensidad térmica usa la categoría: Alto = 1.00 (rojo), Medio = 0.65 (ámbar) y Bajo = 0.30 (verde).
- Los reportes sin clasificación válida no se representan como Bajo.
- Si no hay reportes clasificados, no se crea una capa de calor. El mapa encuadra el recorrido de campo.
- La geometría verde, los 30 registros fotográficos, sus ubicaciones guardadas y las funcionalidades de captura/importación/exportación permanecen sin cambios.

### Recuperación y clasificación visual preliminar de las 30 evidencias — versión 0.9.1.39

- Se recuperaron los 30 puntos usando las coordenadas sectoriales que ya estaban guardadas en `datos/evidencias_nuevas.json`; no se modificó ninguna latitud ni longitud.
- Se revisaron visualmente las 30 fotografías y se añadió a cada ficha `clasificacion_visual_preliminar`, con nivel Alto/Medio/Bajo, tipo de obstrucción observado, confianza y observación.
- Distribución visual preliminar: 9 Alto, 16 Medio y 5 Bajo.
- Los puntos de evidencias se muestran con los colores de los tres niveles. El mapa de calor recibe sus intensidades (Alto 1.00, Medio 0.65, Bajo 0.30) y también incorpora reportes reales con criticidad formal válida.
- Los mensajes emergentes identifican cada punto como evidencia fotográfica y aclaran que su nivel es preliminar. No se copian las evidencias a `reportes.json`, no entran a estadísticas ni al Top 5, y no se presentan como reportes ciudadanos.
- Las fichas no contienen fecha/hora (0 de 30); por tanto, no se calculó la franja pico/valle ni el puntaje formal completo. La valoración visual no es una determinación legal de infracción.
- La galería de fotos, sus identificadores, sus 30 posiciones sectoriales y el recorrido verde (trazado exterior y tres líneas interiores) permanecen intactos.