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
      <!-- hover or click the item (icon + name) to see its full description -->
      <v-menu v-if="slot().item" open-on-hover open-on-click :open-delay="250" location="end" :close-on-content-click="false" max-width="380">
        <template #activator="{ props: p }">
          <div v-bind="p" class="d-flex align-center flex-grow-1 overflow-hidden slot-hit" style="gap: 10px">
            <div class="ro-icon-box">
              <img v-if="slot().item!.hasIcon" :src="iconUrl(slot().item!.id)" alt="" />
            </div>
            <div class="flex-grow-1 overflow-hidden">
              <div class="text-caption text-medium-emphasis">{{ def.label }}</div>
              <div class="text-body-2 text-truncate font-weight-medium">
                <span v-if="slot().refine" class="ro-refine">+{{ slot().refine }} </span>
                {{ slot().item!.name }}
                <span v-if="slot().item!.slotCount" class="text-medium-emphasis">[{{ slot().item!.slotCount }}]</span>
                <v-icon icon="mdi-information-outline" size="12" color="grey" class="ml-1" />
              </div>
              <div v-if="slot().cards.length" class="d-flex align-center mt-1" style="gap: 4px" @mouseenter.stop>
                <template v-for="(card, i) in slot().cards" :key="i">
                  <!-- card / enchant chip: hover = its description, click = change it -->
                  <v-menu v-if="card" open-on-hover :open-delay="250" location="bottom" :close-on-content-click="false" max-width="380">
                    <template #activator="{ props: cp }">
                      <div v-bind="cp" class="ro-card-chip" @click.stop="openCard(i)">
                        <img :src="iconUrl(card.id)" alt="" />
                      </div>
                    </template>
                    <ItemTooltip :item="card" />
                  </v-menu>
                  <div v-else class="ro-card-chip" :title="def.enchantSlots ? 'ใส่ enchant stone' : 'ใส่การ์ด'" @click.stop="openCard(i)">
                    <v-icon :icon="def.enchantSlots ? 'mdi-diamond-stone' : 'mdi-cards-outline'" size="14" color="grey" />
                  </div>
                </template>
                <span v-if="def.enchantSlots && slot().cards[0]" class="text-caption text-medium-emphasis text-truncate">{{ slot().cards[0]!.name }}</span>
              </div>
            </div>
          </div>
        </template>
        <ItemTooltip :item="slot().item!" :refine="slot().refine" />
      </v-menu>

      <template v-else>
        <div class="ro-icon-box"><v-icon :icon="def.icon" color="grey-darken-1" /></div>
        <div class="flex-grow-1 overflow-hidden">
          <div class="text-caption text-medium-emphasis">{{ def.label }}</div>
          <div class="text-body-2 text-truncate font-weight-medium">
            <span class="text-disabled">{{ disabled ? 'ถูกใช้โดยอาวุธสองมือ' : 'ว่าง' }}</span>
          </div>
        </div>
      </template>

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
      :title="def.enchantSlots ? `Enchant — ${slot().item?.name ?? ''}` : `การ์ดช่อง ${cardIndex + 1} — ${slot().item?.name ?? ''}`"
      :filter="{}"
      :card-locations="def.cardLocations"
      :card-filter="def.cardFilter"
      @select="onCard"
    />
  </v-card>
</template>

<style scoped>
.slot-hit { cursor: pointer; border-radius: 6px; }
.slot-hit:hover { background: rgba(37, 99, 235, 0.06); }
</style>
