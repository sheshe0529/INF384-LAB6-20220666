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
