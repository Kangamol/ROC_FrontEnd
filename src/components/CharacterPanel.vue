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
      <v-text-field v-model.number="store.baseLevel" type="number" label="Base Lv" min="1" :max="store.caps.baseLevel" :hint="`สูงสุด ${store.caps.baseLevel}`" persistent-hint />
      <v-text-field v-model.number="store.jobLevel" type="number" label="Job Lv" min="1" :max="store.caps.jobLevel" :hint="`สูงสุด ${store.caps.jobLevel}`" persistent-hint />
    </div>
    <!-- status points: cumulative table from the Gnjoy Awakened page (normal 48-start / transcendent 100-start) -->
    <div v-if="store.statPoints" class="text-caption mb-2" :class="store.statPoints.over ? 'text-error' : 'text-medium-emphasis'">
      แต้มสเตตัสใช้ไป {{ store.statPoints.spent }} / มี {{ store.statPoints.available }}
      <span v-if="store.statPoints.over"> — เกินแต้มที่มี</span>
      <span v-if="store.caps.stat > 99" class="ml-1">· สเตตัสสูงสุด {{ store.caps.stat }}</span>
      <span v-else-if="store.caps.baseLevel > 99" class="ml-1">· สเตตัสถึง 120 ได้เมื่อ Base Lv ≥ 100</span>
    </div>

    <div v-for="k in STAT_KEYS" :key="k" class="d-flex align-center mb-1" style="gap: 8px">
      <span class="text-uppercase font-weight-bold" style="width: 34px">{{ k }}</span>
      <v-slider v-model="store.stats[k]" :min="1" :max="store.caps.stat" :step="1" hide-details density="compact" color="primary" class="flex-grow-1" />
      <span style="width: 84px; text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap">
        {{ store.stats[k] }}<span v-if="store.derived.bonus[k] + store.derived.jobBonus[k]" class="stat-bonus" :class="{ bad: store.derived.bonus[k] + store.derived.jobBonus[k] < 0 }" :title="`อาชีพ +${store.derived.jobBonus[k]}, ไอเทม ${store.derived.bonus[k] >= 0 ? '+' : ''}${store.derived.bonus[k]}`">{{ store.derived.bonus[k] + store.derived.jobBonus[k] > 0 ? '+' : '' }}{{ store.derived.bonus[k] + store.derived.jobBonus[k] }}</span>
      </span>
    </div>
  </v-card>
</template>
