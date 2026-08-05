import { apiKyC } from '$lib/config';

// F-DASHBOARD-POR-PROGRAMA (2026-08-05, Kevin): nuevo campo
// `courseBreakdown` agregado al interface para reflejar el response
// del backend. Cada curso tiene 4 indicadores financieros
// (ingreso_matricula, ingreso_colegiatura, total_ingresos, por_cobrar)
// y metadata (codigo, nombre, tipo, modalidad, estado, activo, inscritos).
export interface DashboardCourseBreakdown {
	id: string;
	codigo: string;
	nombre: string;
	tipo: string;
	modalidad: string;
	estado?: string;
	activo: boolean;
	inscritos: number;
	ingreso_matricula: number;
	ingreso_colegiatura: number;
	total_ingresos: number;
	por_cobrar: number;
}

export interface DashboardStats {
	students: {
		total: number;
		active: number;
	};
	courses: {
		total: number;
		active: number;
	};
	enrollments: {
		total: number;
		active: number;
	};
	payments: {
		total: number;
		pending: number;
		revenue: number;
	};
	courseBreakdown?: DashboardCourseBreakdown[];
}

class DashboardService {
	async getStats(): Promise<DashboardStats> {
		return await apiKyC.get<DashboardStats>('/dashboard/stats');
	}
}

export const dashboardService = new DashboardService();
