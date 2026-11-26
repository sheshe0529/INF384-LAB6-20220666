const express = require('express');
const { calcularHabilitados } = require('../util/calcularHabilitados');

const router = express.Router();

const CODIGO_RE = /^[A-Z0-9]{1,10}$/;

// POST /habilitados
// Body: { "aprobados": string[] }
// Responde 200 con el array de cursos habilitados.
router.post('/', (req, res) => {
  const { aprobados } = req.body;

  // 1. Tipo
  if (!Array.isArray(aprobados)) {
    return res.status(400).json({ error: 'aprobados debe ser un array' });
  }

  // 2. Tamaño
  if (aprobados.length > 87) {
    return res.status(400).json({ error: 'aprobados no puede superar 87 elementos' });
  }

  // 3. Formato
  for (const elemento of aprobados) {
    if (typeof elemento !== 'string' || !CODIGO_RE.test(elemento)) {
      return res.status(400).json({ error: 'elemento inválido en aprobados' });
    }
  }

  const resultado = calcularHabilitados(aprobados);
  res.status(200).json(resultado);
});

module.exports = router;
