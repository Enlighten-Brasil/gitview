<script setup lang="ts">
import { computed } from 'vue'
import { filters, stats } from '../data'

const ranges = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: 'Tudo', months: null },
] as const

const visibleAuthors = computed(() =>
  (stats.value?.authors ?? []).filter(a => filters.showBots || !a.bot),
)

const hasSelection = computed(() => filters.repos.length > 0 || filters.authors.length > 0)

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

function clearSelection() {
  filters.repos = []
  filters.authors = []
}
</script>

<template>
  <div class="panel filter-bar">
    <div class="filter-row">
      <span class="filter-label">Período</span>
      <div class="chip-group">
        <button
          v-for="r in ranges"
          :key="r.label"
          class="chip"
          :class="{ active: filters.rangeMonths === r.months }"
          @click="filters.rangeMonths = r.months"
        >
          {{ r.label }}
        </button>
      </div>
      <label class="bots-toggle">
        <input type="checkbox" v-model="filters.showBots" /> incluir bots
      </label>
      <button v-if="hasSelection" class="chip clear" @click="clearSelection">limpar filtros ✕</button>
    </div>

    <div class="filter-row">
      <span class="filter-label">Repos</span>
      <div class="chip-group">
        <button
          v-for="repo in stats?.repos ?? []"
          :key="repo"
          class="chip"
          :class="{ active: filters.repos.includes(repo) }"
          @click="toggle(filters.repos, repo)"
        >
          {{ repo }}
        </button>
      </div>
    </div>

    <div class="filter-row">
      <span class="filter-label">Devs</span>
      <div class="chip-group">
        <button
          v-for="a in visibleAuthors"
          :key="a.name"
          class="chip"
          :class="{ active: filters.authors.includes(a.name) }"
          @click="toggle(filters.authors, a.name)"
        >
          {{ a.name }}
        </button>
      </div>
    </div>
  </div>
</template>
