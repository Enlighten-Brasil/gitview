import { useToast } from '@nuxt/ui/composables'
import { ref } from 'vue'
import { reportT } from '@/report-i18n'
import { buildReportPdf } from '@/report-pdf'

/**
 * Exportação em PDF compartilhada — espelha a useMarkdownExport (issue #177):
 * o /reports e o resumo semanal (slideover) exportam o MESMO markdown do motor
 * como PDF nativo. Estado `exporting` pro botão e toasts no padrão 0.46;
 * `title` é o H1 do relatório (rodapé + propriedades do documento) e
 * `filename` já vem slugado pelo caller.
 */
export function usePdfExport() {
  const exporting = ref(false)
  const toast = useToast()

  async function exportPdf(markdown: string, opts: { title: string, filename: string }) {
    if (exporting.value)
      return
    exporting.value = true
    try {
      const { data } = await buildReportPdf(markdown, { title: opts.title })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = opts.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.add({ title: reportT('report.pdf.done'), description: opts.filename, color: 'success' })
    }
    catch (err) {
      toast.add({ title: reportT('report.pdf.error'), description: String((err as Error)?.message ?? err), color: 'error' })
    }
    finally {
      exporting.value = false
    }
  }

  return { exporting, exportPdf }
}
