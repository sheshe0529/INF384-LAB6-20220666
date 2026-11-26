# Implementation Plan: habilitados

## Overview

Implementar `POST /habilitados` en tres pasos ordenados: (1) función pura de cálculo, (2) router
con validación, (3) integración en `app.js`. Los tests (unitarios, de ruta y de propiedad con
fast-check) se añaden como sub-tareas opcionales bajo la tarea que implementan.

---

## Tasks

- [ ] 1. Instalar fast-check y crear estructura de archivos
  - Ejecutar `npm install --save-dev fast-check` para agregar la librería de property-based testing.
  - Crear el archivo vacío `src/util/calcularHabilitados.js` con un export de función stub.
  - Crear el archivo vacío `src/routes/habilitados.js` con un router Express stub.
  - Crear el archivo vacío `tests/habilitados.test.js`.
  - _Requirements: 1.1, 2.1, 3.1, 4.1_

- [ ] 2. Implementar la función pura de cálculo
  - [ ] 2.1 Escribir `calcularHabilitados(aprobados)` en `src/util/calcularHabilitados.js`
    - Importar `repositorio.listar()`.
    - Construir un `Set` con los elementos de `aprobados`.
    - Filtrar cursos: `!aprobadosSet.has(curso.id)` AND `curso.prerequisites.every(p => aprobadosSet.has(p))`.
    - Mapear cada resultado a `{ id, name, credits, cycle, type }` (omitir `prerequisites`).
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2_

  - [ ]* 2.2 Escribir tests unitarios de ejemplos concretos para `calcularHabilitados`
    - Test: `aprobados=[]` → solo cursos con `prerequisites=[]`.
    - Test: `aprobados=["1INF25","1INF27","1INF49"]` → 27 cursos incluyendo 1INF29, 1INF30, 1INF31, 1INF32.
    - Test: todos los IDs del catálogo → `[]`.
    - Test: cada objeto del resultado contiene exactamente `id, name, credits, cycle, type` y no contiene `prerequisites`.
    - _Requirements: 1.3, 1.4, 1.5, 5.1, 5.2_

  - [ ]* 2.3 Escribir property tests para `calcularHabilitados`
    - **Property 1: Corrección del filtro de habilitados**
    - **Validates: Requirements 1.1, 1.2**
    - `// Feature: habilitados, Property 1: Corrección del filtro`
    - Usar `fc.array(fc.constantFrom(...ids_del_catalogo), { maxLength: 500 })` como generador.
    - Verificar que cada resultado cumple: `id ∉ aprobados` AND `prerequisites ⊆ aprobados`.
    - **Property 2: Completitud del filtro de habilitados**
    - **Validates: Requirements 1.1, 1.2**
    - `// Feature: habilitados, Property 2: Completitud del filtro`
    - Verificar que ningún curso habilitado según las reglas queda fuera del resultado.
    - Mínimo 100 iteraciones para cada propiedad.
    - _Requirements: 1.1, 1.2_

