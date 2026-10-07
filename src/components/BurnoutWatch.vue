<script setup lang="ts">
import { burnout, type BurnoutRow } from '../data'

/** 🟠 padrão preocupante: commitou em 3+ dos últimos 4 fds ou 25%+ fora do horário */
function status(b: BurnoutRow): { icon: string; label: string } {
  if (b.weekendsActive >= 3 || b.offHoursPct >= 0.25) return { icon: '🟠', label: 'padrão' }
  if (b.weekend + b.night >= 5) return { icon: '🟡', label: 'atenção' }
  return { icon: '🟢', label: 'pontual' }
}
</script>

<template>
  <div class="panel">
    <h2>Fora do horário — últimas 8 semanas 🌙</h2>

    <p v-if="burnout.length === 0" style="color: var(--text-dim); font-size: 13px">
      Nenhum commit de fim de semana ou madrugada no período. 👍
    </p>

    <table v-else>
      <thead>
        <tr>
          <th>dev</th>
          <th class="num">fds</th>
          <th class="num">madrugada</th>
          <th class="num">% fora do horário</th>
          <th class="num">fds ativos (últ. 4)</th>
          <th class="num">status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="b in burnout" :key="b.author">
          <td>{{ b.author }}</td>
          <td class="num">{{ b.weekend }}</td>
          <td class="num">{{ b.night }}</td>
          <td class="num">{{ Math.round(b.offHoursPct * 100) }}%</td>
          <td class="num">{{ b.weekendsActive }}/4</td>
          <td class="num" :title="status(b).label">{{ status(b).icon }}</td>
        </tr>
      </tbody>
    </table>

    <p style="color: var(--text-dim); font-size: 12px; margin: 10px 0 0">
      fds = sáb/dom · madrugada = 22h–6h · 🟠 padrão (3+ fds seguidos ou ≥25% fora do horário) · 🟡 atenção · 🟢 pontual
    </p>
  </div>
</template>
