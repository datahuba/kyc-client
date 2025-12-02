import { apiKyC } from '$lib/config';
import type { LoginCredentials, LoginResponse, UserResponse } from '$lib/interfaces';

class AuthService {
	// Método para login
 async login(credentials: LoginCredentials): Promise<LoginResponse> {
		const response = await apiKyC.postPublic<LoginResponse>('/auth/login', credentials);
		return response;
	}

	// Método para login de estudiantes
	async loginStudent(credentials: LoginCredentials): Promise<LoginResponse> {
		const response = await apiKyC.postPublic<LoginResponse>('/auth/login/student', credentials);
		return response;
	}

	// Método para obtener usuario actual
	async getMe(): Promise<UserResponse> {
		const response = await apiKyC.get<UserResponse>('/auth/me');
		return response;
	}
}

export const authService = new AuthService();