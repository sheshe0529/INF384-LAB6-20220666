const express = require('express');
const { calcularHabilitados } = require('../util/calcularHabilitados');

const router = express.Router();

// POST /habilitados
// Body: { "aprobados": string[] }
// Responde 200 con el array de cursos habilitados.
// (Sin validaciones en esta etapa — se agregan en la tarea 3)
router.post('/', (req, res) => {
  const { aprobados } = req.body;
  const resultado = calcularHabilitados(aprobados);
  res.status(200).json(resultado);
});

module.exports = router;
