import type { ItemSummary } from '@/api/client'

/**
 * NPC enchant rules (data/enchant_pools.json on the API). Enchants sit in the item's card slots
 * counted from the LAST one: position 4 first, then 3, then 2 — exactly how the game stores them,
 * so a [1] item keeps its real card in slot 1 while carrying up to three enchants.
 */
export interface EnchantSlotRule {
  /** card slot the enchant occupies (4, 3 or 2) */
  position: number
  /** item refine needed before this slot can be enchanted */
  minRefine: number
  /** allowed enchant item IDs; null = any enchant option */
  options: number[] | null
  /** the previous slot has to be filled first (Zodiac hats) */
  requiresPrevious?: boolean
  /** …and with one of these enchant IDs (Zodiac: slot 4 must be at Lv.4 before slot 3 opens) */
  requiresPreviousIn?: number[]
}
/** One choosable random option: the user types the rolled value within [min, max]; `key` is a bonus key. */
export interface RandomOptionDef { key: string; label: string; min: number; max: number; unit: '' | '%' }
/** A row of random options (Tengu B.Scroll row 1 / row 2 …) — one option per row */
export interface RandomOptionRow { label: string; options: RandomOptionDef[] }
export interface RolledOption { key: string; value: number }
export interface EnchantRule {
  name: string; source?: string; note?: string; verified?: boolean
  slots: EnchantSlotRule[]
  /** range-based random options rolled on the item itself (in addition to / instead of enchant slots) */
  randomOptions?: RandomOptionRow[]
}
export interface EnchantPools { default: EnchantRule | null; items: Record<string, EnchantRule> }

/** Slot keys whose items can visit the enchant NPCs. */
export const NPC_ENCHANT_SLOTS = new Set(['HEAD_TOP', 'ARMOR', 'GARMENT', 'SHOES'])

export const isEnchant = (item: ItemSummary | null | undefined) => !!item && item.subType === 'ENCHANT'

/** The rule that applies to an item: its own entry, else (when allowed for the slot) the generic Hidden Enchant. */
export function ruleFor(item: ItemSummary, pools: EnchantPools | null, allowDefault = true): EnchantRule | null {
  if (!pools) return null
  return pools.items[String(item.id)] ?? (allowDefault ? pools.default : null)
}

/** Clamp a typed value into the option's range (integers unless the range itself is fractional). */
export function clampOption(def: RandomOptionDef, value: number): number {
  const v = Math.min(def.max, Math.max(def.min, value))
  return Number.isInteger(def.min) && Number.isInteger(def.max) ? Math.round(v) : v
}

/** Number of enchant positions an item can ever have (never overlapping its real card slots). */
export function enchantCapacity(item: ItemSummary, rule: EnchantRule | null): number {
  if (!rule) return 0
  return Math.min(rule.slots.length, 4 - item.slotCount)
}

export interface EnchantSlotView extends EnchantSlotRule {
  /** index in the store's `enchants` array */
  index: number
  unlocked: boolean
  /** why it is locked, for the tooltip */
  lockReason: string
}

/** Enchant slots of an item as the UI should show them, with lock state from refine / order. */
export function enchantSlotsView(item: ItemSummary, refine: number, enchants: (ItemSummary | null)[], rule: EnchantRule | null): EnchantSlotView[] {
  if (!rule) return []
  const n = enchantCapacity(item, rule)
  return rule.slots.slice(0, n).map((r, index) => {
    const prev = index > 0 ? enchants[index - 1] : null
    const needPrev = (!!r.requiresPrevious || !!r.requiresPreviousIn) && index > 0 && !prev
    const wrongPrev = !!r.requiresPreviousIn && !!prev && !r.requiresPreviousIn.includes(prev.id)
    const lowRefine = refine < r.minRefine
    return {
      ...r,
      index,
      unlocked: !needPrev && !wrongPrev && !lowRefine,
      lockReason: lowRefine ? `ต้องตี +${r.minRefine} ขึ้นไป`
        : needPrev ? 'ต้อง enchant ช่องก่อนหน้าก่อน'
        : wrongPrev ? 'ช่องก่อนหน้าต้องอัพออปชันถึงระดับสูงสุดก่อน' : '',
    }
  })
}
