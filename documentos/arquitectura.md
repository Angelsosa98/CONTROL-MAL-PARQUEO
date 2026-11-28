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
4. **`mapa.js`:** mapas Leaflet, línea azul y paradas numeradas para el circuito aproximado de campo, marcadores de reportes y mapa de calor. Las fotografías no se dibujan como puntos.
5. **`filtros.js` y `resumen.js`:** filtros, estadísticas y ranking operativo calculados sobre reportes, no sobre fotografías aisladas.
6. **`almacenamiento.js`:** persistencia local, importación/exportación JSON y validación estructural y geográfica.

## 3. Estado de los datos al actualizar esta documentación

- `datos/reportes.json`: 0 reportes precargados.
- `datos/evidencias_nuevas.json`: 30 evidencias con ubicaciones sectoriales aproximadas (5 Calle 29H y 25 en Carrera 21C, Calle 29J y Carrera 21D).
- `datos/vias.json`: 10 cuadras configuradas mediante segmentos de referencia aproximados.
- `datos/criterios.json`: pesos y franjas horarias del motor de criticidad.

Las ubicaciones sintéticas y los puntajes simulados se retiraron de los registros fotográficos. Las fotografías permanecen en la galería, pero no se utilizan para generar marcadores, mapa de calor, estadísticas o ranking.

## 4. Alcance y limitaciones geográficas

La captura ofrece dos ámbitos:

- **Área de estudio:** aplica el rectángulo definido en datos/vias.json, asigna una de las cuadras configuradas y comprueba una distancia máxima de 30 m respecto al segmento vial de referencia.
- **Otros sectores de Santa Marta:** permite marcar coordenadas mediante GPS, buscador o mapa sin aplicar el rectángulo ni la distancia de las cuadras del estudio. El usuario debe declarar si la vía es arterial o secundaria y puede escribir un sector o referencia.

En ninguno de los dos modos la distancia a un segmento aproximado demuestra por sí sola que el punto esté sobre la calzada ni excluye predios privados, edificios, andenes o campus. Los segmentos configurados no constituyen cartografía vial oficial ni delimitación precisa de calzadas.

El modo externo tampoco dispone todavía de un polígono oficial del municipio. La aplicación no puede confirmar automáticamente que cualquier coordenada elegida pertenece a Santa Marta; el operador debe verificarlo. El tipo de vía externo es una selección declarada por el usuario, no una clasificación automática de la red vial.

La aplicación es estática y conserva reportes en el almacenamiento local del navegador. No existe sincronización central entre dispositivos; el intercambio entre equipos se realiza mediante exportación e importación JSON/ZIP. En el resumen Top 5, los reportes externos se agrupan por clase de vía y no por barrio.

## 5. Pruebas y alcance de verificación

La suite pruebas.html incluye los cuatro casos originales del motor de criticidad, un caso de cálculo en otros sectores y dos casos de seguridad (categoría desconocida y tipo de vía externo inválido). También se realizaron pruebas programáticas de importación/exportación, filtros, representación cartográfica y agrupación de reportes externos. Estas comprobaciones no sustituyen una prueba funcional integral en navegador de GPS, mapas, filtros, persistencia e intercambio de archivos sobre la versión publicada.


## 6. Separación cartográfica de fotografías y reportes — versión 0.9.1.37

Las fotografías (30 registros de `datos/evidencias_nuevas.json`) se muestran únicamente en la galería. Aunque conservan metadatos sectoriales aproximados, no se dibujan como marcadores cartográficos ni generan intensidad térmica, porque no tienen clasificación de criticidad individual.

En el mapa de Registros, los marcadores individuales y la capa de calor se construyen exclusivamente con reportes que tengan `criticidad.nivel` igual a Alto, Medio o Bajo. La intensidad de calor es categórica: Alto 1.00, Medio 0.65 y Bajo 0.30. Los reportes sin nivel válido se omiten del mapa, en lugar de asignarles Bajo por defecto.

Cuando no existen reportes clasificados, no se crea una capa de calor y el mapa encuadra el recorrido de campo. La leyenda conserva el recorrido y las tres categorías de reportes. La galería, archivos de fotos, geometría verde y datos sectoriales de las evidencias no se modifican.

## 7. Puntos y calor de evidencias con clasificación visual preliminar — versión 0.9.1.39

Las 30 fichas de `datos/evidencias_nuevas.json` vuelven a mostrarse como puntos en el mapa utilizando exactamente sus coordenadas sectoriales existentes. Cada ficha incluye `clasificacion_visual_preliminar`: nivel visual Alto/Medio/Bajo, tipo de obstrucción observado, confianza y observación breve. La distribución actual es 9 Alto, 16 Medio y 5 Bajo.

Estos niveles son una valoración visual de la obstrucción que aparece en cada fotografía, no un resultado del algoritmo `calcularCriticidad`. Las 30 fichas tienen `fecha_hora: null`, así que no se puede deducir su franja pico/valle ni el puntaje formal. Cada popup aclara esa limitación y distingue una evidencia fotográfica de un reporte capturado.

Los marcadores de evidencias y los reportes formales se dibujan en la capa de puntos del mapa. La capa de calor pondera ambos orígenes con Alto 1.00, Medio 0.65 y Bajo 0.30. Las evidencias no se añaden a la lista de reportes, estadísticas, filtros de reportes ni Top 5. La galería y el recorrido verde se mantienen sin modificaciones.