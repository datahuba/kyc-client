import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';

const SHOT_DIR = 'C:/Users/Usuario/Documents/PROYECTO KYC/.mavis/v2/assets/2026/07/17';
mkdirSync(SHOT_DIR, { recursive: true });

const STUDENT_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2I3ZjFlMjljNjkwZDU2MzVlOTExMTEiLCJ1c2VyX3R5cGUiOiJzdHVkZW50Iiwicm9sZSI6InN0dWRlbnQiLCJleHAiOjE3ODk4NzY2ODR9.8MpwnRbwRuvfknjeR7qbict1PhoqLbaQTE_wLM01BiM';

const studentData = {
	_id: '67b7f1e29c690d5635e91111',
	username: 'estudiante_test',
	email: 'estudiante@uagrm.edu.bo',
	role: 'student',
	user_type: 'student',
	activo: true,
	nombre: 'Juan Perez Estudiante',
	terminos_aceptados: true,
	perfil_completado: true
};

const ADMIN_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2N2I3ZjFlMjljNjkwZDU2MzVlOTIyMjIiLCJ1c2VyX3R5cGUiOiJ1c2VyIiwicm9sZSI6InN1cGVyYWRtaW4iLCJleHAiOjE3ODk4NzY2ODR9.Eub4vXniB-Ll-AzaYu4djGJJ4atc8rPVhUJsydViTpU';

const adminData = {
	_id: '67b7f1e29c690d5635e92222',
	username: 'admin_test',
	email: 'admin@uagrm.edu.bo',
	role: 'superadmin',
	user_type: 'user',
	activo: true,
	nombre: 'Administrador General',
	terminos_aceptados: true
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

	// 1) Capturar vistas de estudiante
	await context.addInitScript(
		({ t, u }) => {
			try {
				localStorage.setItem('kyc-auth_token', t);
				localStorage.setItem('kyc-auth_token_expiry', String(Date.now() + 23 * 60 * 60 * 1000));
				localStorage.setItem('kyc-user_data', JSON.stringify(u));
				localStorage.setItem('kyc-academic_role', 'student');
				localStorage.setItem('kyc-login_type', 'academic');
			} catch (e) {}
		},
		{ t: STUDENT_TOKEN, u: studentData }
	);

	const STUDENT_PAGES = [
		{ name: 'student-01-dashboard', path: '/app/dashboard' },
		{ name: 'student-02-payments', path: '/app/payments' },
		{ name: 'student-03-enrollments', path: '/app/enrollments' },
		{ name: 'student-04-certificates', path: '/app/certificates' },
		{ name: 'student-05-profile', path: '/app/profile' }
	];

	// 1) Capturar pantalla de login sin sesión
	await page.goto('https://postgrado.datahuba.com/auth/sign-in', { waitUntil: 'networkidle' });
	await page.waitForTimeout(1500);
	await page.screenshot({ path: `${SHOT_DIR}/mobile-01-signin.png`, fullPage: true });
	console.log('OK: 01-signin');

	// 2) Para cada página, navegar (con addInitScript inyectando sesión antes)
	for (const p of STUDENT_PAGES) {
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
