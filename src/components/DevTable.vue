<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { filters, isBot, stats } from '../data'
import { fmtDate, fmtInt, fmtRatio } from '../format'

const router = useRouter()

/** clique na linha abre a página dedicada do dev */
function openDev(author: string) {
  router.push({ name: '/devs/[name]', params: { name: author } })
}

type Key = 'commits' | 'additions' | 'deletions' | 'repos' | 'activeDays' | 'lastCommit' | 'streak'
const sortKey = ref<Key>('commits')
const sortAsc = ref(false)

function toggleSort(key: Key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  }
  else {
    sortKey.value = key
    sortAsc.value = false
  }
}

const visibleAuthors = computed(() => {
  const selected = filters.authors
  const rows = (stats.value?.perAuthor ?? []).filter(a => filters.showBots || !isBot(a.author))
  const filtered = selected.length ? rows.filter(r => selected.includes(r.author)) : rows
  return [...filtered].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
    return sortAsc.value ? cmp : -cmp
  })
})

/** commits/dia ativo — fonte única da precisão; a tabela formata pt-BR (fmtRatio)
 * e o CSV mantém o ponto decimal pra continuar parseável */
function commitsPerDay(a: { commits: number, activeDays: number }): number {
  return a.commits / Math.max(a.activeDays, 1)
}

/** dev selecionado no filtro global — destaca a linha (classe .selected) */
function isSelected(author: string) {
  return filters.authors.includes(author)
}

/** escapa um campo no padrão RFC 4180 (aspas duplas quando há separador/aspas/quebra de linha) */
function csvField(value: string | number) {
  const s = String(value)
  const LF = String.fromCharCode(10) // quebra de linha (LF)
  const CR = String.fromCharCode(13) // retorno de carro (CR)
  const needsQuotes = s.includes(';') || s.includes('"') || s.includes(CR) || s.includes(LF)
  return needsQuotes ? `"${s.replace(/"/g, '""')}"` : s
}

/** chave de data local (YYYY-MM-DD) — evita o slice do ISO, que é UTC e pode cair no dia anterior */
function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function exportCsv() {
  const header = ['dev', 'commits', 'linhas_adicionadas', 'linhas_removidas', 'repos', 'dias_ativos', 'commits_por_dia_ativo', 'streak_atual', 'streak_max', 'ultimo_commit']
  const lines = visibleAuthors.value.map(a => [
    a.author,
    a.commits,
    a.additions,
    a.deletions,
    a.repos,
    a.activeDays,
    commitsPerDay(a).toFixed(1), // ponto decimal: CSV parseável (a tabela usa fmtRatio)
    a.streak,
    a.longestStreak,
    fmtDate(a.lastCommit), // mesmo formato (fuso local) exibido na tabela
  ].map(csvField).join(';'))
  const BOM = String.fromCharCode(0xFEFF) // BOM p/ Excel abrir UTF-8 corretamente
  const csv = `${BOM + header.map(csvField).join(';')}\n${lines.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ranking-time-${localDateKey(new Date())}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Ranking do time (histórico completo)
        </h2>
        <UButton
          icon="i-lucide-download"
          label="CSV"
          color="neutral"
          variant="soft"
          size="xs"
          @click="exportCsv"
        />
      </div>
    </template>
    <table class="data-table">
      <thead>
        <tr>
          <th>Dev</th>
          <th class="num sortable" @click="toggleSort('commits')">
            commits
          </th>
          <th class="num sortable" @click="toggleSort('additions')">
            + linhas
          </th>
          <th class="num sortable" @click="toggleSort('deletions')">
            − linhas
          </th>
          <th class="num sortable" @click="toggleSort('repos')">
            repos
          </th>
          <th class="num sortable" @click="toggleSort('activeDays')">
            dias ativos
          </th>
          <th class="num">
            commits/dia ativo
          </th>
          <th class="num sortable" @click="toggleSort('streak')">
            streak 🔥
          </th>
          <th class="num sortable" @click="toggleSort('lastCommit')">
            último commit
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="a in visibleAuthors"
          :key="a.author"
          class="dev-row"
          :class="{ selected: isSelected(a.author) }"
          @click="openDev(a.author)"
        >
          <td>{{ a.author }}</td>
          <td class="num">
            {{ fmtInt(a.commits) }}
          </td>
          <td class="num add">
            {{ fmtInt(a.additions) }}
          </td>
          <td class="num del">
            {{ fmtInt(a.deletions) }}
          </td>
          <td class="num">
            {{ a.repos }}
          </td>
          <td class="num">
            {{ a.activeDays }}
          </td>
          <td class="num">
            {{ fmtRatio(commitsPerDay(a)) }}
          </td>
          <td class="num">
            <div class="flex items-center justify-end gap-1.5">
              <UBadge
                icon="i-lucide-flame"
                :label="String(a.streak)"
                :color="a.streak > 0 ? 'warning' : 'neutral'"
                :variant="a.streak > 0 ? 'subtle' : 'outline'"
                size="sm"
              />
              <span class="text-xs text-dimmed">máx {{ a.longestStreak }}</span>
            </div>
          </td>
          <td class="num">
            {{ fmtDate(a.lastCommit) }}
          </td>
        </tr>
      </tbody>
    </table>
  </UCard>
</template>

<style scoped>
.dev-row {
  cursor: pointer;
}
.dev-row:hover {
  background: var(--ui-bg-elevated);
}
.dev-row.selected {
  background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
}
</style>
