const express = require('express');
const repositorio = require('../data/repositorio');

const router = express.Router();

router.get('/', (req, res) => {
  const { ciclo } = req.query;

  if (ciclo !== undefined) {
    const num = Number(ciclo);
    // Must be a finite integer between 5 and 10 (no decimals, no NaN, no floats like "5.5")
    if (!Number.isInteger(num) || num < 5 || num > 10) {
      return res.status(400).json({ error: 'ciclo debe ser un entero entre 5 y 10' });
    }
    return res.json(repositorio.listarPorCiclo(num));
  }

  res.json(repositorio.listar());
});

router.get('/:codigo', (req, res) => {
  const curso = repositorio.obtener(req.params.codigo);

  if (!curso) {
    return res.status(404).json({ error: 'curso no encontrado' });
  }

  const prerequisites = curso.prerequisites.map((id) => {
    const prereq = repositorio.obtener(id);
    return { id, name: prereq ? prereq.name : id };
  });

  res.json({
    id: curso.id,
    name: curso.name,
    credits: curso.credits,
    cycle: curso.cycle,
    type: curso.type,
    prerequisites,
  });
});

module.exports = router;
