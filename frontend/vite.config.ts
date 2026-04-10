import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'frappe-gantt/dist/frappe-gantt.css': path.resolve(__dirname, 'node_modules/frappe-gantt/dist/frappe-gantt.css'),
        },
    },
});
