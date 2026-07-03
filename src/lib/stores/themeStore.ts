/**
 * Store de Tema (Claro / Oscuro / Sistema)
 * =========================================
 * Gestiona el modo de tema de toda la plataforma:
 *  - Aplica/quita la clase `.dark` en <html> (Tailwind v4 usa el custom-variant .dark).
 *  - Persiste la preferencia del usuario en localStorage.
 *  - Respeta la preferencia del sistema operativo cuando el modo es 'system'.
 *
 * El script anti-flash en app.html aplica la clase antes del primer render;
 * este store mantiene la reactividad durante la sesión.
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'kyc_theme';

/** Modo elegido por el usuario (light | dark | system) */
export const themeMode = writable<ThemeMode>('system');

/** Booleano resuelto: ¿está el tema oscuro activo ahora mismo? */
export const isDark = writable<boolean>(false);

function systemPrefersDark(): boolean {
	return browser ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
}

function resolveDark(mode: ThemeMode): boolean {
	return mode === 'dark' || (mode === 'system' && systemPrefersDark());
}

function applyMode(mode: ThemeMode) {
	const dark = resolveDark(mode);
	if (browser) {
		document.documentElement.classList.toggle('dark', dark);
	}
	isDark.set(dark);
}

/** Fija un modo concreto, lo persiste y lo aplica al DOM. */
export function setThemeMode(mode: ThemeMode) {
	themeMode.set(mode);
	if (browser) {
		try {
			localStorage.setItem(STORAGE_KEY, mode);
		} catch (e) {
			/* almacenamiento no disponible: se ignora en silencio */
		}
	}
	applyMode(mode);
}

/** Alterna entre claro y oscuro tomando como base el estado resuelto actual. */
export function toggleTheme() {
	const dark = resolveDark(get(themeMode));
	setThemeMode(dark ? 'light' : 'dark');
}

let systemListenerAttached = false;

/** Inicializa el tema al arrancar la app (llamar en el layout raíz, onMount). */
export function initTheme() {
	if (!browser) return;

	let stored: ThemeMode = 'system';
	try {
		stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? 'system';
	} catch (e) {
		stored = 'system';
	}

	themeMode.set(stored);
	applyMode(stored);

	if (!systemListenerAttached) {
		window
			.matchMedia('(prefers-color-scheme: dark)')
			.addEventListener('change', () => {
				if (get(themeMode) === 'system') applyMode('system');
			});
		systemListenerAttached = true;
	}
}
