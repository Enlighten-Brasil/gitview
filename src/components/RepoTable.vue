<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { filteredMonthly, filteredTypes, stats } from '../data'
import { fmtDate, fmtInt } from '../format'
import { daysSinceLastRelease, lastTagLabel, releaseByRepo } from '../releases'
import { FIX_HOTSPOT_AMBER, FIX_HOTSPOT_RED, UNRELEASED_AMBER, UNRELEASED_RED } from '../thresholds'
import TablePanel from './TablePanel.vue'

const router = useRouter()

interface RepoRow {
  repo: string
  commits: number
  devs: number
  lastCommit: string | null
  lastTag: string | null
  daysSinceRelease: number | null
  unreleased: number | null // null = releases não coletadas
  fixPct: number
}

const rows = computed<RepoRow[]>(() => {
  // commits e devs ativos no período filtrado
  const byRepo = new Map<string, { commits: number, devs: Set<string> }>()
  for (const r of filteredMonthly.value) {
    const cur = byRepo.get(r.repo) ?? { commits: 0, devs: new Set<string>() }
    cur.commits += r.commits
    cur.devs.add(r.author)
    byRepo.set(r.repo, cur)
  }

  // fix% no período filtrado
  const fixByRepo = new Map<string, { fix: number, total: number }>()
  for (const r of filteredTypes.value) {
    const cur = fixByRepo.get(r.repo) ?? { fix: 0, total: 0 }
    cur.total += r.commits
    if (r.type === 'fix')
      cur.fix += r.commits
    fixByRepo.set(r.repo, cur)
  }

  const lastCommitByRepo = new Map((stats.value?.perRepo ?? []).map(r => [r.repo, r.lastCommit]))

  return [...byRepo.entries()]
    .map(([repo, v]) => {
      const rel = releaseByRepo.value.get(repo)
      const fix = fixByRepo.get(repo)
      return {
        repo,
        commits: v.commits,
        devs: v.devs.size,
        lastCommit: lastCommitByRepo.get(repo) ?? null,
        lastTag: lastTagLabel(repo),
        daysSinceRelease: daysSinceLastRelease(repo),
        unreleased: rel ? rel.unreleased : null,
        fixPct: fix && fix.total > 0 ? fix.fix / fix.total : 0,
      }
    })
    .sort((a, b) => b.commits - a.commits)
})

/** destaque para trabalho parado sem release */
function unreleasedColor(n: number | null): string {
  if (n == null || n === 0)
    return 'text-dimmed'
  if (n >= UNRELEASED_RED)
    return 'text-error font-medium'
  if (n >= UNRELEASED_AMBER)
    return 'text-warning font-medium'
  return ''
}

function open(repo: string) {
  router.push({ name: '/repos/[name]', params: { name: repo } })
}

/** o clique no link da 1ª célula já navega — não deixa o atalho da linha duplicar o push */
function onRowClick(e: MouseEvent, repo: string) {
  if ((e.target as HTMLElement).closest('a'))
    return
  open(repo)
}
</script>

<template>
  <TablePanel title="Repositórios" icon="i-lucide-git-branch" :count="rows.length">
    <div class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th class="num">
              commits
            </th>
            <th class="num">
              devs
            </th>
            <th class="num">
              % fix
            </th>
            <th class="num">
              último commit
            </th>
            <th class="num">
              última release
            </th>
            <th class="num">
              não liberados
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo" class="cursor-pointer hover:bg-accented/50" @click="onRowClick($event, r.repo)">
            <td class="font-medium">
              <RouterLink :to="{ name: '/repos/[name]', params: { name: r.repo } }" class="text-primary hover:underline">
                {{ r.repo }}
              </RouterLink>
            </td>
            <td class="num">
              {{ fmtInt(r.commits) }}
            </td>
            <td class="num">
              {{ r.devs }}
            </td>
            <td class="num">
              <span :class="r.fixPct >= FIX_HOTSPOT_RED ? 'text-error' : r.fixPct >= FIX_HOTSPOT_AMBER ? 'text-warning' : ''">
                {{ Math.round(r.fixPct * 100) }}%
              </span>
            </td>
            <td class="num whitespace-nowrap text-muted">
              {{ fmtDate(r.lastCommit) }}
            </td>
            <td class="num whitespace-nowrap">
              <template v-if="r.lastTag">
                <code class="text-xs bg-accented px-1 py-0.5 rounded">{{ r.lastTag }}</code>
                <span class="text-dimmed text-xs ml-1">há {{ r.daysSinceRelease }}d</span>
              </template>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num" :class="unreleasedColor(r.unreleased)">
              {{ r.unreleased == null ? '—' : r.unreleased }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="text-dimmed text-xs px-4 pb-3 pt-2">
      commits/devs/% fix seguem o filtro do período · não liberados = commits desde a última tag (≥{{ UNRELEASED_AMBER }} em amarelo, ≥{{ UNRELEASED_RED }} em vermelho) · clique no repo pra ver o detalhe
    </p>
  </TablePanel>
</template>
