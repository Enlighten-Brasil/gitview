<script setup lang="ts">
/**
 * Relatórios (issue #177) — a entrega visível do motor da onda 2: assunto
 * (organização · time do team.json · dev sem bot) × período (6 presets) com a
 * query da URL como fonte ÚNICA reproduzível (leitura computada + escrita via
 * router.replace). Rota `filters: 'none'` — os filtros da sidebar ficam de
 * fora (o rodapé avisa); sem team.json/github.json/daily.json a página
 * degrada (mensagem/UAlert/rodapé do motor), nunca exceção.
 */
import type { ReportSubject, ReportWindow } from '@/report'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMarkdownExport } from '@/composables/useMarkdownExport'
import { stats } from '@/data'
import { githubError } from '@/github'
import { renderMarkdown } from '@/markdown'
import { buildReport, customWindow, presetWindow, rollingWindow } from '@/report'
import { loadTeam, team, teamLoadError } from '@/team'

definePage({
  meta: {
    section: 'reports',
    filters: 'none',
    title: 'Relatórios',
  },
})

// team.json não entra no shell (só github/releases) — quem precisa carrega
// (precedente branches.vue); loader com onErrorValue null
onMounted(loadTeam)

// ---------------------------------------------------------------------------
// vocabário bakeado (issue #177/#187) — NUNCA range/bots/scope (o do urlState);
// people= é opt-in estrita (`q.people === '1'`) e deliberada a cada visita:
// nunca persiste no LS_KEY (strip) — o boot não pode religar sozinho
// ---------------------------------------------------------------------------
type SubjectId = 'org' | 'team' | 'dev'
type PresetId = 'week-closed' | 'week-current' | '7d' | 'month-current' | '30d' | 'custom'

const SUBJECTS: { id: SubjectId, label: string }[] = [
  { id: 'org', label: 'Organização' },
  { id: 'team', label: 'Time' },
  { id: 'dev', label: 'Dev' },
]
const PRESETS: { id: PresetId, label: string }[] = [
  { id: 'week-closed', label: 'Semana fechada' },
  { id: 'week-current', label: 'Nesta semana (em curso)' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: 'month-current', label: 'Neste mês (em curso)' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: 'custom', label: 'Personalizado' },
]
const DEFAULT_PRESET: PresetId = '7d'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const LS_KEY = 'gitview-report-query'

const isSubject = (v: unknown): v is SubjectId => SUBJECTS.some(s => s.id === v)
const isPreset = (v: unknown): v is PresetId => PRESETS.some(p => p.id === v)

const route = useRoute()
const router = useRouter()

// ---------------------------------------------------------------------------
// query = fonte única (sanitização: valor inválido → default, nunca crash)
// ---------------------------------------------------------------------------
const state = computed(() => {
  const q = route.query
  const subject: SubjectId = isSubject(q.subject) ? q.subject : 'org'
  let preset: PresetId = isPreset(q.preset) ? q.preset : DEFAULT_PRESET
  const from = typeof q.from === 'string' && DATE_RE.test(q.from) ? q.from : null
  const to = typeof q.to === 'string' && DATE_RE.test(q.to) ? q.to : null
  // from/to só valem em custom com janela válida — caso contrário, default
  if (preset === 'custom' && (!from || !to || from > to))
    preset = DEFAULT_PRESET
  return {
    subject,
    team: typeof q.team === 'string' ? q.team : '',
    dev: typeof q.dev === 'string' ? q.dev : '',
    preset,
    from,
    to,
    // sanitização estrita: só a string '1' liga (array/repetido cai no default)
    people: q.people === '1',
  }
})
type ReportState = typeof state.value

/** estado → query (defaults omitidos p/ URL limpa; from/to só em custom) */
function queryOf(s: ReportState): Record<string, string> {
  const q: Record<string, string> = {}
  if (s.subject !== 'org')
    q.subject = s.subject
  if (s.subject === 'team' && s.team)
    q.team = s.team
  if (s.subject === 'dev' && s.dev)
    q.dev = s.dev
  if (s.preset !== DEFAULT_PRESET)
    q.preset = s.preset
  if (s.preset === 'custom' && s.from && s.to) {
    q.from = s.from
    q.to = s.to
  }
  if (s.people)
    q.people = '1'
  return q
}

function set(patch: Partial<ReportState>) {
  const q = queryOf({ ...state.value, ...patch })
  // strip do people no localStorage: a opt-in vale só a visita corrente
  const lsQuery = { ...q }
  delete lsQuery.people
  localStorage.setItem(LS_KEY, new URLSearchParams(lsQuery).toString())
  router.replace({ path: '/reports', query: q })
}

function savedQuery(): Record<string, string> | null {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw)
    return null
  const q: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(raw)) q[k] = v
  // defesa em profundidade: people nunca volta do LS, mesmo se gravado à mão
  delete q.people
  return Object.keys(q).length ? q : null
}

