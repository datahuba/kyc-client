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

	// ============================================================================
	// F-080 · Calendario de programas + estado
	// ============================================================================

	/**
	 * F-080: Obtiene el calendario de programas (todos los estados, ordenados
	 * cronológicamente). Pensado para alimentar la vista Timeline/Lista del
	 * sidebar de administrativos.
	 */
	async getCalendario(
		year?: number,
		filters?: { tipo_curso?: string; estado?: string }
	): Promise<{
		success: boolean;
		year: number | null;
		total: number;
		items: CalendarioItem[];
	}> {
		const params = new URLSearchParams();
		if (year !== undefined && year !== null) params.append('year', year.toString());
		if (filters?.tipo_curso) params.append('tipo_curso', filters.tipo_curso);
		if (filters?.estado) params.append('estado', filters.estado);
		return await apiKyC.get(`/courses/calendario?${params.toString()}`);
	}

	/**
	 * F-080: Cursos en los que un estudiante PODRÍA pedir inscripción
	 * (PROGRAMADO + EN_EJECUCION, sin CERRADOS). El dashboard del estudiante
	 * consume este endpoint.
	 */
	async getDisponibles(): Promise<{
		success: boolean;
		total: number;
		items: CursoDisponible[];
	}> {
		return await apiKyC.get('/courses/disponibles');
	}

	/**
	 * F-080: Cambia el override manual del estado de un programa. Solo CPD.
	 * `estado_override` puede ser null (volver al cálculo automático) o
	 * uno de: 'programado', 'en_ejecucion', 'cerrado'.
	 */
	async cambiarEstadoOverride(
		courseId: string,
		estadoOverride: string | null
	): Promise<Course> {
		return await apiKyC.patch<Course>(`/courses/${courseId}/estado`, {
			estado_override: estadoOverride
		});
	}

	/**
	 * F-080: Sube el PDF de la resolución de respaldo del programa.
	 */
	async subirResolucion(courseId: string, file: File): Promise<Course> {
		const form = new FormData();
		form.append('file', file);
		return await apiKyC.post<Course>(`/courses/${courseId}/resolucion`, form);
	}
}

// ============================================================================
// F-080 · Tipos para calendario y cursos disponibles
// ============================================================================

export interface CalendarioItem {
	id: string;
	codigo: string;
	nombre_programa: string;
	tipo_curso: string;
	modalidad: string;
	fecha_inicio: string | null;
	fecha_fin: string | null;
	estado_calculado: 'programado' | 'en_ejecucion' | 'cerrado';
	estado_override: string | null;
	resolucion_pdf_url: string | null;
	activo: boolean;
	costo_total_interno: number;
	matricula_interno: number;
	cantidad_modulos: number;
	cantidad_inscritos: number;
}

export interface CursoDisponible {
	id: string;
	codigo: string;
	nombre_programa: string;
	tipo_curso: string;
	modalidad: string;
	fecha_inicio: string | null;
	fecha_fin: string | null;
	estado_calculado: 'programado' | 'en_ejecucion' | 'cerrado';
	costo_total_interno: number;
	matricula_interno: number;
	cantidad_modulos: number;
}

export const courseService = new CourseService();
