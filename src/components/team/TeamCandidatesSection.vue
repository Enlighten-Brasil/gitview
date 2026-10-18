<script setup lang="ts">
import type { TeamCandidate } from '@/types'
/**
 * Seção "Sem mapeamento": identidades dos dados sem alias cadastrado
 * (team.json#candidates). Sugestão de associação por tokens do e-mail × nome
 * (conservadora: ≥2 tokens) — a confirmação continua manual. Ações saem por
 * emits; quem grava no perfil é o composable na página.
 */
import { computed, reactive, watch } from 'vue'

const props = defineProps<{
  candidates: TeamCandidate[]
  /** devs não-bot (alvos válidos de associação) */
  devNames: string[]
  editable: boolean
}>()

const emit = defineEmits<{
  'assign-login': [dev: string, login: string]
  'assign-emails': [dev: string, emails: string[]]
}>()

const assignTarget = reactive<Record<string, string>>({})

// sugestão de match — e-mail corporativo costuma ser nome.sobrenome@: cruza os
// tokens do local-part com os tokens do nome do dev. Conservador de propósito:
// exige ≥2 tokens casando; a sugestão só pré-seleciona o dropdown (um clique
// confirma), nunca associa sozinha.
function normTokens(s: string): string[] {
  return s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length >= 2)
}

const suggestions = computed(() => {
  const out: Record<string, string> = {}
  for (const c of props.candidates) {
    const sources = c.kind === 'author' ? (c.emails ?? []).map(e => e.split('@')[0] ?? '') : []
    let best: { name: string, ratio: number, matched: number } | null = null
    for (const src of sources) {
      const tokens = normTokens(src)
      if (tokens.length < 2)
        continue
      for (const d of props.devNames) {
        const nameTokens = new Set(normTokens(d))
        const matched = tokens.filter(t => nameTokens.has(t)).length
        if (matched < 2)
          continue
        const ratio = matched / Math.max(tokens.length, nameTokens.size)
        if (!best || ratio > best.ratio || (ratio === best.ratio && matched > best.matched))
          best = { name: d, ratio, matched }
      }
    }
    if (best && best.ratio >= 0.5)
      out[c.id] = best.name
  }
  return out
})

// pré-seleciona a sugestão sem sobrescrever escolha manual
watch(suggestions, (s) => {
  for (const [id, name] of Object.entries(s)) {
    if (!assignTarget[id])
      assignTarget[id] = name
  }
}, { immediate: true })

function assign(c: TeamCandidate) {
  const dev = assignTarget[c.id]
  if (!dev)
    return
  if (c.kind === 'login')
    emit('assign-login', dev, c.id)
  else
    emit('assign-emails', dev, c.emails ?? [])
}
</script>

<template>
  <section v-if="candidates.length" id="sem-mapeamento" class="flex flex-col gap-3 scroll-mt-16">
    <div class="flex items-center gap-2">
      <h2 class="font-medium">
        Sem mapeamento
      </h2>
      <UBadge color="warning" variant="subtle" size="sm">
        {{ candidates.length }}
      </UBadge>
    </div>
    <p class="text-sm text-dimmed">
      Identidades vistas nos dados sem alias cadastrado. Associe a um dev existente pra unificar.
    </p>
    <div class="flex flex-col gap-2">
      <div
        v-for="c in candidates"
        :key="`${c.kind}:${c.id}`"
        class="flex items-center gap-2 flex-wrap rounded-lg border border-warning/30 bg-warning/5 px-3 py-2"
      >
        <UIcon :name="c.kind === 'login' ? 'i-lucide-github' : 'i-lucide-git-commit-horizontal'" class="size-4 text-warning shrink-0" />
        <div class="min-w-0 flex-1">
          <span class="font-mono text-sm">{{ c.id }}</span>
          <span v-if="c.emails?.length" class="text-xs text-dimmed ml-2">{{ c.emails.join(', ') }}</span>
          <span v-if="c.prs != null" class="text-xs text-dimmed ml-2">{{ c.prs }} {{ c.prs === 1 ? 'PR/review' : 'PRs/reviews' }}</span>
        </div>
        <template v-if="editable">
          <UBadge
            v-if="suggestions[c.id] && assignTarget[c.id] === suggestions[c.id]"
            color="primary"
            variant="soft"
            size="xs"
            class="shrink-0"
          >
            sugestão
          </UBadge>
          <!-- UInputMenu com busca: a lista de devs cresce e o select puro não escala -->
          <UFormField label="associar a um dev" :ui="{ label: 'sr-only' }">
            <UInputMenu
              v-model="assignTarget[c.id]"
              :items="devNames"
              placeholder="associar a… (busca por nome)"
              size="xs"
              class="w-48"
            />
          </UFormField>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="!assignTarget[c.id]"
            :label="suggestions[c.id] && assignTarget[c.id] === suggestions[c.id] ? 'confirmar' : 'associar'"
            @click="assign(c)"
          />
        </template>
      </div>
    </div>
  </section>
</template>
