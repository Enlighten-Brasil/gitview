/**
 * Gráficos do perfil do dev (issue #41) — donut por repositório + heatmap de
 * horários (matriz compartilhada da issue #35). A timeline não entra aqui: no
 * perfil ela reusa o `CommitsTimeline` com a prop `author`.
 */
import type { EChartsOption } from 'echarts'
import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { commitsByRepoPeriod } from '../aggregations'
import { donutBase } from '../chartTheme'
import { rangeLabel, scopeMatches, stats } from '../filters'
import { filters, inPeriodMonth, isCustomRange } from '../filters-core'
import { getComposer } from '../i18n'
import { useWeekdayHourHeatmap } from './useHeatmapMatrix'

export function useDevCharts(dev: MaybeRefOrGetter<string>) {
  // o período se aplica no perfil: com preset/range ativo tudo fica restrito;
  // "Tudo" = histórico completo (heatmap capado em 24M na agregação).
  // O escopo de trabalho (issue #129) também se aplica — sem ele o perfil
  // ignoraria os chips da sidebar (filtro fantasma)
  const periodFiltered = computed(() => filters.rangeMonths !== null || isCustomRange())

  // linhas mensais do dev dentro do período/escopo — base do donut por repositório
  const myMonthly = computed(() =>
    (stats.value?.monthly ?? []).filter(r => r.author === toValue(dev) && inPeriodMonth(r.month) && scopeMatches(r)),
  )

  const repoOption = computed<EChartsOption>(() =>
    donutBase(commitsByRepoPeriod(myMonthly.value).map(({ repo, commits }) => ({ name: repo, value: commits }))),
  )

  // heatmap de horários do dev — matriz compartilhada (issue #35); visualMap
  // escondido: a célula de meia largura (ao lado do pie) não comporta a legenda
  const heatOption = useWeekdayHourHeatmap({
    rows: () => (stats.value?.heatmap ?? []).filter(r => r.author === toValue(dev) && inPeriodMonth(r.month) && scopeMatches(r)),
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    visualMap: false,
  })

  // título do heatmap: em "Tudo" a agregação cobre no máx. 24M; com período, o range
  const heatTitle = computed(() => {
    // `t` na montagem do valor: a troca de locale reavalia o computed
    const { t } = getComposer()
    return periodFiltered.value
      ? t('chart.heat.titleRange', { range: rangeLabel.value })
      : t('chart.heat.title24')
  })

  return { repoOption, heatOption, heatTitle }
}
