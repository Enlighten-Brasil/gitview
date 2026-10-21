<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useMarkdownExport } from '@/composables/useMarkdownExport'
import { loadDaily } from '@/data'
import { buildWeeklySummary } from '../summary'

// slideover com o resumo da última semana fechada — gerado na abertura
const open = ref(false)
const summary = computed(() => (open.value ? buildWeeklySummary() : null))

// daily.json opcional: sem ele o resumo cai no fallback semanal (issue #192)
onMounted(loadDaily)

// copiar/baixar moram na composable compartilhada com /reports (issue #177)
const { copied, hasCopyPath, copy, download } = useMarkdownExport('resumo')

function onCopy() {
  if (summary.value)
    copy(summary.value.markdown)
}

function onDownload() {
  if (summary.value)
    download(summary.value.markdown, `resumo-${summary.value.weekKey}.md`)
}
</script>

<template>
  <USlideover v-model:open="open" title="Resumo da semana" :ui="{ content: 'max-w-xl' }">
    <UTooltip text="resumo da semana exportável">
      <UButton
        icon="i-lucide-file-text"
        color="neutral"
        variant="ghost"
        size="sm"
        aria-label="resumo da semana"
      />
    </UTooltip>

    <template #body>
      <pre
        v-if="summary"
        class="font-mono text-xs leading-relaxed whitespace-pre-wrap"
      >{{ summary.markdown }}</pre>
      <p v-else class="text-sm text-dimmed">
        sem dados — rode a coleta primeiro
      </p>
    </template>

    <template #footer>
      <div class="flex flex-col gap-1.5 w-full">
        <div class="flex gap-2">
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard'"
            :label="copied ? 'copiado!' : 'copiar markdown'"
            :color="copied ? 'success' : 'primary'"
            :disabled="!summary || !hasCopyPath"
            @click="onCopy"
          />
          <UButton
            icon="i-lucide-download"
            label="baixar .md"
            color="neutral"
            variant="outline"
            :disabled="!summary"
            @click="onDownload"
          />
        </div>
        <!-- decisão da issue #129: o resumo é relatório do time inteiro — mantém
             a natureza completa e NÃO segue o workScope (como os demais filtros) -->
        <p class="text-xs text-dimmed">
          relatório do time inteiro — ignora os filtros da sidebar, inclusive o escopo (e sempre exclui bots)
        </p>
      </div>
    </template>
  </USlideover>
</template>
