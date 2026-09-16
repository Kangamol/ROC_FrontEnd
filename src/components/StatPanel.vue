<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '@/stores/build'

const store = useBuildStore()
const d = computed(() => store.derived)

const rows = computed(() => [
  { label: 'ATK', value: `${d.value.statusAtk} + ${d.value.weaponAtk + d.value.weaponAtkRefine}${d.value.atkBonusFlat ? ` + ${d.value.atkBonusFlat}` : ''}${d.value.atkPercent ? ` (+${d.value.atkPercent}%)` : ''}` },
  { label: 'MATK', value: `${d.value.matkMin} ~ ${d.value.matkMax}${d.value.matkPercent ? ` (+${d.value.matkPercent}%)` : ''}` },
  { label: 'HIT', value: d.value.hit },
  { label: 'CRIT', value: d.value.crit.toFixed(1) },
  { label: 'DEF', value: `${d.value.hardDef} + ${d.value.softDef}` },
  { label: 'MDEF', value: `${d.value.hardMdef} + ${d.value.softMdef}` },
  { label: 'FLEE', value: `${d.value.flee} + ${d.value.perfectDodge}` },
  { label: 'ASPD', value: d.value.aspd },
  { label: 'Max HP', value: d.value.maxHp.toLocaleString() },
  { label: 'Max SP', value: d.value.maxSp.toLocaleString() },
  { label: 'Cast -%', value: `${d.value.castTimeReduction}%` },
  { label: 'Weight', value: d.value.weight },
])

/** Bonuses the parser found but the engine does not use yet — shown so nothing is silently lost. */
const KNOWN = new Set(['str', 'agi', 'vit', 'int', 'dex', 'luk', 'allStats', 'atk', 'atkPercent', 'matk', 'matkPercent', 'def', 'mdef', 'hit', 'flee', 'crit', 'perfectDodge', 'aspd', 'aspdPercent', 'maxHp', 'maxHpPercent', 'maxSp', 'maxSpPercent', 'castTimePercent', 'afterCastDelayPercent'])
const extra = computed(() => Object.entries(d.value.bonuses).filter(([k]) => !KNOWN.has(k)))
</script>

<template>
  <v-card class="ro-panel pa-3" variant="flat">
    <div class="text-subtitle-2 text-accent mb-2"><v-icon icon="mdi-chart-box-outline" size="small" class="mr-1" />Stats</div>
    <div v-for="r in rows" :key="r.label" class="stat-row">
      <span class="stat-label">{{ r.label }}</span><span>{{ r.value }}</span>
    </div>
    <template v-if="extra.length">
      <v-divider class="my-2" />
      <div class="text-caption text-medium-emphasis mb-1">Bonus อื่นจากไอเทม</div>
      <div v-for="[k, v] in extra" :key="k" class="stat-row"><span class="stat-label">{{ k }}</span><span>+{{ v }}</span></div>
    </template>
    <div class="text-caption text-disabled mt-2">* สูตร pre-renewal โดยประมาณ — bonus มาจากการ parse description ของ client</div>
  </v-card>
</template>
