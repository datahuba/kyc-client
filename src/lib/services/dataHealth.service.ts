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
		// R35-FASE-3 FIX: NO incluir /api/v1/ en el path porque apiKyC ya tiene
		// baseURL=/api/api/v1/. Antes tenia /api/v1/admin/data-health que daba
		// la URL final /api/api/v1/api/v1/admin/data-health (404 en nginx).
		const url = qs ? `/admin/data-health?${qs}` : `/admin/data-health`;
		const res = await apiKyC.get<DataHealthResponse>(url);
		return res.data;
	}

	async fixInconsistencia(accion: string, payload: DataHealthFixRequest): Promise<DataHealthFixResponse> {
		const res = await apiKyC.post<DataHealthFixResponse>(`/admin/data-health/fix/${accion}`, payload);
		return res.data;
	}
}

export const dataHealthService = new DataHealthService();
