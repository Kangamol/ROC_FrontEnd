// Thin typed wrapper around the ElysiaJS API (proxied through Vite in dev).

export type ItemType =
  | 'WEAPON' | 'ARMOR' | 'CARD' | 'AMMO' | 'CONSUMABLE' | 'COSTUME' | 'SHADOW' | 'PET_EGG' | 'ETC'

export type Bonuses = Record<string, number>

/** Bonuses that depend on refine level, base stats, or other worn items. */
export type StatKey = 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk'

/** Extra gate an entry may carry when it was written inside a refine / set block of the description:
 *  it also needs the item at `refine` or more, and/or every name in `requires` worn. */
export interface Gated {
  refine?: number
  requires?: string[]
  /** written under a "เมื่อ Base STR ตั้งแต่ 90 ขึ้นไป" header: also needs that base stat */
  baseStat?: { stat: StatKey; min: number }
}

/**
 * "Base STR" / "Base Lv" in the client text always mean the character's own base value
 * (what the player set on the status window / the character level), never the total after bonuses.
 */
export interface ConditionalBonuses {
  /** once the item's refine >= min */
  refine?: ({ min: number; bonuses: Bonuses } & Gated)[]
  /** bonuses × floor(refine / every) */
  perRefine?: ({ every: number; bonuses: Bonuses } & Gated)[]
  /** bonuses × floor(min(baseStat, max) / every) */
  perStat?: ({ stat: StatKey; every: number; max: number | null; bonuses: Bonuses } & Gated)[]
  /** once baseStat >= min */
  statMin?: ({ stat: StatKey; min: number; bonuses: Bonuses } & Gated)[]
  /** while min <= baseLevel <= max (either side may be null) */
  level?: ({ min: number | null; max: number | null; bonuses: Bonuses } & Gated)[]
  /** bonuses × floor(min(baseLevel, max) / every), only once baseLevel >= min */
  perLevel?: ({ every: number; min: number | null; max: number | null; bonuses: Bonuses } & Gated)[]
  /** bonuses × floor(jobLevel / every) */
  perJobLevel?: ({ every: number; bonuses: Bonuses } & Gated)[]
  /** every named item / card must be worn */
  set?: ({ requires: string[]; bonuses: Bonuses } & Gated)[]
  /** scales with (every) or needs (min) a learned skill level — listed for information, never summed (no skill tree yet) */
  skillLevel?: ({ skill: string; every: number | null; min: number | null; bonuses: Bonuses } & Gated)[]
}

export interface ItemSummary {
  id: number
  name: string
  slotCount: number
  itemType: ItemType
  subType: string
  equipLocations: string[]
  cardLocation: string | null
  atk: number | null
  matk: number | null
  def: number | null
  weight: number | null
  weaponLevel: number | null
  requiredLevel: number | null
  element: string | null
  bonuses: Bonuses
  conditionalBonuses: ConditionalBonuses
  /** Effect lines the parser could not read — not counted in stats */
  unparsedLines: string[]
  hasIcon: boolean
  /** ClassNum — headgear sprite id (0 = no sprite) */
  viewId: number
}

export interface ItemDetail extends ItemSummary {
  unidentifiedName: string | null
  resourceName: string
  isCostume: boolean
  typeLabel: string | null
  jobs: string | null
  description: string
  descriptionLines: string[]
  /** lines that were counted unconditionally / under a condition (cleaned text) */
  parsedLines: string[]
  conditionalLines: string[]
  hasCollection: boolean
}

export interface ItemQuery {
  search?: string
  type?: ItemType
  subType?: string
  location?: string
  cardLocation?: string
  slots?: number
  limit?: number
  offset?: number
}

export interface BuildSlotPayload {
  location: string
  refineLevel: number
  itemId: number | null
  card1Id: number | null
  card2Id: number | null
  card3Id: number | null
  card4Id: number | null
  /** rolled range options (Tengu B.Scroll …) as { key, value } */
  randomOptions?: { key: string; value: number }[]
}

export interface BuildPayload {
  title: string
  jobClass: string
  baseLevel: number
  jobLevel: number
  gender: 'M' | 'F'
  hairStyle: number
  hairColor: number
  clothColor: number
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number }
  slots: BuildSlotPayload[]
}

export interface BuildResponse extends Omit<BuildPayload, 'stats' | 'slots'> {
  id: string
  shareCode: string
  str: number; agi: number; vit: number; int: number; dex: number; luk: number
  slots: Array<BuildSlotPayload & {
    item: ItemSummary | null
    card1: ItemSummary | null
    card2: ItemSummary | null
    card3: ItemSummary | null
    card4: ItemSummary | null
  }>
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { headers: { 'content-type': 'application/json' }, ...init })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  items(q: ItemQuery) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v))
    return request<{ total: number; items: ItemSummary[] }>(`/api/items?${params}`)
  },
  item(id: number) {
    return request<ItemDetail>(`/api/items/${id}`)
  },
  saveBuild(payload: BuildPayload) {
    return request<{ shareCode: string }>('/api/builds', { method: 'POST', body: JSON.stringify(payload) })
  },
  build(shareCode: string) {
    return request<BuildResponse>(`/api/builds/${shareCode}`)
  },
  awakened() {
    return request<{ caps: { baseLevel: number; jobLevel: number; stat: number; statFrom: number; statBelow: number; aspd: number } | null; statPoints: { hiClass: number[]; normal: number[] } | null }>('/api/awakened')
  },
  enchantPools() {
    return request<import('@/lib/enchant').EnchantPools>('/api/enchant-pools')
  },
  jobs() {
    return request<Record<string, import('@/lib/stats').JobData>>('/api/jobs')
  },
}

export const iconUrl = (id: number) => `/assets/items/${id}.png`
export const collectionUrl = (id: number) => `/assets/collection/${id}.png`
