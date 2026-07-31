/**
 * F-REFACTOR-ERRORS (2026-07-31)
 * ===============================
 * Formatters compartidos para el visor de errores.
 *
 * Antes vivian inline en routes/app/admin/errors/+page.svelte como
 * funciones helper locales. Esto las hace reutilizables (e.g. para
 * el ErrorDetailModal extraido) y testeables.
 */

/**
 * Formatea un timestamp ISO a 'es-BO' locale con formato DD/MM/YYYY HH:MM:SS.
 * Si el parseo falla, devuelve el string original.
 */
export function formatErrorTimestamp(iso: string): string {
	try {
		const d = new Date(iso);
		return d.toLocaleString('es-BO', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
	} catch {
		return iso;
	}
}

/**
 * Devuelve clases Tailwind para el badge de método HTTP.
 * GET=azul, POST=verde, PATCH/PUT=amber, DELETE=rojo, otros=gris.
 */
export function getMethodBadgeClass(method: string): string {
	const m = method.toUpperCase();
	if (m === 'GET') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
	if (m === 'POST') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
	if (m === 'PATCH' || m === 'PUT')
		return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
	if (m === 'DELETE') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	return 'bg-gray-100 text-gray-800';
}

/**
 * Devuelve clases Tailwind para el badge de status code.
 * 5xx=rojo, 4xx=amber, 2xx/3xx=verde.
 */
export function getStatusBadgeClass(status: number): string {
	if (status >= 500) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	if (status >= 400) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
	return 'bg-green-100 text-green-800';
}
