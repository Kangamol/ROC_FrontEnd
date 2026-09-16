<script setup lang="ts">
import { ref, watch } from 'vue'
import { api, collectionUrl, iconUrl, type ItemDetail, type ItemSummary } from '@/api/client'
import { displayColor, parseRoLine } from '@/lib/roText'

const props = defineProps<{ item: ItemSummary; refine?: number }>()

const detail = ref<ItemDetail | null>(null)
const showCollection = ref(true)

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
      <div v-for="(line, i) in detail.descriptionLines" :key="i" class="ro-desc-line">
        <span v-for="(span, j) in parseRoLine(line)" :key="j" :style="{ color: displayColor(span.color) }">{{ span.text }}</span>
      </div>
    </template>
    <div v-else class="text-medium-emphasis"><v-progress-circular indeterminate size="14" width="2" /> loading…</div>
  </div>
</template>
