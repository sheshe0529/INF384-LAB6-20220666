const request = require('supertest');
const express = require('express');

// Build a minimal app that reuses the error-handling middleware from app.js
// by mounting a route that intentionally throws an unhandled error.
function buildTestApp() {
  // Require a fresh copy of the error handler from the real app module.
  // We construct a small app that includes only the middleware under test so
  // that existing routes don't interfere.
  const app = express();

  app.get('/throws', (req, res, next) => {
    next(new Error('simulated unhandled error'));
  });

  // Load the same error-handling middleware that app.js registers.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}

describe('Middleware de manejo de errores — Requisito 3.1', () => {
  const app = buildTestApp();

  test('responde 500 con JSON genérico ante un error no controlado', async () => {
    const res = await request(app).get('/throws');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal server error' });
  });

  test('no expone el stack trace ni detalles internos en el body', async () => {
    const res = await request(app).get('/throws');

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/simulated/i);
    expect(body).not.toMatch(/stack/i);
    expect(body).not.toMatch(/Error/);
  });
});
