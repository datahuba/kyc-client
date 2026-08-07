import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// F-LOADING-CHUNKS (2026-08-07, Kevin): manualChunks ELIMINADO porque
		// causaba "Cannot access 'be' before initialization" en runtime
		// (imports circulares entre los chunks custom). Vite ahora hace
		// code splitting por defecto, que es seguro.
		//
		// F-FIX-NGINX-CONCURRENCY (2026-08-07, Kevin): en lugar de
		// manualChunks, la solucion real es:
		// - Backend con 4 workers uvicorn (docker-compose)
		// - Frontend con 4 workers SvelteKit (server.js + cluster + SO_REUSEPORT)
		// - Nginx con worker_connections 2048 + timeouts en location /
		// - HTML inicial con modulepreload (SvelteKit lo hace por default)
		// - Server worker con retry para chunks (F-LOADING-RETRY)
		//
		// Target moderno para reducir polyfills
		target: 'es2022',
		// Minify con esbuild (mas rapido que terser, output similar)
		minify: 'esbuild',
		// Reducir warnings en build
		reportCompressedSize: false,
		// CSS code split
		cssCodeSplit: true,
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
