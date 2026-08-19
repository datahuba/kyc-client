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
//
// TERCERA VUELTA (2026-08-19 tarde): la impresion desde
// /app/certificates/requests seguia en blanco. Los overflow de los
// ancestros del layout (overflow-hidden, overflow-y-auto) recortaban el
// contenido absolutamente posicionado de .libreta-imprimible. Y los
// backdrops de los modales (position:fixed inset:0) tapaban todo. Se
// agregaron reglas para forzar overflow:visible en todos los ancestros y
// display:none en los backdrops, ambas condicionadas a :has().
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

function verificarOverflowAncestros(src: string) {
	// Las reglas de overflow deben apuntar a TODOS los ancestros del
	// arbol (condicionados a :has(.libreta-imprimible)), no solo a los
	// que estan DENTRO de .libreta-imprimible. Los tres overflow que
	// recortaban:
	//   1. overflow-hidden (layout wrapper)
	//   2. overflow-y-auto (main y body del modal)
	//   3. overflow-x-auto (tabla)
	expect(src).toContain('body:has(.libreta-imprimible) .overflow-hidden');
	expect(src).toContain('body:has(.libreta-imprimible) .overflow-y-auto');
	expect(src).toContain('body:has(.libreta-imprimible) .overflow-x-auto');

	// NO debe existir la version vieja que solo apuntaba DENTRO de
	// .libreta-imprimible (esa no neutralizaba el layout padre):
	expect(src).not.toMatch(
		/:global\(\.libreta-imprimible \.overflow-x-auto\)\s*\{/
	);
}

function verificarBackdropsOcultos(src: string) {
	// Los backdrops de los modales (position:fixed, backdrop-blur-sm)
	// deben ocultarse con display:none para que no participen del layout
	// de impresion.
	expect(src).toContain('body:has(.libreta-imprimible) .backdrop-blur-sm');
}

describe('LibretaResumenModal.svelte: print CSS no deja la pagina en blanco (ni con el modal cerrado, ni con el modal abierto)', () => {
	const src = fuente('LibretaResumenModal.svelte');

	it('no esconde body * sin condicion', () => {
		expect(src).not.toMatch(/:global\(body \*\s*\)\s*\{/);
	});

	it('la regla de mostrar tiene la misma especificidad que la de esconder', () => {
		verificarEspecificidadPareja(src);
	});

	it('neutraliza overflow en ancestros del layout, no solo dentro de .libreta-imprimible', () => {
		verificarOverflowAncestros(src);
	});

	it('oculta los backdrops de los modales con display:none', () => {
		verificarBackdropsOcultos(src);
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

	it('neutraliza overflow en ancestros del layout, no solo dentro de .libreta-imprimible', () => {
		verificarOverflowAncestros(src);
	});

	it('oculta los backdrops de los modales con display:none', () => {
		verificarBackdropsOcultos(src);
	});
});