// última seleção explícita — re-aplicada quando um sub com âncora navega sem
// query (AppNav subLink); o path puro (rail) é o reset pro default documentado
let lastQuery = queryOf(state.value)
let booted = false

watch(() => route.fullPath, (full, prevFull) => {
  if (Object.keys(route.query).length > 0) {
    lastQuery = queryOf(state.value)
    booted = true
    return
  }
  // 1º acesso sem query → última escolha lembrada (localStorage)
  if (!booted) {
    booted = true
    const saved = savedQuery()
    if (saved)
      router.replace({ path: '/reports', query: saved })
    return
  }
  const prevHash = prevFull?.includes('#') ? `#${prevFull.slice(prevFull.indexOf('#') + 1)}` : ''
  if (route.hash && route.hash !== prevHash && Object.keys(lastQuery).length)
    router.replace({ path: route.path, query: lastQuery, hash: route.hash })
}, { immediate: true })

// ---------------------------------------------------------------------------
// assunto — time resolvido via renamedFrom; não resolvido → org + mensagem
// ---------------------------------------------------------------------------
const teamNames = computed(() => (team.value?.teams ?? []).map(t => t.name))
const devNames = computed(() =>
  (stats.value?.authors ?? []).filter(a => !a.bot).map(a => a.name).sort((a, b) => a.localeCompare(b)),
)

const resolved = computed<{ subject: ReportSubject, message: string }>(() => {
  const s = state.value
  if (s.subject === 'team') {
    const teams = team.value?.teams ?? []
    const match = teams.find(t => t.name === s.team) ?? teams.find(t => t.renamedFrom?.includes(s.team))
    if (match)
      return { subject: { kind: 'team', team: match.name }, message: '' }
    // team.json ainda carregando não é "não encontrado" (evita flash do alerta)
    if (team.value === null && !teamLoadError.value)
      return { subject: { kind: 'org' }, message: '' }
    return { subject: { kind: 'org' }, message: s.team ? `time não encontrado: ${s.team}` : 'sem times cadastrados' }
  }
  if (s.subject === 'dev') {
    if (s.dev && devNames.value.includes(s.dev))
      return { subject: { kind: 'dev', dev: s.dev }, message: '' }
    return { subject: { kind: 'org' }, message: s.dev ? `dev não encontrado: ${s.dev}` : 'sem devs cadastrados' }
  }
  return { subject: { kind: 'org' }, message: '' }
})

// ---------------------------------------------------------------------------
// período → janela (TUDO do motor — issues #176/#177: a página só mapeia
// chips; 7d/30d são janelas rolantes completas com delta limpo em qualquer
// dia, por isso são o default)
// ---------------------------------------------------------------------------
const windowOf = computed<ReportWindow>(() => {
  switch (state.value.preset) {
    case 'week-closed': return presetWindow('last-week')
    case 'week-current': return presetWindow('this-week')
    case 'month-current': return presetWindow('this-month')
    case '30d': return rollingWindow(30)
    case 'custom': return customWindow(state.value.from!, state.value.to!)
    default: return rollingWindow(7)
  }
})

const report = computed(() => buildReport(resolved.value.subject, windowOf.value.from, windowOf.value.to, windowOf.value.inProgress, { people: state.value.people }))

// ---------------------------------------------------------------------------
// controles
// ---------------------------------------------------------------------------
function dayIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function pickSubject(id: SubjectId) {
  // assunto novo já semeado (1ª opção) — o estado vazio vira alerta só pra
  // link quebrado, nunca pro fluxo da UI
  if (id === 'team')
    set({ subject: 'team', team: teamNames.value[0] ?? '' })
  else if (id === 'dev')
    set({ subject: 'dev', dev: devNames.value[0] ?? '' })
  else
    set({ subject: 'org' })
}

function pickPreset(id: PresetId) {
  if (id === 'custom') {
    // semeia o personalizado com a janela atual — a URL sempre reproduz algo
    const w = windowOf.value
    set({ preset: 'custom', from: dayIso(w.from), to: dayIso(w.to) })
    return
  }
  set({ preset: id })
}

const customFrom = ref('')
const customTo = ref('')
watch(state, (s) => {
  if (s.preset === 'custom') {
    customFrom.value = s.from ?? ''
    customTo.value = s.to ?? ''
  }
}, { immediate: true })

function applyCustom() {
  set({ preset: 'custom', from: customFrom.value, to: customTo.value })
}

// ---------------------------------------------------------------------------
// exportar (compartilhada com o WeeklySummary — fallbackCopy UMA definição só)
// ---------------------------------------------------------------------------
const { copied, hasCopyPath, copy, download } = useMarkdownExport('relatório')

// apresentação pura: cru × preview — fora da URL (o markdown exportado não muda)
const viewMode = ref<'preview' | 'raw'>('preview')
const previewHtml = computed(() => (report.value ? renderMarkdown(report.value.markdown) : ''))

