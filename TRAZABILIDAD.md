# Trazabilidad

## Requisito → gate → evidencia

| Requisito | Gate (herramienta y umbral) | Bloquea / avisa | Etapa | Run fallido | Run corregido |
| --- | --- | --- | --- | --- | --- |
| RS-1 tipo (Req. 2) | Tests Jest RS-1, 0 fallos | Bloquea | push/PR | [tarea 2](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905427356/job/140200892094) | [tarea 3](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905643270) |
| RS-2 tamaño (Req. 3) | Tests Jest RS-2, 0 fallos | Bloquea | push/PR | [tarea 2](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905427356/job/140200892094) | [tarea 3](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905643270) |
| RS-3 formato (Req. 4) | Tests Jest RS-3, 0 fallos | Bloquea | push/PR | [tarea 2](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905427356/job/140200892094) | [tarea 3](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905643270) |
| Calidad: cobertura (Req. 7) | Jest, líneas >= 80 % | Bloquea | push/PR | [gates](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905900338) | [cobertura](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45906769269) |
| Dependencias | npm audit, alta o crítica | Bloquea | push/PR | [gates](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905900338) | [lodash](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45906783794) |
| Secretos | gitleaks, 0 hallazgos no exceptuados | Bloquea | push/PR | [gates](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905900338) | [excepción](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45907569963) |
| SAST | Semgrep, severidad ERROR | Bloquea | push/PR | Sin hallazgos | [job sast en verde](https://github.com/sheshe0529/INF384-LAB6-20220666/actions/runs/45905900338) |

En los runs de cobertura y lodash la corrección se ve en su job; otros jobs aún fallaban.

## Diagnóstico de secretos

gitleaks escanea todo el historial, por lo que retirar la clave del archivo no basta. Se trató como comprometida (rotación simulada, clave de laboratorio) y su huella se registró en `.gitleaksignore`.

## Cambios a la propuesta de Kiro

| Documento | Qué propuso Kiro | Qué cambiaste | Por qué |
| --- | --- | --- | --- |
| requirements.md, design.md, tasks.md | 422 si `aprobados` no es un array | 400 | `tech.md` define 400 para entrada inválida |
| design.md, tasks.md | `gitleaks-action@v2` con `args` | `gitleaks git` con `fetch-depth: 0` | Esos `args` no corresponden a v2 y no garantizan escanear todo el historial |