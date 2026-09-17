<script setup lang="ts">
import { computed } from 'vue'
import { useBuildStore } from '@/stores/build'
import { activeSetBonuses } from '@/lib/stats'
import { GROUP_LABEL, GROUP_ORDER, describeEffect } from '@/lib/effectLabels'

const store = useBuildStore()

/** Every parsed effect from worn gear, summed, grouped like the client's Equipment Status window. */
const groups = computed(() => {
  const lines = Object.entries(store.derived.bonuses)
    .filter(([, v]) => v !== 0)
    .map(([k, v]) => describeEffect(k, v))
  const byGroup = new Map<string, typeof lines>()
  for (const l of lines) byGroup.set(l.group, [...(byGroup.get(l.group) ?? []), l])
  return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({ key: g, label: GROUP_LABEL[g] ?? g, lines: byGroup.get(g)! }))
})

const sets = computed(() => activeSetBonuses(store.equipped))

/** Effect lines the parser could not read, per worn item — so it is clear what is NOT counted. */
const unparsed = computed(() => {
  const out: { name: string; lines: string[] }[] = []
  for (const s of store.equipped) {
    for (const it of [s.item, ...s.cards]) {
      if (it?.unparsedLines?.length) out.push({ name: it.name, lines: it.unparsedLines })
    }
  }
  return out
})
</script>

<template>
  <v-card class="ro-panel pa-3" variant="flat">
    <div class="text-subtitle-2 text-accent mb-2"><v-icon icon="mdi-format-list-bulleted" size="small" class="mr-1" />Equipment Status</div>
    <div v-if="!groups.length" class="text-caption text-medium-emphasis">ยังไม่มีโบนัสจากของสวมใส่</div>
    <template v-for="g in groups" :key="g.key">
      <div class="text-caption text-medium-emphasis mt-2 mb-1">{{ g.label }}</div>
      <div v-for="l in g.lines" :key="l.label + l.value" class="summary-row">
        <span class="summary-value">{{ l.value }}</span>
        <span class="summary-label">{{ l.label }}</span>
      </div>
    </template>

    <template v-if="sets.length">
      <v-divider class="my-2" />
      <div class="text-caption text-medium-emphasis mb-1">Set bonus ที่ทำงานอยู่</div>
      <div v-for="s in sets" :key="s.owner.id + s.requires.join()" class="text-caption">
        <v-icon icon="mdi-link-variant" size="12" class="mr-1" />{{ s.owner.name }} + {{ s.requires.join(', ') }}
      </div>
    </template>

    <template v-if="unparsed.length">
      <v-divider class="my-2" />
      <div class="text-caption text-warning mb-1"><v-icon icon="mdi-alert-outline" size="12" class="mr-1" />ไม่ได้นำมาคำนวณ (อ่านข้อความไม่ได้)</div>
      <div v-for="u in unparsed" :key="u.name" class="text-caption mb-1">
        <div class="font-weight-medium">{{ u.name }}</div>
        <div v-for="(l, i) in u.lines" :key="i" class="text-medium-emphasis pl-2">· {{ l }}</div>
      </div>
    </template>
  </v-card>
</template>

<style scoped lang="scss">
.summary-row {
  display: flex;
  gap: 8px;
  padding: 1px 0;
  font-size: 0.82rem;
  line-height: 1.3;
  .summary-value { flex: 0 0 64px; text-align: right; color: #2563eb; font-weight: 600; font-variant-numeric: tabular-nums; }
  .summary-label { color: #14213d; }
}
</style>
