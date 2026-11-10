<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMarkdownExport } from '@/composables/useMarkdownExport'
import { usePdfExport } from '@/composables/usePdfExport'
import { loadDaily } from '@/data'
import { reportT } from '@/report-i18n'
import { buildWeeklySummary } from '../summary'

const { t } = useI18n({ useScope: 'global' })

// slideover com o resumo da última semana fechada — gerado na abertura
const open = ref(false)
const summary = computed(() => (open.value ? buildWeeklySummary() : null))

// daily.json opcional: sem ele o resumo cai no fallback semanal (issue #192)
onMounted(loadDaily)

// copiar/baixar moram na composable compartilhada com /reports (issue #177);
// o PDF nativo também (composable usePdfExport, mesma exportação das duas telas)
const { copied, hasCopyPath, copy, download } = useMarkdownExport('resumo')
const { exporting, exportPdf } = usePdfExport()

function onCopy() {
  if (summary.value)
    copy(summary.value.markdown)
}

function onDownload() {
  if (summary.value)
    download(summary.value.markdown, `resumo-${summary.value.weekKey}.md`)
}

function onPdf() {
  if (!summary.value)
    return
  // título = H1 do próprio markdown (rodapé + propriedades do documento)
  const title = summary.value.markdown.match(/^# (.*)$/m)?.[1] ?? t('ui.weekly.title')
  void exportPdf(summary.value.markdown, { title, filename: `resumo-${summary.value.weekKey}.pdf` })
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('ui.weekly.title')" :ui="{ content: 'max-w-xl' }">
    <UTooltip :text="t('ui.weekly.tooltip')">
      <UButton
        icon="i-lucide-file-text"
        color="neutral"
        variant="ghost"
        size="sm"
        :aria-label="t('ui.weekly.aria')"
      />
    </UTooltip>

    <template #body>
      <pre
        v-if="summary"
        class="font-mono text-xs leading-relaxed whitespace-pre-wrap"
      >{{ summary.markdown }}</pre>
      <p v-else class="text-sm text-dimmed">
        {{ t('ui.weekly.empty') }}
      </p>
    </template>

    <template #footer>
      <div class="flex flex-col gap-1.5 w-full">
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-file-down"
            :label="exporting ? reportT('report.pdf.generating') : reportT('report.pdf.button')"
            color="primary"
            variant="outline"
            :disabled="!summary || exporting"
            @click="onPdf"
          />
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard'"
            :label="copied ? t('ui.weekly.copied') : t('ui.weekly.copy')"
            :color="copied ? 'success' : 'primary'"
            :disabled="!summary || !hasCopyPath"
            @click="onCopy"
          />
          <UButton
            icon="i-lucide-download"
            :label="t('ui.weekly.download')"
            color="neutral"
            variant="outline"
            :disabled="!summary"
            @click="onDownload"
          />
        </div>
        <!-- decisão da issue #129: o resumo é relatório do time inteiro — mantém
             a natureza completa e NÃO segue o workScope (como os demais filtros) -->
        <p class="text-xs text-dimmed">
          {{ t('ui.weekly.note') }}
        </p>
      </div>
    </template>
  </USlideover>
</template>
