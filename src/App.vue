<script setup lang="ts">
</script>

<template>
  <v-app>
    <v-app-bar density="comfortable" flat class="ro-appbar">
      <div class="ro-brand">
        <div class="ro-brand-icon"><v-icon icon="mdi-sword-cross" size="20" /></div>
        <div>
          <div class="ro-brand-title">ROC Simulator</div>
          <div class="ro-brand-sub">By (SuperTon VIP:1269)</div>
        </div>
      </div>
      <v-spacer />
      <span class="ro-brand-note d-none d-sm-inline">Gnjoy Classic (TH) item data</span>
    </v-app-bar>
    <v-main class="ro-main">
      <router-view />
    </v-main>
  </v-app>
</template>
