/**
 * Composes a player character (robe + body + head + headgears) from RO sprites
 * onto a canvas, following the client's attachment rules:
 *   head origin     = body origin + (body anchor − head anchor)
 *   headgear origin = head origin + (head anchor − headgear anchor)
 *   robe origin     = body origin + (body anchor − robe anchor)
 */
import { parseAct, type Act, type ActFrame } from './act'
import { frameToRgba, parseSpr, type Spr } from './spr'

/** Player action groups — each spans 8 directions (index = group*8 + direction). */
export const ACTIONS = {
  idle: 0, walk: 1, sit: 2, pickup: 3, standby: 4, attack: 5, hurt: 6, freeze: 7, dead: 8,
  freeze2: 9, attack2: 10, attack3: 11, cast: 12,
} as const
export type ActionName = keyof typeof ACTIONS

/** Idle/sit frames are "look" poses picked by head direction, not an animation. */
const STATIC_ACTIONS = new Set<ActionName>(['idle', 'sit'])

export class SpriteSet {
  private cache = new Map<string, HTMLCanvasElement>()
  spr: Spr
  act: Act
  palette?: Uint8Array
  constructor(spr: Spr, act: Act, palette?: Uint8Array) {
    this.spr = spr; this.act = act; this.palette = palette
  }

  frameCanvas(index: number, color: [number, number, number, number]): HTMLCanvasElement | null {
    const key = `${index}:${this.palette ? 'p' : 'd'}:${color.join(',')}`
    let c = this.cache.get(key)
    if (c) return c
    if (index < 0 || index >= this.spr.frames.length) return null
    const { width, height, rgba } = frameToRgba(this.spr, index, this.palette)
    if (color[0] !== 255 || color[1] !== 255 || color[2] !== 255 || color[3] !== 255) {
      for (let i = 0; i < rgba.length; i += 4) {
        rgba[i] = (rgba[i]! * color[0]) / 255; rgba[i + 1] = (rgba[i + 1]! * color[1]) / 255
        rgba[i + 2] = (rgba[i + 2]! * color[2]) / 255; rgba[i + 3] = (rgba[i + 3]! * color[3]) / 255
      }
    }
    c = document.createElement('canvas')
    c.width = Math.max(1, width); c.height = Math.max(1, height)
    c.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0)
    this.cache.set(key, c)
    return c
  }

  setPalette(p?: Uint8Array) { this.palette = p; this.cache.clear() }

  frame(action: number, frame: number): ActFrame | undefined {
    const a = this.act.actions[action] ?? this.act.actions[0]
    if (!a?.length) return undefined
    return a[frame % a.length]
  }
}

export function drawFrame(ctx: CanvasRenderingContext2D, set: SpriteSet, frame: ActFrame, ox: number, oy: number) {
  for (const layer of frame.layers) {
    if (layer.sprite < 0) continue
    const idx = layer.sprite + (layer.isRgba ? set.spr.indexedCount : 0)
    const img = set.frameCanvas(idx, layer.color)
    if (!img) continue
    const w = img.width * layer.scaleX, h = img.height * layer.scaleY
    ctx.save()
    ctx.translate(ox + layer.x, oy + layer.y)
    if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180)
    if (layer.mirror) ctx.scale(-1, 1)
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
}

/** Bounding box of a frame's layers relative to its origin (for thumbnails). */
export function frameBounds(set: SpriteSet, frame: ActFrame) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const l of frame.layers) {
    const f = set.spr.frames[l.sprite + (l.isRgba ? set.spr.indexedCount : 0)]
    if (!f || l.sprite < 0) continue
    const w = (f.width * l.scaleX) / 2, h = (f.height * l.scaleY) / 2
    x0 = Math.min(x0, l.x - w); x1 = Math.max(x1, l.x + w); y0 = Math.min(y0, l.y - h); y1 = Math.max(y1, l.y + h)
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 }
}

export interface CharacterParts {
  body: SpriteSet
  head: SpriteSet
  /** drawn in order — pass lower → mid → top so top headgear ends up in front */
  headgears: SpriteSet[]
  robe?: SpriteSet | null
}

/** Robes hang behind the body when facing the camera and in front when facing away. */
const ROBE_ON_TOP = new Set([3, 4, 5])

/**
 * Frame to use for an attachment. While the body animates, attachments follow
 * the body frame. In static poses (idle/sit) the client picks a frame by head
 * "look" direction (3 groups); animated headgear (blinking eyes, flowing hair…)
 * stores its animation inside each group, so we cycle within the group only —
 * cycling across groups would swap anchors and make the piece jump around.
 */
export function attachmentFrame(set: SpriteSet, action: number, isStatic: boolean, bodyFrame: number, timeMs: number, headDir = 0) {
  const frames = set.act.actions[action]?.length ?? 1
  if (!isStatic) return bodyFrame
  if (frames <= 3) return Math.min(headDir, frames - 1) // plain look poses, no animation
  const delay = (set.act.delays[action] ?? 4) * 25
  const per = frames % 3 === 0 ? frames / 3 : frames
  const group = frames % 3 === 0 ? headDir : 0
  return group * per + (Math.floor(timeMs / delay) % per)
}

