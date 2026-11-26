# Design Document

## Overview

El endpoint `POST /habilitados` calcula los cursos que un estudiante puede cursar, dado el
conjunto de cursos que ya aprobó. La lógica es: un curso está habilitado si no está en la lista
de aprobados y todos sus requisitos sí lo están. La implementación agrega dos archivos nuevos al
proyecto y monta la ruta en `src/app.js`.

---

## Architecture

```
src/
├── app.js                        (modificado: agrega app.use('/habilitados', ...))
├── routes/
│   ├── cursos.js                 (sin cambios)
│   └── habilitados.js            (nuevo: validación + llamada a calcularHabilitados)
└── util/
    ├── formato.js                (sin cambios)
    └── calcularHabilitados.js    (nuevo: función pura de cálculo)
tests/
└── habilitados.test.js           (nuevo: tests de ruta + tests unitarios de la función)
```

```mermaid
flowchart LR
    Cliente -->|POST /habilitados| Router[routes/habilitados.js]
    Router -->|valida body| Validador[Lógica de validación]
    Validador -->|400/422| Cliente
    Validador -->|ok| Calc[calcularHabilitados]
    Calc -->|listar()| Repo[repositorio.js]
    Calc --> Router
    Router -->|200 JSON| Cliente
```

---

## Components and Interfaces

### `src/routes/habilitados.js`

Router Express con un único método POST en `/`. Responsabilidades:

1. Extraer `aprobados` del `req.body`.
2. Ejecutar validaciones en orden (tipo → tamaño → formato).
3. Llamar a `calcularHabilitados(aprobados)` si el input es válido.
4. Responder con el array de cursos habilitados.

```
POST /habilitados
Content-Type: application/json

Request body:
{
  "aprobados": ["1INF25", "1INF27", "1INF49"]  // array de strings, máx 500 elementos
}

Response 200 — éxito:
[
  {
    "id": "1INF29",
    "name": "Nombre del curso",
    "credits": 4,
    "cycle": 6,
    "type": "obligatorio"
  },
  ...
]

Response 400 — tamaño excedido:
{ "error": "aprobados no puede superar 500 elementos" }

Response 400 — elemento inválido:
{ "error": "elemento inválido en aprobados" }

Response 422 — tipo incorrecto:
{ "error": "aprobados debe ser un array" }
```

### `src/util/calcularHabilitados.js`

Función pura sin side-effects:

```
calcularHabilitados(aprobados: string[]): Curso[]
```

- Recibe el array ya validado de códigos aprobados.
- Consulta `repositorio.listar()` para obtener el catálogo completo.
- Construye un `Set` con los aprobados para lookups en O(1).
- Filtra los cursos que cumplen ambas condiciones:
  - `!aprobadosSet.has(curso.id)` — no está aprobado.
  - `curso.prerequisites.every(p => aprobadosSet.has(p))` — todos sus requisitos cubiertos.
- Mapea cada resultado a `{ id, name, credits, cycle, type }` (omite `prerequisites`).

---

## Data Models

### Request

| Campo      | Tipo     | Restricciones                                   |
|------------|----------|-------------------------------------------------|
| `aprobados`| `string[]` | array, máx 500 elementos, cada elemento `^[A-Z0-9]{1,10}$` |

### Response (éxito 200)

| Campo     | Tipo            | Notas                     |
|-----------|-----------------|---------------------------|
| `id`      | `string`        | Código del curso          |
| `name`    | `string`        | Nombre del curso          |
| `credits` | `number`        | Créditos                  |
| `cycle`   | `number\|null`  | Ciclo; null para electivos sin ciclo fijo |
| `type`    | `string`        | `"obligatorio"` o `"electivo"` |

### Validation Order (Requirement 6)

