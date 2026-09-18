<script setup lang="ts">
import { ref } from 'vue'
import { computed } from 'vue'
import { iconUrl, type ItemSummary } from '@/api/client'
import type { SlotDef } from '@/lib/slots'
import { enchantSlotsView } from '@/lib/enchant'
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

// ---- NPC enchant (positions 4, 3, 2 — see lib/enchant.ts) ----
const enchantPickerOpen = ref(false)
const enchantIndex = ref(0)
const enchantRule = computed(() => (props.def.npcEnchant && slot().item ? store.enchantRule(props.def.key, slot().item!) : null))
const enchantSlots = computed(() => (slot().item && enchantRule.value ? enchantSlotsView(slot().item!, slot().refine, slot().enchants, enchantRule.value) : []))
const enchantPool = computed(() => enchantSlots.value[enchantIndex.value]?.options ?? null)
function openEnchant(i: number) {
  if (!enchantSlots.value[i]?.unlocked) return
  enchantIndex.value = i
  enchantPickerOpen.value = true
}
function onEnchant(e: ItemSummary | null) {
  store.setEnchant(props.def.key, enchantIndex.value, e)
}

// ---- range-based random options (Tengu B.Scroll …): one row = one option + the rolled value ----
const randomRows = computed(() => enchantRule.value?.randomOptions ?? [])
const rowDef = (row: number) => randomRows.value[row]?.options.find((o) => o.key === slot().randomOptions[row]?.key)
function onRandomKey(row: number, key: string | null) {
  const def = randomRows.value[row]?.options.find((o) => o.key === key)
  store.setRandomOption(props.def.key, row, key, def ? def.max : 0)   // start at the max roll; the user types the real one
}
function onRandomValue(row: number, value: string | number) {
  const cur = slot().randomOptions[row]
  if (cur) store.setRandomOption(props.def.key, row, cur.key, Number(value))
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
              <!-- NPC enchant chips: one per position the rule allows; locked until the refine / order condition is met -->
              <div v-if="enchantSlots.length" class="d-flex align-center mt-1 flex-wrap" style="gap: 4px" @mouseenter.stop>
                <v-icon icon="mdi-auto-fix" size="12" color="grey" :title="enchantRule?.name" />
                <template v-for="v in enchantSlots" :key="v.position">
                  <v-menu v-if="slot().enchants[v.index]" open-on-hover :open-delay="250" location="bottom" :close-on-content-click="false" max-width="380">
                    <template #activator="{ props: ep }">
                      <div v-bind="ep" class="ro-card-chip enchant filled" @click.stop="openEnchant(v.index)">
                        <!-- enchant options have no icon in the client -->
                        <img v-if="slot().enchants[v.index]!.hasIcon" :src="iconUrl(slot().enchants[v.index]!.id)" alt="" />
                        <v-icon v-else icon="mdi-auto-fix" size="12" color="#7c3aed" />
                      </div>
                    </template>
                    <ItemTooltip :item="slot().enchants[v.index]!" />
                  </v-menu>
                  <div
                    v-else
                    class="ro-card-chip enchant"
                    :class="{ locked: !v.unlocked }"
                    :title="v.unlocked ? `Enchant ช่อง ${v.position}` : `ช่อง ${v.position}: ${v.lockReason}`"
                    @click.stop="openEnchant(v.index)"
                  >
                    <v-icon :icon="v.unlocked ? 'mdi-plus' : 'mdi-lock-outline'" size="12" color="grey" />
                  </div>
                </template>
                <span class="text-caption text-medium-emphasis text-truncate">
                  {{ enchantSlots.filter((v) => slot().enchants[v.index]).map((v) => slot().enchants[v.index]!.name).join(', ') }}
                </span>
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

    <!-- random options rolled on the item (Tengu B.Scroll): choose the option, type the value that was rolled -->
    <div v-if="slot().item && randomRows.length" class="mt-1">
      <div v-for="(row, i) in randomRows" :key="'ro' + i" class="d-flex align-center random-row" style="gap: 6px">
        <v-icon icon="mdi-dice-multiple-outline" size="12" color="grey" :title="row.label" />
        <v-select
          :model-value="slot().randomOptions[i]?.key ?? null"
          :items="[{ title: `— ${row.label}: ไม่มี —`, value: null }, ...row.options.map((o) => ({ title: `${o.label} (${o.min}–${o.max}${o.unit})`, value: o.key }))]"
          density="compact" hide-details variant="plain" class="random-select flex-grow-1" @update:model-value="onRandomKey(i, $event)"
        />
        <v-text-field
          v-if="slot().randomOptions[i]"
          :model-value="slot().randomOptions[i]!.value" type="number" :min="rowDef(i)?.min" :max="rowDef(i)?.max"
          :suffix="rowDef(i)?.unit" density="compact" hide-details variant="outlined" class="random-value"
          @update:model-value="onRandomValue(i, $event)"
        />
      </div>
    </div>

    <ItemPickerDialog v-model="pickerOpen" :title="def.label" :filter="def.filter" @select="store.equip(def.key, $event)" />
    <ItemPickerDialog
      v-if="def.npcEnchant"
      v-model="enchantPickerOpen"
      :title="`Enchant ช่อง ${enchantSlots[enchantIndex]?.position ?? ''} — ${slot().item?.name ?? ''}${enchantRule ? ` (${enchantRule.name})` : ''}`"
      :filter="{}"
      :enchant-pool="enchantPool"
      @select="onEnchant"
    />
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
.ro-card-chip.enchant { border-style: dashed; border-color: #7c3aed; }
.ro-card-chip.enchant.filled { border-style: solid; background: rgba(124, 58, 237, 0.08); }
.ro-card-chip.enchant.locked { cursor: not-allowed; opacity: 0.5; border-color: #9ca3af; }
.random-row :deep(.v-field__input) { font-size: 0.75rem; padding-top: 0; padding-bottom: 0; min-height: 24px; }
.random-select { min-width: 0; }
.random-value { flex: 0 0 92px; }
.random-value :deep(input) { text-align: right; }
.slot-hit:hover { background: rgba(37, 99, 235, 0.06); }
</style>
