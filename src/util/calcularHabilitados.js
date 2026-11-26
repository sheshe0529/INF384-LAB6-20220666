const repositorio = require('../data/repositorio');

/**
 * Calcula los cursos que el estudiante puede cursar a continuación.
 *
 * @param {string[]} aprobados - Códigos de los cursos ya aprobados.
 * @returns {{ id: string, name: string, credits: number, cycle: number|null, type: string }[]}
 */
function calcularHabilitados(aprobados) {
  const aprobadosSet = new Set(aprobados);

  return repositorio
    .listar()
    .filter(
      (curso) =>
        !aprobadosSet.has(curso.id) &&
        curso.prerequisites.every((p) => aprobadosSet.has(p))
    )
    .map(({ id, name, credits, cycle, type }) => ({ id, name, credits, cycle, type }));
}

module.exports = { calcularHabilitados };
