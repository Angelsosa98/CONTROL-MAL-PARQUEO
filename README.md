# Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo

Aplicación web estática desarrollada con HTML, CSS, JavaScript y Leaflet para registrar reportes de mal parqueo, georreferenciarlos y calcular su criticidad en el entorno de la Universidad del Magdalena, Villa Marbella y Cañaveral, Santa Marta, Colombia.

**Publicación:** GitHub Pages se administra desde la configuración de este repositorio. La dirección activa debe consultarse en `Settings → Pages`.

## Estado real de los datos

- `datos/reportes.json` contiene actualmente **0 reportes precargados**.
- `datos/evidencias_nuevas.json` contiene **30 fotografías** conservadas para revisión.
- Las 30 fotografías se muestran con ubicación sectorial aproximada: 5 sobre Calle 29H y 25 en Carrera 21C, Calle 29J y Carrera 21D alrededor de Villa Marbella. No son coordenadas GPS individuales.
- Las coordenadas y puntajes sintéticos anteriores fueron retirados del archivo de evidencias.
- Las fotografías se consultan en Evidencias y sus ubicaciones sectoriales aproximadas se muestran como 30 puntos y como mapa de calor. El calor resume la distribución aproximada de campo; no representa GPS exacto por vehículo ni puntajes de criticidad.
- Los seis registros históricos del Mercado Público no forman parte del conjunto activo.

**Importante:** la configuración de 10 cuadras en `datos/vias.json` utiliza segmentos de referencia aproximados. El límite de 30 m comprueba distancia a esos segmentos, no demuestra que el punto esté sobre la calzada. Antes de usar los registros como evidencia espacial del estudio, deben verificarse las geometrías viales y los puntos con cartografía y trabajo de campo.

## Funcionalidades

- Captura de reportes mediante selección en mapa o GPS.
- Asignación de cuadra por proximidad a segmentos configurados.
- Validación de límites del área y distancia máxima al segmento asignado.
- Clasificación de criticidad según categoría, tipo de vía y franja horaria.
- Evidencia fotográfica opcional y herramienta de pixelado.
- Almacenamiento local, exportación e importación JSON y paquete ZIP.
- Mapa de puntos y mapa de calor basados exclusivamente en reportes con coordenadas y datos completos.
- Línea verde del circuito aproximado del equipo. Con conexión, intenta ajustar la geometría a la red vial de OpenStreetMap mediante OSRM; si el servicio no responde o no logra un ajuste cercano, conserva el trazado manual.
- Galería independiente de evidencias fotográficas.

## Capas del mapa

Los mapas de Captura y Registros permiten alternar entre el mapa de calles de OpenStreetMap y la imagen satelital de Esri. En la vista Registros también se puede mostrar u ocultar el recorrido de campo sin ocultar las evidencias. La capa satelital requiere conexión a internet y conserva la atribución del proveedor.

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
