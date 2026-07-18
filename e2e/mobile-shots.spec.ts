import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';

const SHOT_DIR = 'C:/Users/Usuario/Documents/PROYECTO KYC/.mavis/v2/assets/2026/07/17';
mkdirSync(SHOT_DIR, { recursive: true });

const TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTRiYTg1NGQ4NzJjZDMzZDRiNDliYWYiLCJ1c2VyX3R5cGUiOiJ1c2VyIiwicm9sZSI6ImFkbWluIiwiZXhwIjoxNzg0NDA4MjY0fQ.am1cf9XOXakN5GI5XKTpfJ9DXzvrW9_PXEjUw-9Dmak';

const userData = {
	_id: '6a4ba854d872cd33d4b49baf',
	username: 'admin_test',
	email: 'admin_test@datahuba.com',
	role: 'admin',
	activo: true,
	nombre: 'Admin Test'
};

test.use({
	viewport: { width: 390, height: 844 },
	deviceScaleFactor: 2,
	isMobile: true,
	hasTouch: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});

test('captura mobile', async ({ page, context }) => {
	test.setTimeout(240000);

	// Inyectar localStorage en CADA navegación antes que se cargue cualquier script
	await context.addInitScript(
		({ t, u }) => {
			try {
				localStorage.setItem('auth_token', t);
				localStorage.setItem('auth_token_expiry', String(Date.now() + 23 * 60 * 60 * 1000));
				localStorage.setItem('user_data', JSON.stringify(u));
			} catch (e) {}
		},
		{ t: TOKEN, u: userData }
	);

	const PAGES = [
		{ name: '02-dashboard', path: '/app/dashboard' },
		{ name: '03-payments', path: '/app/payments' },
		{ name: '04-enrollments', path: '/app/enrollments' },
		{ name: '05-courses', path: '/app/courses' },
		{ name: '06-students', path: '/app/students' },
		{ name: '07-discounts', path: '/app/discounts' },
		{ name: '08-change-password', path: '/app/change-password' },
		{ name: '09-profile', path: '/app/profile' }
	];

	// 1) Capturar pantalla de login sin sesión
	await page.goto('https://postgrado.datahuba.com/auth/sign-in', { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `${SHOT_DIR}/mobile-01-signin.png`, fullPage: true });
	console.log('OK: 01-signin');

	// 2) Para cada página, navegar (con addInitScript inyectando sesión antes)
	for (const p of PAGES) {
		const url = `https://postgrado.datahuba.com${p.path}`;
		try {
			await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
			await page.waitForTimeout(3000);
			const file = `${SHOT_DIR}/mobile-${p.name}.png`;
			await page.screenshot({ path: file, fullPage: true });
			console.log(`OK: ${p.name} (URL: ${page.url()})`);
		} catch (err: any) {
			console.log(`FAIL: ${p.name} -> ${err.message}`);
		}
	}
});
