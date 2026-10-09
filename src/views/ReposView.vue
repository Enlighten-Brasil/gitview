<script setup lang="ts">
/**
 * Repositórios — seção dedicada (migrada da tab "repos" do dashboard).
 * Âncoras alimentam o sub-nav contextual.
 */
import RepoTable from '../components/RepoTable.vue'
import LinesFlow from '../components/LinesFlow.vue'
import RepoShare from '../components/RepoShare.vue'
import RepoMonthHeatmap from '../components/RepoMonthHeatmap.vue'
import CommitTypes from '../components/CommitTypes.vue'
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <section id="tabela" class="scroll-mt-16">
      <RepoTable />
    </section>
    <section id="linhas" class="scroll-mt-16">
      <LinesFlow />
    </section>
    <section id="distribuicao" class="scroll-mt-16">
      <RepoShare />
    </section>
    <section id="por-mes" class="scroll-mt-16">
      <RepoMonthHeatmap />
    </section>
    <section id="tipos" class="scroll-mt-16">
      <CommitTypes />
    </section>
  </div>
</template>
