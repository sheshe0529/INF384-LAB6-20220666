# Requirements Document

## Introduction

La funcionalidad **habilitados** expone el endpoint `POST /habilitados` en la API REST Express del
proyecto `malla-inf`. Dado un conjunto de códigos de cursos ya aprobados, el endpoint calcula y
devuelve los cursos que un estudiante puede cursar a continuación: aquellos que **no** están en la
lista de aprobados y cuyo conjunto completo de requisitos sí está cubierto por dicha lista. Un
curso sin requisitos siempre queda habilitado. El endpoint incluye validación defensiva de entrada
para rechazar payloads malformados, oversized o con contenido no permitido antes de ejecutar
cualquier cálculo.

## Glossary

- **Sistema**: la API REST Express del proyecto `malla-inf`.
- **Aprobados**: array de códigos de curso que el estudiante ya aprobó, recibido en el cuerpo de la
  petición.
- **Curso habilitado**: curso que no está en Aprobados y cuyos todos sus requisitos están en
  Aprobados.
- **Código de curso**: cadena que cumple el patrón `^[A-Z0-9]{1,10}$`.
- **Repositorio**: módulo `src/data/repositorio.js` que expone `listar()`, `listarPorCiclo(ciclo)` y
  `obtener(codigo)`.

---

## Requirements

### Requirement 1: Cálculo de cursos habilitados

**User Story:** Como estudiante, quiero enviar la lista de mis cursos aprobados y recibir los
cursos que puedo llevar a continuación, para planificar mi carga académica.

#### Acceptance Criteria

1. CUANDO se recibe `POST /habilitados` con un campo `aprobados` que es un array de cadenas
   válidas, EL SISTEMA DEBE responder 200 con un array JSON de objetos curso que no están en
   `aprobados` y cuyos todos sus requisitos están contenidos en `aprobados`.
2. CUANDO un curso del catálogo tiene `prerequisites` vacío y no está en `aprobados`, EL SISTEMA
   DEBE incluirlo en la respuesta de 200.
3. CUANDO `aprobados` es un array vacío `[]`, EL SISTEMA DEBE responder 200 con únicamente los
   cursos del catálogo que tienen `prerequisites` vacío.
4. CUANDO se recibe `POST /habilitados` con `aprobados: ["1INF25","1INF27","1INF49"]`, EL SISTEMA
   DEBE responder 200 con exactamente 27 cursos, incluyendo `1INF29`, `1INF30`, `1INF31` y
   `1INF32`.
5. CUANDO todos los cursos del catálogo están en `aprobados`, EL SISTEMA DEBE responder 200 con un
   array vacío `[]`.

---

### Requirement 2: Validación de tipo de campo

**User Story:** Como operador de la API, quiero que el sistema rechace payloads donde `aprobados`
no es un array, para evitar comportamientos incorrectos silenciosos.

#### Acceptance Criteria

1. SI `aprobados` no está presente en el cuerpo de la petición, EL SISTEMA DEBE responder 400 con
   `{ "error": "aprobados debe ser un array" }`.
2. SI `aprobados` es un string (p. ej. `"1INF25"`), EL SISTEMA DEBE responder 400 con
   `{ "error": "aprobados debe ser un array" }`.
3. SI `aprobados` es un número, booleano u otro tipo no-array, EL SISTEMA DEBE responder 400 con
   `{ "error": "aprobados debe ser un array" }`.
4. SI el cuerpo de la petición es JSON mal formado, EL SISTEMA DEBE responder 400 con
   `{ "error": <mensaje del parser> }` sin exponer stack traces ni rutas internas del servidor.

---

### Requirement 3: Validación de tamaño de entrada

**User Story:** Como operador de la API, quiero que el sistema rechace listas de aprobados
excesivamente largas y cuerpos demasiado grandes antes de ejecutar el cálculo.

#### Acceptance Criteria

