/**
 * Stat calculation engine (pre-renewal style, matching RO Classic).
 *
 * Item effects come from `bonuses` parsed out of the client descriptions, so
 * anything the parser does not understand yet is simply not counted. Base HP/SP,
 * ASPD and job-level stat bonuses come from the per-job tables served by
 * /api/jobs (rAthena pre-renewal); built-in approximations are the fallback.
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

/** Per-job tables from rAthena pre-renewal (data/jobs.json via /api/jobs). */
export interface JobData {
  key: string
  maxWeight: number
  /** base HP / SP per base level (index 0 = level 1) */
  hp: number[]
  sp: number[]
  /** base attack delay per weapon subType (NONE = bare hands); pre-renewal has no shield penalty */
  aspd: Record<string, number>
  bonusStats: { level: number; str?: number; agi?: number; vit?: number; int?: number; dex?: number; luk?: number }[]
}

export interface Derived {
  total: BaseStats
  /** from items / cards / sets */
  bonus: BaseStats
  /** from job level (job table) */
  jobBonus: BaseStats
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
  /** carry capacity in the same 0.1 units as `weight` (0 when job data is missing) */
  maxWeight: number
  /** true when computed from the job table rather than the built-in approximation */
  usingJobTable: boolean
  bonuses: Bonuses
}

/** Refine ATK bonus per +1 by weapon level (pre-renewal). */
const REFINE_ATK: Record<number, number> = { 1: 2, 2: 3, 3: 5, 4: 7 }

/** Fallback only (used when /api/jobs is unavailable): approximate base weapon delay per weapon subtype. */
const WEAPON_DELAY: Record<string, number> = {
  NONE: 400, DAGGER: 450, SWORD_1H: 500, SWORD_2H: 550, SPEAR_1H: 550, SPEAR_2H: 600,
  AXE_1H: 550, AXE_2H: 600, MACE: 550, STAFF_1H: 550, STAFF_2H: 600, BOW: 550, KATAR: 500,
  BOOK: 500, KNUCKLE: 500, INSTRUMENT: 550, WHIP: 550, HUUMA: 600, REVOLVER: 550, RIFLE: 650,
  SHOTGUN: 700, GATLING: 650, GRENADE_LAUNCHER: 750, UNKNOWN: 550,
}

/** Fallback only (used when /api/jobs is unavailable): rough per-job HP/SP growth. */
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

const addAll = (out: Bonuses, b: Bonuses | undefined, times = 1) => {
  if (!b) return
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v * times
}

/** Bonuses of one item at a given refine level (unconditional + refine-conditional + base-stat scaling). */
export function itemBonusesAt(item: ItemSummary, refine: number, base?: BaseStats): Bonuses {
  const out: Bonuses = { ...item.bonuses }
  const c = item.conditionalBonuses ?? {}
  for (const r of c.refine ?? []) if (refine >= r.min) addAll(out, r.bonuses)
  for (const r of c.perRefine ?? []) if (r.every > 0) addAll(out, r.bonuses, Math.floor(refine / r.every))
  if (base) for (const r of c.perStat ?? []) {
    const v = Math.min(base[r.stat], r.max ?? Infinity)
    if (r.every > 0) addAll(out, r.bonuses, Math.floor(v / r.every))
  }
  return out
}

