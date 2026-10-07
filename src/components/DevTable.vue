<script setup lang="ts">
import { computed, ref } from 'vue'
import { filters, isBot, stats } from '../data'

type Key = 'commits' | 'additions' | 'deletions' | 'repos' | 'activeDays' | 'lastCommit' | 'streak'
const sortKey = ref<Key>('commits')
const sortAsc = ref(false)

function toggleSort(key: Key) {
  if (sortKey.value === key) sortAsc.value = !sortAsc.value
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

function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}
</script>

<template>
  <div class="panel">
    <h2>Ranking do time (histórico completo)</h2>
    <table>
      <thead>
        <tr>
          <th>Dev</th>
          <th class="num" @click="toggleSort('commits')">commits</th>
          <th class="num" @click="toggleSort('additions')">+ linhas</th>
          <th class="num" @click="toggleSort('deletions')">− linhas</th>
          <th class="num" @click="toggleSort('repos')">repos</th>
          <th class="num" @click="toggleSort('activeDays')">dias ativos</th>
          <th class="num" @click="toggleSort('streak')">streak 🔥</th>
          <th class="num" @click="toggleSort('lastCommit')">último commit</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="a in visibleAuthors" :key="a.author">
          <td>{{ a.author }}</td>
          <td class="num">{{ fmt(a.commits) }}</td>
          <td class="num add">{{ fmt(a.additions) }}</td>
          <td class="num del">{{ fmt(a.deletions) }}</td>
          <td class="num">{{ a.repos }}</td>
          <td class="num">{{ a.activeDays }}</td>
          <td class="num">{{ a.streak }} <span style="color: var(--text-dim)">(máx {{ a.longestStreak }})</span></td>
          <td class="num">{{ fmtDate(a.lastCommit) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