```
1. ¿aprobados es array?         → NO → 422
2. ¿aprobados.length <= 500?    → NO → 400
3. ¿Todos los elementos ∈ /^[A-Z0-9]{1,10}$/? → NO → 400
4. Calcular habilitados → 200
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a
system — essentially, a formal statement about what the system should do. Properties serve as the
bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Corrección del filtro de habilitados

*Para todo* subconjunto válido S de códigos de curso (array de strings que cumplen el patrón,
longitud ≤ 500), cada elemento del array devuelto por `calcularHabilitados(S)` cumple
simultáneamente: (a) su `id` no está en S, y (b) todos sus `prerequisites` están en S.

**Validates: Requirements 1.1, 1.2**

### Property 2: Completitud del filtro de habilitados

*Para todo* subconjunto válido S de códigos de curso, ningún curso del catálogo que cumpla las
condiciones de habilitado (id ∉ S y todos sus prerequisites ⊆ S) está ausente del array devuelto
por `calcularHabilitados(S)`.

**Validates: Requirements 1.1, 1.2**

### Property 3: Validación de tipo rechaza todo no-array

*Para todo* valor `v` que no sea un array JavaScript (string, number, boolean, null, object plano),
el endpoint `POST /habilitados` con `{ "aprobados": v }` DEBE responder con status 422 y body
`{ "error": "aprobados debe ser un array" }`.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Validación de tamaño rechaza arrays con más de 500 elementos

*Para todo* array de longitud n donde 501 ≤ n ≤ 5000 (con elementos válidos), el endpoint
`POST /habilitados` DEBE responder con status 400 y body
`{ "error": "aprobados no puede superar 500 elementos" }`.

**Validates: Requirements 3.1**

### Property 5: Validación de formato rechaza cualquier elemento inválido

*Para todo* array de longitud válida (≤ 500) que contiene al menos un elemento que no cumple
`^[A-Z0-9]{1,10}$` (cadena vacía, caracteres en minúscula, caracteres especiales, longitud > 10),
el endpoint `POST /habilitados` DEBE responder con status 400 y body
`{ "error": "elemento inválido en aprobados" }`.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 6: Forma de la respuesta de éxito

*Para todo* subconjunto válido S, si el endpoint responde 200, cada objeto del array contiene
exactamente los campos `id`, `name`, `credits`, `cycle` y `type`, y NO contiene el campo
`prerequisites`.

**Validates: Requirements 5.1, 5.2**

---


## Casos no definidos en los requisitos

Situaciones que los requisitos no cubren explícitamente, con la decisión de diseño adoptada y su razón.

| Caso no definido | Decisión | Razón |
|---|---|---|
| `aprobados` contiene un código que no existe en el catálogo (ej. `"ZZZZZZ"`) | Ignorar silenciosamente: el código simplemente no coincide con ningún curso | Rechazarlo requeriría consultar el catálogo durante la validación, mezclando la capa de validación con la lógica de negocio; además el estudiante puede haber aprobado cursos de otra malla |
| `aprobados` contiene elementos duplicados (ej. `["1INF25","1INF25"]`) | Deduplicar al construir el `Set`; tratar como si apareciera una sola vez | El `Set` lo hace de forma natural en O(n); rechazarlo añadiría complejidad sin beneficio para el cálculo |
| Un curso del catálogo tiene un requisito cuyo código no existe en el catálogo | Tratar ese requisito como no satisfecho (nunca estará en `aprobados`) | Es el comportamiento natural del `Set.has()`; documentarlo evita asumir que el catálogo es consistente |
| Orden de los cursos en la respuesta | No garantizado; refleja el orden de iteración de `repositorio.listar()` | Ordenar añadiría coste y el cliente puede ordenar según su propia necesidad |
| Campo `cycle` con valor `null` en el catálogo | Incluir el curso normalmente; `cycle: null` es un valor válido según el contrato de respuesta | El contrato ya define `cycle` como `number \| null`; excluirlos sería una pérdida de información |
| `aprobados` es un array pero su body llega sin `Content-Type: application/json` | Express `express.json()` no parsea el body; `req.body` queda `undefined`; la validación de tipo responde 422 | Consistente con el flujo de validación existente; no requiere manejo especial |

---
## Error Handling

| Condición                           | Status | Body                                               |
|-------------------------------------|--------|----------------------------------------------------|
| `aprobados` no es array             | 422    | `{ "error": "aprobados debe ser un array" }`       |
| `aprobados.length > 500`            | 400    | `{ "error": "aprobados no puede superar 500 elementos" }` |
| Algún elemento fuera de patrón      | 400    | `{ "error": "elemento inválido en aprobados" }`    |
| Error no controlado en la ruta      | 500    | `{ "error": "internal server error" }` (middleware global existente) |

Los mensajes de error nunca exponen stack traces ni rutas del sistema de archivos.

---

## Testing Strategy

### Herramientas

- **Jest** (ya instalado) para tests unitarios y de integración.
- **supertest** (ya instalado) para tests de ruta HTTP.
- **fast-check** (a instalar como devDependency) para tests basados en propiedades.

### Tests de ruta — `tests/habilitados.test.js`

Tests de integración con supertest que cubren:

- Happy path con el ejemplo del enunciado (27 cursos, con 1INF29/30/31/32).
- `aprobados = []` → solo cursos sin requisitos.
- `aprobados` con todos los IDs del catálogo → array vacío.
- Validación de tipo: string, number, boolean, ausente → 422.
- Validación de tamaño: 501 elementos → 400.
- Validación de formato: `<script>`, minúsculas, vacío, >10 chars → 400.
- Orden de validación: payload que viola tipo+tamaño → recibe 422 (tipo primero).

### Tests unitarios de la función — `tests/habilitados.test.js`

Tests unitarios sobre `calcularHabilitados` importado directamente, sin HTTP:

- Casos concretos de correctitud y borde.
- Verificación de forma de cada objeto devuelto.

### Tests de propiedades — `tests/habilitados.test.js`

Usando **fast-check**, implementar una prueba por cada propiedad definida en este documento:

| Propiedad | Descripción                                   | Mínimo de iteraciones |
|-----------|-----------------------------------------------|-----------------------|
| Property 1 | Corrección del filtro                        | 100                   |
| Property 2 | Completitud del filtro                       | 100                   |
| Property 3 | Tipo rechaza todo no-array                   | 100                   |
| Property 4 | Tamaño rechaza arrays > 500                  | 100                   |
| Property 5 | Formato rechaza elementos inválidos          | 100                   |
| Property 6 | Forma de la respuesta de éxito               | 100                   |

Tag en cada test: `// Feature: habilitados, Property N: <texto>`

### Cobertura

La suite completa del proyecto debe alcanzar **≥ 80 % de cobertura de líneas** sobre
`src/**/*.js` (excluyendo `src/server.js`), medida con `jest --coverage`.

---

## Decisiones de los gates de CI

| Gate | Umbral | Bloquea / avisa | Etapa | Razón |
|---|---|---|---|---|
| SCA (npm audit) | Severidad alta o crítica | Bloquea | Push y PR a main | La política de TI prohíbe esas severidades en todo cambio que llega a main; las menores no la incumplen. |
| Secretos (gitleaks, historial completo) | 1 hallazgo no registrado como excepción | Bloquea | Push y PR a main | La política no admite secretos en el repositorio. Se revisa el historial porque borrar un archivo no elimina la clave de commits anteriores. |
| Cobertura (Jest) | Menos de 80 % de líneas | Bloquea | Push y PR a main | Es el mínimo que exige la política de TI. |
| SAST (Semgrep, extra) | Severidad ERROR | Bloquea | Push y PR a main | Analiza el código propio, que SCA no cubre; limitarlo a ERROR reduce el ruido por falsos positivos. |
