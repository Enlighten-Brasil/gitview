---
"gitview": minor
---

feat(dashboard): Visao geral ganha fluxo de entrega, releases recentes, top devs e pulso do time

Composicao nova em (dashboard)/index.vue na ordem numeros -> alertas -> ritmo -> entrega -> pessoas:
CommitsTimeline x TypeMix (mix de tipos), PrFlow (KPIs de PRs + sparkline merged x criados em 12 semanas)
x RecentReleases (ultimas tags + repos em silencio), TopDevs (ranking por commits com PRs merged)
x TeamPulse (campeao da semana, ritmo 4v8, fora do horario). Logica pura em src/overview.ts e
src/weeklyWinners.ts (formula extraida do WeeklyChampions) com testes; ChartPanel ganha slots pre/footer.
