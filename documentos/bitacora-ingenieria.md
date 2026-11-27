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

Las 10 cuadras de `datos/vias.json` siguen definidas por segmentos aproximados. La validación de 90 m mide distancia a esos segmentos y no acredita que una coordenada esté sobre la calzada ni fuera de propiedades privadas. La geometría vial debe verificarse contra cartografía fiable y recorridos de campo antes de interpretar los datos espacialmente.

## 4. Pruebas

La validación sintáctica de JavaScript y las pruebas unitarias de criticidad son verificaciones parciales. Debe completarse una prueba en navegador para comprobar mapas, GPS, controles, filtros, persistencia, galería, importación y exportación. No se declara aprobada una prueba visual que no se haya ejecutado.
