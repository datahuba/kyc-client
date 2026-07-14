import { apiKyC } from '$lib/config';
import type { Course, CreateCourseRequest, UpdateCourseRequest } from '$lib/interfaces';

class CourseService {
	async getById(id: string): Promise<Course> {
		return await apiKyC.get<Course>(`/courses/${id}`);
	}

	async getAll(
		page = 1,
		per_page = 10,
		filters?: {
			q?: string;
			activo?: boolean;
			tipo_curso?: string;
			modalidad?: string;
		}
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<Course>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});

		if (filters?.q) params.append('q', filters.q);
		if (filters?.activo !== undefined) params.append('activo', filters.activo.toString());
		if (filters?.tipo_curso) params.append('tipo_curso', filters.tipo_curso);
		if (filters?.modalidad) params.append('modalidad', filters.modalidad);

		return await apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<Course>>(
			`/courses/?${params.toString()}`
		);
	}

	async create(data: CreateCourseRequest): Promise<Course> {
		return await apiKyC.post<Course>('/courses/', data);
	}

	async update(id: string, data: UpdateCourseRequest): Promise<Course> {
		return await apiKyC.put<Course>(`/courses/${id}`, data);
	}

	async delete(id: string): Promise<Course> {
		return await apiKyC.delete<Course>(`/courses/${id}`);
	}

	async getStudents(id: string): Promise<import('$lib/interfaces').CourseStudent[]> {
		return await apiKyC.get<import('$lib/interfaces').CourseStudent[]>(`/courses/${id}/students`);
	}

	// ISSUE R: Endpoint para obtener módulos asignados a un docente específico
	async getModulesByTeacher(teacherId: string): Promise<any[]> {
		return await apiKyC.get<any[]>(`/courses/modules/by-teacher/${teacherId}`);
	}

	// Comunicado por correo a todos los estudiantes del programa (Encargado/CPD)
	async enviarComunicado(
		courseId: string,
		data: { asunto: string; mensaje: string }
	): Promise<{ success: boolean; total_estudiantes: number; correos_enviados: number; detail: string }> {
		return await apiKyC.post(`/courses/${courseId}/comunicado`, data);
	}

	async assignEncargados(courseId: string, encargadosIds: string[]): Promise<{ success: boolean; detail: string }> {
		return await apiKyC.put(`/courses/${courseId}/encargados`, { encargados_ids: encargadosIds });
	}
}

export const courseService = new CourseService();
