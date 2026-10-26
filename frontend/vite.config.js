import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // Must be here

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Must be here
  ],
})