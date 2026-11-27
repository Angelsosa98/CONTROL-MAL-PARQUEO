# Control Vial Santa Marta — Detección y Criticidad de Mal Parqueo

Aplicación web estática desarrollada con HTML, CSS, JavaScript y Leaflet para registrar, georreferenciar y priorizar incidencias de mal parqueo e invasión del espacio público en el entorno de la Universidad del Magdalena, Villa Marbella y el semáforo de Cañaveral, en Santa Marta, Colombia.

**Despliegue:** https://angelospinososa-del.github.io/CONTROL-MAL-PARQUEO/

## Alcance del estudio

La versión activa del sistema contiene **10 cuadras configuradas y 24 reportes de campo**. El alcance se limita a:

- Carrera 32 entre Calles 22 y 29, frente al entorno universitario y Villa Marbella.
- Vías internas de Villa Marbella entre Carreras 31 y 32.
- Intersección de Calle 29 / Avenida del Ferrocarril, sector semáforo de Cañaveral.

Los registros MP-ASO-001 a MP-ASO-023 y MP-ASO-030 conforman el conjunto activo. Los registros del Mercado Público (MP-ASO-024 a MP-ASO-029) no forman parte de este análisis. Sus archivos fotográficos se conservan en el repositorio como material histórico y no se cargan en la aplicación.

## Equipo de trabajo

| Integrante | Rol |
|---|---|
| Angel Sosa Ospino | Integración del mapa y lógica de clasificación |
| Adrian Jose Marquez Orozco | Lógica y clasificación |
| Johan David Acosta Peñaloza | Análisis de campo |
| Josue David Rodriguez | Mapa de calor y filtros |

## Funcionalidades

- Captura de reportes mediante selección en mapa o GPS.
- Asignación automática de cuadra por proximidad a las vías configuradas.
- Validación geográfica: el punto debe estar dentro del área del estudio y a no más de 90 m de la cuadra asignada.
- Clasificación de criticidad según categoría, tipo de vía y franja horaria.
- Evidencia fotográfica opcional con herramienta de pixelado.
- Almacenamiento local, exportación e importación JSON y paquete ZIP.
- Mapa de calor, filtros multicriterio y resumen operativo Top 5.

## Criterios de criticidad

El puntaje se calcula como:

`Puntaje = Peso(Categoría) + Peso(Tipo de vía) + Peso(Franja horaria)`

Los rangos configurados son Bajo (0–4), Medio (5–6) y Alto (7–9). Los pesos y las franjas pico se administran en `datos/criterios.json`.

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
│   └── fotos/                 # Evidencias fotográficas conservadas
└── documentos/
    ├── anexo-campo.md
    ├── arquitectura.md
    └── bitacora-ingenieria.md
```

## Ejecución y pruebas

La aplicación debe abrirse desde un servidor HTTP local (por ejemplo, Live Server en VS Code) o desde GitHub Pages, porque carga archivos JSON mediante `fetch`.

Para revisar el motor de criticidad, abre `pruebas.html` en el navegador y verifica los resultados de la suite.