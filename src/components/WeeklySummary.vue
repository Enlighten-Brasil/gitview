<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { computed, onUnmounted, ref } from 'vue'
import { buildWeeklySummary } from '../summary'

// slideover com o resumo da última semana fechada — gerado na abertura
const open = ref(false)
const copied = ref(false)
const toast = useToast()
const summary = computed(() => (open.value ? buildWeeklySummary() : null))

// timer do "copiado!" — guardado pra limpar no unmount (nada de timer órfão)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

// Clipboard API só existe em contexto seguro (https/localhost); fora dele resta o execCommand.
// queryCommandSupported ausente = suporte assumido (execCommand ainda funciona na maioria dos browsers)
const hasCopyPath = computed(() =>
  Boolean(navigator.clipboard?.writeText)
  || document.queryCommandSupported?.('copy') !== false,
)

function markCopied() {
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => (copied.value = false), 2000)
  toast.add({ title: 'Resumo copiado', description: 'markdown na área de transferência.', color: 'success' })
}

// fallback pra contexto não-seguro (http na LAN): textarea temporária + execCommand('copy')
function fallbackCopy(markdown: string): boolean {
  const textarea = document.createElement('textarea')
  textarea.value = markdown
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    return document.execCommand('copy')
  }
  finally {
    textarea.remove()
  }
}

async function copy() {
  if (!summary.value)
    return
  const markdown = summary.value.markdown
  let lastError: unknown

  // caminho moderno: Clipboard API (se existir)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(markdown)
      markCopied()
      return
    }
    catch (err) {
      lastError = err
    }
  }

  // fallback: textarea temporária (clipboard ausente ou writeText rejeitado)
  try {
    if (fallbackCopy(markdown)) {
      markCopied()
      return
    }
    lastError ??= new Error('cópia não suportada neste navegador')
  }
  catch (err) {
    lastError = err
  }

  toast.add({ title: 'Falha ao copiar o resumo', description: String((lastError as Error)?.message ?? lastError), color: 'error' })
}

onUnmounted(() => clearTimeout(copiedTimer))

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
  toast.add({ title: 'Resumo baixado', description: a.download, color: 'success' })
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
        <!-- decisão da issue #129: o resumo é relatório do time inteiro — mantém
             a natureza completa e NÃO segue o workScope (como os demais filtros) -->
        <p class="text-xs text-dimmed">
          relatório do time inteiro — ignora os filtros da sidebar, inclusive o escopo (e sempre exclui bots)
        </p>
      </div>
    </template>
  </USlideover>
</template>
