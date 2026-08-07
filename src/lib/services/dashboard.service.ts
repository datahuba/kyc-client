import { apiKyC } from '$lib/config';
import type { ResumenEconomico } from './payment.service';
import type { CxCResumenReducido } from './cuentas-por-cobrar.service';
import type { EnrollmentResumen } from '$lib/interfaces/enrollment.interface';

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

// F-PERF-DASHBOARD-V2 (2026-08-06, Kevin): interface para el response
// consolidado del endpoint /dashboard/v2. Reemplaza 9 llamadas en paralelo
// (students, courses, enrollments, payments, dashboard/stats, payments/resumen-economico,
//  enrollments/stats/resumen, cuentas-por-cobrar/resumen-reducido, pending docs)
// con 1 sola llamada. Cold ~1-2s vs 8.6s anterior, hot < 50ms.
export interface DashboardV2Response {
	stats: DashboardStats;
	courseBreakdown: DashboardCourseBreakdown[];
	resumenInscritos: EnrollmentResumen;
	resumenEconomico: ResumenEconomico;
	cxcResumen: CxCResumenReducido;
	recentEnrollments: Array<{
		_id: string;
		estudiante_id: string;
		curso_id: string;
		estado: string;
		created_at: string | null;
		studentName: string;
		courseName: string;
	}>;
	recentPayments: Array<{
		_id: string;
		estudiante_id: string;
		curso_id: string;
		cantidad_pago: number;
		concepto: string;
		estado_pago: string;
		created_at: string | null;
		studentName: string;
		courseName: string;
	}>;
	pendingDocumentsCount: number;
	_version: string;
	_cache_ttl_s: number;
}

class DashboardService {
	async getStats(): Promise<DashboardStats> {
		return await apiKyC.get<DashboardStats>('/dashboard/stats');
	}

	// F-PERF-DASHBOARD-V2 (2026-08-06, Kevin): 1 sola llamada que devuelve
	// TODO lo que el dashboard necesita. Reemplaza 9 llamadas paralelas.
	async getV2(): Promise<DashboardV2Response> {
		return await apiKyC.get<DashboardV2Response>('/dashboard/v2');
	}
}

export const dashboardService = new DashboardService();
