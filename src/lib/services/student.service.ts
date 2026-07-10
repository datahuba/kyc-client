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

    // cursoId opcional para auto-inscribir a los estudiantes importados a un curso/diplomado
    async importFromExcel(
        file: File,
        cursoId?: string
    ): Promise<{ success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[]; marcados_por_color: Record<string, string[]> }> {
        const formData = new FormData();
        formData.append('file', file);
        if (cursoId) {
            formData.append('curso_id', cursoId);
        }
        // ISSUE-Q-IMPORT-TIMEOUT (2026-07-09): el backend redujo el tiempo real de
        // importación con auto-inscripción de ~2s/estudiante a ~0.27s/estudiante
        // (paralelización controlada + batching de referencias cruzadas, ver
        // student_service.import_students_from_excel). Aun así se alinea este
        // timeout con el límite de 180s ya configurado en nginx (proxy_read_timeout)
        // como colchón adicional para lotes más grandes a futuro.
        return await apiKyC.post<{ success_count: number; enrolled_count: number; migrated_payments_count: number; matricula_vouchers_count: number; errors: string[]; marcados_por_color: Record<string, string[]> }>(
            '/students/import/excel', 
            formData, 
            { customTimeout: 180000 }
        );
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

	// ISSUE-Q-PRE: aceptación del reglamento de Posgrado en el primer login
	async acceptTerms(): Promise<Student> {
		return await apiKyC.post<Student>('/students/me/accept-terms', {});
	}

	// ISSUE-P-RECORDATORIO-PAGO: Cobranza envía un recordatorio de pago manual al estudiante
	async enviarRecordatorioPago(
		id: string,
		mensaje: string
	): Promise<{ success: boolean; notificacion_in_app: boolean; email_enviado: boolean; detail: string }> {
		return await apiKyC.post<{ success: boolean; notificacion_in_app: boolean; email_enviado: boolean; detail: string }>(
			`/students/${id}/recordatorio-pago`,
			{ mensaje }
		);
	}
}

export const studentService = new StudentService();
