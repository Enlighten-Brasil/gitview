<script setup lang="ts">
import { computed } from 'vue'
import { filteredTypes } from '../data'

interface RepoFix {
  repo: string
  total: number
  fix: number
  fixPct: number
}

/** % de commits fix por repo no período filtrado — fix alto sustentado sugere instabilidade/dívida */
const rows = computed<RepoFix[]>(() => {
  const byRepo = new Map<string, { fix: number, total: number }>()
  for (const r of filteredTypes.value) {
    const cur = byRepo.get(r.repo) ?? { fix: 0, total: 0 }
    cur.total += r.commits
    if (r.type === 'fix')
      cur.fix += r.commits
    byRepo.set(r.repo, cur)
  }
  return [...byRepo.entries()]
    .map(([repo, v]) => ({ repo, ...v, fixPct: v.total > 0 ? v.fix / v.total : 0 }))
    .filter(r => r.total >= 20) // ignora repos com amostra pequena
    .sort((a, b) => b.fixPct - a.fixPct)
})

function risk(r: RepoFix): { color: 'error' | 'warning' | 'success', label: string, hex: string } {
  if (r.fixPct >= 0.35)
    return { color: 'error', label: 'quente', hex: 'var(--ui-error)' }
  if (r.fixPct >= 0.25)
    return { color: 'warning', label: 'atenção', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'ok', hex: 'var(--ui-success)' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-flame" class="size-4 text-error" />
        <span class="text-sm font-semibold text-highlighted">Fix hotspots — % de correção por repo</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Sem dados suficientes no período filtrado.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th style="width: 34%">
              % fix
            </th>
            <th class="num">
              fix
            </th>
            <th class="num">
              commits
            </th>
            <th class="num">
              status
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">
              {{ r.repo }}
            </td>
            <td>
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 rounded bg-accented overflow-hidden">
                  <div class="h-full rounded" :style="{ width: `${Math.round(r.fixPct * 100)}%`, background: risk(r).hex }" />
                </div>
                <span class="num text-xs w-9">{{ Math.round(r.fixPct * 100) }}%</span>
              </div>
            </td>
            <td class="num">
              {{ r.fix }}
            </td>
            <td class="num">
              {{ r.total }}
            </td>
            <td class="num">
              <UBadge :color="risk(r).color" variant="soft">
                {{ risk(r).label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        quente = ≥35% dos commits são fix · atenção = ≥25% · repos com &lt;20 commits no período são ignorados
      </p>
    </template>
  </UCard>
</template>
