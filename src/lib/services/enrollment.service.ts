import { apiKyC } from '$lib/config';
import type { Enrollment, CreateEnrollmentRequest, UpdateEnrollmentRequest } from '$lib/interfaces';

class EnrollmentService {
	async getAll(skip = 0, limit = 100): Promise<Enrollment[]> {
		//console.log("entre a traer pagos de admins");
		return await apiKyC.get<Enrollment[]>(`/enrollments/?skip=${skip}&limit=${limit}`);
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

