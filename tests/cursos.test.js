const request = require('supertest');
const app = require('../src/app');

describe('GET /cursos', () => {
  // 1.1 — listar todos los cursos
  test('devuelve 200 con los 87 cursos y los campos esperados', async () => {
    const res = await request(app).get('/cursos');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(87);

    for (const curso of res.body) {
      expect(curso).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          credits: expect.any(Number),
          type: expect.stringMatching(/^(obligatorio|electivo)$/),
        }),
      );
      // cycle is a number for obligatory courses, null for elective courses without a fixed cycle
      expect(curso.cycle === null || typeof curso.cycle === 'number').toBe(true);
    }
  });

  // 1.2 — filtro por ciclo válido
  test('devuelve 200 con 3 cursos cuando ciclo=10', async () => {
    const res = await request(app).get('/cursos?ciclo=10');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.every((c) => c.cycle === 10)).toBe(true);
  });

  // 1.3a — ciclo fuera del rango (4)
  test('devuelve 400 cuando ciclo=4 (fuera de rango)', async () => {
    const res = await request(app).get('/cursos?ciclo=4');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  // 1.3b — ciclo no numérico
  test('devuelve 400 cuando ciclo=abc', async () => {
    const res = await request(app).get('/cursos?ciclo=abc');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });

  // 1.3c — ciclo decimal (no entero)
  test('devuelve 400 cuando ciclo=5.5', async () => {
    const res = await request(app).get('/cursos?ciclo=5.5');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'ciclo debe ser un entero entre 5 y 10' });
  });
});

describe('GET /cursos/:codigo', () => {
  // 2.1 — curso existente con requisitos
  test('devuelve 200 con el detalle y los prerequisitos resueltos para 1INF30', async () => {
    const res = await request(app).get('/cursos/1INF30');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: '1INF30',
      name: 'Programación 3',
      credits: 5.0,
      cycle: 6,
      type: 'obligatorio',
      prerequisites: [{ id: '1INF25', name: 'Programación 2' }],
    });
  });

  // 2.1 — curso existente sin requisitos
  test('devuelve 200 con prerequisites vacío para un curso sin requisitos', async () => {
    const res = await request(app).get('/cursos/1INF25');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('1INF25');
    expect(res.body.prerequisites).toEqual([]);
  });

  // 2.1 — campos presentes en la respuesta
  test('la respuesta incluye id, name, credits, cycle, type y prerequisites', async () => {
    const res = await request(app).get('/cursos/1INF32');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: '1INF32',
      name: expect.any(String),
      credits: expect.any(Number),
      type: expect.any(String),
      prerequisites: expect.any(Array),
    });
    // cycle puede ser número o null
    expect(res.body.cycle === null || typeof res.body.cycle === 'number').toBe(true);
    // prerequisitos deben tener id y name
    for (const prereq of res.body.prerequisites) {
      expect(prereq).toEqual({ id: expect.any(String), name: expect.any(String) });
    }
  });

  // 2.2 — código inexistente
  test('devuelve 404 cuando el código no existe', async () => {
    const res = await request(app).get('/cursos/NOEXISTE');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'curso no encontrado' });
  });
});
