import { apiKyC } from '../config/apiKyC.config';
import type { User, CreateUserRequest, UpdateUserRequest } from '../interfaces';

class UserService {
	async getAll(
		page = 1,
		per_page = 10
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<User>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});
		return apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<User>>(
			`/users/?${params.toString()}`
		);
	}

	async getById(id: string): Promise<User> {
		return apiKyC.get<User>(`/users/${id}`);
	}

	async create(data: CreateUserRequest): Promise<User> {
		return apiKyC.post<User>('/users/', data);
	}

	async update(id: string, data: UpdateUserRequest): Promise<User> {
		return apiKyC.put<User>('/users/${id}', data);
	}

	async delete(id: string): Promise<User> {
		return apiKyC.delete<User>(`/users/${id}`);
	}
}

export const userService = new UserService();
