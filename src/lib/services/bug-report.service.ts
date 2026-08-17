/**
 * Servicio de Reportes de Bugs
 * ============================
 *
 * F-REPORTE-BUGS (2026-08-17, Kevin): el personal administrativo reporta
 * errores desde la propia aplicación, con detalle y evidencia adjunta, en
 * vez de avisarlos por WhatsApp o de boca.
 *
 * RBAC (lo resuelve el backend con `require_staff`): lo usan los 7 perfiles
 * administrativos. Docentes y estudiantes NO.
 *
 * Quién ve qué: cualquiera del staff ve SUS propios reportes. Ver los de
 * todos y cambiarles el estado queda para admin/superadmin.
 */

import { apiKyC } from '$lib/config';

export type BugSeveridad = 'critica' | 'alta' | 'media' | 'baja';
export type BugEstado = 'abierto' | 'en_revision' | 'resuelto' | 'descartado';

export interface BugReport {
	id: string;
	titulo: string;
	descripcion: string;
	pagina: string | null;
	adjuntos: string[];
	severidad: BugSeveridad;
	modulo: string | null;
	reportado_por_nombre: string;
	reportado_por_rol: string;
	estado: BugEstado;
	respuesta: string | null;
	atendido_por: string | null;
	fecha_atencion: string | null;
	created_at: string;
	/** Adjuntos que no se pudieron subir. El reporte se guardó igual. */
	adjuntos_fallidos?: string[];
}

export interface BugReportListado {
	items: BugReport[];
	data: BugReport[];
	meta: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPrevPage: boolean;
	};
}

export interface BugStats {
	abierto: number;
	en_revision: number;
	resuelto: number;
	descartado: number;
	total: number;
}

export interface CrearBugReportInput {
	titulo: string;
	descripcion: string;
	severidad: BugSeveridad;
	pagina?: string;
	modulo?: string;
	archivos?: File[];
}

/** Tope de adjuntos, en espejo con `MAX_ADJUNTOS` del backend. */
export const MAX_ADJUNTOS = 5;

class BugReportService {
	async crear(input: CrearBugReportInput): Promise<BugReport> {
		const form = new FormData();
		form.append('titulo', input.titulo);
		form.append('descripcion', input.descripcion);
		form.append('severidad', input.severidad);
		if (input.pagina) form.append('pagina', input.pagina);
		if (input.modulo) form.append('modulo', input.modulo);
		for (const archivo of input.archivos ?? []) {
			form.append('archivos', archivo);
		}
		// customTimeout 60s: pueden ser hasta 5 capturas o PDFs.
		return await apiKyC.post<BugReport>('/bug-reports/', form, { customTimeout: 60000 });
	}

	async listar(
		page = 1,
		perPage = 20,
		filtros: { estado?: string; severidad?: string; solo_mios?: boolean } = {}
	): Promise<BugReportListado> {
		const params = new URLSearchParams();
		params.append('page', String(page));
		params.append('per_page', String(perPage));
		if (filtros.estado) params.append('estado', filtros.estado);
		if (filtros.severidad) params.append('severidad', filtros.severidad);
		if (filtros.solo_mios) params.append('solo_mios', 'true');
		return await apiKyC.get<BugReportListado>(`/bug-reports/?${params.toString()}`);
	}

	async stats(): Promise<BugStats> {
		return await apiKyC.get<BugStats>('/bug-reports/stats');
	}

	async detalle(id: string): Promise<BugReport> {
		return await apiKyC.get<BugReport>(`/bug-reports/${id}`);
	}

	/** Solo admin/superadmin. Resolver o descartar exige `respuesta`. */
	async cambiarEstado(id: string, estado: BugEstado, respuesta?: string): Promise<BugReport> {
		return await apiKyC.patch<BugReport>(`/bug-reports/${id}/estado`, { estado, respuesta });
	}

	/** Solo superadmin. */
	async eliminar(id: string): Promise<{ message: string }> {
		return await apiKyC.delete<{ message: string }>(`/bug-reports/${id}`);
	}
}

export const bugReportService = new BugReportService();
