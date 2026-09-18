import type { ItemQuery } from '@/api/client'

export interface SlotDef {
  key: string
  label: string
  icon: string
  group: 'gear' | 'costume'
  /** Query used by the item picker for this slot. */
  filter: ItemQuery
  /** `cardLocation` values whose cards may be compounded into this slot. */
  cardLocations: string[]
  /** Base query for the card/enchant picker (defaults to `{ type: 'CARD' }`). */
  cardFilter?: ItemQuery
  /** Fixed number of enchant slots regardless of the item's slotCount (costume enchant stones). */
  enchantSlots?: number
  /** Refine allowed (weapons/armor only). */
  refinable: boolean
  /** Items in this slot can be enchanted at the NPC (rules in data/enchant_pools.json).
   *  'default' also offers the generic Hidden Enchant to items not in the table; 'table' only listed items. */
  npcEnchant?: 'default' | 'table'
}

const costumeStone = (loc: string): Pick<SlotDef, 'cardLocations' | 'cardFilter' | 'enchantSlots'> => ({
  cardLocations: [loc],
  cardFilter: { type: 'ETC', subType: 'COSTUME_STONE' },
  enchantSlots: 1,
})

export const SLOTS: SlotDef[] = [
  { key: 'HEAD_TOP', label: 'Upper Head', icon: 'mdi-hat-fedora', group: 'gear', filter: { location: 'HEAD_TOP', type: 'ARMOR' }, cardLocations: ['HEADGEAR'], refinable: true, npcEnchant: 'default' },
  { key: 'HEAD_MID', label: 'Middle Head', icon: 'mdi-glasses', group: 'gear', filter: { location: 'HEAD_MID', type: 'ARMOR' }, cardLocations: ['HEADGEAR'], refinable: true, npcEnchant: 'table' },
  { key: 'HEAD_LOW', label: 'Lower Head', icon: 'mdi-emoticon-outline', group: 'gear', filter: { location: 'HEAD_LOW', type: 'ARMOR' }, cardLocations: ['HEADGEAR'], refinable: true, npcEnchant: 'table' },
  { key: 'ARMOR', label: 'Armor', icon: 'mdi-tshirt-crew', group: 'gear', filter: { location: 'ARMOR', type: 'ARMOR' }, cardLocations: ['ARMOR'], refinable: true, npcEnchant: 'default' },
  { key: 'WEAPON', label: 'Weapon', icon: 'mdi-sword', group: 'gear', filter: { location: 'WEAPON', type: 'WEAPON' }, cardLocations: ['WEAPON'], refinable: true, npcEnchant: 'table' },
  { key: 'SHIELD', label: 'Shield', icon: 'mdi-shield', group: 'gear', filter: { location: 'SHIELD', type: 'ARMOR' }, cardLocations: ['SHIELD'], refinable: true, npcEnchant: 'table' },
  { key: 'GARMENT', label: 'Garment', icon: 'mdi-weather-windy', group: 'gear', filter: { location: 'GARMENT', type: 'ARMOR' }, cardLocations: ['GARMENT'], refinable: true, npcEnchant: 'default' },
  { key: 'SHOES', label: 'Footgear', icon: 'mdi-shoe-sneaker', group: 'gear', filter: { location: 'SHOES', type: 'ARMOR' }, cardLocations: ['SHOES'], refinable: true, npcEnchant: 'default' },
  { key: 'ACCESSORY_1', label: 'Accessory 1', icon: 'mdi-ring', group: 'gear', filter: { location: 'ACCESSORY_1', type: 'ARMOR' }, cardLocations: ['ACCESSORY', 'ACCESSORY_R'], refinable: true, npcEnchant: 'table' },
  { key: 'ACCESSORY_2', label: 'Accessory 2', icon: 'mdi-ring', group: 'gear', filter: { location: 'ACCESSORY_2', type: 'ARMOR' }, cardLocations: ['ACCESSORY', 'ACCESSORY_L'], refinable: true, npcEnchant: 'table' },
  { key: 'AMMO', label: 'Ammunition', icon: 'mdi-arrow-projectile', group: 'gear', filter: { location: 'AMMO', type: 'AMMO' }, cardLocations: [], refinable: false },
  { key: 'COSTUME_TOP', label: 'Costume Upper', icon: 'mdi-hat-fedora', group: 'costume', filter: { location: 'COSTUME_TOP', type: 'COSTUME' }, ...costumeStone('COSTUME_TOP'), refinable: false },
  { key: 'COSTUME_MID', label: 'Costume Middle', icon: 'mdi-glasses', group: 'costume', filter: { location: 'COSTUME_MID', type: 'COSTUME' }, ...costumeStone('COSTUME_MID'), refinable: false },
  { key: 'COSTUME_LOW', label: 'Costume Lower', icon: 'mdi-emoticon-outline', group: 'costume', filter: { location: 'COSTUME_LOW', type: 'COSTUME' }, ...costumeStone('COSTUME_LOW'), refinable: false },
  { key: 'COSTUME_GARMENT', label: 'Costume Garment', icon: 'mdi-weather-windy', group: 'costume', filter: { location: 'COSTUME_GARMENT', type: 'COSTUME' }, ...costumeStone('COSTUME_GARMENT'), refinable: false },
]

export const SLOT_MAP = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<string, SlotDef>

/** Two-handed weapon subtypes occupy the shield slot as well. */
export const TWO_HANDED = new Set([
  'SWORD_2H', 'SPEAR_2H', 'AXE_2H', 'STAFF_2H', 'BOW', 'KATAR', 'INSTRUMENT', 'WHIP', 'HUUMA',
  'RIFLE', 'SHOTGUN', 'GATLING', 'GRENADE_LAUNCHER',
])

export const JOB_CLASSES = [
  'Novice', 'Swordman', 'Knight', 'Crusader', 'Lord Knight', 'Paladin',
  'Magician', 'Wizard', 'Sage', 'High Wizard', 'Professor',
  'Archer', 'Hunter', 'Bard', 'Dancer', 'Sniper', 'Clown', 'Gypsy',
  'Acolyte', 'Priest', 'Monk', 'High Priest', 'Champion',
  'Merchant', 'Blacksmith', 'Alchemist', 'Whitesmith', 'Creator',
  'Thief', 'Assassin', 'Rogue', 'Assassin Cross', 'Stalker',
  'Taekwon', 'Star Gladiator', 'Soul Linker', 'Ninja', 'Gunslinger', 'Super Novice',
  // 2nd Extended (Gnjoy): Lv 120 / Job 60, stats to 120 from Lv 100
  'Kagerou', 'Oboro', 'Rebellion',
  // Gnjoy Awakened classes (Lv 120 / Job 75, stats to 130 from Lv 100)
  'Awakened Lord Knight', 'Awakened Paladin', 'Awakened High Wizard', 'Awakened Professor',
  'Awakened Sniper', 'Awakened Clown', 'Awakened Gypsy', 'Awakened High Priest', 'Awakened Champion',
  'Awakened Whitesmith', 'Awakened Creator', 'Awakened Assassin Cross', 'Awakened Stalker',
]
