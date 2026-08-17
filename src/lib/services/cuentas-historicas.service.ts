/**
 * Servicio de Cuentas Históricas
 * ==============================
 *
 * F-CUENTAS-HISTORICAS (2026-08-16): los programas marcados como históricos
 * salieron del Dashboard y de Cuentas por Cobrar — no son cartera corriente,
 * son expediente. Este servicio consulta su informe aparte.
 *
 * Ojo con un detalle de criterio: a diferencia de CxC, acá SÍ cuentan las
 * inscripciones en estado COMPLETADO. En un programa histórico ese es el
 * estado esperado; excluirlas dejaría el informe vacío.
 */

import { apiKyC } from '$lib/config';

export interface HistEnrollment {
	enrollment_id: string;
	estudiante_id: string;
	estudiante_nombre: string;
	estudiante_registro: string | null;
	curso_id: string;
	curso_nombre: string;
	estado: string;
	total_a_pagar: number;
	total_pagado: number;
	saldo: number;
}

export interface HistCurso {
	curso_id: string;
	curso_nombre: string;
	curso_codigo: string | null;
	fecha_inicio: string | null;
	fecha_fin: string | null;
	cantidad_estudiantes: number;
	total_esperado: number;
	total_cobrado: number;
	saldo_pendiente: number;
	avance_pct: number;
}

export interface HistResumen {
	total_programas: number;
	total_estudiantes: number;
	total_esperado: number;
	total_cobrado: number;
	saldo_pendiente: number;
	avance_pct: number;
	por_curso: HistCurso[];
	detalle: HistEnrollment[];
	generado_en: string;
}

class CuentasHistoricasService {
	/** Informe completo: totales, desglose por programa y detalle por estudiante. */
	async getResumen(cursoId?: string): Promise<HistResumen> {
		const params = new URLSearchParams();
		if (cursoId) params.append('curso_id', cursoId);
		const qs = params.toString();
		return await apiKyC.get<HistResumen>(
			`/reports/cuentas-historicas${qs ? `?${qs}` : ''}`
		);
	}

	/** Ruta del XLSX (dos hojas: resumen por programa y detalle por estudiante). */
	getXlsxUrl(cursoId?: string): string {
		const params = new URLSearchParams();
		if (cursoId) params.append('curso_id', cursoId);
		const qs = params.toString();
		return `/reports/cuentas-historicas/xlsx${qs ? `?${qs}` : ''}`;
	}
}

export const cuentasHistoricasService = new CuentasHistoricasService();
