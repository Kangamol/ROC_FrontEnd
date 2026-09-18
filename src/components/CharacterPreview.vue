<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useBuildStore } from '@/stores/build'
import {
  SpriteSet, drawCharacter, frameCount, frameDelayMs, hasAnimatedAttachment, loadManifest, loadPalette, loadSpriteSet, spriteUrl,
  type ActionName, type Gender, type SpriteManifest,
} from '@/lib/ro/renderer'
import HairPicker from './HairPicker.vue'

const store = useBuildStore()
const canvas = ref<HTMLCanvasElement | null>(null)
const manifest = shallowRef<SpriteManifest | null>(null)
const direction = ref(0) // 0 = facing the camera
const action = ref<ActionName>('idle')
const loading = ref(false)
const error = ref<string | null>(null)
const hairPickerOpen = ref(false)
const SCALE = 2
const W = 200, H = 220

const body = shallowRef<SpriteSet | null>(null)
const head = shallowRef<SpriteSet | null>(null)
const gears = shallowRef<SpriteSet[]>([])
const robe = shallowRef<SpriteSet | null>(null)

// Awakened classes have no sprite of their own in the client — draw the base class body
const spriteJob = computed(() => store.jobClass.replace(/^Awakened /, ''))
const jobEntry = computed(() => manifest.value?.jobs.find((j) => j.name === spriteJob.value))
const gender = computed<Gender>(() => (store.gender === 'F' ? 'f' : 'm'))
const genderAvailable = computed(() => !jobEntry.value || jobEntry.value.genders.includes(gender.value))

/**
 * What to draw, applying the client's costume rule: a costume piece hides the
 * normal equipment in the same position (upper / middle / lower / garment).
 * Order lower → mid → top so the top piece renders in front.
 */
const visual = computed(() => {
  const pick = (costumeKey: string, gearKey: string) => store.slots[costumeKey]?.item ?? store.slots[gearKey]?.item
  const headgear = [pick('COSTUME_LOW', 'HEAD_LOW'), pick('COSTUME_MID', 'HEAD_MID'), pick('COSTUME_TOP', 'HEAD_TOP')]
  const ids: number[] = []
  for (const item of headgear) if (item?.viewId && !ids.includes(item.viewId)) ids.push(item.viewId)
  const garment = pick('COSTUME_GARMENT', 'GARMENT')
  return { headgearIds: ids, robeId: garment?.viewId || 0 }
})

/** Equipped visual items that have no sprite in the client (so the user knows why nothing changed). */
const missing = computed(() => {
  const m = manifest.value
  if (!m) return []
  const out: string[] = []
  for (const key of ['HEAD_TOP', 'HEAD_MID', 'HEAD_LOW', 'COSTUME_TOP', 'COSTUME_MID', 'COSTUME_LOW']) {
    const it = store.slots[key]?.item
    if (it && (!it.viewId || !m.acc[String(it.viewId)]?.includes(gender.value))) out.push(it.name)
  }
  for (const key of ['GARMENT', 'COSTUME_GARMENT']) {
    const it = store.slots[key]?.item
    if (it && (!it.viewId || !m.robes.includes(String(it.viewId)))) out.push(it.name)
  }
  return out
})

let loadToken = 0
async function loadAll() {
  const m = manifest.value
  if (!m) return
  const my = ++loadToken
  const job = jobEntry.value ?? m.jobs[0]!
  const g: Gender = job.genders.includes(gender.value) ? gender.value : job.genders[0]!
  loading.value = true; error.value = null
  try {
    const [bp, hp] = await Promise.all([
      store.clothColor > 0 ? loadPalette(spriteUrl.bodyPal(job.key, g, store.clothColor)).catch(() => undefined) : undefined,
      store.hairColor > 0 ? loadPalette(spriteUrl.headPal(store.hairStyle, g, store.hairColor)).catch(() => undefined) : undefined,
    ])
    const [bodySet, headSet, gearSets, robeSet] = await Promise.all([
      loadSpriteSet(spriteUrl.body(job.key, g), bp),
      loadSpriteSet(spriteUrl.head(store.hairStyle, g), hp),
      Promise.all(
        visual.value.headgearIds
          .filter((id) => m.acc[String(id)]?.includes(g))
          .map((id) => loadSpriteSet(spriteUrl.acc(id, g)).catch(() => null)),
      ),
      visual.value.robeId && m.robes.includes(String(visual.value.robeId))
        ? loadSpriteSet(spriteUrl.robe(visual.value.robeId, job.key, g)).catch(() => null)
        : Promise.resolve(null),
    ])
    if (my !== loadToken) return
    body.value = bodySet; head.value = headSet
    gears.value = gearSets.filter((x): x is SpriteSet => !!x)
    robe.value = robeSet
    frame = 0
    render() // draw immediately (also covers hidden tabs where rAF is paused)
  } catch (e) {
    if (my === loadToken) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (my === loadToken) loading.value = false
  }
}

