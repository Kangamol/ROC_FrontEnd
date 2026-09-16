/**
 * Stat calculation engine (pre-renewal style, matching RO Classic).
 *
 * Item effects come from `bonuses` parsed out of the client descriptions, so
 * anything the parser does not understand yet is simply not counted. Job HP/SP
 * and ASPD tables are approximations until per-job data is filled in.
 */
import type { Bonuses, ItemSummary } from '@/api/client'
import { TWO_HANDED } from './slots'

export interface BaseStats { str: number; agi: number; vit: number; int: number; dex: number; luk: number }
export const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const satisfies readonly (keyof BaseStats)[]

export interface EquippedSlot {
  key: string
  item: ItemSummary | null
  refine: number
  cards: (ItemSummary | null)[]
}

export interface Character {
  jobClass: string
  baseLevel: number
  jobLevel: number
  stats: BaseStats
}

export interface Derived {
  total: BaseStats
  bonus: BaseStats
  statusAtk: number
  weaponAtk: number
  weaponAtkRefine: number
  atkBonusFlat: number
  atkPercent: number
  matkMin: number
  matkMax: number
  matkPercent: number
  hardDef: number
  softDef: number
  hardMdef: number
  softMdef: number
  hit: number
  flee: number
  perfectDodge: number
  crit: number
  aspd: number
  maxHp: number
  maxSp: number
  /** DEX-based variable cast reduction (pre-renewal: DEX/1.5 %) */
  castTimeDex: number
  /** Sum of variable cast time reduction from worn items (%) */
  variableCastItems: number
  /** Sum of fixed cast time reduction from worn items */
  fixedCastSeconds: number
  fixedCastPercent: number
  /** Sum of after-cast delay reduction from worn items (%) */
  afterCastDelayItems: number
  weight: number
  bonuses: Bonuses
}

/** Refine ATK bonus per +1 by weapon level (pre-renewal). */
const REFINE_ATK: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 7 }

/** Approximate base weapon delay (ms/10) per weapon subtype; used for ASPD. */
const WEAPON_DELAY: Record<string, number> = {
  NONE: 400, DAGGER: 450, SWORD_1H: 500, SWORD_2H: 550, SPEAR_1H: 550, SPEAR_2H: 600,
  AXE_1H: 550, AXE_2H: 600, MACE: 550, STAFF_1H: 550, STAFF_2H: 600, BOW: 550, KATAR: 500,
  BOOK: 500, KNUCKLE: 500, INSTRUMENT: 550, WHIP: 550, HUUMA: 600, REVOLVER: 550, RIFLE: 650,
  SHOTGUN: 700, GATLING: 650, GRENADE_LAUNCHER: 750, UNKNOWN: 550,
}

/** Rough per-job HP/SP growth (hp_factor, hp_multiplier, sp_factor ×0.01). */
const JOB_GROWTH: Record<string, [number, number, number]> = {
  Novice: [0, 500, 100], 'Super Novice': [0, 500, 100],
  Swordman: [700, 500, 200], Knight: [1500, 500, 300], Crusader: [1100, 500, 400],
  'Lord Knight': [1500, 500, 300], Paladin: [1100, 500, 400],
  Magician: [300, 500, 600], Wizard: [550, 500, 900], Sage: [750, 500, 700],
  'High Wizard': [550, 500, 900], Professor: [750, 500, 700],
  Archer: [500, 500, 200], Hunter: [850, 500, 400], Bard: [750, 500, 300], Dancer: [750, 500, 300],
  Sniper: [850, 500, 400], Clown: [750, 500, 300], Gypsy: [750, 500, 300],
  Acolyte: [400, 500, 500], Priest: [750, 500, 800], Monk: [900, 500, 400],
  'High Priest': [750, 500, 800], Champion: [900, 500, 400],
  Merchant: [400, 500, 300], Blacksmith: [900, 500, 400], Alchemist: [900, 500, 400],
  Whitesmith: [900, 500, 400], Creator: [900, 500, 400],
  Thief: [500, 500, 200], Assassin: [1100, 500, 400], Rogue: [850, 500, 500],
  'Assassin Cross': [1100, 500, 400], Stalker: [850, 500, 500],
  Taekwon: [700, 500, 200], 'Star Gladiator': [900, 500, 300], 'Soul Linker': [750, 500, 900],
  Ninja: [900, 500, 400], Gunslinger: [900, 500, 400],
}

/** Bonuses of one item at a given refine level (unconditional + refine-conditional). */
export function itemBonusesAt(item: ItemSummary, refine: number): Bonuses {
  const out: Bonuses = { ...item.bonuses }
  const add = (b: Bonuses, times = 1) => { for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v * times }
  for (const r of item.conditionalBonuses?.refine ?? []) if (refine >= r.min) add(r.bonuses)
  for (const r of item.conditionalBonuses?.perRefine ?? []) if (r.every > 0) add(r.bonuses, Math.floor(refine / r.every))
  return out
}

export function sumBonuses(slots: EquippedSlot[]): Bonuses {
  const out: Bonuses = {}
  const add = (b: Bonuses | undefined) => {
    if (!b) return
    for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v
  }
  for (const s of slots) {
    if (s.item) add(itemBonusesAt(s.item, s.refine))
    for (const c of s.cards) if (c) add(itemBonusesAt(c, 0))
  }
  return out
}

