import { useToast } from '@nuxt/ui/composables'
import { computed, onUnmounted, ref } from 'vue'

/**
 * Copiar/baixar markdown (.md) — extraído do WeeklySummary (issue #177) pra
 * ser a ÚNICA implementação usada pelo resumo semanal (navbar) e pela página
 * /reports: clipboard API + fallback execCommand + Blob + toasts no padrão
 * 0.46. `noun` personaliza os títulos ("Resumo copiado", "Relatório baixado").
 */
export function useMarkdownExport(noun: string) {
  const copied = ref(false)
  const toast = useToast()
  const cap = noun.charAt(0).toUpperCase() + noun.slice(1)

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
    toast.add({ title: `${cap} copiado`, description: 'markdown na área de transferência.', color: 'success' })
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

  async function copy(markdown: string) {
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

    toast.add({ title: `Falha ao copiar o ${noun}`, description: String((lastError as Error)?.message ?? lastError), color: 'error' })
  }

  function download(markdown: string, filename: string) {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast.add({ title: `${cap} baixado`, description: filename, color: 'success' })
  }

  onUnmounted(() => clearTimeout(copiedTimer))

  return { copied, hasCopyPath, copy, download }
}
