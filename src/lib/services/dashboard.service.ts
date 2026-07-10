import { apiKyC } from '$lib/config';

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
}

class DashboardService {
	async getStats(): Promise<DashboardStats> {
		return await apiKyC.get<DashboardStats>('/dashboard/stats');
	}
}

export const dashboardService = new DashboardService();