// feedback 0.46: impressão abre o diálogo NATIVO do navegador — sem toast
function onPrint() {
  window.print()
}

function fileSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function onCopy() {
  if (report.value)
    copy(report.value.markdown)
}

function onDownload() {
  if (report.value)
    download(report.value.markdown, `${fileSlug(report.value.title)}.md`)
}
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <section id="assunto" class="flex flex-col gap-3 scroll-mt-16 no-print">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-dimmed">assunto</span>
        <UButton
          v-for="s in SUBJECTS"
          :key="s.id"
          :label="s.label"
          size="sm"
          color="neutral"
          :variant="state.subject === s.id ? 'solid' : 'soft'"
          @click="pickSubject(s.id)"
        />
        <USelect
          v-if="state.subject === 'team'"
          :model-value="state.team"
          :items="teamNames"
          size="sm"
          class="w-56"
          :placeholder="teamNames.length ? 'escolher time' : 'sem times cadastrados'"
          :disabled="!teamNames.length"
          @update:model-value="v => set({ team: String(v ?? '') })"
        />
        <USelect
          v-if="state.subject === 'dev'"
          :model-value="state.dev"
          :items="devNames"
          size="sm"
          class="w-56"
          placeholder="escolher dev"
          :disabled="!devNames.length"
          @update:model-value="v => set({ dev: String(v ?? '') })"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm text-dimmed">período</span>
        <UButton
          v-for="p in PRESETS"
          :key="p.id"
          :label="p.label"
          size="sm"
          color="neutral"
          :variant="state.preset === p.id ? 'solid' : 'soft'"
          @click="pickPreset(p.id)"
        />
        <template v-if="state.preset === 'custom'">
          <UInput v-model="customFrom" type="date" size="sm" aria-label="início do período" @change="applyCustom" />
          <span class="text-dimmed">→</span>
          <UInput v-model="customTo" type="date" size="sm" aria-label="fim do período" @change="applyCustom" />
        </template>
      </div>
    </section>

    <UAlert
      v-if="resolved.message"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Assunto não resolvido"
      :description="`${resolved.message} — mostrando a Organização.`"
    />
    <UAlert
      v-if="githubError"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Sem dados do GitHub"
      :description="`${githubError} para gerar o public/data/github.json (requer gh autenticado) — a seção de PRs do relatório fica de fora.`"
    />

    <section id="relatorio" class="flex flex-col gap-3 scroll-mt-16">
      <div class="flex flex-wrap items-center justify-between gap-2 no-print">
        <h1 class="text-lg font-semibold">
          {{ report?.title ?? 'Relatório' }}
        </h1>
        <div class="flex flex-wrap gap-2">
          <UButton
            label="incluir gestão de pessoas"
            size="sm"
            color="neutral"
            :variant="state.people ? 'solid' : 'soft'"
            @click="set({ people: !state.people })"
          />
          <UButton
            label="preview"
            size="sm"
            color="neutral"
            :variant="viewMode === 'preview' ? 'solid' : 'soft'"
            @click="viewMode = 'preview'"
          />
          <UButton
            label="markdown cru"
            size="sm"
            color="neutral"
            :variant="viewMode === 'raw' ? 'solid' : 'soft'"
            @click="viewMode = 'raw'"
          />
          <UButton
            icon="i-lucide-printer"
            label="imprimir"
            color="neutral"
            variant="outline"
            :disabled="!report"
            @click="onPrint"
          />
          <UButton
            :icon="copied ? 'i-lucide-check' : 'i-lucide-clipboard'"
            :label="copied ? 'copiado!' : 'copiar markdown'"
            :color="copied ? 'success' : 'primary'"
            :disabled="!report || !hasCopyPath"
            @click="onCopy"
          />
          <UButton
            icon="i-lucide-download"
            label="baixar .md"
            color="neutral"
            variant="outline"
            :disabled="!report"
            @click="onDownload"
          />
        </div>
      </div>
      <pre
        v-if="report && viewMode === 'raw'"
        class="font-mono text-xs leading-relaxed whitespace-pre-wrap rounded-lg border border-default p-4"
      >{{ report.markdown }}</pre>
      <div
        v-else-if="report"
        class="report-md rounded-lg border border-default p-4"
        v-html="previewHtml"
      />
      <p v-else class="text-sm text-dimmed">
        sem dados — rode a coleta primeiro
      </p>
      <!-- decisão da issue #177: o relatório é dia-preciso e ignorado pelos
           filtros da sidebar (como o resumo semanal, issue #129) -->
      <p class="text-xs text-dimmed no-print">
        relatório dia-preciso — pode divergir do dashboard da sidebar, que corta por mês; ignora os filtros da sidebar e sempre exclui bots.
      </p>
    </section>
  </div>
</template>
