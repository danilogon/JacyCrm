import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // pdfjs-dist v5 é um ES module puro; excluir do pre-bundle do Vite
    // evita erros de carregamento do worker em produção
    exclude: ['pdfjs-dist'],
  },
})
