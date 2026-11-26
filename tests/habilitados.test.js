/**
 * Tests de flujo funcional para POST /habilitados
 * Feature: habilitados
 */

const request = require('supertest');
const fc = require('fast-check');
const app = require('../src/app');
const { calcularHabilitados } = require('../src/util/calcularHabilitados');
const repositorio = require('../src/data/repositorio');

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Devuelve todos los IDs del catálogo */
function todosLosIds() {
  return repositorio.listar().map((c) => c.id);
}

/** Arbitrario fast-check: subconjunto de IDs del catálogo (array sin duplicados) */
const subconjuntoArb = fc.array(
  fc.constantFrom(...todosLosIds()),
  { minLength: 0, maxLength: todosLosIds().length }
).map((arr) => [...new Set(arr)]);

// ─── Tests de integración HTTP ────────────────────────────────────────────────

describe('POST /habilitados — flujo funcional', () => {

  // Requirement 1.3
  test('aprobados=[] → 200 con exactamente los cursos de prerequisites vacíos', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Todo lo devuelto debe tener prerequisites vacíos en el catálogo
    const catalogMap = new Map(repositorio.listar().map((c) => [c.id, c]));
    for (const curso of res.body) {
      expect(catalogMap.get(curso.id).prerequisites).toEqual([]);
    }

    // No debe faltar ningún curso con prerequisites vacíos
    const conPrereqVacio = repositorio.listar().filter((c) => c.prerequisites.length === 0);
    expect(res.body.length).toBe(conPrereqVacio.length);
  });

  // Requirement 1.4
  test('aprobados=["1INF25","1INF27","1INF49"] → 200 con exactamente 27 cursos incluyendo 1INF29/30/31/32', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(27);

    const ids = res.body.map((c) => c.id);
    expect(ids).toContain('1INF29');
    expect(ids).toContain('1INF30');
    expect(ids).toContain('1INF31');
    expect(ids).toContain('1INF32');
  });

  // Requirement 1.5
  test('aprobados con todos los IDs del catálogo → 200 con array vacío', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: todosLosIds() })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Requirements 5.1, 5.2 — forma de cada objeto
  test('cada objeto del resultado contiene exactamente id, name, credits, cycle, type y no prerequisites', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF25', '1INF27', '1INF49'] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);

    for (const curso of res.body) {
      const keys = Object.keys(curso).sort();
      expect(keys).toEqual(['credits', 'cycle', 'id', 'name', 'type']);
      expect(curso).not.toHaveProperty('prerequisites');
    }
  });

});

// ─── Tests unitarios sobre la función pura ────────────────────────────────────

describe('calcularHabilitados — función pura', () => {

  // Requirement 1.2
  test('curso con prerequisites vacío y no en aprobados se incluye', () => {
    const resultado = calcularHabilitados([]);
    const ids = resultado.map((c) => c.id);
    // 1GES92 tiene prerequisites vacíos y no está en aprobados
    expect(ids).toContain('1GES92');
  });

  // Requirement 1.1 — corrección básica
  test('1INF25 en aprobados → 1INF30 (prereq: 1INF25) debe aparecer en habilitados', () => {
    const resultado = calcularHabilitados(['1INF25']);
    const ids = resultado.map((c) => c.id);
    expect(ids).toContain('1INF30');
  });

  test('1INF25 en aprobados → 1INF32 con prereq [1INF27, 1INF25] no aparece (falta 1INF27)', () => {
    const resultado = calcularHabilitados(['1INF25']);
    const ids = resultado.map((c) => c.id);
    expect(ids).not.toContain('1INF32');
  });

});

// ─── Property tests (fast-check) ─────────────────────────────────────────────

