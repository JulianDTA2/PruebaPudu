import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth':  { target: 'https://pudu.roboticminds.ec/', changeOrigin: true },
      '/secure':{ target: 'https://pudu.roboticminds.ec/', changeOrigin: true },
      '/health':{ target: 'https://pudu.roboticminds.ec/', changeOrigin: true },
      '/pudu-entry':    { target: 'https://pudu.roboticminds.ec', changeOrigin: true, secure: true },
      '/pudu-entry-v2': { target: 'https://pudu.roboticminds.ec', changeOrigin: true, secure: true },
     }
  }
}) 