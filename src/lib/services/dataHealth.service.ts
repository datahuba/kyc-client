// R35-FASE-3: service para el reporte de salud de datos
import { apiKyC } from '$lib/config';
import type { DataHealthResponse, DataHealthFixRequest, DataHealthFixResponse } from '$lib/interfaces/dataHealth.interface';

class DataHealthService {
	async getDataHealth(params?: Record<string, string>): Promise<DataHealthResponse> {
		const queryParams = new URLSearchParams();
		if (params) {
			Object.entries(params).forEach(([k, v]) => {
				if (v) queryParams.set(k, v);
			});
		}
		const qs = queryParams.toString();
		// NOTA: NO incluir /api/v1/ en el path. apiKyC ya tiene baseURL con prefijo
		// y concatena /api/v1. Path final esperado por nginx: /api/api/v1/admin/data-health
		const url = qs ? `/admin/data-health?${qs}` : `/admin/data-health`;
		// apiKyC.get retorna el JSON directo (NO es axios, no usar res.data)
		return await apiKyC.get<DataHealthResponse>(url);
	}

	async fixInconsistencia(accion: string, payload: DataHealthFixRequest): Promise<DataHealthFixResponse> {
		// F-FIX-TIMEOUT-60S-HEALTH (2026-08-09, Kevin): las acciones de fix pueden
		// hacer N saves en el backend (cambiar_a_activo, reclasificar, etc) y con
		// muchas inscripciones tardan >30s. customTimeout 60s.
		return await apiKyC.post<DataHealthFixResponse>(`/admin/data-health/fix/${accion}`, payload, { customTimeout: 60000 });
	}
}

export const dataHealthService = new DataHealthService();
