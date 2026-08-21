import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';

const QA_SHOT_DIR = 'C:/Users/Usuario/Documents/PROYECTO KYC/.mavis/v2/assets/qa_runs';
mkdirSync(QA_SHOT_DIR, { recursive: true });

test.describe('KYC DataHub — Suite Integral de QA (Playwright)', () => {

	test('1. Portal de Inicio: Selector de Perfiles y Cambio de Tema', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		// Verificar presencia de los 3 perfiles de acceso
		const bodyText = await page.textContent('body');
		expect(bodyText).toContain('Estudiantes');
		expect(bodyText).toContain('Docentes');
		expect(bodyText).toContain('Administrativos');

		// Captura de pantalla de la Landing
		await page.screenshot({ path: `${QA_SHOT_DIR}/01_landing_roles.png`, fullPage: true });

		// Probar toggle de tema
		const themeToggle = page.locator('button').filter({ has: page.locator('svg') }).first();
		if (await themeToggle.count() > 0) {
			await themeToggle.click();
			await page.waitForTimeout(500);
			await page.screenshot({ path: `${QA_SHOT_DIR}/01b_landing_theme_toggled.png`, fullPage: true });
		}
	});

	test('2. Flujo Completo de Estudiante: Selección -> Login -> Validaciones -> Registro', async ({ page }) => {
		await page.goto('/', { waitUntil: 'networkidle' });

		// Hacer clic en la tarjeta de 'Estudiantes'
		const studentBtn = page.getByRole('button', { name: /Estudiantes/i });
		await studentBtn.click();
		await page.waitForURL('**/auth/sign-in', { timeout: 10000 });

		// Verificar que cargue la interfaz de login para estudiante
		await expect(page.locator('#username')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();

		// Enviar formulario vacío para probar validación
		const submitBtn = page.getByRole('button', { name: /Iniciar Sesión/i });
		await submitBtn.click();
		await page.waitForTimeout(500);

		// Captura de validaciones
		await page.screenshot({ path: `${QA_SHOT_DIR}/02_student_login_validation.png`, fullPage: true });

		// Probar enlace de '¿Olvidaste tu contraseña?'
		const forgotLink = page.getByRole('link', { name: /¿Olvidaste tu contraseña\?/i });
		if (await forgotLink.count() > 0) {
			await forgotLink.click();
			await page.waitForURL('**/auth/forgot-password');
			await page.waitForSelector('input', { state: 'visible' });
			await page.waitForTimeout(800);
			await expect(page.locator('input[type="email"], input[id="email"]')).toBeVisible();
			await page.screenshot({ path: `${QA_SHOT_DIR}/02b_forgot_password.png`, fullPage: true });
		}

		// Probar enlace de Registro / Crear Cuenta
		await page.goto('/auth/register', { waitUntil: 'networkidle' });
		await page.waitForSelector('form, input', { state: 'visible' });
		await page.waitForTimeout(800);
		await expect(page.locator('input').first()).toBeVisible();
		await page.screenshot({ path: `${QA_SHOT_DIR}/02c_student_register.png`, fullPage: true });
	});

	test('3. Flujo de Acceso: Personal Administrativo y Docente', async ({ page }) => {
		// 1) Seleccionar Administrativos desde Landing
		await page.goto('/', { waitUntil: 'networkidle' });
		const adminBtn = page.getByRole('button', { name: /Administrativos/i });
		await adminBtn.click();
		await page.waitForURL('**/auth/sign-in', { timeout: 10000 });
		await page.waitForSelector('#username', { state: 'visible' });

		await expect(page.locator('#username')).toBeVisible();
		await page.waitForTimeout(800);
		await page.screenshot({ path: `${QA_SHOT_DIR}/03a_staff_login.png`, fullPage: true });

		// Usar 'Cambiar tipo de usuario' para volver limpiamente a la selección de roles
		const switchRoleBtn = page.getByRole('button', { name: /Cambiar tipo de usuario/i });
		await switchRoleBtn.click();
		await page.waitForURL('**/', { timeout: 10000 });
		await page.waitForTimeout(800);

		// 2) Seleccionar Docentes desde Landing
		const teacherBtn = page.getByRole('button', { name: /Docentes/i });
		await teacherBtn.click();
		await page.waitForURL('**/auth/sign-in', { timeout: 10000 });
		await page.waitForSelector('#username', { state: 'visible' });

		await expect(page.locator('#username')).toBeVisible();
		await page.waitForTimeout(800);
		await page.screenshot({ path: `${QA_SHOT_DIR}/03b_teacher_login.png`, fullPage: true });
	});

	test('4. Seguridad y Protección de Endpoints y Vistas Protegidas', async ({ request, page }) => {
		// Validar que endpoints privados no expongan datos sin autenticación
		const resUsers = await request.get('/api/v1/users/');
		expect([401, 403]).toContain(resUsers.status());

		const resPayments = await request.get('/api/v1/payments/');
		expect([401, 403]).toContain(resPayments.status());

		const resEnrollments = await request.get('/api/v1/enrollments/');
		expect([401, 403]).toContain(resEnrollments.status());

		const resCertificates = await request.get('/api/v1/certificates/requests');
		expect([401, 403]).toContain(resCertificates.status());

		// Validar que rutas protegidas del frontend redirijan al login/landing
		await page.goto('/app/dashboard', { waitUntil: 'networkidle' });
		await page.waitForTimeout(1000);
		const currentUrl = page.url();
		expect(currentUrl.includes('/auth') || currentUrl.endsWith('/')).toBeTruthy();
	});
});
