import { defineConfig, devices } from '@playwright/test';

/**
 * F-2026-08-11-CAMPOS-EC-E2E (Kevin 22:37): Playwright config para los tests
 * E2E del wizard de preinscripcion y el panel del encargado.
 *
 * Para correr:
 *   npm install -D @playwright/test  (ya esta)
 *   npx playwright install chromium (descarga el browser, una vez)
 *   npx playwright test e2e/pre-registros.spec.ts
 *
 * Variables de entorno:
 *   BASE_URL = https://postgrado.datahuba.com (default de produccion)
 */

export default defineConfig({
	testDir: './e2e',
	timeout: 30_000,
	expect: { timeout: 5_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'list',
	use: {
		baseURL: process.env.BASE_URL || 'https://postgrado.datahuba.com',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
});
