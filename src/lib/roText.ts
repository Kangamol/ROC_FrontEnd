/**
 * Render RO client description text. The client marks colours with ^RRGGBB;
 * ^000000 resets to the default colour. Output is a list of coloured spans
 * so templates can render them without v-html.
 */
export interface TextSpan { text: string; color: string | null }

const COLOR = /\^([0-9a-fA-F]{6})/g

export function parseRoLine(line: string): TextSpan[] {
  const spans: TextSpan[] = []
  let color: string | null = null
  let last = 0
  for (const m of line.matchAll(COLOR)) {
    const text = line.slice(last, m.index)
    if (text) spans.push({ text, color })
    const hex = m[1]!.toLowerCase()
    color = hex === '000000' ? null : `#${hex}`
    last = m.index! + m[0].length
  }
  const tail = line.slice(last)
  if (tail) spans.push({ text: tail, color })
  return spans
}

/** Client colours target the game's tooltip; on our white background hide near-white text and soften greys. */
export function displayColor(color: string | null): string | undefined {
  if (!color) return undefined
  if (color === '#777777') return '#5b6b8c'
  const n = parseInt(color.slice(1), 16)
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  if (lum > 0.85) return undefined // e.g. ^ffffff separators — unreadable on white
  return color
}
