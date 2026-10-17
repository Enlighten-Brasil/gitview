<script setup lang="ts">
import StatCard from './StatCard.vue'

/**
 * Grid de stat-cards compartilhado (issue #41) — o bloco `cards-grid` +
 * v-for de StatCard que estava espelhado em devs/[name] e repos/[name].
 */
defineProps<{
  cards: { value: string, label: string, icon?: string, color?: string }[]
}>()
</script>

<template>
  <div class="cards-grid">
    <StatCard v-for="c in cards" :key="c.label" :value="c.value" :label="c.label" :icon="c.icon" :color="c.color" />
  </div>
</template>
