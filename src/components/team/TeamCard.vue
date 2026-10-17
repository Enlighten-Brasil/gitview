<script setup lang="ts">
import type { MemberAddItem, TeamMetrics } from '@/team'
/**
 * Card de time editável: identidade (avatar/nome/descrição), paleta de cor em
 * popover, membros como chips removíveis + combobox de adição (marca quem já
 * está em outro time), métricas agregadas e remoção com confirmação (useConfirm).
 * Fluxo unidirecional (issue #40): campos entram por defineModel e mudanças de
 * membros/remoção saem por emits carregando o `cid` — o card nunca muta estado
 * do pai. `disabled` (build estático) esconde toda a UI de edição.
 */
import { computed, ref } from 'vue'
import { useConfirm } from '@/composables/useConfirm'
import { fmtDaysAgo } from '@/format'
import { avatarBgClass, initialsOf, TEAM_PALETTE } from '@/team'

const props = defineProps<{
  /** id estável do time — toda ação sai carregando ele (identidade por cid) */
  cid: string
  /** membros atuais (só leitura — mudanças saem por add-member/remove-member) */
  members: string[]
  /** opções do add-member já filtradas (sem quem está neste time) */
  items: MemberAddItem[]
  metrics: TeamMetrics
  disabled?: boolean
}>()

const emit = defineEmits<{
  'add-member': [cid: string, value: string]
  'remove-member': [cid: string, value: string]
  'remove': [cid: string]
}>()
const name = defineModel<string>('name', { default: '' })
const description = defineModel<string>('description', { default: '' })
const color = defineModel<string>('color', { default: '' })

const colorOpen = ref(false)
const customColor = ref('')
const confirm = useConfirm()
const pick = ref<string | null>(null)

function setColor(c: string) {
  color.value = c
  colorOpen.value = false
}

// hex válido: #rgb, #rrggbb ou #rrggbbaa (3/6/8 dígitos) — o {3,8} antigo
// aceitava comprimentos quebrados como #abc1 e aplicava cor inválida no avatar.
// O critério-de-pronto da issue #30 exige #abc1 (4 dígitos) REJEITADO, então
// #rgba fica de fora de propósito (ver PR: a Proposta dizia 3/4/6/8 em conflito
// com o próprio critério e com a mensagem de erro citada)
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/** mensagem de erro do campo de cor custom (vazia/limpa = sem erro) */
const customColorError = computed(() => {
  const v = customColor.value.trim()
  return v && !HEX_RE.test(v) ? 'use #rgb, #rrggbb ou #rrggbbaa' : undefined
})

function commitCustom() {
  const v = customColor.value.trim()
  // hex inválido não é mais descartado em silêncio: o campo exibe o erro via
  // :error (UFormField propaga aria-invalid ao UInput) e o valor fica pra correção
  if (HEX_RE.test(v))
    setColor(v)
}

function addMember(value: string | null) {
  if (value && !props.members.includes(value))
    emit('add-member', props.cid, value)
  pick.value = null
}

function removeMember(m: string) {
  emit('remove-member', props.cid, m)
}

/** remoção do time é destrutiva — passa pelo useConfirm (UModal), sem swap inline */
async function requestRemove() {
  const ok = await confirm({
    title: `Remover o time "${name.value.trim() || '?'}"?`,
    description: 'Os membros voltam a ficar sem time na lista. O time só sai do team.local.json quando você salvar.',
    confirmLabel: 'remover time',
  })
  if (ok)
    emit('remove', props.cid)
}

const numFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact' })
</script>

