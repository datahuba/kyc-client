// ============================================================================
// F-FIX-DESCARGA-PDF-RACE (2026-08-19)
//
// downloadCertPdf() leia `selectedRequest.tipo`/`.id` DESPUES del await de
// certificateService.downloadPdf(). Si el usuario cerraba el modal (o
// navegaba) mientras la descarga estaba en curso, selectedRequest podia
// quedar en null y el acceso reventaba: "Cannot read properties of null
// (reading 'tipo')" — visto en vivo en consola durante la capacitacion.
// ============================================================================
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function fuente(relPath: string): string {
	return readFileSync(join(__dirname, relPath), 'utf-8');
}

describe('certificates/requests/+page.svelte: downloadCertPdf no lee selectedRequest despues del await', () => {
	const src = fuente('+page.svelte');

	it('captura tipo/id en variables locales antes del await', () => {
		const ini = src.indexOf('async function downloadCertPdf');
		const fin = src.indexOf('\n\t}', ini);
		const cuerpo = src.slice(ini, fin);

		const idxCertificateId = cuerpo.indexOf('const certificateId');
		const idxTipo = cuerpo.indexOf('const tipo');
		const idxId = cuerpo.indexOf('const id ');
		const idxAwait = cuerpo.indexOf('await certificateService.downloadPdf');

		expect(idxCertificateId).toBeGreaterThan(-1);
		expect(idxTipo).toBeGreaterThan(-1);
		expect(idxId).toBeGreaterThan(-1);
		expect(idxAwait).toBeGreaterThan(-1);
		expect(idxCertificateId).toBeLessThan(idxAwait);
		expect(idxTipo).toBeLessThan(idxAwait);
		expect(idxId).toBeLessThan(idxAwait);

		// Despues del await no debe quedar ningun acceso directo a
		// selectedRequest.tipo / selectedRequest.id
		const despuesDelAwait = cuerpo.slice(idxAwait);
		expect(despuesDelAwait).not.toContain('selectedRequest.tipo');
		expect(despuesDelAwait).not.toContain('selectedRequest.id');
	});
});
