/**
 * F-044 (2026-07-22) · Interfaces del Visor de Errores 500
 *
 * Permiten a admin/superadmin ver los errores 500 que el backend
 * capturó en producción (con TTL 7 días en MongoDB).
 */

/** Item básico del listado de errores. */
export interface ErrorLogItem {
	id: string;
	timestamp: string; // ISO date
	path: string;
	method: string;
	status_code: number;
	error_type: string; // ej: "NameError", "ValueError"
	message: string;
	user_email: string | null;
	user_type: string | null; // 'user' | 'student' | 'anonymous' | null
	environment: string; // 'production' | 'staging' | 'development'
}

/** Item con detalle completo (incluye stack_trace, request_body, query_params). */
export interface ErrorLogDetail extends ErrorLogItem {
	stack_trace: string | null;
	request_body: string | null;
	query_params: string | null;
}

/** Path con conteo de errores (para stats.top_paths). */
export interface TopPathStat {
	path: string;
	count: number;
}

/** Estadísticas agregadas de la lista de errores. */
export interface ErrorLogStats {
	by_type: Record<string, number>; // ej: { "NameError": 3, "ValueError": 1 }
	by_status: Record<string, number>; // ej: { "500": 4 }
	top_paths: TopPathStat[];
}

/** Respuesta del endpoint GET /admin/errors/recent. */
export interface ErrorLogsListResponse {
	total: number;
	items: ErrorLogItem[];
	stats: ErrorLogStats;
}
