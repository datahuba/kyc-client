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

	// ISSUE-A-VERIFICACION: confirma el correo con el token recibido (público, sin auth)
	async verifyEmail(token: string): Promise<{ message: string }> {
		return await apiKyC.postPublic<{ message: string }>('/auth/verify-email', { token });
	}

	// ISSUE-A-VERIFICACION: el usuario logueado pide un nuevo correo de verificación
	async resendVerification(): Promise<{ message: string; enviado?: boolean }> {
		return await apiKyC.post<{ message: string }>('/auth/resend-verification', {});
	}
}

export const authService = new AuthService();