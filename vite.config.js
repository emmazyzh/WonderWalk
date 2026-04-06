import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['react-simple-maps', 'prop-types', 'd3-geo'],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design')) {
            return 'antd-vendor'
          }
          if (
            id.includes('node_modules/react-simple-maps') ||
            id.includes('node_modules/d3-geo') ||
            id.includes('node_modules/prop-types')
          ) {
            return 'map-vendor'
          }
        },
      },
    },
  },
})
