<script setup lang="ts">
/**
 * Passo 3 do wizard: clonar os repos escolhidos (SSE /__setup/apply) e rodar a
 * primeira coleta (SSE /__collect) em sequência. O progresso vive nos refs de
 * módulo (setup.ts/collect.ts), então trocar de rota não mata a execução — ao
 * voltar, o log continua de onde parou.
 */
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { collectError, collecting, collectSucceeded, startCollect } from '@/collect'
import RunLog from '@/components/setup/RunLog.vue'
import { resetBoot } from '@/router/guards'
import { setupApplying, setupDone, setupError, startSetupApply } from '@/setup'
import { loadTeam, team } from '@/team'
import { readWizardSelection } from '@/wizard'

definePage({
  meta: {
    setupStep: 3,
  },
})

const router = useRouter()
const allDone = ref(collectSucceeded.value)
const running = () => setupApplying.value || collecting.value

function start() {
  const sel = readWizardSelection()
  if (!sel) {
    router.replace('/setup/repos')
    return
  }
  startSetupApply(sel.org, sel.repos)
}

onMounted(() => {
  if (running())
    return
  if (allDone.value)
    return
  // clone já rodou nesta sessão e a coleta ainda não (ex.: F5 entre fases)
  if (setupDone.value && !collectSucceeded.value && !setupError.value)
    startCollect()
  else
    start()
})

// clone terminou → dispara a coleta (reusa o fluxo do botão ↻ do navbar)
watch(setupDone, (done) => {
  if (done && !collecting.value && !collectSucceeded.value && !collectError.value)
    startCollect()
})
watch(collectSucceeded, (ok) => {
  if (ok)
    allDone.value = true
})

async function openDashboard() {
  // boot antigo marcou "sem dados"; descarta p/ o guard reler o stats.json fresco
  resetBoot()
  // passo 4 opcional: candidatos sem mapeamento aparecem na etapa de time
  await loadTeam()
  if (team.value?.candidates?.length)
    router.push('/setup/team')
  else
    router.push('/')
}

function back() {
  router.push('/setup/repos')
}
</script>

<template>
  <RunLog :done="allDone" idle-title="Clonar e coletar">
    <template #actions>
      <UButton
        v-if="!running() && !allDone"
        label="voltar"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="back"
      />
      <span v-else />
      <UButton
        v-if="allDone"
        label="abrir dashboard"
        trailing-icon="i-lucide-arrow-right"
        @click="openDashboard"
      />
    </template>
  </RunLog>
</template>
