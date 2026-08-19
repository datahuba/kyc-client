// ============================================================================
// F-FIX-PREREGISTROS-VALIDAR-SIN-AUTH (2026-08-19)
//
// Kevin: "a los encargados de educacion continua diplomado no les da la
// aprobacion de descuentos en el modulo de preinscripciones". La causa real
// no era RBAC: los botones de aprobar/rechazar titulo y descuento de
// vicerrectorado usaban fetch() crudo con `credentials: 'include'`, pero
// este backend usa Bearer token (localStorage), no cookies de sesion — asi
// que la llamada nunca mandaba el token y el backend devolvia 401/403 para
// CUALQUIER rol, no solo encargado_curso. Se reemplazaron por apiKyC
// (adjunta el Bearer token automaticamente, igual que el resto de la app).
//
// Test de inspeccion de fuente: verifica que no queden fetch() crudos hacia
// los endpoints de validacion en esta pagina, y que se use apiKyC en su
// lugar.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fuente(relPath: string): string {
	return readFileSync(join(__dirname, relPath), 'utf-8');
}

describe('pre-registros/+page.svelte: validar titulo/descuento usa apiKyC, no fetch crudo', () => {
	const src = fuente('+page.svelte');

	it('importa apiKyC', () => {
		expect(src).toMatch(/import\s*\{\s*apiKyC\s*\}\s*from\s*'\$lib\/config\/apiKyC\.config'/);
	});

	it('no queda ningun fetch() crudo hacia /api/v1/students/', () => {
		expect(src).not.toMatch(/fetch\(`\/api\/v1\/students\//);
	});

	it('no queda credentials: include (este backend usa Bearer token, no cookies)', () => {
		expect(src).not.toContain("credentials: 'include'");
	});

	it('usa apiKyC.putFormData para validar titulo y descuento de vicerrectorado', () => {
		expect(src).toMatch(/apiKyC\.putFormData\(`\/students\/\$\{validatingTituloFor\.studentId\}\/titulo\/validar`/);
		expect(src).toMatch(
			/apiKyC\.putFormData\(`\/students\/\$\{validatingDescuentoFor\.studentId\}\/descuento-vicerrectorado\/validar`/
		);
	});

	it('usa apiKyC.get para cargar el estado actual del descuento', () => {
		expect(src).toMatch(/apiKyC\.get<any>\(`\/students\/\$\{sub\.migrated_to_student_id\}`\)/);
	});
});

describe('apiKyC.config.ts: putFormData adjunta el Bearer token igual que postFormData', () => {
	const src = fuente('../../../lib/config/apiKyC.config.ts');

	it('define putFormData usando buildHeaders (que adjunta el token)', () => {
		const ini = src.indexOf('async putFormData');
		expect(ini).toBeGreaterThan(-1);
		const fin = src.indexOf('\n\t}', ini);
		const cuerpo = src.slice(ini, fin === -1 ? undefined : fin);
		expect(cuerpo).toContain('this.buildHeaders(options)');
		expect(cuerpo).toContain("method: 'PUT'");
	});
});
