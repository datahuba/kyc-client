/**
 * Servicio de Cuentas por Cobrar
 * ===============================
 *
 * F-CUENTAS-POR-COBRAR (2026-07-29): CxC real vs estimada para informes
 * financieros del staff. La CxC real (a la fecha) solo suma los módulos
 * que Sandra/Rocío (encargado del programa) ya marcó como 'iniciado_en'.
 *
 * - GET /reports/cuentas-por-cobrar              → JSON con desglose completo
 * - GET /reports/cuentas-por-cobrar/resumen      → Solo totales (para dashboard)
 * - GET /reports/cuentas-por-cobrar/xlsx         → XLSX descargable
 * - POST /enrollments/{id}/modulos/{n}/iniciar   → Habilitar módulo (CxC real)
 * - POST /enrollments/{id}/modulos/{n}/deshacer-inicio → Revertir
 */

import { apiKyC } from '$lib/config';

export interface ModuloCxC {
	nombre: string;
	modulo_index: number;
	costo: number;
	monto_pagado: number;
	saldo_pendiente: number;
	iniciado_en: string | null;
	cuenta_cxc_real: boolean;
}

export interface EnrollmentCxC {
	enrollment_id: string;
	estudiante_id: string;
	estudiante_nombre: string;
	estudiante_registro: string | null;
	curso_id: string;
	curso_nombre: string;
	estado: string;
	total_a_pagar: number;
	total_pagado: number;
	recaudacion_efectiva: number;
	total_devengado: number;
	cxc_devengada: number;
	proyeccion_futura: number;
	saldo_estimado: number;
	saldo_a_la_fecha: number;
	modulos: ModuloCxC[];
}

export interface CursoCxC {
	curso_id: string;
	curso_nombre: string;
	curso_codigo: string | null;
	cantidad_estudiantes: number;
	recaudacion_efectiva: number;
	total_devengado: number;
	cxc_devengada: number;
	proyeccion_futura: number;
	total_estimado: number;
	total_a_la_fecha: number;
}

export interface CxCResumen {
	recaudacion_efectiva: number;
	total_devengado: number;
	cxc_devengada: number;
	proyeccion_futura: number;
	total_estimado: number;
	total_a_la_fecha: number;
	total_modulos_iniciados: number;
	total_modulos_no_iniciados: number;
	cantidad_enrollments: number;
	cantidad_cursos: number;
	por_curso: CursoCxC[];
	detalle: EnrollmentCxC[];
	generado_en: string;
}

export interface CxCResumenReducido {
	recaudacion_efectiva: number;
	total_devengado: number;
	cxc_devengada: number;
	proyeccion_futura: number;
	total_estimado: number;
	total_a_la_fecha: number;
	diferencia: number;
	total_modulos_iniciados: number;
	total_modulos_no_iniciados: number;
	cantidad_enrollments: number;
	cantidad_cursos: number;
	generado_en: string;
}

class CuentasPorCobrarService {
	/**
	 * Resumen completo (con desglose por curso y enrollment).
	 * Tarda más, usar solo para la página de reporte.
	 */
	async getResumen(cursoId?: string): Promise<CxCResumen> {
		const params = new URLSearchParams();
		if (cursoId) params.append('curso_id', cursoId);
		const qs = params.toString();
		return await apiKyC.get<CxCResumen>(
			`/reports/cuentas-por-cobrar${qs ? `?${qs}` : ''}`
		);
	}

	/**
	 * Resumen reducido (solo totales). Optimizado para la tarjeta del dashboard.
	 */
	async getResumenReducido(): Promise<CxCResumenReducido> {
		return await apiKyC.get<CxCResumenReducido>(
			'/reports/cuentas-por-cobrar/resumen'
		);
	}

	/**
	 * URL directa al XLSX (se abre en una nueva pestaña o se descarga).
	 */
	getXlsxUrl(cursoId?: string): string {
		const params = new URLSearchParams();
		if (cursoId) params.append('curso_id', cursoId);
		const qs = params.toString();
		return `/reports/cuentas-por-cobrar/xlsx${qs ? `?${qs}` : ''}`;
	}

	/**
	 * Inicia un módulo (RBAC: Admin/Superadmin/Encargado del Curso).
	 */
	async iniciarModulo(enrollmentId: string, moduloIndex: number): Promise<unknown> {
		return await apiKyC.post<unknown>(
			`/enrollments/${enrollmentId}/modulos/${moduloIndex}/iniciar`,
			{}
		);
	}

	/**
	 * Revierte el inicio de un módulo (mismo RBAC).
	 */
	async deshacerInicioModulo(enrollmentId: string, moduloIndex: number): Promise<unknown> {
		return await apiKyC.post<unknown>(
			`/enrollments/${enrollmentId}/modulos/${moduloIndex}/deshacer-inicio`,
			{}
		);
	}

	/**
	 * F-MODULOS-MODAL (2026-07-31): marca un módulo como finalizado/cerrado.
	 * Solo se puede finalizar un módulo que ya está iniciado.
	 *
	 * F-2026-08-11-MODULOS-EC: asistencia_porcentaje es opcional (0-100). Si
	 * se pasa y es < 80, el backend fuerza estado_academico='Reprobado'
	 * (regla de aprobación mínima por asistencia, educación continua UAGRM
	 * 2026-08-11).
	 */
	async finalizarModulo(
		enrollmentId: string,
		moduloIndex: number,
		asistencia_porcentaje?: number | null
	): Promise<unknown> {
		return await apiKyC.post<unknown>(
			`/enrollments/${enrollmentId}/modulos/${moduloIndex}/finalizar`,
			{ asistencia_porcentaje: asistencia_porcentaje ?? null }
		);
	}

	/**
	 * F-MODULOS-MODAL (2026-07-31): revierte la finalización de un módulo
	 * (caso de error humano).
	 */
	async deshacerFinalizacionModulo(enrollmentId: string, moduloIndex: number): Promise<unknown> {
		return await apiKyC.post<unknown>(
			`/enrollments/${enrollmentId}/modulos/${moduloIndex}/deshacer-finalizacion`,
			{}
		);
	}
}

export const cuentasPorCobrarService = new CuentasPorCobrarService();
