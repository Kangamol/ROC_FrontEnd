import { computed, reactive, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { api, type BuildResponse, type ItemSummary } from '@/api/client'
import { SLOTS, SLOT_MAP } from '@/lib/slots'
import { calculate, isTwoHanded, type BaseStats, type EquippedSlot, type JobData } from '@/lib/stats'

interface SlotState {
  item: ItemSummary | null
  refine: number
  cards: (ItemSummary | null)[]
}

/** Classic server caps refining at +15 */
export const MAX_REFINE = 15

const emptySlot = (): SlotState => ({ item: null, refine: 0, cards: [] })

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
    SLOTS.map((s) => ({ key: s.key, item: slots[s.key]!.item, refine: slots[s.key]!.refine, cards: slots[s.key]!.cards })),
  )

  /** Job tables from the API (base HP/SP, ASPD, job-level stats); engine falls back to approximations until loaded. */
  const jobData = shallowRef<Record<string, JobData>>({})
  api.jobs().then((d) => { jobData.value = d }).catch(() => { /* keep fallback */ })

  const derived = computed(() =>
    calculate({ jobClass: jobClass.value, baseLevel: baseLevel.value, jobLevel: jobLevel.value, stats }, equipped.value, jobData.value[jobClass.value]),
  )

  const shieldBlocked = computed(() => isTwoHanded(slots.WEAPON!.item))

  /** Card / enchant capacity of a slot: costume pieces always take one enchant stone. */
  const capacity = (slotKey: string, item: ItemSummary) => SLOT_MAP[slotKey]?.enchantSlots ?? item.slotCount

  function equip(slotKey: string, item: ItemSummary | null) {
    const slot = slots[slotKey]
    if (!slot) return
    slot.item = item
    slot.refine = 0
    slot.cards = item ? Array.from({ length: capacity(slotKey, item) }, () => null) : []
    shareCode.value = null
    // two-handed weapons kick the shield out
    if (slotKey === 'WEAPON' && isTwoHanded(item)) Object.assign(slots.SHIELD!, emptySlot())
  }

  function setRefine(slotKey: string, refine: number) {
    const slot = slots[slotKey]
    if (!slot?.item || !SLOT_MAP[slotKey]?.refinable) return
    slot.refine = Math.max(0, Math.min(MAX_REFINE, refine))
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
            card1Id: st.cards[0]?.id ?? null,
            card2Id: st.cards[1]?.id ?? null,
            card3Id: st.cards[2]?.id ?? null,
            card4Id: st.cards[3]?.id ?? null,
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
      slot.cards = Array.from({ length: capacity(s.location, s.item) }, (_, i) => [s.card1, s.card2, s.card3, s.card4][i] ?? null)
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
    equipped, derived, shieldBlocked,
    equip, setRefine, setCard, reset, save, load,
  }
})