<template>
  <UCard :ui="{ header: 'p-0 sm:p-0', body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center gap-3 px-4 pt-4">
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
          :style="color ? { backgroundColor: color } : undefined"
          :class="!color && avatarBgClass(name || '?')"
        >
          {{ initialsOf(name || '?') }}
        </span>
        <div class="min-w-0 flex-1">
          <UFormField v-if="!disabled" label="nome do time" :ui="{ label: 'sr-only' }" class="w-full">
            <UInput
              v-model="name"
              variant="none"
              size="lg"
              placeholder="Nome do time"
              class="w-full font-semibold ps-0! text-lg"
            />
          </UFormField>
          <div v-else class="font-semibold text-lg truncate">
            {{ name }}
          </div>
          <UFormField v-if="!disabled" label="descrição do time" :ui="{ label: 'sr-only' }" class="w-full">
            <UInput
              v-model="description"
              variant="ghost"
              size="xs"
              placeholder="descrição (opcional)"
              class="w-full text-xs ps-0!"
            />
          </UFormField>
          <p v-else-if="description" class="text-xs text-dimmed truncate">
            {{ description }}
          </p>
        </div>
        <div v-if="!disabled" class="flex items-center gap-1 shrink-0">
          <UPopover v-model:open="colorOpen">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              square
              :aria-label="`cor do time ${name}`"
            >
              <span class="size-4 rounded-full border border-default" :style="{ backgroundColor: color || 'transparent' }" />
            </UButton>
            <template #content>
              <div class="p-3 flex flex-col gap-2 w-48">
                <div class="grid grid-cols-5 gap-1.5">
                  <button
                    v-for="c in TEAM_PALETTE"
                    :key="c"
                    class="size-7 rounded-md border transition-transform hover:scale-110"
                    :class="color === c ? 'border-strong ring-2 ring-primary/40' : 'border-default'"
                    :style="{ backgroundColor: c }"
                    :aria-label="c"
                    @click="setColor(c)"
                  />
                </div>
                <UFormField label="cor personalizada" :ui="{ label: 'sr-only' }" :error="customColorError">
                  <UInput v-model="customColor" size="xs" placeholder="#hex" class="font-mono" @keyup.enter="commitCustom" @blur="commitCustom" />
                </UFormField>
                <UButton label="sem cor" size="xs" color="neutral" variant="link" @click="setColor('')" />
              </div>
            </template>
          </UPopover>
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            size="xs"
            square
            aria-label="remover time"
            @click="requestRemove"
          />
        </div>
      </div>
    </template>

    <div class="flex flex-col gap-3 px-4 pb-4">
      <!-- membros: chips removíveis -->
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="m in members"
          :key="m"
          class="inline-flex items-center gap-1.5 rounded-full border border-default bg-elevated/50 py-0.5 ps-0.5 pe-1 text-xs"
        >
          <span :class="[`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ${avatarBgClass(m)}`]">
            {{ initialsOf(m) }}
          </span>
          <span class="max-w-40 truncate">{{ m }}</span>
          <button
            v-if="!disabled"
            class="text-dimmed hover:text-error transition-colors"
            :aria-label="`remover ${m} do time`"
            @click="removeMember(m)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </span>
        <p v-if="!members.length" class="text-xs text-dimmed italic">
          sem membros ainda
        </p>
      </div>

      <!-- adicionar membro -->
      <UFormField v-if="!disabled" label="adicionar membro" :ui="{ label: 'sr-only' }">
        <UInputMenu
          v-model="pick"
          :items="items"
          value-key="value"
          label-key="label"
          placeholder="adicionar membro… (busca por nome)"
          size="sm"
          class="w-full"
          @update:model-value="addMember"
        />
      </UFormField>

      <!-- métricas do time (dados coletados; período da sidebar não se aplica) -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-default pt-3 text-xs text-dimmed">
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-users" class="size-3.5" />
          {{ metrics.devs }} devs
        </span>
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-git-commit-horizontal" class="size-3.5" />
          {{ numFmt.format(metrics.commits) }} commits
        </span>
        <span class="inline-flex items-center gap-1">
          <UIcon name="i-lucide-git-pull-request" class="size-3.5" />
          {{ numFmt.format(metrics.prs) }} PRs
        </span>
        <UTooltip v-if="metrics.lastCommit" :text="`último commit: ${metrics.lastCommit}`">
          <span class="ml-auto inline-flex items-center gap-1">
            <UIcon name="i-lucide-clock" class="size-3.5" />
            {{ fmtDaysAgo(metrics.lastCommit) }}
          </span>
        </UTooltip>
        <!-- dashboard do time (rota funciona também no build estático) -->
        <UButton
          v-if="name.trim()"
          :to="`/teams/${encodeURIComponent(name.trim())}`"
          icon="i-lucide-layout-dashboard"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="`abrir dashboard do time ${name.trim()}`"
          :class="!metrics.lastCommit && 'ml-auto'"
        />
      </div>
    </div>
  </UCard>
</template>
