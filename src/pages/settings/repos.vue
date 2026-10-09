<script setup lang="ts">
/**
 * Gerenciar repositórios (modo manage do RepoPicker) + aplicar mudanças:
 * remove clones desmarcados, clona os novos e recoleta — SSE ao vivo, com o
 * log reaproveitando o componente do wizard.
 */
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { collectSucceeded, collecting, startCollect } from '@/collect'
import { setupApplying, setupDone, setupError, startSetupApply } from '@/setup'
import { getCachedStatus } from '@/router/guards'
import type { SetupStatus } from '@/setup'
import RepoPicker from '@/components/setup/RepoPicker.vue'
import RunLog from '@/components/setup/RunLog.vue'

const router = useRouter()
const status = ref<SetupStatus | null>(null)
const applying = ref(false)

onMounted(async () => {
  status.value = await getCachedStatus()
})

function apply(payload: { org: string, repos: string[], remove: string[] }) {
  applying.value = true
  startSetupApply(payload.org, payload.repos, { remove: payload.remove })
}

watch(setupDone, (done) => {
  if (done && !collecting.value && !collectSucceeded.value && !setupError.value)
    startCollect(true)
})
watch(collectSucceeded, (ok) => {
  if (ok) {
    applying.value = false
    status.value = null
    getCachedStatus(true).then((st) => {
      status.value = st
    })
  }
})

function backToGeneral() {
  router.push('/settings')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <RepoPicker v-if="!applying" :status="status" mode="manage" @submit="apply" />

    <RunLog v-else idle-title="Aplicando mudanças…">
      <template #actions>
        <span />
        <UButton
          v-if="!setupApplying && !collecting"
          label="voltar às configurações"
          color="neutral"
          variant="ghost"
          size="sm"
          @click="backToGeneral"
        />
      </template>
    </RunLog>
  </div>
</template>
