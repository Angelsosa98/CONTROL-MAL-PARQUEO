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
4. **`mapa.js`:** mapas Leaflet, recorrido verde independiente, puntos de evidencias fotográficas con valoración visual preliminar, puntos de reportes con criticidad formal y mapa de calor ponderado. Los popups identifican el origen de cada punto.
5. **`filtros.js` y `resumen.js`:** filtros, estadísticas y ranking operativo calculados sobre reportes, no sobre fotografías aisladas.
6. **`almacenamiento.js`:** persistencia local, importación/exportación JSON y validación estructural y geográfica.

## 3. Estado de los datos al actualizar esta documentación

- `datos/reportes.json`: 0 reportes precargados.
- `datos/evidencias_nuevas.json`: 30 evidencias con ubicación sectorial aproximada (9 en la calle de la Universidad del Magdalena y 21 en Villa Marbella), valoración visual preliminar y sin GPS individual ni fecha/hora verificados.
- `datos/vias.json`: 14 vías registradas, cuatro activas para captura y diez deshabilitadas como referencias históricas; los segmentos son aproximados.
- `datos/criterios.json`: pesos y franjas horarias del motor de criticidad.

Las ubicaciones sectoriales y valoraciones visuales preliminares se conservan separadas del índice formal. Las fotografías se muestran en galería y como puntos en el mapa y aportan intensidad visual al calor, pero no se incorporan a reportes, estadísticas ni Top 5.

## 4. Alcance y limitaciones geográficas

La captura ofrece dos ámbitos:

- **Área de estudio:** aplica el rectángulo definido en datos/vias.json, asigna una de las cuadras configuradas y comprueba una distancia máxima de 30 m respecto al segmento vial de referencia.
- **Otros sectores de Santa Marta:** permite marcar coordenadas mediante GPS, buscador o mapa sin aplicar el rectángulo ni la distancia de las cuadras del estudio. El usuario debe declarar si la vía es arterial o secundaria y puede escribir un sector o referencia.

En ninguno de los dos modos la distancia a un segmento aproximado demuestra por sí sola que el punto esté sobre la calzada ni excluye predios privados, edificios, andenes o campus. Los segmentos configurados no constituyen cartografía vial oficial ni delimitación precisa de calzadas.

El modo externo tampoco dispone todavía de un polígono oficial del municipio. La aplicación no puede confirmar automáticamente que cualquier coordenada elegida pertenece a Santa Marta; el operador debe verificarlo. El tipo de vía externo es una selección declarada por el usuario, no una clasificación automática de la red vial.

La aplicación es estática y conserva reportes en el almacenamiento local del navegador. No existe sincronización central entre dispositivos; el intercambio entre equipos se realiza mediante exportación e importación JSON/ZIP. En el resumen Top 5, los reportes externos se agrupan por clase de vía y no por barrio.

## 5. Pruebas y alcance de verificación

La suite `pruebas.html` cubre siete casos del motor de criticidad. `pruebas-integracion.html` cubre siete casos de vías activas e importación ZIP. Se revisan también sintaxis, referencias DOM, estructura de datos, IDs de evidencias y coherencia CSV/JSON. Estas pruebas no sustituyen una comprobación manual de GPS, mapas y almacenamiento en navegador.


## 6. Capas cartográficas y procedencia de datos — versión 0.9.1.40

- **Recorrido verde:** representa el camino realizado por el equipo; incluye un trazado exterior y tres tramos interiores.
- **Puntos de evidencias:** representan ubicaciones aproximadas de vehículos observados. Hay 30 fichas: 9 de la calle de la Universidad del Magdalena y 21 de Villa Marbella. Los puntos no tienen que coincidir con el recorrido del equipo.
- **Valoración visual preliminar:** cada fotografía tiene nivel Alto, Medio o Bajo y una observación. Como no hay fecha/hora verificada, no se calcula la franja ni el puntaje formal.
- **Reportes formales:** se capturan con categoría, vía y fecha/hora; el motor calcula su criticidad y estos registros alimentan estadísticas y Top 5.
- **Mapa de calor:** combina evidencias con nivel visual preliminar y reportes formales con criticidad válida. Las ventanas emergentes distinguen la procedencia.
- **Buscador:** solo ofrece como sugerencias locales las vías que no tengan `activa:false`. Los diez registros históricos desactivados permanecen en `vias.json`, pero no se ofrecen para asignar ubicación.

El calor combinado es una visualización exploratoria. Los análisis formales deben separar las evidencias fotográficas de los reportes capturados.

## 7. Captura e intercambio de reportes

La captura dispone de dos ámbitos: área de estudio (cuatro vías activas) y otros sectores de Santa Marta. La aplicación conserva los reportes en el navegador local. La exportación e importación admite JSON y paquetes ZIP exportados por la aplicación. El lector ZIP exige `reportes.json`, convierte las imágenes contenidas en la carpeta `fotos/` y aplica límites de tamaño y rutas permitidas.

Todavía no existe sincronización central entre dispositivos ni un polígono oficial municipal para validar automáticamente otros sectores.