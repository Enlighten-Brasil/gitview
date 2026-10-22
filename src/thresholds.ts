/**
 * Limiares de negócio centralizados (issue #26) — única fonte dos valores que
 * definem saudável / atenção / crítico em cards, alertas e resumos.
 * Antes viviam espalhados em 10+ arquivos e já divergiam entre si (o mesmo
 * conceito tinha valores diferentes em painéis que deveriam mostrar o mesmo
 * número). Qualquer ajuste de sensibilidade deve ser feito só aqui.
 *
 * Convenção: frações (0–1) para razões/percentuais, dias/contagens para
 * janelas. Os rótulos de UI interpolam as constantes — nunca texto solto.
 */

// --- Ritmo (PaceAlert · AlertStrip) — 4 últimas semanas vs 8 anteriores ---
/** queda: ritmo atual <= PACE_FALLING da média das 8 semanas anteriores */
export const PACE_FALLING = 0.5
/** acelerando: ritmo atual >= PACE_RISING da média anterior */
export const PACE_RISING = 1.5

// --- PRs parados (PrSummaryCards · PrStaleAlert · AlertStrip · summary.ts) ---
/** idade em dias que torna um PR aberto "parado" */
export const PR_STALE_DAYS = 14
/** quantidade de PRs parados que escala o alerta para erro */
export const PR_STALE_ERROR_COUNT = 5
/** idade em dias que pinta o PR parado de erro na lista */
export const PR_AGE_ERROR_DAYS = 30

// --- Merge sem review (ReviewCoverage · PrSummaryCards · AlertStrip) ---
/** % de merges sem review de outra pessoa considerado crítico */
export const MERGE_NO_REVIEW_RED = 0.2
/** % de merges sem review de outra pessoa considerado atenção */
export const MERGE_NO_REVIEW_AMBER = 0.1

// --- Inatividade (InactiveWatch · AlertStrip · summary.ts) — medida até hoje ---
/** dias sem commit que tornam o dev inativo (ignora bots) */
export const DEV_STALE_DAYS = 21
/** dias sem commit que pintam o dev inativo de erro */
export const DEV_STALE_ERROR_DAYS = 60
/** dias sem commit que tornam o repo inativo */
export const REPO_STALE_DAYS = 30
/** dias sem commit que pintam o repo inativo de erro */
export const REPO_STALE_ERROR_DAYS = 90

// --- Fix hotspots (FixHotspots · RepoTable) — % de commits de correção ---
/** % de commits fix considerado crítico (quente) */
export const FIX_HOTSPOT_RED = 0.35
/** % de commits fix considerado atenção */
export const FIX_HOTSPOT_AMBER = 0.25
/** amostra mínima de commits para calcular o % fix do repo */
export const FIX_HOTSPOT_MIN_COMMITS = 20

// --- Commits não liberados (RepoTable · RepoReleasesGrid · repos/[name] · AlertStrip) ---
/** commits desde a última tag que já merecem atenção */
export const UNRELEASED_AMBER = 20
/** commits desde a última tag considerados críticos */
export const UNRELEASED_RED = 50

// --- Fora do horário (OffHoursPanel · AlertStrip · summary.ts · data.ts) ---
/** % de fds+madrugada que caracteriza padrão preocupante */
export const OFF_HOURS_PCT = 0.25
/** fds ativos (dos últimos 4) na janela de 8 semanas que caracteriza padrão */
export const OFF_HOURS_WEEKENDS = 3
/** atenção: % de fds+madrugada abaixo do padrão, mas ainda alto */
export const OFF_HOURS_PCT_ATTENTION = 0.15
/** atenção: volume absoluto de fds+madrugada na janela fixa de 8 semanas */
export const OFF_HOURS_COUNT_ATTENTION = 5
/** ignora devs com menos que isso de commits no período */
export const OFF_HOURS_MIN_COMMITS = 20
/** ignora devs com menos que isso de commits na semana do resumo semanal */
export const OFF_HOURS_WEEK_MIN_COMMITS = 5

// --- Releases (RepoReleasesGrid) ---
/** dias desde a última tag que pintam a release de atrasada */
export const RELEASE_STALE_DAYS = 30

// --- Idade de PR aberto (PrOpenTable) ---
/** idade em dias que pinta a idade do PR de atenção */
export const PR_AGE_AMBER = 3
/** idade em dias que pinta a idade do PR de erro */
export const PR_AGE_RED = 7

// --- Dev principal (repos/[name]) — share do autor principal no período ---
/** % dos commits do período no autor principal que pinta o card de erro */
export const DEV_SHARE_RED = 0.7
/** % dos commits do período no autor principal que pinta o card de atenção */
export const DEV_SHARE_AMBER = 0.5

// --- Bus factor (BusFactor) — concentração de commits/reviews por repo ---
/** amostra mínima de commits no período para incluir o repo */
export const BUS_FACTOR_MIN_COMMITS = 10
/** reviews mínimas no repo para nomear o reviewer principal */
export const BUS_FACTOR_TOP_REVIEWER_MIN_REVIEWS = 3
/** reviews mínimas no repo para avaliar ponto cego de review */
export const BUS_FACTOR_BLIND_SPOT_MIN_REVIEWS = 5
/** % das reviews do repo que, nas mãos do dev principal, caracteriza ponto cego (espelha o gargalo de review) */
export const BUS_FACTOR_BLIND_SPOT_REVIEW_SHARE = 0.7
/** % de concentração de 1 dev considerado risco "alto" */
export const BUS_FACTOR_RISK_RED = 0.7
/** % de concentração de 1 dev considerado risco "médio" */
export const BUS_FACTOR_RISK_AMBER = 0.5
/** devs ativos no repo que ainda permitem "alto" por concentração */
export const BUS_FACTOR_HIGH_MAX_DEVS = 2

// --- Gargalo de review (ReviewBottleneck) — concentração de reviews por repo ---
/** reviews mínimas no período para incluir o repo */
export const REVIEW_BOTTLENECK_MIN_REVIEWS = 5
/** % das reviews do repo em 1 pessoa que caracteriza "gargalo" */
export const REVIEW_BOTTLENECK_RED = 0.7
/** % das reviews do repo em 1 pessoa que caracteriza "atenção" */
export const REVIEW_BOTTLENECK_AMBER = 0.5

// --- Delta dos cards de resumo (SummaryCards) ---
/** variação % absoluta até esse valor é exibida como "flat" */
export const DELTA_FLAT_PCT = 2