/** "Variable Casting Stone(Middle)" and "Variable Casting Stone (Middle) [1]" should match. */
const normName = (s: string) => s.replace(/\[\d+\]/g, '').replace(/[\s'\-.]/g, '').toLowerCase()

/**
 * Set bonuses: an item's set entry applies when every required name is worn
 * (cards, stones and the item itself count). The same set text is usually
 * printed on every piece, so identical (members, bonuses) pairs count once.
 */
export function activeSetBonuses(slots: EquippedSlot[]): { owner: ItemSummary; requires: string[]; bonuses: Bonuses }[] {
  const worn: ItemSummary[] = []
  for (const s of slots) { if (s.item) worn.push(s.item); for (const c of s.cards) if (c) worn.push(c) }
  const wornNames = worn.map((i) => normName(i.name))
  const isWorn = (req: string) => { const n = normName(req); return wornNames.some((w) => w === n || w.startsWith(n)) }
  const seen = new Set<string>()
  const out: { owner: ItemSummary; requires: string[]; bonuses: Bonuses }[] = []
  for (const item of worn) {
    for (const set of item.conditionalBonuses?.set ?? []) {
      if (!set.requires.every(isWorn)) continue
      const members = [...new Set([...set.requires.map(normName), normName(item.name)])].sort().join('|')
      const key = `${members}::${JSON.stringify(set.bonuses)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ owner: item, requires: set.requires, bonuses: set.bonuses })
    }
  }
  return out
}

export function sumBonuses(slots: EquippedSlot[], base?: BaseStats): Bonuses {
  const out: Bonuses = {}
  for (const s of slots) {
    if (s.item) addAll(out, itemBonusesAt(s.item, s.refine, base))
    for (const c of s.cards) if (c) addAll(out, itemBonusesAt(c, s.refine, base)) // cards scale with the host item's refine
  }
  for (const set of activeSetBonuses(slots)) addAll(out, set.bonuses)
  return out
}

export function calculate(char: Character, slots: EquippedSlot[], job?: JobData): Derived {
  const b = sumBonuses(slots, char.stats)
  const all = b.allStats ?? 0
  const bonus: BaseStats = {
    str: (b.str ?? 0) + all, agi: (b.agi ?? 0) + all, vit: (b.vit ?? 0) + all,
    int: (b.int ?? 0) + all, dex: (b.dex ?? 0) + all, luk: (b.luk ?? 0) + all,
  }
  const jobBonus: BaseStats = { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 }
  for (const e of job?.bonusStats ?? []) {
    if (e.level > char.jobLevel) continue
    for (const k of STAT_KEYS) jobBonus[k] += e[k] ?? 0
  }
  const total: BaseStats = {
    str: char.stats.str + bonus.str + jobBonus.str, agi: char.stats.agi + bonus.agi + jobBonus.agi, vit: char.stats.vit + bonus.vit + jobBonus.vit,
    int: char.stats.int + bonus.int + jobBonus.int, dex: char.stats.dex + bonus.dex + jobBonus.dex, luk: char.stats.luk + bonus.luk + jobBonus.luk,
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

  // ASPD (pre-renewal): amotion = base[job][weapon] (+ shield penalty) - amotion*(AGI*4+DEX)/1000, then % and flat modifiers
  const subType = weapon?.item?.subType ?? 'NONE'
  const shield = slots.find((s) => s.key === 'SHIELD')?.item
  let delay: number
  if (job?.aspd) {
    // a weapon the job cannot normally use has no entry — fall back to the generic delay
    delay = job.aspd[subType] ?? WEAPON_DELAY[subType] ?? job.aspd.NONE ?? WEAPON_DELAY.UNKNOWN!
    if (shield && job.aspd.SHIELD) delay += job.aspd.SHIELD // renewal-style tables only
  } else {
    delay = WEAPON_DELAY[subType] ?? WEAPON_DELAY.UNKNOWN!
  }
  let amotion = delay - (delay * (total.agi * 4 + total.dex)) / 1000
  amotion *= 1 - (b.aspdPercent ?? 0) / 100
  let aspd = 200 - amotion / 10 + (b.aspd ?? 0)
  aspd = Math.min(190, Math.max(0, aspd))

  let baseHp: number, baseSp: number
  const usingJobTable = !!job?.hp?.length
  if (job?.hp?.length) {
    const i = Math.min(Math.max(lv, 1), job.hp.length) - 1
    baseHp = job.hp[i]!
    baseSp = job.sp[Math.min(i, job.sp.length - 1)]!
  } else {
    const [hpFactor, hpMul, spFactor] = JOB_GROWTH[char.jobClass] ?? JOB_GROWTH.Novice!
    baseHp = 35 + (lv * hpMul) / 100 + (hpFactor / 100) * ((lv * (lv + 1)) / 2) / 10
    baseSp = 10 + (lv * spFactor) / 100
  }
  let maxHp = Math.floor(baseHp * (1 + total.vit / 100)) + (b.maxHp ?? 0)
  maxHp = Math.floor(maxHp * (1 + (b.maxHpPercent ?? 0) / 100))
  let maxSp = Math.floor(baseSp * (1 + total.int / 100)) + (b.maxSp ?? 0)
  maxSp = Math.floor(maxSp * (1 + (b.maxSpPercent ?? 0) / 100))

  return {
    total, bonus, jobBonus, statusAtk, weaponAtk, weaponAtkRefine,
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
    maxWeight: job ? job.maxWeight + total.str * 300 : 0, // pre-renewal: +30 weight per STR (0.1 units)
    usingJobTable,
    bonuses: b,
  }
}

export const isTwoHanded = (item: ItemSummary | null) => !!item && TWO_HANDED.has(item.subType)
