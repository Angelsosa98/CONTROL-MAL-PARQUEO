# Guion de Sustentación — Control Vial Santa Marta (10 Minutos)

**Equipo:**
1. **Angel Sosa Ospino** — Integrador del mapa, instrucciones a la IA e Ingeniero de Lógica y Clasificación
2. **Adrian Jose Marquez Orozco** — Ingeniero de Lógica y Clasificación
3. **Johan David Acosta Peñaloza** — Analista de Campo
4. **Josue David Rodriguez** — Mapa de Calor y Filtros

---

## Reparto de Intervenciones

### 1. Introducción y Levantamiento de Campo (2 min 30 s) — Johan David Acosta Peñaloza
* **Qué presentar:** Vista **Registros** (lista de tarjetas y modal de foto ampliada) y `documentos/anexo-campo.pdf`.
* **Puntos clave:**
  * Explicar el problema real observado en dos focos críticos de Santa Marta: el entorno de la **Universidad del Magdalena / Villa Marbella** (24 reportes) y el **Mercado Público** (6 reportes).
  * Mostrar cómo se recolectaron las 30 evidencias reales (`MP-ASO-001` a `MP-ASO-030`) y cómo se garantizó la privacidad pixelando placas y rostros antes de publicar.

### 2. Demostración en Vivo de Captura y Arquitectura (2 min 30 s) — Angel Sosa Ospino
* **Qué presentar:** Vista **Captura** en vivo y `documentos/arquitectura.pdf` + `documentos/bitacora-ingenieria.pdf`.
* **Puntos clave:**
  * Registrar un reporte nuevo en vivo en menos de 30 segundos (tocar mapa, selección automática de cuadra, foto con pixelado y guardado en `localStorage`).
  * Explicar cómo se corrigieron los fallos de la IA (separación geográfica entre Unimagdalena y Mercado Público, ajuste horario local de Colombia y redimensionamiento del mapa de calor).

### 3. Motor de Criticidad y Pruebas Unitarias (2 min 30 s) — Adrian Jose Marquez Orozco
* **Qué presentar:** `criticidad.js`, `datos/criterios.json` y `pruebas.html`.
* **Puntos clave:**
  * Explicar la fórmula determinista: $	ext{Puntaje} = 	ext{Categoría} + 	ext{Vía} + 	ext{Franja}$, con límites de hora pico donde el inicio se incluye ($\ge$) y el fin se excluye ($<$).
  * Mostrar `pruebas.html` ejecutándose en vivo con todos los casos en **PASS**, demostrando que la lógica pura es independiente de la interfaz.

### 4. Mapa de Calor, Filtros y Resumen Operativo Top 5 (2 min 30 s) — Josue David Rodriguez
* **Qué presentar:** Mapa de calor en **Registros** y vista **Resumen (Top 5)**.
* **Puntos clave:**
  * Alternar en vivo entre las capas **Ambos**, **Solo calor** y **Solo puntos**, explicando cómo la intensidad del calor se pondera según el puntaje de criticidad (`puntaje / 9`).
  * Aplicar filtros combinados (por cuadra, franja pico/valle, categoría y actor) y mostrar cómo el **Top 5** asigna automáticamente acciones operativas mediante las reglas `R1` a `R6` (por ejemplo, *Patrullaje prioritario en hora pico* en la Carrera 32 frente a Unimagdalena con 25 puntos acumulados).

---

## Preguntas Frecuentes del Jurado (Respuestas Rápidas)

* **¿Por qué no usaron base de datos en servidor?** Porque el requisito exige una aplicación estática desplegable en GitHub Pages que funcione offline en campo usando `localStorage` y archivos JSON versionados con respaldo exportable.
* **¿Cómo evitan que se pierdan datos si se llena `localStorage`?** `almacenamiento.js` captura `QuotaExceededError`, mantiene el reporte pendiente en memoria y habilita la exportación inmediata a JSON.
* **¿Qué pasa si dos compañeros suben reportes con el mismo ID?** `importarReportesDesdeTexto()` detecta si es un duplicado idéntico (lo omite) o un conflicto con datos distintos (lo reporta sin sobrescribir).