export function calculate(char: Character, slots: EquippedSlot[]): Derived {
  const b = sumBonuses(slots)
  const all = b.allStats ?? 0
  const bonus: BaseStats = {
    str: (b.str ?? 0) + all, agi: (b.agi ?? 0) + all, vit: (b.vit ?? 0) + all,
    int: (b.int ?? 0) + all, dex: (b.dex ?? 0) + all, luk: (b.luk ?? 0) + all,
  }
  const total: BaseStats = {
    str: char.stats.str + bonus.str, agi: char.stats.agi + bonus.agi, vit: char.stats.vit + bonus.vit,
    int: char.stats.int + bonus.int, dex: char.stats.dex + bonus.dex, luk: char.stats.luk + bonus.luk,
  }
  const lv = char.baseLevel

  const weapon = slots.find((s) => s.key === 'WEAPON')
  const isRanged = ['BOW', 'REVOLVER', 'RIFLE', 'SHOTGUN', 'GATLING', 'GRENADE_LAUNCHER', 'HUUMA'].includes(weapon?.item?.subType ?? '')
  const mainStat = isRanged ? total.dex : total.str
  const subStat = isRanged ? total.str : total.dex
  const statusAtk = mainStat + Math.floor(mainStat / 10) ** 2 + Math.floor(subStat / 5) + Math.floor(total.luk / 5)

  let weaponAtk = 0, weaponAtkRefine = 0, hardDef = 0, hardMdef = 0, weight = 0
  for (const s of slots) {
    const it = s.item
    if (!it) continue
    weight += it.weight ?? 0
    for (const c of s.cards) weight += c?.weight ?? 0
    if (s.key === 'WEAPON' || s.key === 'AMMO') {
      weaponAtk += it.atk ?? 0
      if (s.key === 'WEAPON') weaponAtkRefine += s.refine * (REFINE_ATK[it.weaponLevel ?? 1] ?? 2)
    } else {
      hardDef += it.def ?? 0
      hardDef += s.refine // armour refine: +1 DEF per level
    }
  }
  hardDef += b.def ?? 0
  hardMdef += b.mdef ?? 0

  const matkMin = total.int + Math.floor(total.int / 7) ** 2 + (b.matk ?? 0) + (weapon?.item?.matk ?? 0)
  const matkMax = total.int + Math.floor(total.int / 5) ** 2 + (b.matk ?? 0) + (weapon?.item?.matk ?? 0)

  // ASPD (pre-renewal): amotion = delay - delay*(AGI*4+DEX)/1000, then % modifiers
  const subType = weapon?.item?.subType ?? 'NONE'
  const delay = WEAPON_DELAY[subType] ?? WEAPON_DELAY.UNKNOWN!
  let amotion = delay - (delay * (total.agi * 4 + total.dex)) / 1000
  amotion *= 1 - (b.aspdPercent ?? 0) / 100
  let aspd = 200 - amotion / 10 + (b.aspd ?? 0)
  aspd = Math.min(190, Math.max(0, aspd))

  const [hpFactor, hpMul, spFactor] = JOB_GROWTH[char.jobClass] ?? JOB_GROWTH.Novice!
  const baseHp = 35 + (lv * hpMul) / 100 + (hpFactor / 100) * ((lv * (lv + 1)) / 2) / 10
  let maxHp = Math.floor(baseHp * (1 + total.vit / 100)) + (b.maxHp ?? 0)
  maxHp = Math.floor(maxHp * (1 + (b.maxHpPercent ?? 0) / 100))
  const baseSp = 10 + (lv * spFactor) / 100
  let maxSp = Math.floor(baseSp * (1 + total.int / 100)) + (b.maxSp ?? 0)
  maxSp = Math.floor(maxSp * (1 + (b.maxSpPercent ?? 0) / 100))

  return {
    total, bonus, statusAtk, weaponAtk, weaponAtkRefine,
    atkBonusFlat: b.atk ?? 0, atkPercent: b.atkPercent ?? 0,
    matkMin, matkMax, matkPercent: b.matkPercent ?? 0,
    hardDef, softDef: total.vit,
    hardMdef, softMdef: total.int,
    hit: 175 + lv + total.dex + (b.hit ?? 0),
    flee: 100 + lv + total.agi + (b.flee ?? 0),
    perfectDodge: 1 + Math.floor(total.luk / 10) + (b.perfectDodge ?? 0),
    crit: 1 + total.luk * 0.3 + (b.crit ?? 0),
    aspd: Math.round(aspd * 10) / 10,
    maxHp, maxSp,
    castTimeDex: Math.min(100, Math.floor(total.dex / 1.5)),
    variableCastItems: b.variableCastPercent ?? 0,
    fixedCastSeconds: b.fixedCastSeconds ?? 0,
    fixedCastPercent: b.fixedCastPercent ?? 0,
    afterCastDelayItems: b.afterCastDelayPercent ?? 0,
    weight,
    bonuses: b,
  }
}

export const isTwoHanded = (item: ItemSummary | null) => !!item && TWO_HANDED.has(item.subType)
