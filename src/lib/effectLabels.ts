/**
 * Thai labels for parsed bonus keys, for the "Equipment Status" summary.
 * Targeted keys look like "physDamage:race:demihuman" / "skillDamage:Bowling Bash".
 */
const RACE: Record<string, string> = {
  demihuman: 'กึ่งมนุษย์ (Demi-Human)', brute: 'สัตว์ (Brute)', plant: 'พืช (Plant)', insect: 'แมลง (Insect)', fish: 'ปลา (Fish)',
  demon: 'ปีศาจ (Demon)', undead: 'อันเดด (Undead)', dragon: 'มังกร (Dragon)', angel: 'เทพ (Angel)', formless: 'ไร้รูป (Formless)',
  player: 'Player', boss: 'Boss', normal: 'มอนสเตอร์ทั่วไป', all: 'ทุกเผ่า',
}
const ELEMENT: Record<string, string> = {
  neutral: 'Neutral', water: 'Water', earth: 'Earth', fire: 'Fire', wind: 'Wind', poison: 'Poison', holy: 'Holy',
  shadow: 'Shadow', ghost: 'Ghost', undead: 'Undead', all: 'ทุกธาตุ',
}
const SIZE: Record<string, string> = { small: 'ขนาดเล็ก', medium: 'ขนาดกลาง', large: 'ขนาดใหญ่', all: 'ทุกขนาด' }

function target(kind: string, value: string) {
  if (kind === 'race') return RACE[value] ?? value
  if (kind === 'element') return `ธาตุ ${ELEMENT[value] ?? value}`
  if (kind === 'size') return SIZE[value] ?? value
  if (kind === 'range') return value === 'ranged' ? 'ระยะไกล' : 'ระยะประชิด'
  return value
}

/** good = green (a benefit), bad = red (a penalty), neutral = default colour (granted skills etc.). */
export type Polarity = 'good' | 'bad' | 'neutral'
export interface EffectLine { value: string; label: string; group: string; polarity: Polarity }

/**
 * Every parsed key is stored in the "positive = beneficial" direction — reductions (cast time,
 * delay, damage taken, SP cost) are positive numbers — so the sign alone tells good from bad.
 */
export const polarityOf = (key: string, value: number): Polarity =>
  key.startsWith('skill:') || value === 0 ? 'neutral' : value > 0 ? 'good' : 'bad'

