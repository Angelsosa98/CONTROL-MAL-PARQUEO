# Bitácora de Ingeniería y Ajustes ante Fallos de IA

**Equipo:** Angel Sosa Ospino (`ASO`), Adrian Jose Marquez Orozco (`AMO`), Johan David Acosta Peñaloza (`JAP`), Josue David Rodriguez (`JDR`)  
**Asignatura:** Ingeniería de Sistemas — Universidad del Magdalena  

---

## 1. Registro Cronológico de Desarrollo

| Fase | Actividad Principal | Responsables | Resultado Verificado |
| :---: | :--- | :--- | :--- |
| **1** | Definición del modelo de datos (`vias.json`, `criterios.json`, `reportes.json`) y arquitectura modular sin backend. | Angel Sosa, Adrian Marquez | Esquema JSON validado con separación de lógica pura. |
| **2** | Implementación de captura rápida (< 30 s), geolocalización, asignación de cuadra más cercana y pixelado en `<canvas>`. | Angel Sosa | Registro funcional offline en `localStorage` con control de cuota. |
| **3** | Implementación del motor de criticidad (`criticidad.js`) y suite de pruebas unitarias (`pruebas.html`). | Adrian Marquez, Angel Sosa | 100 % de los casos de prueba aprobados frente al cálculo manual. |
| **4** | Integración de mapa de calor ponderado (`Leaflet.heat`), filtros combinados y resumen operativo Top 5. | Josue Rodriguez, Angel Sosa | Visualización interactiva con modos *Ambos / Calor / Puntos*. |
| **5** | Consolidación del conjunto de análisis en el sector Unimagdalena–Villa Marbella–Cañaveral, revisión de coordenadas y anonimización de evidencias. | Johan Acosta, Todo el equipo | 24 reportes activos en Unimagdalena/Villa Marbella/Cañaveral; los seis registros del Mercado Público quedan fuera del alcance vigente. |

---

## 2. Fallos Detectados en Asistencia con IA y Correcciones Aplicadas

Durante la construcción del prototipo se identificaron cuatro fallos técnicos en el código o datos generados inicialmente por la IA, los cuales fueron diagnosticados y corregidos por el equipo:

### Ajuste 1: Delimitación del conjunto de análisis
* **Hallazgo:** El repositorio contenía dos zonas de levantamiento: 24 reportes del entorno Unimagdalena–Villa Marbella–Cañaveral y 6 del Mercado Público.
* **Decisión de alcance:** Esta versión del estudio mantiene activos únicamente los 24 reportes de Unimagdalena–Villa Marbella–Cañaveral y sus 10 cuadras. Los seis registros del Mercado Público se excluyeron del conjunto analítico vigente; sus archivos fotográficos se conservan en el repositorio como material histórico.

### Ajuste 2: Desfase horario de +5 horas (UTC vs. hora local de Colombia)
* **Fallo detectado:** El código inicial utilizaba `new Date().toISOString()` para generar marcas de tiempo y nombres de archivo de exportación, lo que desplazaba los registros tomados después de las 19:00 hora local hacia el día siguiente en horario UTC y alteraba la detección de franja pico/valle.
* **Corrección aplicada:** Se reemplazó por extracción explícita de componentes locales (`getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`) en `almacenamiento.js` y `captura.js`.

### Ajuste 3: Lienzo `0x0` del mapa de calor al cambiar de pestaña
* **Fallo detectado:** Al inicializar `L.heatLayer` mientras la pestaña *Registros* permanecía oculta (`display: none`), Leaflet calculaba un contenedor de `0x0` píxeles y el mapa de calor no se renderizaba al abrir la vista.
* **Corrección aplicada:** En `mapa.js` (`redimensionarMapaRegistros()`), se ejecutó `mapaRegistros.invalidateSize()` tras mostrar la pestaña y se condicionó la creación de `L.heatLayer` a que `mapaRegistros.getSize()` sea mayor a `0 px`.

### Ajuste 4: Fallo de despliegue en GitHub Pages por procesamiento Jekyll
* **Fallo detectado:** El flujo de despliegue en GitHub Pages falló al intentar procesar carpetas y archivos con Jekyll.
* **Corrección aplicada:** Se incorporó el archivo vacío `.nojekyll` en la raíz del repositorio y se mantuvieron todas las rutas relativas en minúsculas (`datos/vias.json`, `datos/fotos/mp-aso-001.jpg`).


### Ajuste 5: Coherencia entre captura e importación geográfica
* **Fallo detectado:** La captura permitía guardar puntos fuera de la zona o asignar la cuadra más cercana aunque estuviera demasiado lejos; la importación aplicaba un límite rectangular distinto.
* **Corrección aplicada:** La captura y la importación ahora validan el área configurada y una distancia máxima de 90 m entre el punto y la cuadra asignada. Los puntos sin una cuadra suficientemente cercana no se aceptan como reportes válidos.
