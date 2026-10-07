<script setup lang="ts">
import { filters, stats } from '../data'

const ranges = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: 'Tudo', months: null },
] as const

function onReposChange(e: Event) {
  const el = e.target as HTMLSelectElement
  filters.repos = [...el.selectedOptions].map(o => o.value)
}
function onAuthorsChange(e: Event) {
  const el = e.target as HTMLSelectElement
  filters.authors = [...el.selectedOptions].map(o => o.value)
}
</script>

<template>
  <div class="panel filter-bar">
    <div class="filter-group">
      <label>Período</label>
      <div class="range-group">
        <button
          v-for="r in ranges"
          :key="r.label"
          class="range-btn"
          :class="{ active: filters.rangeMonths === r.months }"
          @click="filters.rangeMonths = r.months"
        >
          {{ r.label }}
        </button>
      </div>
    </div>

    <div class="filter-group">
      <label>Repositórios (vazio = todos)</label>
      <select multiple @change="onReposChange">
        <option v-for="repo in stats?.repos ?? []" :key="repo" :value="repo">
          {{ repo }}
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>Devs (vazio = todos)</label>
      <select multiple @change="onAuthorsChange">
        <option v-for="a in stats?.authors ?? []" :key="a.name" :value="a.name">
          {{ a.name }}{{ a.bot ? ' 🤖' : '' }}
        </option>
      </select>
    </div>

    <div class="filter-group">
      <label>&nbsp;</label>
      <label style="text-transform: none; font-size: 13px; color: var(--text); cursor: pointer">
        <input type="checkbox" v-model="filters.showBots" /> incluir bots
      </label>
    </div>
  </div>
</template>
