import { defineConfig } from 'vite'
import { crx, defineManifest } from '@crxjs/vite-plugin'

const manifest = defineManifest({
  manifest_version: 3,
  name: '__MSG_appName__',
  version: '0.1.0',
  description: '__MSG_appDescription__',
  default_locale: 'en',
  permissions: ['storage', 'tabs'],
  host_permissions: ['<all_urls>'],
  background: {
    service_worker: 'src/background/service-worker.ts',
  },
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content/index.ts'],
      run_at: 'document_start',
      all_frames: true,
      match_about_blank: true,
    },
  ],
  action: {
    default_popup: 'src/popup/popup.html',
  },
  icons: {
    '16': 'src/assets/icons/icon-16.png',
    '48': 'src/assets/icons/icon-48.png',
    '128': 'src/assets/icons/icon-128.png',
  },
})

export default defineConfig({
  plugins: [
    crx({ manifest }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
