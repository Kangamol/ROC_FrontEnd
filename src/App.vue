<script setup lang="ts">
</script>

<template>
  <v-app>
    <v-app-bar density="compact" flat class="ro-panel">
      <v-app-bar-title class="text-accent font-weight-bold">
        <v-icon icon="mdi-sword-cross" class="mr-2" />RO Classic Simulator
      </v-app-bar-title>
      <span class="text-caption text-medium-emphasis mr-4">Gnjoy Classic (TH) item data</span>
    </v-app-bar>
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
