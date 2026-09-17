<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, collectionUrl, iconUrl, type ItemDetail, type ItemSummary } from '@/api/client'
import { displayColor, parseRoLine } from '@/lib/roText'

const props = defineProps<{ item: ItemSummary; refine?: number }>()

const detail = ref<ItemDetail | null>(null)
const showCollection = ref(true)

/** Match a raw description line (with ^colour codes) against the parser's cleaned lines. */
const clean = (s: string) => s.replace(/\^[0-9a-fA-F]{6}/g, '').replace(/ /g, ' ').trim()
const marks = computed(() => {
  const d = detail.value
  if (!d) return null
  return {
    counted: new Set((d.parsedLines ?? []).map(clean)),
    conditional: new Set((d.conditionalLines ?? []).map(clean)),
    skipped: new Set((d.unparsedLines ?? []).map(clean)),
  }
})
const hasMarks = computed(() => !!marks.value && (marks.value.counted.size + marks.value.conditional.size + marks.value.skipped.size) > 0)
function lineClass(line: string): '' | 'counted' | 'conditional' | 'skipped' {
  const m = marks.value
  if (!m) return ''
  const c = clean(line)
  if (m.counted.has(c)) return 'counted'
  if (m.conditional.has(c)) return 'conditional'
  if (m.skipped.has(c)) return 'skipped'
  return ''
}

watch(
  () => props.item.id,
  async (id) => {
    detail.value = null
    showCollection.value = true
    try { detail.value = await api.item(id) } catch { /* tooltip stays summary-only */ }
  },
  { immediate: true },
)
</script>

<template>
  <div class="ro-tooltip">
    <div class="d-flex align-center mb-2" style="gap: 8px">
      <div class="ro-icon-box"><img v-if="item.hasIcon" :src="iconUrl(item.id)" alt="" /></div>
      <div>
        <div class="ro-tooltip-title">
          <span v-if="refine" class="ro-refine">+{{ refine }} </span>{{ item.name }}
          <span v-if="item.slotCount" class="text-medium-emphasis">[{{ item.slotCount }}]</span>
        </div>
        <div class="text-caption text-medium-emphasis">#{{ item.id }} · {{ item.subType }}</div>
      </div>
    </div>
    <div v-if="detail?.hasCollection && showCollection" class="text-center mb-2">
      <img :src="collectionUrl(item.id)" alt="" style="max-height: 100px" @error="showCollection = false" />
    </div>
    <template v-if="detail">
      <div v-for="(line, i) in detail.descriptionLines" :key="i" class="ro-desc-line" :class="lineClass(line)">
        <v-icon v-if="lineClass(line) === 'counted'" icon="mdi-check" size="11" class="mr-1" />
        <v-icon v-else-if="lineClass(line) === 'conditional'" icon="mdi-help-circle-outline" size="11" class="mr-1" />
        <v-icon v-else-if="lineClass(line) === 'skipped'" icon="mdi-close" size="11" class="mr-1" />
        <span v-for="(span, j) in parseRoLine(line)" :key="j" :style="{ color: lineClass(line) ? undefined : displayColor(span.color) }">{{ span.text }}</span>
      </div>
      <div v-if="hasMarks" class="ro-legend mt-2">
        <span class="counted"><v-icon icon="mdi-check" size="10" /> นำมาคำนวณ</span>
        <span class="conditional"><v-icon icon="mdi-help-circle-outline" size="10" /> คำนวณเมื่อเข้าเงื่อนไข (ตีบวก / stat / เซ็ต)</span>
        <span class="skipped"><v-icon icon="mdi-close" size="10" /> ยังอ่านไม่ได้ ไม่ถูกนับ</span>
      </div>
    </template>
    <div v-else class="text-medium-emphasis"><v-progress-circular indeterminate size="14" width="2" /> loading…</div>
  </div>
</template>
