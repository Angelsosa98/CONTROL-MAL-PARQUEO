# Arquitectura del Sistema — Control Vial Santa Marta

**Autores:** Angel Sosa Ospino, Adrian Jose Marquez Orozco, Johan David Acosta Peñaloza, Josue David Rodriguez  
**Programa:** Ingeniería de Sistemas — Universidad del Magdalena

---

## 1. Estilo arquitectónico

Aplicación cliente estática modular, sin backend, desplegable en GitHub Pages. La presentación está en `index.html` y `estilos.css`; la lógica de aplicación en `captura.js`; la persistencia en `almacenamiento.js`; la visualización cartográfica en `mapa.js`; y la lógica de negocio en `criticidad.js`, `filtros.js` y `resumen.js`.

## 2. Módulos

1. **`index.html` y `estilos.css`:** dos vistas conmutables: captura y registros/evidencias.
2. **`captura.js`:** ciclo de vida, GPS, selección de ubicación, validación de formulario, galería y actualización de indicadores.
3. **`criticidad.js`:** deducción de franja horaria y cálculo de criticidad a partir de reportes completos.
4. **`mapa.js`:** mapas Leaflet, marcadores de reportes georreferenciados y mapa de calor basado en esos reportes. Las fotografías sin coordenadas verificadas no se dibujan.
5. **`filtros.js` y `resumen.js`:** filtros, estadísticas y ranking operativo calculados sobre reportes, no sobre fotografías aisladas.
6. **`almacenamiento.js`:** persistencia local, importación/exportación JSON y validación estructural y geográfica.

## 3. Estado de los datos al actualizar esta documentación

- `datos/reportes.json`: 0 reportes precargados.
- `datos/evidencias_nuevas.json`: 30 fotografías pendientes de georreferenciación y clasificación verificadas.
- `datos/vias.json`: 10 cuadras configuradas mediante segmentos de referencia aproximados.
- `datos/criterios.json`: pesos y franjas horarias del motor de criticidad.

Las ubicaciones sintéticas y los puntajes simulados se retiraron de los registros fotográficos. Las fotografías permanecen en la galería, pero no se utilizan para generar marcadores, mapa de calor, estadísticas o ranking.

## 4. Alcance y limitaciones geográficas

La aplicación limita la captura al rectángulo definido en `datos/vias.json` y verifica distancia respecto al segmento de referencia asignado. El umbral actual de 90 m es una validación geométrica contra esos segmentos; **no equivale a comprobar que el punto esté sobre la calzada ni que esté fuera de predios privados, edificios, andenes o campus**.

Los segmentos configurados no constituyen todavía una cartografía vial oficial ni una delimitación de calzadas. Para sostener conclusiones espaciales del estudio, deben sustituirse por geometrías viales verificadas y validarse visualmente los puntos de campo.

## 5. Pruebas y alcance de verificación

La suite `pruebas.html` cubre casos del motor de criticidad. La sintaxis de los módulos puede comprobarse por separado. Ninguna de estas verificaciones sustituye una prueba funcional integral en navegador de GPS, mapas, filtros, persistencia, importación y exportación.
