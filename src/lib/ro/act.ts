/**
 * Gravity .act parser: actions → frames → layers, plus per-frame anchors that
 * tell where a head attaches to a body (and a headgear to a head).
 */
export interface ActLayer {
  x: number
  y: number
  sprite: number
  mirror: boolean
  color: [number, number, number, number]
  scaleX: number
  scaleY: number
  rotation: number
  /** true → `sprite` indexes the RGBA frame list, not the indexed one */
  isRgba: boolean
}

export interface ActFrame {
  layers: ActLayer[]
  anchors: { x: number; y: number }[]
  event: number
}

export interface Act {
  actions: ActFrame[][]
  /** per action, in 25ms units */
  delays: number[]
  events: string[]
  version: [number, number]
}

export function parseAct(buf: ArrayBuffer): Act {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  if (bytes[0] !== 0x41 || bytes[1] !== 0x43) throw new Error('not an ACT file')
  const version: [number, number] = [bytes[3]!, bytes[2]!]
  const ge = (maj: number, min: number) => version[0] > maj || (version[0] === maj && version[1] >= min)
  let pos = 4
  const nActions = view.getUint16(pos, true); pos += 2
  pos += 10

  const actions: ActFrame[][] = []
  for (let a = 0; a < nActions; a++) {
    const nFrames = view.getUint32(pos, true); pos += 4
    const frames: ActFrame[] = []
    for (let f = 0; f < nFrames; f++) {
      pos += 32
      const nLayers = view.getUint32(pos, true); pos += 4
      const layers: ActLayer[] = []
      for (let l = 0; l < nLayers; l++) {
        const x = view.getInt32(pos, true); const y = view.getInt32(pos + 4, true)
        const sprite = view.getInt32(pos + 8, true); const mirror = view.getUint32(pos + 12, true) !== 0
        pos += 16
        let color: [number, number, number, number] = [255, 255, 255, 255]
        let scaleX = 1, scaleY = 1, rotation = 0, isRgba = false
        if (ge(2, 0)) {
          color = [bytes[pos]!, bytes[pos + 1]!, bytes[pos + 2]!, bytes[pos + 3]!]; pos += 4
          scaleX = view.getFloat32(pos, true); pos += 4
          scaleY = scaleX
          if (ge(2, 4)) { scaleY = view.getFloat32(pos, true); pos += 4 }
          rotation = view.getInt32(pos, true); pos += 4
          isRgba = view.getInt32(pos, true) === 1; pos += 4
          if (ge(2, 5)) pos += 8
        }
        layers.push({ x, y, sprite, mirror, color, scaleX, scaleY, rotation, isRgba })
      }
      let event = -1
      const anchors: { x: number; y: number }[] = []
      if (ge(2, 0)) { event = view.getInt32(pos, true); pos += 4 }
      if (ge(2, 3)) {
        const nAnchors = view.getUint32(pos, true); pos += 4
        for (let i = 0; i < nAnchors; i++) {
          pos += 4
          anchors.push({ x: view.getInt32(pos, true), y: view.getInt32(pos + 4, true) }); pos += 8
          pos += 4
        }
      }
      frames.push({ layers, anchors, event })
    }
    actions.push(frames)
  }
  const events: string[] = []
  if (ge(2, 1)) {
    const n = view.getUint32(pos, true); pos += 4
    for (let i = 0; i < n; i++) {
      const raw = bytes.subarray(pos, pos + 40); pos += 40
      const end = raw.indexOf(0)
      events.push(new TextDecoder('latin1').decode(end >= 0 ? raw.subarray(0, end) : raw))
    }
  }
  const delays = new Array<number>(nActions).fill(4)
  if (ge(2, 2)) for (let i = 0; i < nActions; i++) { delays[i] = view.getFloat32(pos, true); pos += 4 }
  return { actions, delays, events, version }
}
