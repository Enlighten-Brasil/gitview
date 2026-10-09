<script setup lang="ts">
/** Passo 2 do wizard: escolher os repositórios que entram no dashboard. */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getCachedStatus } from '@/router/guards'
import type { SetupStatus } from '@/setup'
import { writeWizardSelection } from '@/wizard'
import RepoPicker from '@/components/setup/RepoPicker.vue'

definePage({
  meta: {
    setupStep: 2,
  },
})

const router = useRouter()
const status = ref<SetupStatus | null>(null)

onMounted(async () => {
  status.value = await getCachedStatus()
})

function submit(payload: { org: string, repos: string[], remove: string[] }) {
  // remove não existe no wizard (nada foi clonado ainda); seleção sobrevive ao F5
  writeWizardSelection({ org: payload.org, repos: payload.repos })
  router.push('/setup/collect')
}
</script>

<template>
  <RepoPicker :status="status" mode="wizard" @submit="submit">
    <template #back>
      <UButton
        label="voltar"
        color="neutral"
        variant="ghost"
        size="sm"
        @click="router.push('/setup/github')"
      />
    </template>
  </RepoPicker>
</template>
