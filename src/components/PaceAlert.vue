<script setup lang="ts">
import { computed } from 'vue'
import { pace } from '../data'

/** queda: ritmo atual <= 50% da média anterior; acelerando: >= 150% */
const falling = computed(() => pace.value.filter(r => r.ratio !== null && r.ratio <= 0.5))
const rising = computed(() => pace.value.filter(r => r.ratio !== null && r.ratio >= 1.5))

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}
</script>

<template>
  <div class="panel">
    <h2>Ritmo — últimas 4 semanas vs 8 anteriores</h2>

    <p v-if="falling.length === 0 && rising.length === 0" style="color: var(--text-dim); font-size: 13px">
      Todo mundo no ritmo habitual. 👍
    </p>

    <template v-if="falling.length">
      <h3 class="group-title down">📉 abaixo do ritmo</h3>
      <table>
        <tbody>
          <tr v-for="r in falling" :key="r.author">
            <td>{{ r.author }}</td>
            <td class="num">{{ r.recent }} commits / 4 sem</td>
            <td class="num" style="color: var(--text-dim)">média {{ r.prevAvg.toFixed(1) }}/sem</td>
            <td class="num del">{{ pct(r.ratio!) }}</td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-if="rising.length">
      <h3 class="group-title up">🚀 acelerando</h3>
      <table>
        <tbody>
          <tr v-for="r in rising" :key="r.author">
            <td>{{ r.author }}</td>
            <td class="num">{{ r.recent }} commits / 4 sem</td>
            <td class="num" style="color: var(--text-dim)">média {{ r.prevAvg.toFixed(1) }}/sem</td>
            <td class="num add">{{ pct(r.ratio!) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<style scoped>
.group-title {
  font-size: 13px;
  margin: 12px 0 6px;
  font-weight: 600;
}
.group-title.down { color: #f87171; }
.group-title.up { color: #4ade80; }
</style>
