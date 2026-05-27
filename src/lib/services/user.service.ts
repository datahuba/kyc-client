import { apiKyC } from '../config/apiKyC.config';
import type { User, CreateUserRequest, UpdateUserRequest } from '../interfaces';

type UserPayload = Omit<Partial<CreateUserRequest>, 'role'> & {
	rol?: CreateUserRequest['role'];
};

function toBackendPayload(data: CreateUserRequest | UpdateUserRequest): UserPayload {
	const { role, ...rest } = data;
	return role !== undefined
		? {
				...rest,
				rol: role
			}
		: rest;
}

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

	async getTeachers(): Promise<User[]> {
		return apiKyC.get<User[]>('/users/teachers');
	}

	async getById(id: string): Promise<User> {
		return apiKyC.get<User>(`/users/${id}`);
	}

	async create(data: CreateUserRequest): Promise<User> {
		return apiKyC.post<User>('/users/', toBackendPayload(data));
	}

	async update(id: string, data: UpdateUserRequest): Promise<User> {
		return apiKyC.put<User>(`/users/${id}`, toBackendPayload(data));
	}

	async delete(id: string): Promise<User> {
		return apiKyC.delete<User>(`/users/${id}`);
	}
}

export const userService = new UserService();
