<script setup lang="ts">
import { computed } from 'vue'
import { ghName, stalePrs } from '../github'

const STALE_DAYS = 14

const stale = computed(() => stalePrs(STALE_DAYS))
const oldest = computed(() => stale.value[0] ?? null)
const shown = computed(() => stale.value.slice(0, 5))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-hourglass" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">PRs parados — abertos há {{ STALE_DAYS }}+ dias</span>
        <UBadge v-if="stale.length" :color="stale.length >= 5 ? 'error' : 'warning'" variant="soft" size="sm" class="ml-auto">
          {{ stale.length }}
        </UBadge>
      </div>
    </template>

    <p v-if="stale.length === 0" class="text-muted text-sm">
      Nenhum PR parado além de {{ STALE_DAYS }} dias. 👍
    </p>

    <template v-else>
      <table class="data-table">
        <tbody>
          <tr v-for="pr in shown" :key="`${pr.repo}#${pr.number}`">
            <td class="max-w-[380px]">
              <a :href="pr.url" target="_blank" rel="noopener" class="text-primary hover:underline truncate block">
                #{{ pr.number }} {{ pr.title }}
              </a>
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ pr.repo }}
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ ghName(pr.author) }}
            </td>
            <td class="num whitespace-nowrap">
              <span :class="pr.ageDays >= 30 ? 'text-error font-medium' : 'text-warning'">{{ pr.ageDays }}d</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        <template v-if="stale.length > shown.length">
          mostrando {{ shown.length }} de {{ stale.length }} ·
        </template>
        mais antigo: <b>{{ oldest?.ageDays }}d</b> · lista completa na aba Pull requests
      </p>
    </template>
  </UCard>
</template>
