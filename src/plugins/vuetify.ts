import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'

// Light theme: white background, navy text/titles, blue actions.
export const vuetify = createVuetify({
  theme: {
    defaultTheme: 'ro',
    themes: {
      ro: {
        dark: false,
        colors: {
          background: '#ffffff',
          surface: '#ffffff',
          'surface-variant': '#eef4fb',
          'on-surface': '#14213d',
          primary: '#2563eb',
          secondary: '#1e3a8a',
          accent: '#1e3a8a',
          error: '#dc2626',
          success: '#15803d',
          warning: '#d97706',
          info: '#0284c7',
        },
      },
    },
  },
  defaults: {
    VCard: { rounded: 'lg' },
    VBtn: { rounded: 'md' },
    VTextField: { variant: 'outlined', density: 'compact', hideDetails: true },
    VSelect: { variant: 'outlined', density: 'compact', hideDetails: true },
  },
})
