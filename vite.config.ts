import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the static build works under any path (GitHub Pages, etc.).
export default defineConfig({
    base: './',
    plugins: [react()],
});
