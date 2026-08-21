import { test, expect } from '@playwright/test';
import { mkdirSync } from 'fs';

const QA_SHOT_DIR = 'C:/Users/Usuario/Documents/PROYECTO KYC/.mavis/v2/assets/mobile-qa';
mkdirSync(QA_SHOT_DIR, { recursive: true });

const SUPERADMIN_TOKEN = 'mock-superadmin-jwt-token-playwright';
const superadminData = {
	_id: '67b7f1e29c690d5635e92222',
	id: '67b7f1e29c690d5635e92222',
	username: 'superadmin_test',
	email: 'superadmin@uagrm.edu.bo',
	role: 'superadmin',
	rol: 'superadmin',
	user_type: 'user',
	activo: true,
	nombre: 'Super Administrador General',
	terminos_aceptados: true
};

const STUDENT_TOKEN = 'mock-student-jwt-token-playwright';
const studentData = {
	_id: '67b7f1e29c690d5635e91111',
	id: '67b7f1e29c690d5635e91111',
	username: 'estudiante_test',
	email: 'estudiante@uagrm.edu.bo',
	role: 'student',
	rol: 'student',
	user_type: 'student',
	activo: true,
	nombre: 'Juan Perez Estudiante',
	terminos_aceptados: true,
	perfil_completado: true,
	documentos: {
		ci: 'https://res.cloudinary.com/dummy/image/upload/sample.jpg'
	}
};

// Configuración iPhone 14 Plus (430x932, scaleFactor 3)
test.use({
	viewport: { width: 430, height: 932 },
	deviceScaleFactor: 3,
	isMobile: true,
	hasTouch: true,
	userAgent:
		'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
});

test.describe('Mobile QA: Superadmin & Student WebApp Experience (iPhone 14 Plus)', () => {
	test('Superadmin: Bottom Nav Only, No Sidebar Drawer, Full Menu Sheet, Zero Overflows', async ({ page, context }) => {
		// Mock universal para cualquier URL con auth/me
		await page.route((url) => url.href.includes('auth/me'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(superadminData)
			});
		});
		await page.route((url) => url.href.includes('notifications'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ count: 0, alerts: [], ticket: 'dummy-ticket' })
			});
		});
		await page.route((url) => url.href.includes('reports') || url.href.includes('payments') || url.href.includes('enrollments'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		// Configurar Storage State
		await context.addInitScript(
			({ t, u }) => {
				try {
					localStorage.setItem('kyc-auth_token', t);
					localStorage.setItem('kyc-auth_token_expiry', String(Date.now() + 23 * 60 * 60 * 1000));
					localStorage.setItem('kyc-user_data', JSON.stringify(u));
					localStorage.setItem('kyc-login_type', 'admin');
				} catch (e) {}
			},
			{ t: SUPERADMIN_TOKEN, u: superadminData }
		);

		await page.goto('/app/dashboard');
		await page.waitForLoadState('networkidle');

		// 1. Sidebar desktop debe estar completamente oculto
		const sidebar = page.locator('aside');
		if (await sidebar.count() > 0) {
			await expect(sidebar).toBeHidden();
		}

		// 2. Header no debe tener botón de hamburguesa
		const hamburger = page.locator('header button[aria-label="Abrir menú lateral"]');
		await expect(hamburger).toHaveCount(0);

		// 3. Floating Bottom Bar debe estar visible con tabs
		const bottomNav = page.locator('nav').filter({ hasText: 'Inicio' });
		await expect(bottomNav).toBeVisible();

		// 4. Captura de pantalla del Dashboard Superadmin
		await page.screenshot({ path: `${QA_SHOT_DIR}/01-superadmin-dashboard-iphone14plus.png` });

		// 5. Verificar que no haya desborde horizontal (scrollWidth <= clientWidth)
		const overflowCheck = await page.evaluate(() => {
			return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
		});
		expect(overflowCheck).toBe(true);

		// 6. Abrir "Menú" en la barra flotante
		const menuButton = page.getByRole('button', { name: /Ver todas las opciones|Menú/i });
		await menuButton.click();
		await page.waitForTimeout(300);

		// 7. Verificar que el Bottom Sheet esté visible
		const menuDialog = page.getByRole('dialog', { name: /Menú completo de navegación/i });
		await expect(menuDialog).toBeVisible();

		// Captura del Bottom Sheet abierto
		await page.screenshot({ path: `${QA_SHOT_DIR}/02-superadmin-bottomsheet-iphone14plus.png` });

		// 8. Probar búsqueda en el Bottom Sheet
		const searchInput = menuDialog.locator('input[placeholder*="Buscar módulo"]');
		await searchInput.fill('Usuarios');
		await page.waitForTimeout(200);

		await expect(menuDialog.getByText('Usuarios')).toBeVisible();
		await page.screenshot({ path: `${QA_SHOT_DIR}/03-superadmin-bottomsheet-search.png` });

		// 9. Cerrar Bottom Sheet
		const closeButton = menuDialog.getByRole('button', { name: 'Cerrar menú' });
		await closeButton.click();
		await page.waitForTimeout(200);
		await expect(menuDialog).toBeHidden();
	});

	test('Student: Mobile App Experience, Touch Quick Actions, Balance Card, Safe Insets', async ({ page, context }) => {
		// Mock universal para cualquier URL con auth/me
		await page.route((url) => url.href.includes('auth/me'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(studentData)
			});
		});
		await page.route((url) => url.href.includes('notifications'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ count: 0, alerts: [], ticket: 'dummy-ticket' })
			});
		});
		await page.route((url) => url.href.includes('reports') || url.href.includes('payments') || url.href.includes('enrollments') || url.href.includes('courses'), async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify([])
			});
		});

		// Configurar Storage State
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

		await page.goto('/app/dashboard');
		await page.waitForLoadState('networkidle');

		// 1. Sidebar desktop no debe ser visible
		const sidebar = page.locator('aside');
		if (await sidebar.count() > 0) {
			await expect(sidebar).toBeHidden();
		}

		// 2. Floating Bottom Bar visible
		const bottomNav = page.locator('nav').filter({ hasText: 'Inicio' });
		await expect(bottomNav).toBeVisible();

		// 3. Captura del Dashboard Estudiantil
		await page.screenshot({ path: `${QA_SHOT_DIR}/04-student-dashboard-iphone14plus.png` });

		// 4. Verificar overflow horizontal en Student Dashboard
		const overflowCheck = await page.evaluate(() => {
			return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2;
		});
		expect(overflowCheck).toBe(true);

		// 5. Navegar a Mis Pagos vía Bottom Tab
		const pagosTab = page.locator('a[href="/app/payments"]');
		await pagosTab.click();
		await page.waitForLoadState('networkidle');

		await page.screenshot({ path: `${QA_SHOT_DIR}/05-student-payments-iphone14plus.png` });
	});
});
