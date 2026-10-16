<script setup lang="ts">
import type { SetupStatus } from '@/setup'
/**
 * Geral: repos no dashboard + manutenção dos dados locais + resumo da conta.
 * Gerenciar repositórios e conta agora têm rotas próprias (/settings/*).
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { collectError, collecting, collectLog, collectSucceeded, startCollect } from '@/collect'
import { stats } from '@/data'
import { getCachedStatus, resetBoot } from '@/router/guards'
import { cleanLocalData } from '@/setup'

const router = useRouter()
const status = ref<SetupStatus | null>(null)

onMounted(async () => {
  status.value = await getCachedStatus()
})

// ---------------------------------------------------------------------------
// manutenção: recoletar tudo / limpar+recoletar / apagar dados (regeneráveis)
// ---------------------------------------------------------------------------
const confirmWipe = ref(false)
const maintenanceRan = ref(false)
const maintenanceLog = computed(() => collectLog.value.slice(-8))

function recollectAll() {
  confirmWipe.value = false
  maintenanceRan.value = true
  startCollect(true)
}

function wipeAndRecollect() {
  if (!confirmWipe.value) {
    confirmWipe.value = true
    return
  }
  confirmWipe.value = false
  maintenanceRan.value = true
  startCollect(false, true)
}

// apagar sem recoletar: volta ao estado de primeira execução (wizard)
const confirmDelete = ref(false)
const deleteRepos = ref(false)
const deleting = ref(false)
const deleteError = ref<string | null>(null)

async function deleteAllData() {
  deleting.value = true
  deleteError.value = null
  try {
    await cleanLocalData(deleteRepos.value)
    // derruba o estado de "tem dados" na memória e cai no wizard — sem reload
    stats.value = null
    resetBoot()
    await router.replace('/setup')
  }
  catch (err) {
    deleteError.value = (err as Error).message
    deleting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UCard>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2 font-medium">
          <UIcon name="i-lucide-package" class="size-5" />
          Repositórios no dashboard
          <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
            {{ status?.repos.length ?? 0 }}
          </UBadge>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <UBadge
            v-for="r in status?.repos ?? []"
            :key="r"
            color="neutral"
            variant="soft"
            size="sm"
          >
            {{ r }}
          </UBadge>
        </div>
        <div class="flex justify-end gap-2">
          <UButton
            label="perfis e times"
            icon="i-lucide-users"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="outline"
            to="/teams"
          />
          <UButton
            label="gerenciar repositórios"
            icon="i-lucide-list-checks"
            trailing-icon="i-lucide-arrow-right"
            color="neutral"
            variant="outline"
            to="/settings/repos"
          />
        </div>
      </div>
    </UCard>

    <!-- manutenção dos dados locais (banco + JSONs são 100% regeneráveis) -->
    <UCard>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2 font-medium">
          <UIcon name="i-lucide-database" class="size-5" />
          Manutenção dos dados locais
        </div>
        <p class="text-sm text-dimmed">
          O banco e os JSONs do dashboard são 100% regeneráveis a partir dos repositórios.
          Recoletar só gera dados novos;
          <strong>limpar e recoletar</strong> apaga e gera de novo na sequência;
          <strong>apagar dados</strong> remove tudo e volta ao assistente de configuração
          (os clones em <code>data/repos</code> ficam, a menos que você marque a opção).
        </p>

        <pre
          v-if="collecting && maintenanceLog.length"
          class="max-h-40 overflow-auto rounded bg-accented p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
        >{{ maintenanceLog.join('\n') }}</pre>

        <UAlert
          v-if="maintenanceRan && collectSucceeded && !collecting"
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          title="dados regenerados com sucesso"
        />
        <UAlert
          v-if="maintenanceRan && collectError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="collectError"
        />
        <UAlert
          v-if="deleteError"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-x"
          :title="deleteError"
        />

        <div class="flex items-center justify-between">
          <UButton
            label="recoletar tudo"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :disabled="collecting || deleting"
            @click="recollectAll"
          />
          <div class="flex items-center gap-2">
            <template v-if="confirmWipe">
              <span class="text-xs text-dimmed">apaga banco + JSONs e gera tudo de novo na sequência</span>
              <UButton label="cancelar" size="sm" color="neutral" variant="ghost" @click="confirmWipe = false" />
              <UButton
                label="confirmar"
                size="sm"
                color="error"
                icon="i-lucide-trash-2"
                :loading="collecting"
                @click="wipeAndRecollect"
              />
            </template>
            <template v-else-if="confirmDelete">
              <UCheckbox v-model="deleteRepos" size="xs" label="incluindo os clones (data/repos)" />
              <span class="text-xs text-dimmed">volta ao assistente; nada é recoletado</span>
              <UButton label="cancelar" size="sm" color="neutral" variant="ghost" @click="confirmDelete = false" />
              <UButton
                label="confirmar"
                size="sm"
                color="error"
                icon="i-lucide-trash-2"
                :loading="deleting"
                @click="deleteAllData"
              />
            </template>
            <template v-else>
              <UButton
                label="apagar dados"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-eraser"
                :disabled="collecting"
                @click="confirmDelete = true"
              />
              <UButton
                label="limpar e recoletar"
                color="error"
                variant="soft"
                icon="i-lucide-trash-2"
                :disabled="collecting"
                @click="wipeAndRecollect"
              />
            </template>
          </div>
        </div>
      </div>
    </UCard>

    <UCard>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-github" class="size-5" />
        <template v-if="status?.auth">
          <span class="text-sm">
            Conectado como <span class="font-medium">@{{ status.auth.login }}</span>
            <span class="text-dimmed">via {{ status.auth.via }}</span>
          </span>
          <UButton
            label="gerenciar conta"
            size="xs"
            color="neutral"
            variant="link"
            class="ml-auto"
            to="/settings/account"
          />
        </template>
        <template v-else>
          <span class="text-sm text-dimmed">GitHub não conectado — necessário pra gerenciar e coletar.</span>
          <UButton
            label="conectar"
            size="sm"
            class="ml-auto"
            to="/settings/account"
          />
        </template>
      </div>
    </UCard>
  </div>
</template>
