# Implementation Plan: habilitados

## Overview

Cinco tareas en secuencia estricta que siguen un ciclo red-green-refactor extendido a CI:
(1) flujo funcional verde, (2) tests de seguridad en rojo, (3) validaciones hasta verde,
(4) gates en CI, (5) correcciones que exijan los gates.

---

## Tasks

- [x] 1. Flujo funcional de POST /habilitados
  - Instalar fast-check como devDependency (`npm install --save-dev fast-check`).
  - Crear `src/util/calcularHabilitados.js` con la función pura:
    - Recibe `aprobados: string[]`.
    - Construye `Set` con los aprobados.
    - Filtra `repositorio.listar()`: cursos cuyo `id` no está en el set y todos sus `prerequisites` sí lo están.
    - Mapea cada resultado a `{ id, name, credits, cycle, type }` (omite `prerequisites`).
  - Crear `src/routes/habilitados.js`: router Express con `POST /` que llama a `calcularHabilitados` y responde 200 con el array. Sin ninguna validación de entrada.
  - Agregar `app.use('/habilitados', require('./routes/habilitados'))` en `src/app.js`, después de `/cursos` y antes del middleware de error.
  - Crear `tests/habilitados.test.js` con los tests del flujo funcional:
    - `aprobados = []` → 200, solo cursos con `prerequisites` vacío.
    - `aprobados = ["1INF25","1INF27","1INF49"]` → 200, exactamente 27 cursos incluyendo `1INF29`, `1INF30`, `1INF31`, `1INF32`.
    - `aprobados` = todos los IDs del catálogo → 200, array vacío.
    - Cada objeto del resultado contiene exactamente `id, name, credits, cycle, type` y no contiene `prerequisites`.
    - Property test (fast-check, 100 iteraciones): para cualquier subconjunto válido S, cada objeto devuelto cumple `id ∉ S` y `prerequisites ⊆ S` (corrección del filtro).
    - Property test (fast-check, 100 iteraciones): ningún curso habilitado según las reglas queda fuera del resultado (completitud del filtro).
  - Todos los tests existentes deben seguir pasando.
  - _Requisitos: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2_

- [x] 2. Tests de seguridad y validación (deben fallar — no modificar src/)
  - Agregar en `tests/habilitados.test.js` los tests de las reglas de seguridad, que deben quedar en rojo hasta la tarea 3.
  - **RS-1 — Validación de tipo** (Requisito 2):
    - `aprobados` ausente → 400 `{ "error": "aprobados debe ser un array" }`.
    - `aprobados = "1INF25"` (string) → 400.
    - `aprobados = 42` (número) → 400.
    - `aprobados = true` (booleano) → 400.
    - Property test (fast-check, 100 iteraciones): cualquier valor no-array → 400.
  - **RS-2 — Validación de tamaño** (Requisito 3):
    - Array de 88 elementos válidos → 400 `{ "error": "aprobados no puede superar 87 elementos" }`.
    - Body de 5000 códigos (supera 4 kb) → 413 `{ "error": "cuerpo demasiado grande" }`.
    - Property test (fast-check, 100 iteraciones): array con 88–300 elementos válidos → 400.
  - **RS-3 — Validación de formato** (Requisito 4):
    - `["1INF30<script>"]` → 400 `{ "error": "elemento inválido en aprobados" }` sin stack trace ni ruta interna en el body.
    - `["abc"]` (minúsculas) → 400.
    - `[""]` (vacío) → 400.
    - `["12345678901"]` (11 chars) → 400.
    - `[123]` (elemento número, no string) → 400.
    - `[null]` (elemento null) → 400.
    - Property test (fast-check, 100 iteraciones): array con un elemento inválido en posición aleatoria → 400.
  - **RS-4 — JSON mal formado** (Requisito 2.4):
    - Enviar body con JSON mal formado (ej. `"{aprobados:"`) → 400 `{ "error": <mensaje> }` sin stack trace.
  - Verificar orden de validación (Requisito 6): payload `{ "aprobados": "texto" }` → 400 de tipo, no de tamaño.
  - No modificar ningún archivo de `src/`.
  - Confirmar que estos tests fallan al ejecutar `npm test` antes de continuar.
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4_

