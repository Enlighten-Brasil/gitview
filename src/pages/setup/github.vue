<script setup lang="ts">
import type { SetupStatus } from '@/setup'
/** Passo 1 do wizard: conectar o GitHub (device flow / PAT / gh). */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import GithubConnect from '@/components/setup/GithubConnect.vue'
import { getCachedStatus } from '@/router/guards'

definePage({
  meta: {
    setupStep: 1,
  },
})

const router = useRouter()
const status = ref<SetupStatus | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function refresh(mode: 'reload' | 'poll' = 'poll') {
  if (mode === 'reload')
    loading.value = true
  // sempre força a rede: o poll é justamente detectar mudança de auth
  const st = await getCachedStatus(true)
  if (st) {
    status.value = st
    error.value = null
  }
  else if (mode === 'reload') {
    error.value = 'não foi possível consultar o dev server (/__setup/status)'
  }
  loading.value = false
}

onMounted(() => refresh())
</script>

<template>
  <GithubConnect
    :status="status"
    :loading="loading"
    :error="error"
    mode="wizard"
    @refresh="refresh"
    @continue="router.push('/setup/repos')"
  />
</template>
