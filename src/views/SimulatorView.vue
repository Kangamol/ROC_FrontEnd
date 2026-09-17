<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { SLOTS } from '@/lib/slots'
import { useBuildStore } from '@/stores/build'
import CharacterPanel from '@/components/CharacterPanel.vue'
import CharacterPreview from '@/components/CharacterPreview.vue'
import EquipmentSlot from '@/components/EquipmentSlot.vue'
import StatPanel from '@/components/StatPanel.vue'
import EquipmentSummary from '@/components/EquipmentSummary.vue'

const props = defineProps<{ shareCode?: string }>()
const store = useBuildStore()
const router = useRouter()

const gear = SLOTS.filter((s) => s.group === 'gear')
const costume = SLOTS.filter((s) => s.group === 'costume')
const snackbar = ref<string | null>(null)

const shareUrl = computed(() => (store.shareCode ? `${location.origin}/b/${store.shareCode}` : null))

watch(() => props.shareCode, (code) => { if (code) store.load(code) }, { immediate: true })

async function save() {
  try {
    const code = await store.save()
    router.replace({ name: 'build', params: { shareCode: code } })
    await navigator.clipboard?.writeText(`${location.origin}/b/${code}`).catch(() => {})
    snackbar.value = 'บันทึกแล้ว — คัดลอกลิงก์แชร์ไว้ในคลิปบอร์ด'
  } catch (e) {
    snackbar.value = `บันทึกไม่สำเร็จ: ${e instanceof Error ? e.message : e}`
  }
}
</script>

<template>
  <v-container fluid class="pa-4">
    <v-alert v-if="store.loadError" type="error" variant="tonal" class="mb-3" closable @click:close="store.loadError = null">
      โหลด build ไม่ได้: {{ store.loadError }}
    </v-alert>
    <v-row dense>
      <v-col cols="12" md="3">
        <CharacterPreview class="mb-3" />
        <CharacterPanel />
        <v-card class="ro-panel pa-3 mt-3" variant="flat">
          <div class="d-flex" style="gap: 8px">
            <v-btn color="primary" prepend-icon="mdi-content-save" :loading="store.saving" block @click="save">Save & Share</v-btn>
            <v-btn variant="tonal" icon="mdi-restore" title="รีเซ็ต" @click="store.reset()" />
          </div>
          <v-text-field v-if="shareUrl" :model-value="shareUrl" readonly class="mt-2" prepend-inner-icon="mdi-link" />
        </v-card>
      </v-col>

      <v-col cols="12" md="6">
        <div class="text-subtitle-2 text-accent mb-2"><v-icon icon="mdi-shield-sword" size="small" class="mr-1" />Equipment</div>
        <v-row dense>
          <v-col v-for="s in gear" :key="s.key" cols="12" sm="6">
            <EquipmentSlot :def="s" :disabled="s.key === 'SHIELD' && store.shieldBlocked" />
          </v-col>
        </v-row>
        <div class="text-subtitle-2 text-accent mt-4 mb-2"><v-icon icon="mdi-drama-masks" size="small" class="mr-1" />Costume</div>
        <v-row dense>
          <v-col v-for="s in costume" :key="s.key" cols="12" sm="6">
            <EquipmentSlot :def="s" />
          </v-col>
        </v-row>
      </v-col>

      <v-col cols="12" md="3">
        <StatPanel />
        <EquipmentSummary class="mt-3" />
      </v-col>
    </v-row>
    <v-snackbar :model-value="!!snackbar" timeout="3000" @update:model-value="snackbar = null">{{ snackbar }}</v-snackbar>
  </v-container>
</template>
