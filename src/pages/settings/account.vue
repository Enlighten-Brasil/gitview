<script setup lang="ts">
import type { SetupStatus } from '@/setup'
/**
 * Conta GitHub: conectar/trocar/desconectar sem sair das configurações.
 * O device flow e a sonda de `gh auth login` vivem no GithubConnect.
 */
import { onMounted, ref } from 'vue'
import GithubConnect from '@/components/setup/GithubConnect.vue'
import { getCachedStatus } from '@/router/guards'

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
    mode="settings"
    @refresh="refresh"
  />
</template>
