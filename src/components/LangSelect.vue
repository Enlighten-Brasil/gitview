<script setup lang="ts">
/**
 * Seletor de idioma (issue #264): USelect no navbar, opção rotulada no
 * PRÓPRIO idioma (nativeName do catálogo — mesmo valor nos 3 locales).
 * O estado é o locale global; a troca (chunk lazy antes do applyLocale,
 * com persistência) fica em useLangSelect.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLangSelect } from '@/composables/useLangSelect'

const { t } = useI18n({ useScope: 'global' })
const { locale, choose } = useLangSelect()

const items = computed(() => [
  { value: 'pt-BR', label: t('app.lang.name.ptBR') },
  { value: 'en-US', label: t('app.lang.name.enUS') },
  { value: 'es-ES', label: t('app.lang.name.esES') },
])
</script>

<template>
  <USelect
    :model-value="locale"
    :items="items"
    size="sm"
    class="w-44"
    :aria-label="t('app.lang.aria')"
    @update:model-value="v => choose(String(v))"
  />
</template>
