import { apiKyC } from '$lib/config';
import type { Student, CreateStudentRequest, UpdateStudentRequest } from '$lib/interfaces';

class StudentService {
	async getAll(skip = 0, limit = 100): Promise<Student[]> {
		return await apiKyC.get<Student[]>(`/students/?skip=${skip}&limit=${limit}`);
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
}

export const studentService = new StudentService();
