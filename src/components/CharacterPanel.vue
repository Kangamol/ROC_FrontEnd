<script setup lang="ts">
import { JOB_CLASSES } from '@/lib/slots'
import { STAT_KEYS } from '@/lib/stats'
import { useBuildStore } from '@/stores/build'

const store = useBuildStore()
</script>

<template>
  <v-card class="ro-panel pa-3" variant="flat">
    <div class="text-subtitle-2 text-accent mb-2"><v-icon icon="mdi-account" size="small" class="mr-1" />Character</div>
    <v-text-field v-model="store.title" label="ชื่อ build" class="mb-2" />
    <v-select v-model="store.jobClass" :items="JOB_CLASSES" label="อาชีพ" class="mb-2" />
    <div class="d-flex mb-3" style="gap: 8px">
      <v-text-field v-model.number="store.baseLevel" type="number" label="Base Lv" min="1" max="99" />
      <v-text-field v-model.number="store.jobLevel" type="number" label="Job Lv" min="1" max="70" />
    </div>

    <div v-for="k in STAT_KEYS" :key="k" class="d-flex align-center mb-1" style="gap: 8px">
      <span class="text-uppercase font-weight-bold" style="width: 34px">{{ k }}</span>
      <v-slider v-model="store.stats[k]" :min="1" :max="99" :step="1" hide-details density="compact" color="primary" class="flex-grow-1" />
      <span style="width: 70px; text-align: right; font-variant-numeric: tabular-nums">
        {{ store.stats[k] }}<span v-if="store.derived.bonus[k]" class="stat-bonus">+{{ store.derived.bonus[k] }}</span>
      </span>
    </div>
  </v-card>
</template>
