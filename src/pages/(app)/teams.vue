<script setup lang="ts">
/** /times — orquestração do editor de times (issue #40): drafts/persistência em useTeamDrafts, UI em componentes próprios */
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { collecting } from '@/collect'
import DevCard from '@/components/team/DevCard.vue'
import TeamCandidatesSection from '@/components/team/TeamCandidatesSection.vue'
import TeamCard from '@/components/team/TeamCard.vue'
import TeamImportModal from '@/components/team/TeamImportModal.vue'
import TeamProfileModal from '@/components/team/TeamProfileModal.vue'
import TeamSaveBar from '@/components/team/TeamSaveBar.vue'
import { useTeamDrafts } from '@/composables/useTeamDrafts'
import { useUnsavedChangesGuard } from '@/composables/useUnsavedChangesGuard'
import { dedupeList, EMPTY_TEAM_METRICS, loadTeam, team, teamLoadError, toTeamDraft } from '@/team'

// gerência do time (era /team — alias mantém links/bookmarks)
definePage({
  alias: '/team',
  meta: {
    section: 'teams',
    filters: 'none',
    title: 'nav.sections.teams',
  },
})

const isDev = import.meta.env.DEV
// chaves do editor de times (catálogo team.*) — escopo global como no FilterBar
const { t } = useI18n({ useScope: 'global' })
const {
  addItemsByCid,
  addMember,
  addTeam,
  applyProfile,
  assignEmails,
  assignLogin,
  authorsWithCommits,
  candidates,
  configLoaded,
  devNames,
  devs,
  dirty,
  importTeam,
  loadConfigState,
  metricsByCid,
  profiles,
  removeMember,
  removeTeam,
  revert,
  save,
  saveAndRecollect,
  saving,
  teamBadgesByDev,
  teams,
} = useTeamDrafts()

const teamCount = computed(() => teams.value.filter(t => t.name.trim()).length)

// boot único com sequência explícita (issue #40): dados → rascunhos
onMounted(async () => {
  await loadTeam(true)
  // build estático: sem endpoints de config — times vêm do team.json (somente leitura)
  if (!isDev) {
    teams.value = (team.value?.teams ?? []).map(toTeamDraft)
    return
  }
  await loadConfigState()
})

// guarda de navegação — confirmação via useConfirm (UModal), assíncrona (issue #38)
useUnsavedChangesGuard(() => dirty.value)

// edição de perfil (modal) + import do GitHub (slideover)
const editOpen = ref(false)
const editingName = ref('')
const importOpen = ref(false)

function openEdit(name: string) {
  editingName.value = name
  editOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto w-full">
    <div class="flex items-center gap-3 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold">
          {{ t('team.page.title') }}
        </h1>
        <p class="text-sm text-dimmed">
          {{ t('team.page.intro') }} <code class="text-xs">{{ t('team.page.introFile') }}</code> {{ t('team.page.introEnd') }}
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          v-if="isDev"
          icon="i-lucide-github"
          color="neutral"
          variant="soft"
          size="sm"
          :label="t('team.import.title')"
          @click="importOpen = true"
        />
      </div>
    </div>

    <UAlert
      v-if="!isDev"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      :title="t('team.static.title')"
      :description="t('team.static.description')"
    />
    <UAlert
      v-if="teamLoadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('team.loadError.title')"
      :description="t('team.loadError.description')"
    />

    <!-- skeleton enquanto o team.json chega (senão o vazio parece "sem time") -->
    <div v-if="!team && !teamLoadError" class="flex flex-col gap-6" aria-busy="true">
      <div class="grid gap-4 md:grid-cols-2">
        <USkeleton v-for="i in 4" :key="i" class="h-48 rounded-lg" />
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <USkeleton v-for="i in 6" :key="i" class="h-28 rounded-lg" />
      </div>
    </div>

    <template v-else>
      <!-- times -->
      <section id="times" class="flex flex-col gap-3 scroll-mt-16">
        <div class="flex items-center gap-2">
          <h2 class="font-medium">
            {{ t('team.section.times') }}
          </h2>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ teamCount }}
          </UBadge>
          <UButton
            v-if="isDev && configLoaded"
            icon="i-lucide-plus"
            size="xs"
            color="neutral"
            variant="soft"
            :label="t('team.actions.newTeam')"
            class="ml-auto"
            @click="addTeam"
          />
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <TeamCard
            v-for="td in teams"
            :key="td.cid"
            v-model:name="td.name"
            v-model:description="td.description"
            v-model:color="td.color"
            :cid="td.cid"
            :members="td.members"
            :items="addItemsByCid.get(td.cid) ?? []"
            :metrics="metricsByCid.get(td.cid) ?? EMPTY_TEAM_METRICS"
            :disabled="!isDev || !configLoaded"
            @remove="removeTeam"
            @add-member="addMember"
            @remove-member="removeMember"
          />
          <button
            v-if="isDev && configLoaded && !teams.length"
            class="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-default text-sm text-dimmed hover:border-primary hover:text-primary transition-colors cursor-pointer"
            @click="addTeam"
          >
            <UIcon name="i-lucide-plus" class="size-6" />
            {{ t('team.empty.createFirst') }}
          </button>
          <p v-if="!teams.length && !(isDev && configLoaded)" class="text-sm text-dimmed">
            {{ t('team.empty.none') }}
          </p>
        </div>
      </section>

      <!-- devs -->
      <section id="devs" class="flex flex-col gap-3 scroll-mt-16">
        <div class="flex items-center gap-2">
          <h2 class="font-medium">
            {{ t('team.section.devs') }}
          </h2>
          <UBadge color="neutral" variant="subtle" size="sm">
            {{ devs.filter(d => !d.bot).length }}
          </UBadge>
          <span class="text-xs text-dimmed">{{ t('team.devs.hint') }}</span>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <DevCard
            v-for="d in devs"
            :key="d.name"
            :name="d.name"
            :title="profiles[d.name]?.title || d.title"
            :description="profiles[d.name]?.description || d.description"
            :emails="profiles[d.name] ? dedupeList(profiles[d.name].emails) : d.emails"
            :github-logins="profiles[d.name] ? dedupeList(profiles[d.name].githubLogins) : d.githubLogins"
            :team-badges="teamBadgesByDev.get(d.name) ?? []"
            :bot="d.bot"
            :has-profile="authorsWithCommits.has(d.name)"
            :editable="isDev && configLoaded && !d.bot"
            @edit="openEdit(d.name)"
          />
        </div>
      </section>

      <!-- candidatos: identidades dos dados sem alias cadastrado -->
      <TeamCandidatesSection
        :candidates="candidates"
        :dev-names="devNames"
        :editable="isDev && configLoaded"
        @assign-login="assignLogin"
        @assign-emails="assignEmails"
      />
    </template>

    <!-- gravação: barra sticky no rodapé do painel -->
    <TeamSaveBar
      v-if="isDev && configLoaded"
      :dirty="dirty"
      :saving="saving"
      :collecting="collecting"
      @revert="revert"
      @save="save()"
      @save-and-recollect="saveAndRecollect"
    />

    <!-- modal editar perfil -->
    <TeamProfileModal
      v-model:open="editOpen"
      :dev-name="editingName"
      :profile="profiles[editingName]"
      @apply="applyProfile(editingName, $event)"
    />

    <!-- slideover importar do GitHub -->
    <TeamImportModal
      v-model:open="importOpen"
      :devs="devs"
      :dev-names="devNames"
      @import-team="importTeam"
      @assign-login="assignLogin"
    />
  </div>
</template>
