import { apiKyC } from '$lib/config';
import type { Enrollment, CreateEnrollmentRequest, UpdateEnrollmentRequest } from '$lib/interfaces';

class EnrollmentService {
	async getAll(
		page = 1,
		per_page = 10,
		filters?: {
			q?: string;
			estado?: string;
			curso_id?: string;
			estudiante_id?: string;
		}
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<Enrollment>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});

		if (filters?.q) params.append('q', filters.q);
		if (filters?.estado) params.append('estado', filters.estado);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);

		return await apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<Enrollment>>(
			`/enrollments/?${params.toString()}`
		);
	}

	async create(data: CreateEnrollmentRequest): Promise<Enrollment> {
		return await apiKyC.post<Enrollment>('/enrollments/', data);
	}

	async update(id: string, data: UpdateEnrollmentRequest): Promise<Enrollment> {
		return await apiKyC.put<Enrollment>(`/enrollments/${id}`, data);
	}

	async delete(id: string): Promise<Enrollment> {
		return await apiKyC.delete<Enrollment>(`/enrollments/${id}`);
	}

	async getByStudentId(studentId: string): Promise<Enrollment[]> {
		//console.log("entre a traer pagos de students");
		return await apiKyC.get<Enrollment[]>(`/enrollments/student/${studentId}`);
	}

	async getByCourseId(courseId: string): Promise<Enrollment[]> {
		return await apiKyC.get<Enrollment[]>(`/enrollments/course/${courseId}`);
	}
}

export const enrollmentService = new EnrollmentService();

