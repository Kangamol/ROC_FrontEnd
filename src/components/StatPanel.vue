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
  { label: 'Weight', value: d.value.maxWeight ? `${d.value.weight / 10} / ${d.value.maxWeight / 10}` : d.value.weight / 10 },
])

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
/** Cast / delay reductions summed from worn items only (no skill-specific effects). */
const castRows = computed(() => [
  { label: 'Variable Cast (items)', value: `-${fmt(d.value.variableCastItems)}%`, hint: `DEX ให้อีก -${d.value.castTimeDex}%` },
  { label: 'Fixed Cast (items)', value: [d.value.fixedCastSeconds ? `-${fmt(d.value.fixedCastSeconds)}s` : '', d.value.fixedCastPercent ? `-${fmt(d.value.fixedCastPercent)}%` : ''].filter(Boolean).join(' ') || '0' },
  { label: 'After-cast Delay (items)', value: `-${fmt(d.value.afterCastDelayItems)}%` },
])

</script>

<template>
  <v-card class="ro-panel pa-3" variant="flat">
    <div class="text-subtitle-2 text-accent mb-2"><v-icon icon="mdi-chart-box-outline" size="small" class="mr-1" />Stats</div>
    <div v-for="r in rows" :key="r.label" class="stat-row">
      <span class="stat-label">{{ r.label }}</span><span>{{ r.value }}</span>
    </div>
    <v-divider class="my-2" />
    <div class="text-caption text-medium-emphasis mb-1">Cast / Delay จากของสวมใส่ (รวมโบนัสตามขั้นตีบวก)</div>
    <div v-for="r in castRows" :key="r.label" class="stat-row">
      <span class="stat-label">{{ r.label }}</span>
      <span>{{ r.value }}<span v-if="r.hint" class="text-caption text-medium-emphasis ml-1">({{ r.hint }})</span></span>
    </div>
    <div class="text-caption text-disabled mt-2">
      * สูตร pre-renewal — HP/SP/ASPD จาก{{ d.usingJobTable ? 'ตารางอาชีพ (rAthena pre-re)' : 'ค่าประมาณ (โหลดตารางอาชีพไม่ได้)' }}; bonus มาจาก description ของ client
    </div>
  </v-card>
</template>
