import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/video-info': 'http://localhost:4000', 
      '/download': 'http://localhost:4000',    
    },
    watch: {
      usePolling: true 
    }
  },
})