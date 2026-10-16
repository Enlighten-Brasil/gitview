<script setup lang="ts">
import { computed } from 'vue'
import { filteredWeekly } from '../data'

/** campeão de cada semana + total de "títulos" por dev (no filtro atual) */
const data = computed(() => {
  const byWeek = new Map<string, Map<string, number>>()
  for (const r of filteredWeekly.value) {
    if (!byWeek.has(r.week))
      byWeek.set(r.week, new Map())
    const m = byWeek.get(r.week)!
    m.set(r.author, (m.get(r.author) ?? 0) + r.commits)
  }

  const weeks = [...byWeek.entries()]
    .map(([week, authors]) => {
      const [champion, commits] = [...authors.entries()].sort((a, b) => b[1] - a[1])[0]
      return { week, champion, commits }
    })
    .sort((a, b) => b.week.localeCompare(a.week))

  const titles = new Map<string, number>()
  for (const w of weeks) titles.set(w.champion, (titles.get(w.champion) ?? 0) + 1)
  const titleRank = [...titles.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count)

  return { recent: weeks.slice(0, 12), titleRank }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-trophy" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Campeão da semana</span>
      </div>
    </template>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>semana</th><th>dev</th><th class="num">
              commits
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in data.recent" :key="w.week">
            <td class="text-muted">
              {{ w.week }}
            </td>
            <td>{{ w.champion }}</td>
            <td class="num font-semibold">
              {{ w.commits }}
            </td>
          </tr>
        </tbody>
      </table>
      <table class="data-table">
        <thead>
          <tr>
            <th>títulos (período)</th><th class="num">
              🏆
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in data.titleRank" :key="t.author">
            <td>{{ t.author }}</td>
            <td class="num">
              <UBadge color="warning" variant="soft">
                {{ t.count }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </UCard>
</template>