let frame = 0, last = 0, raf = 0, lastAttachmentDraw = 0
function tick(now: number) {
  raf = requestAnimationFrame(tick)
  const b = body.value
  if (!b) return
  const n = frameCount(b, action.value, direction.value)
  if (n > 1 && now - last >= frameDelayMs(b, action.value, direction.value)) {
    last = now; frame = (frame + 1) % n; render(now)
  } else if (n <= 1 && now - lastAttachmentDraw >= 50 && hasAnimatedAttachment(parts(), action.value, direction.value)) {
    lastAttachmentDraw = now; render(now)
  }
}
const parts = () => ({ body: body.value!, head: head.value!, headgears: gears.value, robe: robe.value })
function render(now = performance.now()) {
  const c = canvas.value, b = body.value, h = head.value
  if (!c || !b || !h) return
  const ctx = c.getContext('2d')!
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.imageSmoothingEnabled = false
  ctx.scale(SCALE, SCALE)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath(); ctx.ellipse(W / 2, H - 22, 18, 6, 0, 0, Math.PI * 2); ctx.fill()
  drawCharacter(ctx, parts(), action.value, direction.value, frame, W / 2, H - 24, now)
}

onMounted(async () => {
  manifest.value = await loadManifest().catch((e) => { error.value = String(e); return null })
  await loadAll()
  raf = requestAnimationFrame(tick)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))

watch([() => store.jobClass, () => store.gender, () => store.hairStyle, () => store.hairColor, () => store.clothColor, visual], loadAll)
watch([direction, action], () => { frame = 0; render() })
watch(gender, () => {
  const styles = manifest.value?.hair[gender.value]
  if (styles && !styles.includes(store.hairStyle)) store.hairStyle = styles[0] ?? 1
})

const clothColors = computed(() => jobEntry.value?.palettes[gender.value] ?? 0)
</script>

<template>
  <v-card class="ro-panel pa-3" variant="flat">
    <div class="d-flex align-center mb-2">
      <div class="text-subtitle-2 text-accent"><v-icon icon="mdi-human" size="small" class="mr-1" />Preview</div>
      <v-spacer />
      <v-btn-toggle v-model="store.gender" density="compact" variant="outlined" divided mandatory>
        <v-btn value="M" size="x-small" icon="mdi-gender-male" />
        <v-btn value="F" size="x-small" icon="mdi-gender-female" />
      </v-btn-toggle>
    </div>

    <div class="preview-stage">
      <canvas ref="canvas" :width="W * SCALE" :height="H * SCALE" :style="{ width: W + 'px', height: H + 'px' }" />
      <v-progress-circular v-if="loading" indeterminate size="20" width="2" class="preview-loading" />
      <div v-if="error" class="text-caption text-error pa-2">{{ error }}</div>
      <div v-else-if="!genderAvailable" class="text-caption text-warning pa-2">อาชีพนี้มีเฉพาะอีกเพศ — แสดงเพศที่มี</div>
    </div>

    <div class="d-flex align-center justify-center mt-1" style="gap: 6px">
      <v-btn icon="mdi-rotate-left" size="x-small" variant="text" @click="direction = (direction + 7) % 8" />
      <v-btn-toggle v-model="action" density="compact" variant="text" mandatory>
        <v-btn value="idle" size="x-small">ยืน</v-btn>
        <v-btn value="walk" size="x-small">เดิน</v-btn>
        <v-btn value="sit" size="x-small">นั่ง</v-btn>
        <v-btn value="attack" size="x-small">ตี</v-btn>
      </v-btn-toggle>
      <v-btn icon="mdi-rotate-right" size="x-small" variant="text" @click="direction = (direction + 1) % 8" />
    </div>

    <div class="d-flex align-center mt-2" style="gap: 8px">
      <v-btn variant="tonal" size="small" prepend-icon="mdi-face-woman-shimmer" @click="hairPickerOpen = true">
        ทรงผม {{ store.hairStyle }} · สี {{ store.hairColor }}
      </v-btn>
      <v-select v-model="store.clothColor" :items="Array.from({ length: Math.max(1, clothColors) }, (_, i) => i)" label="สีชุด" :disabled="clothColors <= 1" style="max-width: 90px" />
    </div>
    <div v-if="missing.length" class="text-caption text-disabled mt-1">ไม่มี sprite ใน client: {{ missing.join(', ') }}</div>

    <HairPicker v-if="manifest" v-model="hairPickerOpen" v-model:style="store.hairStyle" v-model:color="store.hairColor" :manifest="manifest" :gender="gender" />
  </v-card>
</template>

<style scoped lang="scss">
.preview-stage {
  position: relative;
  display: flex;
  justify-content: center;
  border-radius: 8px;
  background:
    radial-gradient(ellipse at 50% 90%, rgba(37, 99, 235, 0.14), transparent 60%),
    linear-gradient(180deg, #f3f8ff, #e3eefb);
  border: 1px solid #cfe0f5;
  canvas { image-rendering: pixelated; max-width: 100%; height: auto !important; }
  .preview-loading { position: absolute; top: 8px; right: 8px; }
}
</style>
