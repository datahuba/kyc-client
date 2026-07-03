import { apiKyC } from '$lib/config';
import type {
	Student,
	CreateStudentRequest,
	UpdateStudentRequest,
	TituloData,
	VerifyTituloData,
	ChangePasswordRequest,
	PaginatedResponse,
	UpdateStudentSelfRequest
} from '$lib/interfaces';

class StudentService {
	async getAll(
		page = 1,
		per_page = 10,
		filters?: {
			q?: string;
			activo?: boolean;
			estado_titulo?: string;
			curso_id?: string;
		}
	): Promise<PaginatedResponse<Student>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});

		if (filters?.q) params.append('q', filters.q);
		if (filters?.activo !== undefined) params.append('activo', filters.activo.toString());
		if (filters?.estado_titulo) params.append('estado_titulo', filters.estado_titulo);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);

		return await apiKyC.get<PaginatedResponse<Student>>(`/students/?${params.toString()}`);
	}

	async getById(id: string): Promise<Student> {
		return await apiKyC.get<Student>(`/students/${id}`);
	}

	async create(data: CreateStudentRequest): Promise<Student> {
		return await apiKyC.post<Student>('/students/', data);
	}

    // ISSUE G: Añadido selector de tipo de estudiante
    // NUEVO: cursoId opcional para auto-inscribir a los estudiantes importados a un curso/diplomado
    async importFromExcel(
        file: File,
        tipoEstudiante: 'interno' | 'externo',
        cursoId?: string
    ): Promise<{ success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[] }> {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('tipo_estudiante', tipoEstudiante);
        if (cursoId) {
            formData.append('curso_id', cursoId);
        }
        return await apiKyC.post<{ success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[] }>(
            '/students/import/excel', 
            formData, 
            { customTimeout: 120000 }
        );
    }

    // ISSUE H: Botón rápido de cambio de tipo
    async toggleTipoEstudiante(id: string, tipo: 'interno' | 'externo'): Promise<Student> {
        return await apiKyC.patch<Student>(`/students/${id}/toggle-tipo`, { tipo });
    }

    async bulkDelete(ids: string[]): Promise<{ message: string; deleted_count: number }> {
		return await apiKyC.post<{ message: string; deleted_count: number }>('/students/bulk-delete', { ids });
	}

	async update(id: string, data: UpdateStudentRequest): Promise<Student> {
		return await apiKyC.put<Student>(`/students/${id}`, data);
	}

	async delete(id: string): Promise<Student> {
		return await apiKyC.delete<Student>(`/students/${id}`);
	}

	async uploadPhoto(id: string, file: File): Promise<Student> {
		const formData = new FormData();
		formData.append('file', file);
		return await apiKyC.post<Student>(`/students/${id}/upload/photo`, formData);
	}

	async uploadCV(id: string, file: File): Promise<Student> {
		const formData = new FormData();
		formData.append('file', file);
		return await apiKyC.post<Student>(`/students/${id}/upload/cv`, formData);
	}

	async uploadCarnet(id: string, file: File): Promise<Student> {
		const formData = new FormData();
		formData.append('file', file);
		return await apiKyC.post<Student>(`/students/${id}/upload/carnet`, formData);
	}

	async uploadAfiliacion(id: string, file: File): Promise<Student> {
		const formData = new FormData();
		formData.append('file', file);
		return await apiKyC.post<Student>(`/students/${id}/upload/afiliacion`, formData);
	}

	async uploadTitulo(id: string, file: File, data: TituloData): Promise<Student> {
		const formData = new FormData();
		formData.append('file', file);
		formData.append('titulo', data.titulo);
		formData.append('numero_titulo', data.numero_titulo);
		formData.append('año_expedicion', data.año_expedicion);
		formData.append('universidad', data.universidad);
		return await apiKyC.post<Student>(`/students/${id}/upload/titulo`, formData);
	}

	async verifyTitulo(id: string, data: VerifyTituloData): Promise<Student> {
		// Convertir VerifyTituloData a URLSearchParams para x-www-form-urlencoded
		const params = new URLSearchParams();
		if (data.titulo) params.append('titulo', data.titulo);
		if (data.numero_titulo) params.append('numero_titulo', data.numero_titulo);
		if (data.año_expedicion) params.append('año_expedicion', data.año_expedicion);
		if (data.universidad) params.append('universidad', data.universidad);

		return await apiKyC.put<Student>(`/students/${id}/titulo/verificar`, params, {
			customHeaders: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});
	}

	async rejectTitulo(id: string, motivo: string): Promise<Student> {
		const params = new URLSearchParams();
		params.append('motivo', motivo);

		return await apiKyC.put<Student>(`/students/${id}/titulo/rechazar`, params, {
			customHeaders: {
				'Content-Type': 'application/x-www-form-urlencoded'
			}
		});
	}

	async changePassword(data: ChangePasswordRequest, isStudent: boolean = true): Promise<void> {
		// Encaminamiento dinámico de contraseñas: Alumno vs Personal Administrativo (Bug 5)
		const endpoint = isStudent ? '/students/me/change-password' : '/users/me/change-password';
		try {
			return await apiKyC.post<void>(endpoint, data);
		} catch (error: any) {
			// Si la petición fue exitosa (200) pero el parseador de JSON del cliente arrojó un error (texto plano en docentes)
			if (
				error.status === 200 || 
				error.response?.status === 200 || 
				error.message === 'Error en la solicitud' || 
				error.message?.includes('JSON') || 
				error.message?.includes('SyntaxError')
			) {
				return;
			}
			throw error;
		}
	}

	async updateSelf(data: UpdateStudentSelfRequest): Promise<Student> {
		return await apiKyC.put<Student>('/students/me', data);
	}
}

export const studentService = new StudentService();
