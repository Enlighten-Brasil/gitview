<script setup lang="ts">
import { ghName, openAging } from '../github'

/** cor da idade: >7d vermelho, >3d amarelo, senão neutro */
function ageColor(days: number): string {
  if (days > 7) return 'text-error font-semibold'
  if (days > 3) return 'text-warning font-semibold'
  return 'text-muted'
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0', header: 'py-3 px-4 sm:px-4' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-git-pull-request-arrow" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">PRs abertos — mais antigos primeiro</span>
        <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
          {{ openAging.length }}
        </UBadge>
      </div>
    </template>

    <div v-if="openAging.length" class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>PR</th>
            <th>repo</th>
            <th>autor</th>
            <th class="num">
              idade
            </th>
            <th class="num">
              arquivos
            </th>
            <th class="num">
              +/−
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pr in openAging" :key="`${pr.repo}#${pr.number}`">
            <td class="max-w-[420px]">
              <a
                :href="pr.url"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline truncate block"
                :title="pr.title"
              >
                #{{ pr.number }} {{ pr.title }}
              </a>
              <UBadge v-if="pr.draft" color="neutral" variant="soft" size="sm" class="mt-0.5">
                rascunho
              </UBadge>
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ pr.repo }}
            </td>
            <td class="whitespace-nowrap">
              {{ ghName(pr.author) }}
            </td>
            <td class="num whitespace-nowrap" :class="ageColor(pr.ageDays)">
              {{ pr.ageDays === 0 ? 'hoje' : `${pr.ageDays}d` }}
            </td>
            <td class="num text-muted">
              {{ pr.changedFiles }}
            </td>
            <td class="num whitespace-nowrap">
              <span class="add">+{{ pr.additions.toLocaleString('pt-BR') }}</span>
              <span class="del ml-1">−{{ pr.deletions.toLocaleString('pt-BR') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="py-10 text-center text-sm text-muted">
      Nenhum PR aberto nos filtros atuais 🎉
    </div>
  </UCard>
</template>
