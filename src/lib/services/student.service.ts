import { apiKyC } from '$lib/config';
import type {
	Student,
	CreateStudentRequest,
	UpdateStudentRequest,
	TituloData,
	VerifyTituloData
} from '$lib/interfaces';

class StudentService {
	async getAll(skip = 0, limit = 100): Promise<Student[]> {
		return await apiKyC.get<Student[]>(`/students/?skip=${skip}&limit=${limit}`);
	}

	async getById(id: string): Promise<Student> {
		return await apiKyC.get<Student>(`/students/${id}`);
	}

	async create(data: CreateStudentRequest): Promise<Student> {
		return await apiKyC.post<Student>('/students/', data);
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

	async changePassword(data: import('$lib/interfaces').ChangePasswordRequest): Promise<void> {
		return await apiKyC.post<void>('/students/me/change-password', data);
	}
}

export const studentService = new StudentService();