- [ ] 3. Checkpoint — verificar lógica de cálculo
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implementar validación en el router
  - [ ] 4.1 Escribir `src/routes/habilitados.js` con validación en orden tipo → tamaño → formato
    - Comprobar `Array.isArray(aprobados)`; si falla → 422 `{ "error": "aprobados debe ser un array" }`.
    - Comprobar `aprobados.length <= 500`; si falla → 400 `{ "error": "aprobados no puede superar 500 elementos" }`.
    - Iterar el array y comprobar cada elemento contra `/^[A-Z0-9]{1,10}$/`; si falla → 400 `{ "error": "elemento inválido en aprobados" }`.
    - Si la validación pasa, llamar `calcularHabilitados(aprobados)` y devolver 200.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 4.2, 4.3, 4.4, 6.1, 6.2, 6.3_

  - [ ]* 4.2 Escribir tests de ruta (supertest) para los caminos de validación
    - 422: `aprobados` ausente, string, number, boolean.
    - 400: array de 501 elementos con elementos válidos.
    - 400: elemento con `<script>`, minúsculas, vacío, longitud > 10.
    - Verificar que las respuestas de error no contienen stack traces ni rutas del sistema.
    - Verificar orden: payload con `aprobados = "texto"` (string) → 422, no 400.
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 4.1, 4.2, 6.1, 6.2, 6.3_

  - [ ]* 4.3 Escribir property tests para la validación del router
    - **Property 3: Validación de tipo rechaza todo no-array**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - `// Feature: habilitados, Property 3: Tipo rechaza todo no-array`
    - Usar `fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null))` como generador.
    - Verificar respuesta 422 para cualquier valor no-array.
    - **Property 4: Validación de tamaño rechaza arrays con más de 500 elementos**
    - **Validates: Requirements 3.1**
    - `// Feature: habilitados, Property 4: Tamaño rechaza > 500`
    - Usar `fc.array(fc.stringMatching(/^[A-Z0-9]{1,10}$/), { minLength: 501, maxLength: 5000 })`.
    - Verificar respuesta 400.
    - **Property 5: Validación de formato rechaza cualquier elemento inválido**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - `// Feature: habilitados, Property 5: Formato rechaza elementos inválidos`
    - Generar array válido de longitud ≤ 500 e insertar un elemento inválido en posición aleatoria.
    - Verificar respuesta 400.
    - Mínimo 100 iteraciones por propiedad.
    - _Requirements: 2.1, 3.1, 4.1, 4.2, 4.3, 4.4_

- [ ] 5. Integrar la ruta en `src/app.js`
  - [ ] 5.1 Agregar `app.use('/habilitados', require('./routes/habilitados'))` en `src/app.js`
    - Colocar la línea después del montaje de `/cursos` y antes del middleware de error.
    - _Requirements: 1.1_

  - [ ]* 5.2 Escribir tests de ruta (supertest) para el happy path integrado
    - **Property 6: Forma de la respuesta de éxito**
    - **Validates: Requirements 5.1, 5.2**
    - `// Feature: habilitados, Property 6: Forma de la respuesta de éxito`
    - Test de integración: `aprobados=["1INF25","1INF27","1INF49"]` → 200, 27 cursos, campos correctos.
    - Test de propiedad: para cualquier subconjunto válido S, si la respuesta es 200, cada objeto contiene `id, name, credits, cycle, type` y no contiene `prerequisites`.
    - Mínimo 100 iteraciones.
    - _Requirements: 1.4, 5.1, 5.2_

- [ ] 6. Checkpoint — verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Verificar cobertura de líneas >= 80 %
  - Ejecutar `npx jest --coverage` y revisar el resumen de cobertura de líneas en `src/**/*.js`
    (excluyendo `src/server.js`, según `jest.config.js`).
  - Si la cobertura de líneas es inferior al 80 %, identificar las líneas no cubiertas en los
    nuevos archivos (`src/routes/habilitados.js`, `src/util/calcularHabilitados.js`) y agregar
    los tests de caso faltantes en `tests/habilitados.test.js`.
  - _Requirements: Requisito de calidad (≥ 80 % cobertura de líneas)_

---

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP rápido.
- Cada tarea referencia los IDs de requisito para trazabilidad.
- Los checkpoints en las tareas 3 y 6 son puntos de validación incremental.
- La tarea 7 es obligatoria por el requisito de calidad del enunciado.
- fast-check genera valores aleatorios; cada property test debe ejecutarse con `numRuns: 100` como mínimo.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3"] },
    { "id": 3, "tasks": ["3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3"] },
    { "id": 6, "tasks": ["5.1"] },
    { "id": 7, "tasks": ["5.2"] },
    { "id": 8, "tasks": ["6"] },
    { "id": 9, "tasks": ["7"] }
  ]
}
```
