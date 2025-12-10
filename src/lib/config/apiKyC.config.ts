import { ErrorType } from '$lib/interfaces';
import { AppError, errorService } from '$lib/services';
import { API_CONFIG, defaultHeaders } from './api.config';
import { browser } from '$app/environment';
import { AUTH_TOKEN_KEY } from '$lib/constants';

interface RequestOptions {
	requireAuth?: boolean;
	customHeaders?: HeadersInit;
}

class ApiKyC {
	// Método para construir headers con autenticación
	private buildHeaders(options: RequestOptions = {}): HeadersInit {
		const headers: HeadersInit = { ...defaultHeaders };

		// Agregar headers customizados si existen
		if (options.customHeaders) {
			Object.assign(headers, options.customHeaders);
		}

		// Agregar token de autorización si es requerido
		if (options.requireAuth !== false) {
			// Por defecto requiere auth
			const token = browser ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
			if (token) {
				(headers as Record<string, string>).Authorization = `Bearer ${token}`;
			} else if (options.requireAuth === true) {
				// Si explícitamente requiere auth y no hay token, lanzar error
				throw new AppError('Token de autenticación requerido', ErrorType.AUTHENTICATION, 401);
			}
		}

		return headers;
	}

	// Método genérico para solicitudes
	private async request<T>(
		endpoint: string,
		method: string,
		data?: unknown,
		options: RequestOptions = {}
	): Promise<T> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);

		try {
			const isFormData = data instanceof FormData;
			const isUrlSearchParams = data instanceof URLSearchParams;
			const headers = this.buildHeaders(options);

			if (isFormData) {
				// Al enviar FormData, el navegador establece automáticamente el Content-Type con el boundary correcto
				// por lo que debemos eliminar el Content-Type: application/json por defecto
				const headersObj = headers as Record<string, string>;
				delete headersObj['Content-Type'];
			}

			const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1${endpoint}`, {
				method,
				headers,
				body: isFormData || isUrlSearchParams ? (data as BodyInit) : data ? JSON.stringify(data) : undefined,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			// Manejar respuesta 204 (No Content)
			if (response.status === 204) {
				return {} as T;
			}

			// Manejar errores de respuesta
			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({}));
				const errorType = errorService.mapHttpToErrorType(response.status);

				// Si es error 401, limpiar token
				if (response.status === 401) {
					if (browser) {
						localStorage.removeItem('auth_token');
						localStorage.removeItem('user_data');
					}
				}

				throw new AppError(
					errorBody.message || 'Error en la solicitud',
					errorType,
					response.status
				);
			}

			return response.json();
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AppError('Solicitud cancelada por timeout', ErrorType.NETWORK, 408);
			}

			if (error instanceof AppError) {
				throw error; // Re-throw AppError sin modificar
			}

			throw new AppError(
				'Error de red',
				ErrorType.NETWORK,
				undefined,
				error instanceof Error ? error : undefined
			);
		}
	}

	// Métodos para diferentes tipos de solicitudes
	async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(endpoint, 'GET', undefined, options);
	}

	async post<T>(endpoint: string, data: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(endpoint, 'POST', data, options);
	}

	async put<T>(endpoint: string, data: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(endpoint, 'PUT', data, options);
	}

	async patch<T>(endpoint: string, data: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(endpoint, 'PATCH', data, options);
	}

	async delete<T>(endpoint: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
		return this.request<T>(endpoint, 'DELETE', data, options);
	}

	// Métodos específicos para endpoints que no requieren autenticación
	async getPublic<T>(endpoint: string): Promise<T> {
		return this.get<T>(endpoint, { requireAuth: false });
	}

	async postPublic<T>(endpoint: string, data: unknown): Promise<T> {
		return this.post<T>(endpoint, data, { requireAuth: false });
	}
}

export const apiKyC = new ApiKyC();
