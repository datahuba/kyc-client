import { ErrorType } from '$lib/interfaces';
import { AppError, errorService } from '$lib/services';
import { API_CONFIG, defaultHeaders } from './api.config';
import { browser } from '$app/environment';
import { AUTH_TOKEN_KEY, USER_DATA_KEY, AUTH_TOKEN_EXPIRY_KEY } from '$lib/constants';

interface RequestOptions {
	requireAuth?: boolean;
	customHeaders?: HeadersInit;
	customTimeout?: number; // ISSUE J: Permitir sobreescribir el timeout en llamadas pesadas
}

function extractErrorMessage(errorBody: unknown): string {
	if (!errorBody || typeof errorBody !== 'object') {
		return 'Error en la solicitud';
	}

	const body = errorBody as {
		message?: string;
		detail?: string | Array<{ msg?: string } | string>;
	};

	if (typeof body.message === 'string' && body.message.trim()) {
		return body.message;
	}

	if (typeof body.detail === 'string' && body.detail.trim()) {
		return body.detail;
	}

	if (Array.isArray(body.detail) && body.detail.length > 0) {
		const firstDetail = body.detail[0];
		if (typeof firstDetail === 'string' && firstDetail.trim()) {
			return firstDetail;
		}
		if (
			typeof firstDetail === 'object' &&
			firstDetail !== null &&
			typeof firstDetail.msg === 'string' &&
			firstDetail.msg.trim()
		) {
			return firstDetail.msg;
		}
	}

	return 'Error en la solicitud';
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
		// ISSUE J: Usar timeout customizado si se especifica, de lo contrario usar el por defecto
		const timeoutDuration = options.customTimeout ?? API_CONFIG.TIMEOUT;
		// F-FIX-TIMEOUT-TOAST (2026-08-09, Kevin): distinguir entre cancelacion
		// por timeout real vs cancelacion manual (navegacion, componente
		// desmontado, etc). Antes ambos casos mostraban el mismo toast
		// "Solicitud cancelada por timeout" que era engañoso: si el browser
		// cancelaba una request paralela (ej. refresh de lista al cerrar un
		// modal), el toast parecia un error de la operacion principal cuando
		// en realidad el PUT/POST si se habia aplicado.
		let isTimeout = false;
		const timeoutId = setTimeout(() => {
			isTimeout = true;
			controller.abort();
		}, timeoutDuration);

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

				// Si es error 401, limpiar la sesión con las CLAVES CORRECTAS y re-loguear.
				// (Antes borraba 'auth_token'/'user_data' que no existen: el token vencido
				//  quedaba en localStorage y provocaba un 401 eterno sin redirección.)
				if (response.status === 401 && browser) {
					localStorage.removeItem(AUTH_TOKEN_KEY);
					localStorage.removeItem(USER_DATA_KEY);
					localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);

					// Redirigir al login solo si no estamos ya en una pantalla pública
					const path = window.location.pathname;
					if (!path.startsWith('/auth') && path !== '/') {
						window.location.href = '/auth/sign-in';
					}
				}

				throw new AppError(extractErrorMessage(errorBody), errorType, response.status);
			}

			return response.json();
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof DOMException && error.name === 'AbortError') {
				// F-FIX-TIMEOUT-TOAST (2026-08-09, Kevin): solo mostrar toast
				// de timeout si el timer realmente disparo. Si el browser cancelo
				// la request (navegacion, componente desmontado, race condition
				// con otra request), mostrar un mensaje neutro sin alarma.
				if (isTimeout) {
					throw new AppError('Solicitud cancelada por timeout', ErrorType.NETWORK, 408);
				}
				throw new AppError('Solicitud cancelada', ErrorType.NETWORK, 0);
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

	// F-2026-08-11-CAMPOS-EC-MODALIDAD-FILE: multipart upload sin Content-Type
	// (el browser lo setea automaticamente con el boundary). Funciona con
	// requireAuth: false para endpoints publicos (ej. upload de carta firmada
	// del wizard) o true para endpoints con auth (ej. subir CV del estudiante).
	async postFormData<T>(endpoint: string, form: FormData, options: RequestOptions = {}): Promise<T> {
		const headers = this.buildHeaders(options);
		// Eliminar Content-Type para que el browser ponga el boundary correcto
		const headersObj = headers as Record<string, string>;
		delete headersObj['Content-Type'];

		const controller = new AbortController();
		const timeoutDuration = options.customTimeout ?? API_CONFIG.TIMEOUT;
		const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

		try {
			const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1${endpoint}`, {
				method: 'POST',
				headers,
				body: form,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.status === 204) {
				return {} as T;
			}

			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({}));
				const errorType = errorService.mapHttpToErrorType(response.status);

				if (response.status === 401 && browser) {
					localStorage.removeItem(AUTH_TOKEN_KEY);
					localStorage.removeItem(USER_DATA_KEY);
					localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
					const path = window.location.pathname;
					if (!path.startsWith('/auth') && path !== '/') {
						window.location.href = '/auth/sign-in';
					}
				}

				throw new AppError(extractErrorMessage(errorBody), errorType, response.status);
			}

			return response.json();
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AppError('Solicitud cancelada por timeout', ErrorType.NETWORK, 408);
			}
			if (error instanceof AppError) {
				throw error;
			}
			throw new AppError('Error de red', ErrorType.NETWORK, undefined, error instanceof Error ? error : undefined);
		}
	}

	// F-FIX-PREREGISTROS-VALIDAR-SIN-AUTH (2026-08-19): mismo caso que
	// postFormData pero para PUT — los endpoints de validar titulo/descuento
	// de vicerrectorado (pre-inscripciones) usan multipart PUT y antes se
	// llamaban con fetch() crudo + `credentials: 'include'`. Este backend NO
	// usa cookies de sesion, usa Bearer token (ver buildHeaders arriba), asi
	// que esas llamadas nunca mandaban el token y el backend las rechazaba
	// con 401/403 para CUALQUIER rol, no solo encargado_curso — aunque el
	// sintoma que reporto Kevin ("a los encargados de educacion continua no
	// les da la aprobacion") parecia especifico de un rol, porque son los
	// unicos que usan este flujo en la practica.
	async putFormData<T>(endpoint: string, form: FormData, options: RequestOptions = {}): Promise<T> {
		const headers = this.buildHeaders(options);
		const headersObj = headers as Record<string, string>;
		delete headersObj['Content-Type'];

		const controller = new AbortController();
		const timeoutDuration = options.customTimeout ?? API_CONFIG.TIMEOUT;
		const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

		try {
			const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1${endpoint}`, {
				method: 'PUT',
				headers,
				body: form,
				signal: controller.signal
			});

			clearTimeout(timeoutId);

			if (response.status === 204) {
				return {} as T;
			}

			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({}));
				const errorType = errorService.mapHttpToErrorType(response.status);

				if (response.status === 401 && browser) {
					localStorage.removeItem(AUTH_TOKEN_KEY);
					localStorage.removeItem(USER_DATA_KEY);
					localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
					const path = window.location.pathname;
					if (!path.startsWith('/auth') && path !== '/') {
						window.location.href = '/auth/sign-in';
					}
				}

				throw new AppError(extractErrorMessage(errorBody), errorType, response.status);
			}

			return response.json();
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof DOMException && error.name === 'AbortError') {
				throw new AppError('Solicitud cancelada por timeout', ErrorType.NETWORK, 408);
			}
			if (error instanceof AppError) {
				throw error;
			}
			throw new AppError('Error de red', ErrorType.NETWORK, undefined, error instanceof Error ? error : undefined);
		}
	}

	// ISSUE-P-REPORTE: descarga de archivos binarios autenticados (Excel/PDF).
	// Los endpoints de descarga requieren el mismo Authorization header que
	// cualquier otra request, por eso no puede usarse un <a href> directo.
	async getBlob(endpoint: string, options: RequestOptions = {}): Promise<Blob> {
		const headers = this.buildHeaders(options);
		const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1${endpoint}`, {
			method: 'GET',
			headers
		});

		if (!response.ok) {
			const errorBody = await response.json().catch(() => ({}));
			const errorType = errorService.mapHttpToErrorType(response.status);
			throw new AppError(extractErrorMessage(errorBody), errorType, response.status);
		}

		return response.blob();
	}
}

export const apiKyC = new ApiKyC();
