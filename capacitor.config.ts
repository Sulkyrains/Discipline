import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.discipline.app',
  appName: 'Discipline',
  webDir: 'dist',
  android: {
    allowMixedContent: true
  }
}

export default config