describe('Property 1: Corrección del filtro — id ∉ S y prerequisites ⊆ S', () => {
  // Feature: habilitados, Property 1: Corrección del filtro
  // Validates: Requirements 1.1, 1.2
  test('para cualquier subconjunto S cada resultado cumple id ∉ S y prerequisites ⊆ S', () => {
    const catalogMap = new Map(repositorio.listar().map((c) => [c.id, c]));

    fc.assert(
      fc.property(subconjuntoArb, (S) => {
        const aprobadosSet = new Set(S);
        const resultado = calcularHabilitados(S);

        for (const curso of resultado) {
          // id no está en aprobados
          if (aprobadosSet.has(curso.id)) return false;

          // todos los prerequisites están en aprobados
          const original = catalogMap.get(curso.id);
          if (!original) return false;
          for (const p of original.prerequisites) {
            if (!aprobadosSet.has(p)) return false;
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 2: Completitud del filtro — ningún habilitado queda fuera', () => {
  // Feature: habilitados, Property 2: Completitud del filtro
  // Validates: Requirements 1.1, 1.2
  test('para cualquier subconjunto S ningún curso habilitado queda fuera del resultado', () => {
    const catalogo = repositorio.listar();

    fc.assert(
      fc.property(subconjuntoArb, (S) => {
        const aprobadosSet = new Set(S);
        const resultado = calcularHabilitados(S);
        const resultadoIds = new Set(resultado.map((c) => c.id));

        for (const curso of catalogo) {
          const debeEstarHabilitado =
            !aprobadosSet.has(curso.id) &&
            curso.prerequisites.every((p) => aprobadosSet.has(p));

          if (debeEstarHabilitado && !resultadoIds.has(curso.id)) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ─── RS-1: Validación de tipo (Requisito 2) ───────────────────────────────────

describe('RS-1 — Validación de tipo de aprobados', () => {

  // Requirement 2.1
  test('aprobados ausente → 400 "aprobados debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados debe ser un array' });
  });

  // Requirement 2.2
  test('aprobados = "1INF25" (string) → 400 "aprobados debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: '1INF25' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados debe ser un array' });
  });

  // Requirement 2.3
  test('aprobados = 42 (número) → 400 "aprobados debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: 42 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados debe ser un array' });
  });

  // Requirement 2.3
  test('aprobados = true (booleano) → 400 "aprobados debe ser un array"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: true })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados debe ser un array' });
  });

  // Feature: habilitados, Property 3: Tipo rechaza todo no-array
  // Validates: Requirements 2.1, 2.2, 2.3
  test('Property 3: cualquier valor no-array → 400 "aprobados debe ser un array"', async () => {
    // Genera valores que no son arrays: strings, numbers, booleans, null, plain objects
    const nonArrayArb = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.float(),
      fc.boolean(),
      fc.constant(null),
      fc.record({ x: fc.integer() })
    );

    await fc.assert(
      fc.asyncProperty(nonArrayArb, async (value) => {
        const res = await request(app)
          .post('/habilitados')
          .send({ aprobados: value })
          .set('Content-Type', 'application/json');

        return (
          res.status === 400 &&
          res.body.error === 'aprobados debe ser un array'
        );
      }),
      { numRuns: 100 }
    );
  });

});

// ─── RS-2: Validación de tamaño (Requisito 3) ────────────────────────────────

describe('RS-2 — Validación de tamaño de aprobados', () => {

  // Requirement 3.1
  test('array de 88 elementos válidos → 400 "aprobados no puede superar 87 elementos"', async () => {
    // Generar 88 códigos válidos únicos (patrón ^[A-Z0-9]{1,10}$)
    const elementos = Array.from({ length: 88 }, (_, i) => `A${String(i).padStart(4, '0')}`);

    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: elementos })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados no puede superar 87 elementos' });
  });

  // Requirement 3.2
  test('body con 5000 códigos (supera 4 kb) → 413 "cuerpo demasiado grande"', async () => {
    // Generar un payload que supere los 4 kb
    const elementos = Array.from({ length: 5000 }, (_, i) => `A${String(i).padStart(9, '0')}`);

    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: elementos })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ error: 'cuerpo demasiado grande' });
  });

  // Feature: habilitados, Property 4: Tamaño rechaza arrays con 88–300 elementos
  // Validates: Requirements 3.1
  test('Property 4: array con 88–300 elementos válidos → 400 "aprobados no puede superar 87 elementos"', async () => {
    // Genera un array de longitud entre 88 y 300 con elementos válidos
    const largeValidArrayArb = fc
      .integer({ min: 88, max: 300 })
      .chain((len) =>
        fc.constant(
          Array.from({ length: len }, (_, i) => `A${String(i).padStart(4, '0')}`)
        )
      );

    await fc.assert(
      fc.asyncProperty(largeValidArrayArb, async (elementos) => {
        const res = await request(app)
          .post('/habilitados')
          .send({ aprobados: elementos })
          .set('Content-Type', 'application/json');

        return (
          res.status === 400 &&
          res.body.error === 'aprobados no puede superar 87 elementos'
        );
      }),
      { numRuns: 100 }
    );
  });

});

