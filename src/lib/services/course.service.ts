import { apiKyC } from '$lib/config';
import type { Course, CreateCourseRequest, UpdateCourseRequest } from '$lib/interfaces';

class CourseService {
	async getAll(skip = 0, limit = 100): Promise<Course[]> {
		return await apiKyC.get<Course[]>(`/courses/?skip=${skip}&limit=${limit}`);
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
}

export const courseService = new CourseService();
