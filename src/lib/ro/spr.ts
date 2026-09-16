/**
 * Gravity .spr parser. Frames are 8-bit indexed (RLE on index 0 from v2.1)
 * followed by optional 32-bit RGBA frames; a 256-colour RGBA palette sits at
 * the end of the file. Index 0 is transparent.
 */
export interface SprFrame {
  width: number
  height: number
  indexed: boolean
  /** indexed: width*height palette indices — rgba: width*height*4 bytes (ABGR, bottom-up) */
  data: Uint8Array
}

export interface Spr {
  frames: SprFrame[]
  indexedCount: number
  palette: Uint8Array
  version: [number, number]
}

export function parseSpr(buf: ArrayBuffer): Spr {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  if (bytes[0] !== 0x53 || bytes[1] !== 0x50) throw new Error('not a SPR file')
  const version: [number, number] = [bytes[3]!, bytes[2]!]
  const ge = (maj: number, min: number) => version[0] > maj || (version[0] === maj && version[1] >= min)
  let pos = 4
  const nIndexed = view.getUint16(pos, true); pos += 2
  let nRgba = 0
  if (ge(2, 0)) { nRgba = view.getUint16(pos, true); pos += 2 }

  const frames: SprFrame[] = []
  for (let i = 0; i < nIndexed; i++) {
    const width = view.getUint16(pos, true); const height = view.getUint16(pos + 2, true); pos += 4
    const size = width * height
    const data = new Uint8Array(size)
    if (ge(2, 1)) {
      const len = view.getUint16(pos, true); pos += 2
      let o = 0
      const end = pos + len
      while (pos < end && o < size) {
        const c = bytes[pos++]!
        if (c === 0) {
          const n = bytes[pos++]!
          o += n === 0 ? 1 : n // zeros already in the buffer
        } else data[o++] = c
      }
      pos = end
    } else {
      data.set(bytes.subarray(pos, pos + size)); pos += size
    }
    frames.push({ width, height, indexed: true, data })
  }
  for (let i = 0; i < nRgba; i++) {
    const width = view.getUint16(pos, true); const height = view.getUint16(pos + 2, true); pos += 4
    const size = width * height * 4
    frames.push({ width, height, indexed: false, data: bytes.slice(pos, pos + size) }); pos += size
  }
  const palette = ge(1, 1) ? bytes.slice(bytes.length - 1024) : new Uint8Array(1024)
  return { frames, indexedCount: nIndexed, palette, version }
}

/** Decode one frame to RGBA pixels using `palette` (defaults to the file's own). */
export function frameToRgba(spr: Spr, index: number, palette?: Uint8Array): { width: number; height: number; rgba: Uint8ClampedArray<ArrayBuffer> } {
  const f = spr.frames[index]
  if (!f) throw new Error(`frame ${index} out of range`)
  const rgba = new Uint8ClampedArray(new ArrayBuffer(f.width * f.height * 4))
  if (f.indexed) {
    const pal = palette ?? spr.palette
    for (let i = 0; i < f.data.length; i++) {
      const c = f.data[i]!
      if (c === 0) continue
      rgba[i * 4] = pal[c * 4]!; rgba[i * 4 + 1] = pal[c * 4 + 1]!; rgba[i * 4 + 2] = pal[c * 4 + 2]!; rgba[i * 4 + 3] = 255
    }
  } else {
    // stored bottom-up as ABGR
    for (let y = 0; y < f.height; y++) {
      const srcRow = (f.height - 1 - y) * f.width * 4
      const dstRow = y * f.width * 4
      for (let x = 0; x < f.width; x++) {
        const s = srcRow + x * 4, d = dstRow + x * 4
        rgba[d] = f.data[s + 3]!; rgba[d + 1] = f.data[s + 2]!; rgba[d + 2] = f.data[s + 1]!; rgba[d + 3] = f.data[s]!
      }
    }
  }
  return { width: f.width, height: f.height, rgba }
}
