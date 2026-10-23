<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { filters, isBot, stats } from '../data'
import { fmtDate, fmtInt, fmtRatio } from '../format'
import TablePanel from './TablePanel.vue'

const router = useRouter()
const toast = useToast()
const { t } = useI18n({ useScope: 'global' })

/** clique na linha abre a página dedicada do dev (atalho — o link na 1ª célula é o caminho acessível) */
function openDev(author: string) {
  router.push({ name: '/devs/[name]', params: { name: author } })
}

/** o clique no link da 1ª célula já navega — não deixa o atalho da linha duplicar o push */
function onRowClick(e: MouseEvent, author: string) {
  if ((e.target as HTMLElement).closest('a'))
    return
  openDev(author)
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

/** aria-sort do th: só a coluna ativa anuncia a direção; as demais ficam 'none' */
function ariaSort(key: Key): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key)
    return 'none'
  return sortAsc.value ? 'ascending' : 'descending'
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
  // ponytail: colunas do CSV são dado parseável — ficam em pt-BR até o export ganhar locale
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
  toast.add({ title: t('ui.devTable.csvExported'), description: link.download, color: 'success' })
}
</script>

<template>
  <TablePanel :title="t('ui.devTable.title')">
    <template #actions>
      <UButton
        icon="i-lucide-download"
        label="CSV"
        color="neutral"
        variant="soft"
        size="xs"
        @click="exportCsv"
      />
    </template>
    <table class="data-table">
      <thead>
        <tr>
          <th>{{ t('ui.th.dev') }}</th>
          <th class="num sortable" :aria-sort="ariaSort('commits')">
            <button type="button" class="th-sort" @click="toggleSort('commits')">
              {{ t('ui.th.commits') }}
              <UIcon v-if="sortKey === 'commits'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num sortable" :aria-sort="ariaSort('additions')">
            <button type="button" class="th-sort" @click="toggleSort('additions')">
              {{ t('ui.th.additions') }}
              <UIcon v-if="sortKey === 'additions'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num sortable" :aria-sort="ariaSort('deletions')">
            <button type="button" class="th-sort" @click="toggleSort('deletions')">
              {{ t('ui.th.deletions') }}
              <UIcon v-if="sortKey === 'deletions'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num sortable" :aria-sort="ariaSort('repos')">
            <button type="button" class="th-sort" @click="toggleSort('repos')">
              {{ t('ui.th.repos') }}
              <UIcon v-if="sortKey === 'repos'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num sortable" :aria-sort="ariaSort('activeDays')">
            <button type="button" class="th-sort" @click="toggleSort('activeDays')">
              {{ t('ui.th.activeDays') }}
              <UIcon v-if="sortKey === 'activeDays'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num">
            {{ t('ui.th.perDay') }}
          </th>
          <th class="num sortable" :aria-sort="ariaSort('streak')">
            <button type="button" class="th-sort" @click="toggleSort('streak')">
              {{ t('ui.th.streak') }}
              <UIcon name="i-lucide-flame" class="size-3 shrink-0" />
              <UIcon v-if="sortKey === 'streak'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
          <th class="num sortable" :aria-sort="ariaSort('lastCommit')">
            <button type="button" class="th-sort" @click="toggleSort('lastCommit')">
              {{ t('ui.th.lastCommit') }}
              <UIcon v-if="sortKey === 'lastCommit'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
            </button>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="a in visibleAuthors"
          :key="a.author"
          class="dev-row"
          :class="{ selected: isSelected(a.author) }"
          @click="onRowClick($event, a.author)"
        >
          <td>
            <RouterLink :to="{ name: '/devs/[name]', params: { name: a.author } }" class="dev-link">
              {{ a.author }}
            </RouterLink>
          </td>
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
              <span class="text-xs text-dimmed">{{ t('ui.devTable.max', { n: a.longestStreak }) }}</span>
            </div>
          </td>
          <td class="num">
            {{ fmtDate(a.lastCommit) }}
          </td>
        </tr>
      </tbody>
    </table>
  </TablePanel>
</template>

<style scoped>
.th-sort {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 2px;
  width: 100%;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.th-sort:hover {
  color: var(--ui-text-highlighted);
}
.dev-link {
  color: inherit;
  text-decoration: none;
}
.dev-link:hover {
  color: var(--ui-primary);
}
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
