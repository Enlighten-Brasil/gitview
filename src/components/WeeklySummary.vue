<script setup lang="ts">
import { computed, ref } from 'vue'
import { buildWeeklySummary } from '../summary'

// slideover com o resumo da última semana fechada — gerado na abertura
const open = ref(false)
const copied = ref(false)
const summary = computed(() => (open.value ? buildWeeklySummary() : null))

async function copy() {
  if (!summary.value)
    return
  await navigator.clipboard.writeText(summary.value.markdown)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}

function download() {
  if (!summary.value)
    return
  const blob = new Blob([summary.value.markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `resumo-${summary.value.weekKey}.md`
  a.click()
  URL.revokeObjectURL(url)
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
      <div class="flex gap-2">
        <UButton
          :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard'"
          :label="copied ? 'copiado!' : 'copiar markdown'"
          :color="copied ? 'success' : 'primary'"
          :disabled="!summary"
          @click="copy"
        />
        <UButton
          icon="i-lucide-download"
          label="baixar .md"
          color="neutral"
          variant="outline"
          :disabled="!summary"
          @click="download"
        />
      </div>
    </template>
  </USlideover>
</template>
