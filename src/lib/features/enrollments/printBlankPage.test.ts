// ============================================================================
// F-FIX-PRINT-PAGINA-EN-BLANCO (2026-08-19)
//
// El CSS de impresion escondia `body *` sin condicion. Como es CSS global
// (:global) queda cargado en la hoja de estilos de la ruta mientras el
// componente exista ahi, INCLUSO con el modal cerrado. Si alguien imprimia
// la pagina sin el modal abierto, .libreta-imprimible no existia para
// revelarse de nuevo y la impresion salia completamente en blanco — visto
// en vivo en capacitacion (Kevin). Fix: usar `:has()` para que la regla de
// ocultar todo solo se active si de verdad hay contenido imprimible.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fuente(relPath: string): string {
	return readFileSync(join(__dirname, relPath), 'utf-8');
}

describe('LibretaResumenModal.svelte: print CSS no deja la pagina en blanco sin el modal abierto', () => {
	const src = fuente('LibretaResumenModal.svelte');

	it('usa :has(.libreta-imprimible) en vez de esconder body * sin condicion', () => {
		expect(src).toContain('body:has(.libreta-imprimible)');
		expect(src).not.toMatch(/:global\(body \*\s*\)\s*\{/);
	});
});

describe('/app/enrollments/+page.svelte: mismo fix en el print CSS del Kardex', () => {
	const src = fuente('../../../routes/app/enrollments/+page.svelte');

	it('usa :has(.libreta-imprimible) en vez de esconder body * sin condicion', () => {
		expect(src).toContain('body:has(.libreta-imprimible)');
		expect(src).not.toMatch(/:global\(body \*\s*\)\s*\{/);
	});
});
