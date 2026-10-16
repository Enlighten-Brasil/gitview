<script setup lang="ts">
/**
 * Passo 4 opcional do wizard: depois da primeira coleta, mostra as identidades
 * sem mapeamento (autores de git e logins do GitHub sem dev) e leva o usuário a
 * /teams#sem-mapeamento para unificá-las. Sem candidatos, a etapa não tem o que
 * mostrar — só segue para o dashboard.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { loadTeam, team } from '@/team'

definePage({
  meta: {
    setupStep: 4,
  },
})

const router = useRouter()
const ready = ref(false)

onMounted(async () => {
  // o cache do boot/finish já vem fresco da coleta; F5 refaz o fetch
  await loadTeam()
  ready.value = true
})

const candidates = computed(() => team.value?.candidates ?? [])

function skip() {
  router.push('/')
}

function unify() {
  router.push({ path: '/teams', hash: '#sem-mapeamento' })
}
</script>

<template>
  <UCard>
    <div v-if="!ready" class="text-sm text-dimmed">
      verificando identidades…
    </div>

    <div v-else-if="!candidates.length" class="flex flex-col gap-4">
      <div class="flex items-center gap-2 font-medium">
        <UIcon name="i-lucide-circle-check" class="size-5 text-success" />
        Nenhuma identidade sem mapear
      </div>
      <p class="text-sm text-dimmed">
        Todos os autores de git e logins do GitHub encontrados nos dados já pertencem a um dev.
      </p>
      <div class="flex justify-end">
        <UButton label="abrir dashboard" trailing-icon="i-lucide-arrow-right" @click="skip" />
      </div>
    </div>

    <div v-else class="flex flex-col gap-4">
      <div class="flex items-center gap-2 font-medium">
        <UIcon name="i-lucide-user-round-x" class="size-5 text-warning" />
        {{ candidates.length }} {{ candidates.length === 1 ? 'identidade aparece sem mapear' : 'identidades aparecem sem mapear' }}
      </div>
      <p class="text-sm text-dimmed">
        São autores de commit e logins do GitHub que a coleta encontrou mas não ligou a nenhum dev.
        Sem unificar, cada variação de nome vira uma pessoa separada nas métricas.
      </p>

      <ul class="flex flex-wrap gap-1.5">
        <li
          v-for="c in candidates"
          :key="`${c.kind}:${c.id}`"
          class="inline-flex items-center gap-1.5 rounded-full border border-default px-2.5 py-1 text-xs"
          :class="c.kind === 'author' ? 'bg-accented text-default' : 'bg-elevated text-dimmed'"
        >
          <UIcon :name="c.kind === 'author' ? 'i-lucide-at-sign' : 'i-lucide-github'" class="size-3.5" />
          {{ c.id }}
        </li>
      </ul>

      <div class="flex items-center gap-2 justify-end">
        <UButton
          label="pular — abrir dashboard"
          color="neutral"
          variant="ghost"
          @click="skip"
        />
        <UButton
          label="unificar agora"
          trailing-icon="i-lucide-arrow-right"
          @click="unify"
        />
      </div>
    </div>
  </UCard>
</template>
