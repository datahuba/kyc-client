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

	/**
	 * F-FIX-CONTRATO-UPLOADCV (2026-08-16): la ruta era `/users/{id}/cv`, que
	 * NO existe en el backend — el endpoint real es `/users/{id}/cv/upload`
	 * (ver api/users.py). Toda subida de CV de docente devolvía 404: tanto la
	 * del propio docente desde /app/profile como la que hace el staff desde
	 * /app/teachers. Detectado auditando el contrato frontend↔backend.
	 */
	async uploadCV(id: string, file: File): Promise<User> {
		const formData = new FormData();
		formData.append('file', file);
		return apiKyC.post<User>(`/users/${id}/cv/upload`, formData);
	}
}

export const userService = new UserService();
