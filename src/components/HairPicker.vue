<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { drawFrame, frameBounds, loadPalette, loadSpriteSet, spriteUrl, type Gender, type SpriteManifest } from '@/lib/ro/renderer'

const props = defineProps<{ manifest: SpriteManifest; gender: Gender }>()
const open = defineModel<boolean>({ default: false })
const style = defineModel<number>('style', { default: 1 })
const color = defineModel<number>('color', { default: 0 })

const THUMB = 56
const styleCanvases = ref<Record<number, HTMLCanvasElement | null>>({})
const colorCanvases = ref<Record<number, HTMLCanvasElement | null>>({})
const colorCount = ref(0)
let token = 0

async function drawHead(canvas: HTMLCanvasElement | null | undefined, hair: number, pal: number) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, THUMB, THUMB)
  try {
    const palette = pal > 0 ? await loadPalette(spriteUrl.headPal(hair, props.gender, pal)).catch(() => undefined) : undefined
    const set = await loadSpriteSet(spriteUrl.head(hair, props.gender), palette)
    const frame = set.frame(0, 0)
    if (!frame) return
    const b = frameBounds(set, frame)
    const w = b.x1 - b.x0, h = b.y1 - b.y0
    const scale = Math.min(1.6, (THUMB - 6) / Math.max(w, h, 1))
    ctx.imageSmoothingEnabled = false
    ctx.setTransform(scale, 0, 0, scale, THUMB / 2 - ((b.x0 + b.x1) / 2) * scale, THUMB / 2 - ((b.y0 + b.y1) / 2) * scale)
    drawFrame(ctx, set, frame, 0, 0)
  } catch { /* leave blank */ }
}

async function renderAll() {
  const my = ++token
  colorCount.value = props.manifest.hairPalettes[props.gender]?.[String(style.value)] ?? 0
  await nextTick() // let the canvases mount before drawing into them
  await new Promise((r) => setTimeout(r, 30))
  if (my !== token) return
  const styles = props.manifest.hair[props.gender] ?? []
  await Promise.all([
    ...styles.map((h) => drawHead(styleCanvases.value[h], h, color.value)),
    ...Array.from({ length: colorCount.value }, (_, i) => drawHead(colorCanvases.value[i], style.value, i)),
  ])
}

watch(open, (o) => { if (o) renderAll() })
watch([style, color, () => props.gender], () => { if (open.value) renderAll() })
onBeforeUnmount(() => { token++ })

const setStyleRef = (h: number) => (el: unknown) => { styleCanvases.value[h] = (el as HTMLCanvasElement) ?? null }
const setColorRef = (i: number) => (el: unknown) => { colorCanvases.value[i] = (el as HTMLCanvasElement) ?? null }
</script>

<template>
  <v-dialog v-model="open" max-width="640" scrollable>
    <v-card class="ro-panel">
      <v-card-title class="d-flex align-center">
        <span>ทรงผม & สีผม</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="open = false" />
      </v-card-title>
      <v-card-text>
        <div class="text-caption text-medium-emphasis mb-1">สีผม (ทรง {{ style }})</div>
        <div class="thumb-grid mb-4">
          <button v-for="i in Math.max(1, colorCount)" :key="i" class="thumb" :class="{ active: color === i - 1 }" @click="color = i - 1">
            <canvas :ref="setColorRef(i - 1)" :width="THUMB" :height="THUMB" />
            <span>{{ i - 1 }}</span>
          </button>
        </div>
        <div class="text-caption text-medium-emphasis mb-1">ทรงผม</div>
        <div class="thumb-grid">
          <button v-for="h in manifest.hair[gender]" :key="h" class="thumb" :class="{ active: style === h }" @click="style = h">
            <canvas :ref="setStyleRef(h)" :width="THUMB" :height="THUMB" />
            <span>{{ h }}</span>
          </button>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped lang="scss">
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 6px;
}
.thumb {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3px;
  border-radius: 6px;
  border: 1px solid #cfe0f5;
  background: #eef4fb;
  color: #5b6b8c;
  font-size: 11px;
  cursor: pointer;
  canvas { image-rendering: pixelated; }
  &:hover { border-color: #2563eb; }
  &.active { border-color: #1e3a8a; box-shadow: 0 0 0 1px #1e3a8a inset; color: #1e3a8a; background: #dbe8fa; }
}
</style>