const SIMPLE: Record<string, [label: string, unit: '' | '%' | 's', group: string, reduction?: boolean]> = {
  str: ['STR', '', 'stat'], agi: ['AGI', '', 'stat'], vit: ['VIT', '', 'stat'], int: ['INT', '', 'stat'], dex: ['DEX', '', 'stat'], luk: ['LUK', '', 'stat'],
  allStats: ['All Stats', '', 'stat'],
  maxHp: ['MaxHP', '', 'stat'], maxHpPercent: ['MaxHP', '%', 'stat'], maxSp: ['MaxSP', '', 'stat'], maxSpPercent: ['MaxSP', '%', 'stat'],
  hitPercent: ['Perfect Hit', '%', 'combat'],
  atk: ['ATK', '', 'combat'], atkPercent: ['ATK', '%', 'combat'], matk: ['MATK', '', 'combat'], matkPercent: ['MATK', '%', 'combat'],
  def: ['DEF', '', 'combat'], mdef: ['MDEF', '', 'combat'], hit: ['HIT', '', 'combat'], flee: ['FLEE', '', 'combat'],
  crit: ['CRI', '', 'combat'], critPercent: ['CRI', '%', 'combat'], perfectDodge: ['Perfect Dodge', '', 'combat'],
  aspd: ['ASPD', '', 'combat'], aspdPercent: ['ASPD', '%', 'combat'],
  critDamagePercent: ['Critical Damage', '%', 'combat'],
  rangedDamagePercent: ['Damage ทางกายภาพระยะไกล', '%', 'combat'], meleeDamagePercent: ['Damage ทางกายภาพระยะประชิด', '%', 'combat'],
  variableCastPercent: ['ลดระยะเวลาร่ายแบบแปรผัน', '%', 'cast', true],
  fixedCastSeconds: ['ลดระยะเวลาร่ายแบบคงที่', 's', 'cast', true], fixedCastPercent: ['ลดระยะเวลาร่ายแบบคงที่', '%', 'cast', true],
  afterCastDelayPercent: ['ลด Delay หลังใช้สกิล', '%', 'cast', true],
  spCostPercent: ['ลด SP ที่ใช้ในการร่ายสกิล', '%', 'cast', true],
  hpRecoveryPercent: ['ความเร็วในการฟื้น HP ตามธรรมชาติ', '%', 'misc'], spRecoveryPercent: ['ความเร็วในการฟื้น SP ตามธรรมชาติ', '%', 'misc'],
  healPowerPercent: ['พลังฮีล (Heal ที่ใช้)', '%', 'misc'], healReceivedPercent: ['ประสิทธิภาพการฟื้นฟูที่ได้รับ', '%', 'misc'],
  expPercent: ['EXP ที่ได้รับ', '%', 'misc'],
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
const signed = (n: number, unit: string, reduction = false) => {
  // reductions are stored positive; show "25%" for "ลด… 25%", and "+25%" for increases
  if (reduction) return `${n < 0 ? '+' : ''}${fmt(Math.abs(n))}${unit}`
  return `${n >= 0 ? '+' : '-'}${fmt(Math.abs(n))}${unit}`
}

export function describeEffect(key: string, value: number): EffectLine {
  return { ...describe(key, value), polarity: polarityOf(key, value) }
}

function describe(key: string, value: number): Omit<EffectLine, 'polarity'> {
  const simple = SIMPLE[key]
  if (simple) {
    const [label, unit, group, reduction] = simple
    // a negative reduction is an increase: "ลดระยะเวลาร่าย… −100%" reads better as "เพิ่มระยะเวลาร่าย… 100%"
    if (reduction && value < 0) return { value: `${fmt(-value)}${unit === 's' ? ' วินาที' : unit}`, label: label.replace(/^ลด/, 'เพิ่ม'), group }
    return { value: signed(value, unit === 's' ? ' วินาที' : unit, reduction), label, group }
  }
  const [type, a = '', b = ''] = key.split(':')
  const t = target(a, b)
  switch (type) {
    case 'physDamage': return { value: signed(value, '%'), label: `Damage ทางกายภาพต่อ ${t}`, group: 'race' }
    case 'magicDamage': return { value: signed(value, '%'), label: `Damage ทางเวทมนตร์ต่อ ${t}`, group: 'race' }
    case 'ignoreDef': return { value: `${fmt(value)}%`, label: `เพิกเฉยต่อพลังป้องกันทางกายภาพของ ${t}`, group: 'race' }
    case 'ignoreMdef': return { value: `${fmt(value)}%`, label: `เพิกเฉยต่อพลังป้องกันทางเวทมนตร์ของ ${t}`, group: 'race' }
    case 'resist': return { value: signed(value, '%'), label: `ความต้านทานต่อการโจมตีจาก ${t}`, group: 'resist' }
    case 'statusResist': return { value: signed(value, '%'), label: `ป้องกันอาการ ${a.charAt(0).toUpperCase()}${a.slice(1)}`, group: 'resist' }
    case 'skillDamage': return { value: signed(value, '%'), label: `Damage สกิล ${a}`, group: 'skill' }
    case 'skillVct': return { value: `${fmt(value)}%`, label: `ลดระยะเวลาร่ายแบบแปรผันสกิล ${a}`, group: 'skill' }
    case 'skillDelay': return { value: `${fmt(value)}%`, label: `ลด Delay สกิล ${a}`, group: 'skill' }
    case 'skillFct': return { value: `${fmt(value)}%`, label: `ลดระยะเวลาร่ายแบบคงที่สกิล ${a}`, group: 'skill' }
    case 'skillFctSeconds': return { value: `${fmt(value)} วินาที`, label: `ลดระยะเวลาร่ายแบบคงที่สกิล ${a}`, group: 'skill' }
    case 'skill': return { value: `Lv.${fmt(value)}`, label: `สามารถใช้ ${a}`, group: 'skill' }
    case 'ignoreSizePenalty': return { value: '✓', label: 'ยกเลิกโทษขนาดอาวุธ (ตีทุกขนาด 100%)', group: 'combat' }
    case 'exp': return { value: signed(value, '%'), label: `EXP จากมอนสเตอร์ ${t}`, group: 'misc' }
    default: return { value: signed(value, ''), label: key, group: 'misc' }
  }
}

export const GROUP_ORDER = ['stat', 'combat', 'cast', 'race', 'resist', 'skill', 'misc']
export const GROUP_LABEL: Record<string, string> = {
  stat: 'Status', combat: 'Combat', cast: 'Cast / Delay', race: 'Race / Element / Size', resist: 'Resistance', skill: 'Skill', misc: 'Special',
}
