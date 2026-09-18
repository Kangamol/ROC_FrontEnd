<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { api, iconUrl, type ItemQuery, type ItemSummary } from '@/api/client'
import ItemTooltip from './ItemTooltip.vue'

const props = defineProps<{
  title: string
  filter: ItemQuery
  /** Card mode: filter by these cardLocation values (client-side OR) */
  cardLocations?: string[]
  /** Card mode base query — defaults to `{ type: 'CARD' }`; costume slots use enchant stones instead */
  cardFilter?: ItemQuery
  /** NPC-enchant mode: only these enchant item IDs are offered (null = every enchant option) */
  enchantPool?: number[] | null
}>()
const model = defineModel<boolean>({ default: false })
const emit = defineEmits<{ select: [item: ItemSummary | null] }>()

const search = ref('')
const minSlots = ref(0)
const allCards = ref(false)
const loading = ref(false)
const total = ref(0)
const items = ref<ItemSummary[]>([])
const page = ref(1)
const PAGE = 40
/** Item whose tooltip is shown in the side panel (hover/click the info icon). */
const preview = ref<ItemSummary | null>(null)

const isCardMode = computed(() => !!props.cardLocations)
const isEnchantMode = computed(() => props.enchantPool !== undefined)
const poolSet = computed(() => (props.enchantPool ? new Set(props.enchantPool) : null))
const SLOT_OPTIONS = [
  { title: 'ทุก slot', value: 0 }, { title: '1+ slot', value: 1 }, { title: '2+ slot', value: 2 },
  { title: '3+ slot', value: 3 }, { title: '4 slot', value: 4 },
]

const query = computed<ItemQuery>(() => {
  if (isEnchantMode.value) {
    // the whole option list is small (~260) — fetch once, filter to the pool here so the order matches the rule
    return { type: 'CARD', subType: 'ENCHANT', search: search.value, limit: 300, offset: 0 }
  }
  if (isCardMode.value) {
    const q: ItemQuery = { ...(props.cardFilter ?? { type: 'CARD' }), search: search.value, limit: PAGE, offset: (page.value - 1) * PAGE }
    // one cardLocation at a time on the API; when a slot accepts several (accessories)
    // or the user wants unparsed cards, fetch all and filter here.
    if (!allCards.value && props.cardLocations!.length === 1) q.cardLocation = props.cardLocations![0]
    return q
  }
  return { ...props.filter, search: search.value, slots: minSlots.value || undefined, limit: PAGE, offset: (page.value - 1) * PAGE }
})

const visible = computed(() => {
  if (isEnchantMode.value) {
    if (allCards.value || !poolSet.value) return items.value
    const order = new Map(props.enchantPool!.map((id, i) => [id, i]))
    return items.value.filter((i) => poolSet.value!.has(i.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!)
  }
  if (!isCardMode.value || allCards.value || props.cardLocations!.length === 1) return items.value
  return items.value.filter((i) => i.cardLocation && props.cardLocations!.includes(i.cardLocation))
})

let timer: ReturnType<typeof setTimeout> | undefined
async function fetchItems() {
  loading.value = true
  try {
    const res = await api.items(query.value)
    total.value = res.total
    items.value = res.items
  } finally {
    loading.value = false
  }
}

watch([search, minSlots, allCards], () => {
  page.value = 1
  clearTimeout(timer)
  timer = setTimeout(fetchItems, 250)
})
watch(page, fetchItems)
watch(model, (open) => {
  if (open) { search.value = ''; minSlots.value = 0; page.value = 1; preview.value = null; fetchItems() }
})

function pick(item: ItemSummary | null) {
  emit('select', item)
  model.value = false
}
</script>

<template>
  <v-dialog v-model="model" max-width="1000" scrollable>
    <v-card class="ro-panel">
      <v-card-title class="d-flex align-center">
        <span>{{ title }}</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="model = false" />
      </v-card-title>
      <v-card-text class="pt-0">
        <div class="d-flex align-center flex-wrap" style="gap: 8px">
          <v-text-field v-model="search" prepend-inner-icon="mdi-magnify" label="ค้นหาชื่อ / ID" clearable style="min-width: 220px" />
          <v-select v-if="!isCardMode && !isEnchantMode" v-model="minSlots" :items="SLOT_OPTIONS" style="max-width: 130px" />
          <v-switch v-else-if="isEnchantMode && poolSet" v-model="allCards" label="แสดง enchant ทั้งหมด (นอกชุดของ NPC นี้)" color="accent" density="compact" hide-details />
          <v-switch v-else-if="isCardMode" v-model="allCards" :label="cardFilter ? 'แสดง stone ทุกตำแหน่ง' : 'แสดงการ์ดทั้งหมด'" color="accent" density="compact" hide-details />
          <span class="text-caption text-medium-emphasis">{{ isEnchantMode ? visible.length : total }} รายการ</span>
        </div>
        <div class="d-flex mt-2" style="gap: 12px">
        <v-list density="compact" class="bg-transparent flex-grow-1" style="min-height: 300px">
          <v-list-item v-if="!isCardMode || true" @click="pick(null)">
            <template #prepend><div class="ro-icon-box mr-3"><v-icon icon="mdi-close-circle-outline" color="grey" /></div></template>
            <v-list-item-title class="text-medium-emphasis">— ถอดออก —</v-list-item-title>
          </v-list-item>
          <v-list-item v-for="it in visible" :key="it.id" @click="pick(it)">
            <template #prepend>
              <div class="ro-icon-box mr-3"><img v-if="it.hasIcon" :src="iconUrl(it.id)" alt="" loading="lazy" /></div>
            </template>
            <v-list-item-title>
              {{ it.name }} <span v-if="it.slotCount" class="text-medium-emphasis">[{{ it.slotCount }}]</span>
            </v-list-item-title>
            <v-list-item-subtitle>
              #{{ it.id }} · {{ it.subType }}
              <template v-if="it.atk"> · ATK {{ it.atk }}</template>
              <template v-if="it.def"> · DEF {{ it.def }}</template>
              <template v-if="it.requiredLevel"> · Lv {{ it.requiredLevel }}</template>
              <template v-if="it.cardLocation"> · {{ it.cardLocation }}</template>
            </v-list-item-subtitle>
            <template #append>
              <v-icon icon="mdi-information-outline" size="small" color="grey" @click.stop="preview = it" @mouseenter="preview = it" />
            </template>
          </v-list-item>
          <v-skeleton-loader v-if="loading && !items.length" type="list-item-avatar@6" class="bg-transparent" />
          <div v-else-if="!visible.length" class="text-center text-medium-emphasis py-8">ไม่พบไอเทม</div>
        </v-list>
        <div v-if="preview" class="d-none d-sm-block" style="width: 300px; flex: 0 0 300px">
          <ItemTooltip :item="preview" />
        </div>
        </div>
        <div v-if="!isEnchantMode && total > PAGE" class="d-flex align-center justify-center mt-2" style="gap: 12px">
          <v-btn icon="mdi-chevron-left" size="small" variant="tonal" :disabled="page <= 1" @click="page--" />
          <span class="text-caption">หน้า {{ page }} / {{ Math.ceil(total / PAGE) }}</span>
          <v-btn icon="mdi-chevron-right" size="small" variant="tonal" :disabled="page >= Math.ceil(total / PAGE)" @click="page++" />
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
