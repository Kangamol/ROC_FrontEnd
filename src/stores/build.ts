import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { api, type BuildResponse, type ItemSummary } from '@/api/client'
import { SLOTS, SLOT_MAP } from '@/lib/slots'
import { TRANSCENDENT, calculate, classCaps, isTwoHanded, statPointsSpent, type BaseStats, type EquippedSlot, type JobData } from '@/lib/stats'
import { clampOption, enchantCapacity, enchantSlotsView, isEnchant, ruleFor, type EnchantPools, type RolledOption } from '@/lib/enchant'

interface SlotState {
  item: ItemSummary | null
  refine: number
  cards: (ItemSummary | null)[]
  /** NPC enchants by position order 4, 3, 2 (see lib/enchant.ts) */
  enchants: (ItemSummary | null)[]
  /** rolled range options, one per rule row (Tengu B.Scroll …); null = row not rolled */
  randomOptions: (RolledOption | null)[]
}

/** Classic server caps refining at +15 */
export const MAX_REFINE = 15

const emptySlot = (): SlotState => ({ item: null, refine: 0, cards: [], enchants: [], randomOptions: [] })

export const useBuildStore = defineStore('build', () => {
  const title = ref('My Build')
  const jobClass = ref('Knight')
  const baseLevel = ref(99)
  const jobLevel = ref(50)
  const gender = ref<'M' | 'F'>('M')
  const hairStyle = ref(1)
  const hairColor = ref(0)
  const clothColor = ref(0)
  const stats = reactive<BaseStats>({ str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 })
  const slots = reactive<Record<string, SlotState>>(Object.fromEntries(SLOTS.map((s) => [s.key, emptySlot()])))
  const shareCode = ref<string | null>(null)
  const saving = ref(false)
  const loadError = ref<string | null>(null)

  const equipped = computed<EquippedSlot[]>(() =>
    SLOTS.map((s) => ({
      key: s.key, item: slots[s.key]!.item, refine: slots[s.key]!.refine, cards: slots[s.key]!.cards, enchants: slots[s.key]!.enchants,
      randomOptions: slots[s.key]!.randomOptions.filter((r): r is RolledOption => !!r),
    })),
  )

  /** NPC enchant rules from the API (data/enchant_pools.json); no enchanting until loaded. */
  const enchantPools = shallowRef<EnchantPools | null>(null)
  api.enchantPools().then((p) => { enchantPools.value = p }).catch(() => { /* enchant UI stays hidden */ })

  const enchantRule = (slotKey: string, item: ItemSummary) => {
    const mode = SLOT_MAP[slotKey]?.npcEnchant
    return mode ? ruleFor(item, enchantPools.value, mode === 'default') : null
  }
  const randomRows = (slotKey: string, item: ItemSummary) => enchantRule(slotKey, item)?.randomOptions?.length ?? 0
  // items equipped before the rules arrived (shared link) get their enchant slots once they do
  watch(enchantPools, () => {
    for (const s of SLOTS) {
      const slot = slots[s.key]!
      if (!slot.item) continue
      const n = enchantCapacity(slot.item, enchantRule(s.key, slot.item))
      slot.enchants = Array.from({ length: n }, (_, i) => slot.enchants[i] ?? null)
      slot.randomOptions = Array.from({ length: randomRows(s.key, slot.item) }, (_, i) => slot.randomOptions[i] ?? null)
    }
  })

  /** Job tables from the API (base HP/SP, ASPD, job-level stats); engine falls back to approximations until loaded. */
  const jobData = shallowRef<Record<string, JobData>>({})
  api.jobs().then((d) => { jobData.value = d }).catch(() => { /* keep fallback */ })

  const derived = computed(() =>
    calculate({ jobClass: jobClass.value, baseLevel: baseLevel.value, jobLevel: jobLevel.value, stats }, equipped.value, jobData.value[jobClass.value]),
  )

  /** Level / stat limits of the chosen class (Awakened: 120 / 75, stats 130 once Base Lv ≥ 100). */
  const caps = computed(() => classCaps(jobData.value[jobClass.value], baseLevel.value))
  // keep level and stats inside the class limits when the class or the level changes
  watch([caps, jobClass], () => {
    if (baseLevel.value > caps.value.baseLevel) baseLevel.value = caps.value.baseLevel
    if (jobLevel.value > caps.value.jobLevel) jobLevel.value = caps.value.jobLevel
    for (const k of Object.keys(stats) as (keyof BaseStats)[]) if (stats[k] > caps.value.stat) stats[k] = caps.value.stat
  })

  /** Cumulative status-point tables from the API (Gnjoy page); null until loaded. */
  const statPointTable = shallowRef<{ hiClass: number[]; normal: number[] } | null>(null)
  api.awakened().then((a) => { statPointTable.value = a.statPoints }).catch(() => { /* indicator stays hidden */ })
  /** Status points spent vs. available at this base level (Awakened classes use the normal 48-start column). */
  const statPoints = computed(() => {
    const t = statPointTable.value
    if (!t) return null
    const col = TRANSCENDENT.has(jobClass.value) ? t.hiClass : t.normal
    const available = col[Math.min(Math.max(baseLevel.value, 1), col.length) - 1] ?? 0
    const spent = (Object.keys(stats) as (keyof BaseStats)[]).reduce((sum, k) => sum + statPointsSpent(stats[k]), 0)
    return { spent, available, over: spent > available }
  })

  const shieldBlocked = computed(() => isTwoHanded(slots.WEAPON!.item))

  /** Card / enchant capacity of a slot: costume pieces always take one enchant stone. */
  const capacity = (slotKey: string, item: ItemSummary) => SLOT_MAP[slotKey]?.enchantSlots ?? item.slotCount

  function equip(slotKey: string, item: ItemSummary | null) {
    const slot = slots[slotKey]
    if (!slot) return
    slot.item = item
    slot.refine = 0
    slot.cards = item ? Array.from({ length: capacity(slotKey, item) }, () => null) : []
    slot.enchants = item ? Array.from({ length: enchantCapacity(item, enchantRule(slotKey, item)) }, () => null) : []
    slot.randomOptions = item ? Array.from({ length: randomRows(slotKey, item) }, () => null) : []
    shareCode.value = null
    // two-handed weapons kick the shield out
    if (slotKey === 'WEAPON' && isTwoHanded(item)) Object.assign(slots.SHIELD!, emptySlot())
  }

  function setRefine(slotKey: string, refine: number) {
    const slot = slots[slotKey]
    if (!slot?.item || !SLOT_MAP[slotKey]?.refinable) return
    slot.refine = Math.max(0, Math.min(MAX_REFINE, refine))
    // an enchant slot that needs a higher refine loses its enchant when the item is refined down
    for (const v of enchantSlotsView(slot.item, slot.refine, slot.enchants, enchantRule(slotKey, slot.item))) {
      if (slot.refine < v.minRefine) slot.enchants[v.index] = null
    }
    shareCode.value = null
  }

  /** Pick / clear a random-option row: `key` from that row's options, `value` clamped to its range. */
  function setRandomOption(slotKey: string, row: number, key: string | null, value: number) {
    const slot = slots[slotKey]
    if (!slot?.item || row >= slot.randomOptions.length) return
    const def = enchantRule(slotKey, slot.item)?.randomOptions?.[row]?.options.find((o) => o.key === key)
    slot.randomOptions[row] = def ? { key: def.key, value: clampOption(def, value) } : null
    shareCode.value = null
  }

  function setEnchant(slotKey: string, index: number, enchant: ItemSummary | null) {
    const slot = slots[slotKey]
    if (!slot?.item || index >= slot.enchants.length) return
    slot.enchants[index] = enchant
    shareCode.value = null
  }

  function setCard(slotKey: string, index: number, card: ItemSummary | null) {
    const slot = slots[slotKey]
    if (!slot?.item || index >= capacity(slotKey, slot.item)) return
    slot.cards[index] = card
    shareCode.value = null
  }

  function reset() {
    for (const s of SLOTS) Object.assign(slots[s.key]!, emptySlot())
    Object.assign(stats, { str: 1, agi: 1, vit: 1, int: 1, dex: 1, luk: 1 })
    shareCode.value = null
  }

  async function save() {
    saving.value = true
    try {
      const res = await api.saveBuild({
        title: title.value,
        jobClass: jobClass.value,
        baseLevel: baseLevel.value,
        jobLevel: jobLevel.value,
        gender: gender.value,
        hairStyle: hairStyle.value,
        hairColor: hairColor.value,
        clothColor: clothColor.value,
        stats: { ...stats },
        slots: SLOTS.filter((s) => slots[s.key]!.item).map((s) => {
          const st = slots[s.key]!
          return {
            location: s.key,
            refineLevel: st.refine,
            itemId: st.item!.id,
            // enchants live in the last card positions (4, 3, 2), the same way the game stores them
            card1Id: st.cards[0]?.id ?? null,
            card2Id: st.cards[1]?.id ?? st.enchants[2]?.id ?? null,
            card3Id: st.cards[2]?.id ?? st.enchants[1]?.id ?? null,
            card4Id: st.cards[3]?.id ?? st.enchants[0]?.id ?? null,
            randomOptions: st.randomOptions.filter((r): r is RolledOption => !!r),
          }
        }),
      })
      shareCode.value = res.shareCode
      return res.shareCode
    } finally {
      saving.value = false
    }
  }

  function applyBuild(b: BuildResponse) {
    title.value = b.title
    jobClass.value = b.jobClass
    baseLevel.value = b.baseLevel
    jobLevel.value = b.jobLevel
    gender.value = b.gender ?? 'M'
    hairStyle.value = b.hairStyle ?? 1
    hairColor.value = b.hairColor ?? 0
    clothColor.value = b.clothColor ?? 0
    Object.assign(stats, { str: b.str, agi: b.agi, vit: b.vit, int: b.int, dex: b.dex, luk: b.luk })
    for (const s of SLOTS) Object.assign(slots[s.key]!, emptySlot())
    for (const s of b.slots) {
      const slot = slots[s.location]
      if (!slot || !s.item) continue
      slot.item = s.item
      slot.refine = s.refineLevel
      const stored = [s.card1, s.card2, s.card3, s.card4]
      slot.cards = Array.from({ length: capacity(s.location, s.item) }, (_, i) => (isEnchant(stored[i]) ? null : stored[i]) ?? null)
      const n = enchantCapacity(s.item, enchantRule(s.location, s.item))
      slot.enchants = Array.from({ length: n }, (_, i) => (isEnchant(stored[3 - i]) ? stored[3 - i]! : null))
      const rolled = s.randomOptions ?? []
      slot.randomOptions = Array.from({ length: Math.max(randomRows(s.location, s.item), rolled.length) }, (_, i) => rolled[i] ?? null)
    }
    shareCode.value = b.shareCode
  }

  async function load(code: string) {
    loadError.value = null
    try {
      applyBuild(await api.build(code))
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : String(e)
    }
  }

  return {
    title, jobClass, baseLevel, jobLevel, gender, hairStyle, hairColor, clothColor, stats, slots, shareCode, saving, loadError,
    equipped, derived, shieldBlocked, enchantPools, enchantRule, caps, statPoints, jobData,
    equip, setRefine, setCard, setEnchant, setRandomOption, reset, save, load,
  }
})
