import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		// F-LOADING-CHUNKS (2026-08-07, Kevin): dividir el bundle en chunks
		// mas pequenos y granulares para que el browser haga menos requests
		// en paralelo. Cuando carga el bundle, hace ~10-20 requests
		// simultaneas de chunks al server. Si el server (nginx/Hostinger)
		// tiene worker_connections limitado, satura y devuelve 502 o
		// corta conexiones con ECONNRESET.
		//
		// Solucion: agrupar dependencias grandes en chunks dedicados
		// (vendor) y dejar que las paginas se carguen como chunks pequenos
		// individuales. Asi el primer load del dashboard hace solo ~5
		// requests en vez de ~20.
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					// Dependencias grandes -> chunk vendor dedicado
					if (id.includes('node_modules')) {
						if (id.includes('chart.js') || id.includes('chartjs')) {
							return 'vendor-chart';
						}
						if (id.includes('svelte')) {
							return 'vendor-svelte';
						}
						// Resto de deps -> chunk vendor general
						return 'vendor';
					}
					// Componentes compartidos del dashboard
					if (id.includes('/components/dashboard/')) {
						return 'dashboard-components';
					}
					if (id.includes('/components/ui/')) {
						return 'ui-components';
					}
					// Stores compartidos
					if (id.includes('/stores/')) {
						return 'stores';
					}
					// Servicios API compartidos
					if (id.includes('/services/') && !id.includes('/services/payment') && !id.includes('/services/enrollment')) {
						return 'services-base';
					}
					// Páginas: chunks individuales (comportamiento por defecto de SvelteKit)
				}
			}
		},
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
