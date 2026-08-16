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
		pathContains?: string,
		unresolvedOnly: boolean = true
	): Promise<ErrorLogsListResponse> {
		const params = new URLSearchParams();
		params.append('hours', String(hours));
		params.append('limit', String(limit));
		if (statusCode) params.append('status_code', String(statusCode));
		if (pathContains) params.append('path_contains', pathContains);
		// F-XXX (2026-07-29): incluir filtro resolved (default true = solo no resueltos)
		params.append('unresolved_only', String(unresolvedOnly));

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
	 * F-XXX (2026-07-29): marca un error como resuelto.
	 */
	async resolveError(errorId: string, note?: string): Promise<any> {
		return await apiKyC.post<any>(`/admin/errors/${errorId}/resolve`, { note: note || '' });
	}

	// F-FIX-CONTRATO (2026-08-16): se elimino `unresolveError()`. Apuntaba a
	// POST /admin/errors/{id}/unresolve, endpoint que NO existe en el backend:
	// desde F-ERROR-VIEWER-FIX (2026-07-31) resolver un error hace HARD DELETE,
	// asi que reabrirlo dejo de tener sentido y el boton "Reabrir" ya se habia
	// quitado de la UI. El metodo quedo huerfano apuntando a un 404.

	/**
	 * F-XXX (2026-07-29): auto-resuelve todos los errores que matcheen el
	 * patrón regex en su mensaje. Útil para limpiar el visor de errores
	 * esperados (401 de token expirado, 422 de JSON inválido, etc).
	 */
	async autoResolveErrors(
		hours: number = 168,
		pattern: string = 'Token.*inválido|expirado',
		statusCode: number = 401,
		note: string = 'Auto-resuelto: error esperado'
	): Promise<{ resolved_count: number; window_hours: number; pattern: string }> {
		const params = new URLSearchParams();
		params.append('hours', String(hours));
		params.append('pattern', pattern);
		if (statusCode > 0) params.append('status_code', String(statusCode));
		params.append('note', note);
		// F-FIX-TIMEOUT-60S-ADMIN (2026-08-09, Kevin): auto-resolve puede iterar
		// sobre N errores. customTimeout 60s.
		return await apiKyC.post<{ resolved_count: number; window_hours: number; pattern: string }>(
			`/admin/errors/auto-resolve-expired-tokens?${params.toString()}`,
			{},
			{ customTimeout: 60000 }
		);
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
