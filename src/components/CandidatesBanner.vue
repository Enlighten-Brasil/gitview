<script setup lang="ts">
/**
 * Banner discreto enquanto houver identidades sem mapeamento (team.json#candidates).
 * Aparece só nas rotas de escopo full (decidido pelo chamador). A dispensa grava o
 * CONJUNTO de identidades visto — o banner volta se a próxima coleta trouxer
 * identidades novas (mesmo que o total caia); some sozinho quando candidates chega a 0.
 */
import { computed, onMounted, ref } from 'vue'
import { loadTeam, team } from '@/team'

const KEY = 'gitview-candidates-dismissed'

const idOf = (c: { kind: string, id: string }) => `${c.kind}:${c.id}`

function readDismissed(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return new Set(Array.isArray(raw) ? raw.map(String) : [])
  }
  catch {
    // storage corrompido (ou formato antigo numérico) = nada dispensado
    return new Set()
  }
}

const dismissed = ref(readDismissed())
const candidates = computed(() => team.value?.candidates ?? [])
const visible = computed(() => candidates.value.some(c => !dismissed.value.has(idOf(c))))

// carregado por preguiça: FilterBar/times já usam o mesmo cache do team.json
onMounted(() => loadTeam())

function dismiss() {
  dismissed.value = new Set(candidates.value.map(idOf))
  localStorage.setItem(KEY, JSON.stringify([...dismissed.value]))
}
</script>

<template>
  <div v-if="visible" class="border-b border-default bg-elevated/50">
    <div class="max-w-[1320px] w-full mx-auto px-5 py-1.5 flex items-center gap-2 text-xs">
      <UIcon name="i-lucide-user-round-x" class="size-4 shrink-0 text-warning" />
      <span class="min-w-0 truncate">
        <strong class="font-semibold">{{ candidates.length }}</strong>
        {{ candidates.length === 1 ? 'identidade sem mapear' : 'identidades sem mapear' }} — cada uma conta como um dev separado nas métricas.
      </span>
      <UButton
        size="xs"
        color="primary"
        variant="soft"
        label="unificar agora"
        class="shrink-0"
        :to="{ path: '/teams', hash: '#sem-mapeamento' }"
      />
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="dispensar aviso"
        class="shrink-0 ml-auto"
        @click="dismiss"
      />
    </div>
  </div>
</template>
