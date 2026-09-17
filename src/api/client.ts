// Thin typed wrapper around the ElysiaJS API (proxied through Vite in dev).

export type ItemType =
  | 'WEAPON' | 'ARMOR' | 'CARD' | 'AMMO' | 'CONSUMABLE' | 'COSTUME' | 'SHADOW' | 'PET_EGG' | 'ETC'

export type Bonuses = Record<string, number>

/** Bonuses that depend on refine level, base stats, or other worn items. */
export interface ConditionalBonuses {
  refine?: { min: number; bonuses: Bonuses }[]
  perRefine?: { every: number; bonuses: Bonuses }[]
  perStat?: { stat: 'str' | 'agi' | 'vit' | 'int' | 'dex' | 'luk'; every: number; max: number | null; bonuses: Bonuses }[]
  set?: { requires: string[]; bonuses: Bonuses }[]
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
}

export const iconUrl = (id: number) => `/assets/items/${id}.png`
export const collectionUrl = (id: number) => `/assets/collection/${id}.png`