1. SI `aprobados` es un array con más de 87 elementos, EL SISTEMA DEBE responder 400 con
   `{ "error": "aprobados no puede superar 87 elementos" }` sin ejecutar el cálculo de habilitados.
2. SI el cuerpo de la petición supera los 4 kb, EL SISTEMA DEBE responder 413 con
   `{ "error": "cuerpo demasiado grande" }`. Este rechazo es manejado por el middleware de error
   global, no por la lógica de la ruta.

---

### Requirement 4: Validación de formato de elementos

**User Story:** Como operador de la API, quiero que el sistema rechace códigos que no cumplan el
patrón permitido, para prevenir inyección de contenido y garantizar que solo se consulten
identificadores de curso válidos.

#### Acceptance Criteria

1. SI algún elemento de `aprobados` no cumple el patrón `^[A-Z0-9]{1,10}$`, EL SISTEMA DEBE
   responder 400 con `{ "error": "elemento inválido en aprobados" }`.
2. SI algún elemento de `aprobados` contiene caracteres especiales o etiquetas HTML (p. ej.
   `"1INF30<script>"`), EL SISTEMA DEBE responder 400 con `{ "error": "elemento inválido en
   aprobados" }` sin exponer stack traces ni rutas internas del servidor en la respuesta.
3. SI algún elemento de `aprobados` es una cadena vacía, EL SISTEMA DEBE responder 400 con
   `{ "error": "elemento inválido en aprobados" }`.
4. SI algún elemento de `aprobados` supera 10 caracteres, EL SISTEMA DEBE responder 400 con
   `{ "error": "elemento inválido en aprobados" }`.
5. SI algún elemento de `aprobados` es el número `123` (tipo number, no string), EL SISTEMA DEBE
   responder 400 con `{ "error": "elemento inválido en aprobados" }`.
6. SI algún elemento de `aprobados` es `null`, EL SISTEMA DEBE responder 400 con
   `{ "error": "elemento inválido en aprobados" }`.

---

### Requirement 5: Contrato de respuesta de éxito

**User Story:** Como cliente de la API, quiero que cada objeto del array de respuesta incluya los
campos definidos del curso, para poder mostrar la información al estudiante sin consultas
adicionales.

#### Acceptance Criteria

1. CUANDO EL SISTEMA responde 200, EL SISTEMA DEBE incluir en cada objeto del array los campos
   `id` (string), `name` (string), `credits` (number), `cycle` (number o null) y `type` (string).
2. CUANDO EL SISTEMA responde 200, EL SISTEMA DEBE excluir de cada objeto el campo `prerequisites`
   (no es necesario en la respuesta).

---

### Requirement 6: Orden de validación

**User Story:** Como operador de la API, quiero que las validaciones se apliquen en un orden
determinista, para que los mensajes de error sean predecibles y los tests sean reproducibles.

#### Acceptance Criteria

1. CUANDO el body supera 4 kb, EL SISTEMA DEBE rechazarlo con 413 antes de que llegue al router,
   mediante el middleware de limit de `express.json`.
2. CUANDO el cuerpo contiene `aprobados` que no es un array, EL SISTEMA DEBE aplicar primero la
   validación de tipo (Requirement 2) y responder 400 antes de evaluar tamaño o formato.
3. CUANDO `aprobados` es un array con más de 87 elementos, EL SISTEMA DEBE aplicar la validación
   de tamaño (Requirement 3) y responder 400 antes de evaluar el formato de los elementos.
4. CUANDO `aprobados` es un array de longitud válida pero con algún elemento inválido, EL SISTEMA
   DEBE aplicar la validación de formato (Requirement 4) y responder 400.

---

### Requirement 7: Calidad - cobertura de pruebas

**User Story:** Como equipo de TI, quiero una cobertura minima de pruebas, para detectar cambios sin probar.

#### Acceptance Criteria

1. SI la cobertura de lineas es menor a 80 %, EL PIPELINE DEBE terminar con estado fallido en el job cobertura.
