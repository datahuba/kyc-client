// ============================================================================
// F-SIDEBAR-COORD-FINANCIERO-SOLO-ECONOMICO (2026-08-19)
//
// Kevin en capacitacion: "los de sidebar de los coordinadores solo debe
// salir lo que les corresponde no que salga todo". El mecanismo existente
// (ECONOMIC_HREFS) es unidireccional: esconde lo economico de quien NO es
// financiero. Estos tests verifican la inversa: que el financiero tenga
// escondido lo academico/inscripciones, no solo lo economico visible.
//
// Test de inspeccion de fuente (no monta el componente): Sidebar.svelte usa
// $derived/$state de Svelte 5 dentro de un <script> que requiere el
// compilador de Svelte para ejecutarse fuera de un componente montado, asi
// que se verifica la presencia de las reglas en el texto fuente, siguiendo
// el mismo patron que los tests de inspeccion del backend.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fuente(relPath: string): string {
	return readFileSync(join(__dirname, relPath), 'utf-8');
}

describe('Sidebar.svelte: financiero no ve academico ni inscripciones', () => {
	const src = fuente('Sidebar.svelte');

	it('define grupos ocultos para el financiero incluyendo Academico e Inscripciones', () => {
		expect(src).toContain('FINANCIERO_HIDDEN_GROUPS');
		expect(src).toMatch(/FINANCIERO_HIDDEN_GROUPS\s*=\s*\[[^\]]*'Académico'[^\]]*\]/);
		expect(src).toMatch(/FINANCIERO_HIDDEN_GROUPS\s*=\s*\[[^\]]*'Inscripciones'[^\]]*\]/);
	});

	it('esconde Estudiantes y Solicitudes de Tramite del financiero', () => {
		expect(src).toContain('FINANCIERO_HIDDEN_HREFS');
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/students'[^\]]*\]/);
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/requests'[^\]]*\]/);
	});

	it('el chequeo de grupo oculto se aplica solo a coordinador financiero', () => {
		const linea = src
			.split('\n')
			.find((l) => l.includes('FINANCIERO_HIDDEN_GROUPS.includes'));
		expect(linea).toBeDefined();
		expect(linea).toContain("userRole === 'coordinador'");
		expect(linea).toContain('esCoordinadorFinanciero');
		expect(linea).not.toContain('!esCoordinadorFinanciero');
	});

	it('el chequeo de item oculto (FINANCIERO_HIDDEN_HREFS) se aplica solo a coordinador financiero', () => {
		const linea = src
			.split('\n')
			.find((l) => l.includes('FINANCIERO_HIDDEN_HREFS.includes'));
		expect(linea).toBeDefined();
		expect(linea).toContain("userRole === 'coordinador'");
		expect(linea).toContain('esCoordinadorFinanciero');
		expect(linea).not.toContain('!esCoordinadorFinanciero');
	});

	it('el mecanismo previo (ECONOMIC_HREFS) sigue intacto, no se toco', () => {
		expect(src).toContain('ECONOMIC_HREFS');
		expect(src).toMatch(/ECONOMIC_HREFS\.includes\(entry\.href\) && !esCoordinadorFinanciero/);
	});
});

describe('BottomNav.svelte: mismo criterio en mobile', () => {
	const src = fuente('BottomNav.svelte');

	it('define hrefs ocultos para el financiero (inscripciones/estudiantes/docentes/programas)', () => {
		expect(src).toContain('FINANCIERO_HIDDEN_HREFS');
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/enrollments'[^\]]*\]/);
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/students'[^\]]*\]/);
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/teachers'[^\]]*\]/);
		expect(src).toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/courses'[^\]]*\]/);
	});

	it('el chequeo se aplica solo a coordinador financiero, sin tocar el mecanismo previo', () => {
		const linea = src
			.split('\n')
			.find((l) => l.includes('FINANCIERO_HIDDEN_HREFS.includes'));
		expect(linea).toBeDefined();
		expect(linea).toContain("userRole === 'coordinador'");
		expect(linea).toContain('esCoordinadorFinanciero');
		expect(linea).not.toContain('!esCoordinadorFinanciero');
		expect(src).toMatch(/ECONOMIC_HREFS\.includes\(item\.href\) && !esCoordinadorFinanciero/);
	});

	it('no esconde Pagos ni Caja (economico) del financiero', () => {
		expect(src).not.toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/payments'[^\]]*\]/);
		expect(src).not.toMatch(/FINANCIERO_HIDDEN_HREFS\s*=\s*\[[^\]]*'\/app\/reports'[^\]]*\]/);
	});
});
