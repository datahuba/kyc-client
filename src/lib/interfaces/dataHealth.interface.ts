// R35-FASE-3: interfaces para el reporte de salud de datos
export interface DataHealthInconsistencia {
	tipo: string;
	severidad: 'critica' | 'alta' | 'media' | 'baja';
	entidad_tipo: 'enrollment' | 'student' | 'course' | 'pago' | 'discount' | 'user';
	entidad_id: string;
	estudiante_nombre?: string | null;
	programa_id?: string | null;
	programa_codigo?: string | null;
	descripcion: string;
	accion_sugerida?: string;
	metadata?: Record<string, any>;
}

export interface DataHealthKPIs {
	criticas: number;
	altas: number;
	medias: number;
	bajas: number;
	total: number;
	por_tipo?: Record<string, number>;
}

export interface DataHealthFiltros {
	programas: { id: string; codigo: string; nombre: string; inscritos: number }[];
	tipos: { tipo: string; titulo: string; severidad: string; icono: string }[];
	severidades: string[];
	acciones_disponibles: string[];
}

export interface DataHealthResponse {
	kpis: DataHealthKPIs;
	kpis_filtrados?: DataHealthKPIs;
	inconsistencias: DataHealthInconsistencia[];
	filtros: DataHealthFiltros;
	programas_evaluados: number;
	checks_ejecutados: number;
	errores_checks: string[];
	timestamp: string;
	_version: string;
	_cache_ttl_s: number;
}

export interface DataHealthFixRequest {
	entidad_id: string;
	metadata?: Record<string, any>;
	motivo?: string;
	decision?: string;
	porcentaje?: number;
}

export interface DataHealthFixResponse {
	ok: boolean;
	message: string;
	mantenido?: string;
}
