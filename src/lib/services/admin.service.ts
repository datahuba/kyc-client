/**
 * F-044 (2026-07-22) · Service para endpoints de admin
 *
 * Incluye el visor de errores 500 que permite a admin/superadmin
 * ver los errores capturados en producción (con TTL 7 días).
 */

import { apiKyC } from '$lib/config';
import type {
	ErrorLogItem,
	ErrorLogDetail,
	ErrorLogsListResponse,
} from '$lib/interfaces';

class AdminService {
	/**
	 * Lista los errores 500 capturados en las últimas N horas.
	 *
	 * @param hours Ventana de tiempo en horas (default 24, max 168 = 7 días)
	 * @param limit Máximo de errores a retornar (default 100, max 500)
	 * @param statusCode Filtrar por status code específico (ej: 500)
	 * @param pathContains Filtrar por substring del path
	 */
	async getRecentErrors(
		hours: number = 24,
		limit: number = 100,
		statusCode?: number,
		pathContains?: string
	): Promise<ErrorLogsListResponse> {
		const params = new URLSearchParams();
		params.append('hours', String(hours));
		params.append('limit', String(limit));
		if (statusCode) params.append('status_code', String(statusCode));
		if (pathContains) params.append('path_contains', pathContains);

		return await apiKyC.get<ErrorLogsListResponse>(
			`/admin/errors/recent?${params.toString()}`
		);
	}

	/**
	 * Obtiene el detalle completo de un error (con stack_trace y body).
	 */
	async getErrorDetail(errorId: string): Promise<ErrorLogDetail> {
		return await apiKyC.get<ErrorLogDetail>(`/admin/errors/${errorId}`);
	}

	/**
	 * Borra errores antiguos. Solo superadmin.
	 */
	async clearOldErrors(hours: number = 168): Promise<{ deleted: number; cutoff: string }> {
		return await apiKyC.delete<{ deleted: number; cutoff: string }>(
			`/admin/errors/clear?hours=${hours}`
		);
	}
}

export const adminService = new AdminService();
