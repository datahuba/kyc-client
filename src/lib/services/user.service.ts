import { apiKyC } from '../config/apiKyC.config';
import type { User, CreateUserRequest, UpdateUserRequest } from '../interfaces';

class UserService {
	async getAll(skip: number = 0, limit: number = 100): Promise<User[]> {
		return apiKyC.get<User[]>(`/users/?skip=${skip}&limit=${limit}`);
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