- [x] 3. Validaciones, límite de cuerpo y manejo de errores
  - Configurar `express.json({ limit: '4kb' })` en `src/app.js`; el límite actual debe reemplazarse o ajustarse.
  - Actualizar el middleware de error global en `src/app.js` para interceptar:
    - Errores `SyntaxError` (JSON mal formado) → 400 `{ "error": err.message }` sin stack trace.
    - Errores con `status 413` / `type 'entity.too.large'` → 413 `{ "error": "cuerpo demasiado grande" }`.
  - Agregar en `src/routes/habilitados.js` las validaciones en orden tipo → tamaño → formato:
    - `!Array.isArray(aprobados)` → 400 `{ "error": "aprobados debe ser un array" }`.
    - `aprobados.length > 87` → 400 `{ "error": "aprobados no puede superar 87 elementos" }`. Responder sin ejecutar el cálculo.
    - Algún elemento no es string o no cumple `/^[A-Z0-9]{1,10}$/` → 400 `{ "error": "elemento inválido en aprobados" }`.
  - Ejecutar `npm test`; todos los tests de la tarea 2 deben pasar ahora.
  - _Requisitos: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2, 6.3, 6.4_

- [x] 4. Gates en .github/workflows/ci.yml
  - No modificar ningún archivo de `src/` ni de `tests/`.
  - Agregar job `sca` (npm audit):
    - Ejecuta `npm audit --audit-level=high`.
    - Bloquea ante vulnerabilidades de severidad alta o crítica.
  - Agregar job `secretos` (gitleaks):
    - En el step de checkout usar `fetch-depth: 0` para obtener el historial completo.
    - Instalar gitleaks v8.24.3: `wget https://github.com/gitleaks/gitleaks/releases/download/v8.24.3/gitleaks_8.24.3_linux_x64.tar.gz && tar -xzf gitleaks_8.24.3_linux_x64.tar.gz`.
    - Ejecutar `./gitleaks git --redact --verbose .` para escanear el historial completo.
    - Bloquea ante 1 hallazgo no registrado en `.gitleaksignore`.
    - No usar `gitleaks/gitleaks-action`.
  - Agregar job `cobertura` (Jest con umbral):
    - Ejecuta `npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'`.
    - Bloquea si la cobertura de líneas es inferior al 80 %.
    - Depende del job `build` (tests deben pasar antes de medir cobertura).
  - Agregar job `sast` (Semgrep):
    - Instalar con `pipx install semgrep==1.187.0`.
    - Ejecutar `semgrep scan --config p/nodejs --severity ERROR --error src`.
    - Bloquea ante hallazgos de severidad ERROR en `src/`.
    - No usar `returntocorp/semgrep-action`.
  - Todos los jobs corren en `ubuntu-latest` y se activan en push y PR a `main`.
  - _Requisitos: Requisito de calidad (≥ 80 % cobertura); Decisiones de gates de CI en design.md_

- [ ] 5. Correcciones detectadas por los gates
  - Ejecutar localmente cada gate y registrar los hallazgos antes de corregir:
    - `npm audit --audit-level=high` → actualizar o reemplazar dependencias con severidad alta o crítica.
    - Gitleaks en historial completo (`fetch-depth: 0`) → si se detecta una clave, tratarla como rotada y registrarla en `.gitleaksignore` con su razón (fingerprint + comentario explicativo); no reescribir historial.
    - `npx jest --coverage --coverageThreshold='{"global":{"lines":80}}'` → si la cobertura es < 80 %, agregar tests en `tests/habilitados.test.js` para las líneas no cubiertas de `src/routes/habilitados.js`, `src/util/calcularHabilitados.js` y `src/util/formato.js`.
    - Semgrep → corregir cada hallazgo de severidad ERROR en `src/`; si es falso positivo, agregar comentario de supresión con justificación.
  - Solo modificar lo estrictamente necesario para que cada gate pase; no refactorizar código no relacionado.
  - Verificar que `npm test` sigue pasando después de cada corrección.
  - _Requisitos: 2.4, 4.2 (sin stack traces); Requisito de calidad (≥ 80 % cobertura); Decisiones de gates de CI en design.md_

---

## Notes

- La tarea 2 termina con tests en rojo por diseño: ese estado confirma que las validaciones aún no existen en `src/`.
- Las tareas 1–3 siguen el ciclo red-green estándar aplicado a requisitos de seguridad.
- La tarea 5 no tiene alcance fijo; su contenido depende de lo que detecten los gates en la tarea 4.
- fast-check debe instalarse en la tarea 1 antes de escribir cualquier property test.
- Los property tests de tamaño usan el rango 88–300 para mantenerse por debajo del coste de serializar cuerpos muy grandes en cada iteración.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["4"] },
    { "id": 4, "tasks": ["5"] }
  ]
}
```