// ─── RS-3: Validación de formato (Requisito 4) ───────────────────────────────

describe('RS-3 — Validación de formato de elementos', () => {

  // Requirement 4.2
  test('["1INF30<script>"] → 400 "elemento inválido en aprobados" sin stack trace', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['1INF30<script>'] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
    // No debe haber stack trace ni ruta interna
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\w/);
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules/);
  });

  // Requirement 4.1 (minúsculas no cumplen ^[A-Z0-9]{1,10}$)
  test('["abc"] (minúsculas) → 400 "elemento inválido en aprobados"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['abc'] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
  });

  // Requirement 4.3
  test('[""] (vacío) → 400 "elemento inválido en aprobados"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [''] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
  });

  // Requirement 4.4
  test('["12345678901"] (11 chars) → 400 "elemento inválido en aprobados"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: ['12345678901'] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
  });

  // Requirement 4.5
  test('[123] (elemento número, no string) → 400 "elemento inválido en aprobados"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [123] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
  });

  // Requirement 4.6
  test('[null] (elemento null) → 400 "elemento inválido en aprobados"', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: [null] })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'elemento inválido en aprobados' });
  });

  // Feature: habilitados, Property 5: Formato rechaza elementos inválidos
  // Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
  test('Property 5: array con un elemento inválido en posición aleatoria → 400', async () => {
    // Genera un elemento inválido: string que no cumple ^[A-Z0-9]{1,10}$, o no-string
    const invalidElementArb = fc.oneof(
      // Cadena vacía
      fc.constant(''),
      // Demasiado larga (11–20 chars, solo A-Z0-9)
      fc.stringMatching(/^[A-Z0-9]{11,20}$/),
      // Contiene minúsculas
      fc.stringMatching(/[a-z]+/),
      // Contiene caracteres especiales
      fc.stringMatching(/[^A-Z0-9]+/).filter((s) => s.length >= 1 && s.length <= 10),
      // Tipo no-string
      fc.integer(),
      fc.boolean(),
      fc.constant(null)
    );

    // Genera un array de 0–86 elementos válidos y luego inserta un inválido
    const validElementArb = fc.stringMatching(/^[A-Z0-9]{1,10}$/);
    const arrayWithOneInvalidArb = fc
      .tuple(
        fc.array(validElementArb, { minLength: 0, maxLength: 86 }),
        invalidElementArb,
        fc.integer({ min: 0, max: 86 })
      )
      .map(([valids, invalid, pos]) => {
        const arr = [...valids];
        const insertAt = Math.min(pos, arr.length);
        arr.splice(insertAt, 0, invalid);
        return arr;
      });

    await fc.assert(
      fc.asyncProperty(arrayWithOneInvalidArb, async (elementos) => {
        const res = await request(app)
          .post('/habilitados')
          .send({ aprobados: elementos })
          .set('Content-Type', 'application/json');

        return (
          res.status === 400 &&
          res.body.error === 'elemento inválido en aprobados'
        );
      }),
      { numRuns: 100 }
    );
  });

});

// ─── RS-4: JSON mal formado (Requisito 2.4) ───────────────────────────────────

describe('RS-4 — JSON mal formado', () => {

  // Requirement 2.4
  test('body con JSON mal formado → 400 con { error: <mensaje> } sin stack trace', async () => {
    const res = await request(app)
      .post('/habilitados')
      .set('Content-Type', 'application/json')
      .send('{aprobados:');

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(typeof res.body.error).toBe('string');
    // No debe exponer stack trace ni rutas internas
    expect(JSON.stringify(res.body)).not.toMatch(/at\s+\w/);
    expect(JSON.stringify(res.body)).not.toMatch(/node_modules/);
  });

});

// ─── Orden de validación (Requisito 6) ───────────────────────────────────────

describe('Orden de validación (Requisito 6)', () => {

  // Requirement 6.2: tipo se valida antes que tamaño
  test('aprobados = "texto" (string) → 400 de tipo, no de tamaño', async () => {
    const res = await request(app)
      .post('/habilitados')
      .send({ aprobados: 'texto' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'aprobados debe ser un array' });
  });

});
