<script setup lang="ts">
import { ref } from 'vue'
import { iconUrl, type ItemSummary } from '@/api/client'
import type { SlotDef } from '@/lib/slots'
import { useBuildStore } from '@/stores/build'
import ItemPickerDialog from './ItemPickerDialog.vue'
import ItemTooltip from './ItemTooltip.vue'

const props = defineProps<{ def: SlotDef; disabled?: boolean }>()
const store = useBuildStore()

const pickerOpen = ref(false)
const cardPickerOpen = ref(false)
const cardIndex = ref(0)

const slot = () => store.slots[props.def.key]!

function openCard(i: number) {
  cardIndex.value = i
  cardPickerOpen.value = true
}
function onCard(card: ItemSummary | null) {
  store.setCard(props.def.key, cardIndex.value, card)
}
</script>

<template>
  <v-card class="ro-panel pa-2" :class="{ 'opacity-50': disabled }" variant="flat">
    <div class="d-flex align-center" style="gap: 10px">
      <v-menu v-if="slot().item" open-on-hover :open-delay="400" location="end" :close-on-content-click="false">
        <template #activator="{ props: p }">
          <div v-bind="p" class="ro-icon-box" style="cursor: help">
            <img v-if="slot().item!.hasIcon" :src="iconUrl(slot().item!.id)" alt="" />
          </div>
        </template>
        <ItemTooltip :item="slot().item!" :refine="slot().refine" />
      </v-menu>
      <div v-else class="ro-icon-box"><v-icon :icon="def.icon" color="grey-darken-1" /></div>

      <div class="flex-grow-1 overflow-hidden">
        <div class="text-caption text-medium-emphasis">{{ def.label }}</div>
        <div class="text-body-2 text-truncate font-weight-medium">
          <template v-if="slot().item">
            <span v-if="slot().refine" class="ro-refine">+{{ slot().refine }} </span>
            {{ slot().item!.name }}
            <span v-if="slot().item!.slotCount" class="text-medium-emphasis">[{{ slot().item!.slotCount }}]</span>
          </template>
          <span v-else class="text-disabled">{{ disabled ? 'ถูกใช้โดยอาวุธสองมือ' : 'ว่าง' }}</span>
        </div>
        <div v-if="slot().item && slot().item!.slotCount" class="d-flex mt-1" style="gap: 4px">
          <div v-for="(card, i) in slot().cards" :key="i" class="ro-card-chip" :title="card?.name ?? 'ใส่การ์ด'" @click="openCard(i)">
            <img v-if="card" :src="iconUrl(card.id)" alt="" />
            <v-icon v-else icon="mdi-cards-outline" size="14" color="grey" />
          </div>
        </div>
      </div>

      <div class="d-flex flex-column align-end" style="gap: 2px">
        <v-btn icon="mdi-pencil" size="x-small" variant="tonal" :disabled="disabled" @click="pickerOpen = true" />
        <div v-if="def.refinable && slot().item" class="d-flex align-center">
          <v-btn icon="mdi-minus" size="x-small" variant="text" density="compact" @click="store.setRefine(def.key, slot().refine - 1)" />
          <span class="text-caption ro-refine" style="width: 26px; text-align: center">+{{ slot().refine }}</span>
          <v-btn icon="mdi-plus" size="x-small" variant="text" density="compact" @click="store.setRefine(def.key, slot().refine + 1)" />
        </div>
      </div>
    </div>

    <ItemPickerDialog v-model="pickerOpen" :title="def.label" :filter="def.filter" @select="store.equip(def.key, $event)" />
    <ItemPickerDialog
      v-if="def.cardLocations.length"
      v-model="cardPickerOpen"
      :title="`การ์ดช่อง ${cardIndex + 1} — ${slot().item?.name ?? ''}`"
      :filter="{}"
      :card-locations="def.cardLocations"
      @select="onCard"
    />
  </v-card>
</template>
