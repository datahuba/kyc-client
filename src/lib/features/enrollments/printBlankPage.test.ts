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
//
// SEGUNDA VUELTA (mismo dia): el primer intento de fix arriba rompio el
// flujo NORMAL (modal SI abierto) — agregar `:has(.libreta-imprimible)` a
// la regla de esconder le subio la especificidad (0,1,1) por encima de
// `.libreta-imprimible`/`.libreta-imprimible *` (0,1,0), asi que la regla
// de "volver a mostrar" pasaba a PERDER la cascada y todo quedaba
// invisible — Kevin lo reprodujo imprimiendo desde el boton Imprimir DEL
// POP-UP (con el modal abierto). Verificado con una reproduccion HTML
// aislada (fuera de este repo) antes y despues del fix: `visibility`
// computada daba `hidden` con la primera version, `visible` con la
// segunda (que repite `:has()` tambien del lado de "mostrar", empatando
// la especificidad).
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fuente(relPath: string): string {
	return readFileSync(join(__dirname, relPath), 'utf-8');
}

function verificarEspecificidadPareja(src: string) {
	// La regla de "mostrar" tiene que repetir la MISMA condicion :has()
	// que la regla de "esconder", si no pierde la cascada por
	// especificidad y todo el contenido queda invisible.
	expect(src).toContain('body:has(.libreta-imprimible) *');
	expect(src).toMatch(
		/body:has\(\.libreta-imprimible\)\s*\.libreta-imprimible\)[,\s]*[\s\S]{0,20}body:has\(\.libreta-imprimible\)\s*\.libreta-imprimible \*/
	);
	// La version ROTA (la regla de "mostrar" con menor especificidad que
	// la de "esconder") no debe volver a aparecer: eso especificamente es
	// `.libreta-imprimible` seguido de `visibility: visible` SIN el
	// prefijo `body:has(...)`.
	expect(src).not.toMatch(
		/:global\(\.libreta-imprimible\),\s*\n\s*:global\(\.libreta-imprimible \*\)\s*\{\s*\n\s*visibility:\s*visible;/
	);
}

describe('LibretaResumenModal.svelte: print CSS no deja la pagina en blanco (ni con el modal cerrado, ni con el modal abierto)', () => {
	const src = fuente('LibretaResumenModal.svelte');

	it('no esconde body * sin condicion', () => {
		expect(src).not.toMatch(/:global\(body \*\s*\)\s*\{/);
	});

	it('la regla de mostrar tiene la misma especificidad que la de esconder', () => {
		verificarEspecificidadPareja(src);
	});
});

describe('/app/enrollments/+page.svelte: mismo fix en el print CSS del Kardex', () => {
	const src = fuente('../../../routes/app/enrollments/+page.svelte');

	it('no esconde body * sin condicion', () => {
		expect(src).not.toMatch(/:global\(body \*\s*\)\s*\{/);
	});

	it('la regla de mostrar tiene la misma especificidad que la de esconder', () => {
		verificarEspecificidadPareja(src);
	});
});
