---
'gitview': patch
---

guard/shell: estado de erro alcançável e saída no build estático — o alerta de falha de carga do dashboard (inalcançável: o guard já mandava para /setup sem dados) sai de cena, o /setup do build estático ganha diagnóstico honesto com link de saída para a documentação do projeto (URL do próprio repositório, versionada no package.json) e falha de rede no carregamento dos dados mostra toast com "Tentar de novo" em vez de silêncio (404 = sem arquivo continua caindo no wizard).