export function drawCharacter(
  ctx: CanvasRenderingContext2D, parts: CharacterParts,
  actionName: ActionName, direction: number, frameIndex: number, ox: number, oy: number, timeMs = 0,
) {
  const dir = direction & 7
  const action = ACTIONS[actionName] * 8 + dir
  const isStatic = STATIC_ACTIONS.has(actionName)
  const fi = isStatic ? 0 : frameIndex
  const body = parts.body.frame(action, fi)
  if (!body) return
  const ba = body.anchors[0]

  const drawRobe = () => {
    if (!parts.robe) return
    const rf = parts.robe.frame(action, attachmentFrame(parts.robe, action, isStatic, fi, timeMs))
    if (!rf) return
    const ra = rf.anchors[0]
    drawFrame(ctx, parts.robe, rf, ox + (ba && ra ? ba.x - ra.x : 0), oy + (ba && ra ? ba.y - ra.y : 0))
  }

  if (!ROBE_ON_TOP.has(dir)) drawRobe()
  drawFrame(ctx, parts.body, body, ox, oy)

  const head = parts.head.frame(action, fi)
  if (!head) return
  const ha = head.anchors[0]
  const hx = ox + (ba && ha ? ba.x - ha.x : 0)
  const hy = oy + (ba && ha ? ba.y - ha.y : 0)
  drawFrame(ctx, parts.head, head, hx, hy)

  for (const gear of parts.headgears) {
    const gf = gear.frame(action, attachmentFrame(gear, action, isStatic, fi, timeMs))
    if (!gf) continue
    const ga = gf.anchors[0]
    drawFrame(ctx, gear, gf, hx + (ha && ga ? ha.x - ga.x : 0), hy + (ha && ga ? ha.y - ga.y : 0))
  }
  if (ROBE_ON_TOP.has(dir)) drawRobe()
}

/** True when any attachment animates on its own in a static pose (so the caller keeps redrawing). */
export function hasAnimatedAttachment(parts: CharacterParts, actionName: ActionName, direction: number) {
  const action = ACTIONS[actionName] * 8 + (direction & 7)
  return [...parts.headgears, parts.robe].some((s) => s && (s.act.actions[action]?.length ?? 1) > 3)
}

/** Frame count of an action for animation (1 for static poses). */
export function frameCount(set: SpriteSet, actionName: ActionName, direction: number) {
  if (STATIC_ACTIONS.has(actionName)) return 1
  return set.act.actions[ACTIONS[actionName] * 8 + (direction & 7)]?.length ?? 1
}
export function frameDelayMs(set: SpriteSet, actionName: ActionName, direction: number) {
  return (set.act.delays[ACTIONS[actionName] * 8 + (direction & 7)] ?? 4) * 25
}

// ---------------------------------------------------------------- loading ----
const buffers = new Map<string, Promise<ArrayBuffer>>()
function fetchBuffer(url: string) {
  let p = buffers.get(url)
  if (!p) {
    p = fetch(url).then((r) => { if (!r.ok) throw new Error(`${r.status} ${url}`); return r.arrayBuffer() })
    p.catch(() => buffers.delete(url))
    buffers.set(url, p)
  }
  return p
}

const parsed = new Map<string, Promise<{ spr: Spr; act: Act }>>()
export function loadSprite(base: string) {
  let p = parsed.get(base)
  if (!p) {
    p = Promise.all([fetchBuffer(`${base}.spr`), fetchBuffer(`${base}.act`)]).then(([s, a]) => ({ spr: parseSpr(s), act: parseAct(a) }))
    p.catch(() => parsed.delete(base))
    parsed.set(base, p)
  }
  return p
}

export async function loadSpriteSet(base: string, palette?: Uint8Array) {
  const { spr, act } = await loadSprite(base)
  return new SpriteSet(spr, act, palette)
}

export async function loadPalette(url: string): Promise<Uint8Array> {
  const buf = await fetchBuffer(url)
  return new Uint8Array(buf).slice(0, 1024)
}

export type Gender = 'm' | 'f'
export interface SpriteManifest {
  jobs: { key: string; name: string; genders: Gender[]; palettes: Record<string, number> }[]
  hair: Record<Gender, number[]>
  hairPalettes: Record<Gender, Record<string, number>>
  acc: Record<string, Gender[]>
  robes: string[]
}
let manifest: Promise<SpriteManifest> | undefined
export function loadManifest() {
  manifest ??= fetch('/sprites/manifest.json').then((r) => { if (!r.ok) throw new Error(`${r.status} manifest`); return r.json() as Promise<SpriteManifest> })
  manifest.catch(() => (manifest = undefined))
  return manifest
}

export const spriteUrl = {
  body: (job: string, g: Gender) => `/sprites/body/${job}_${g}`,
  head: (hair: number, g: Gender) => `/sprites/head/${hair}_${g}`,
  acc: (viewId: number, g: Gender) => `/sprites/acc/${viewId}_${g}`,
  robe: (robeId: number, job: string, g: Gender) => `/sprites/robe/${robeId}_${job}_${g}`,
  bodyPal: (job: string, g: Gender, n: number) => `/sprites/pal-body/${job}_${g}_${n}.pal`,
  headPal: (hair: number, g: Gender, n: number) => `/sprites/pal-head/${hair}_${g}_${n}.pal`,
}
