import { ErrorType } from '$lib/interfaces';

// Error personalizado avanzado
export class AppError extends Error {
	type: ErrorType;
	status?: number;
	originalError?: Error;

	constructor(
		message: string,
		type: ErrorType = ErrorType.UNKNOWN,
		status?: number,
		originalError?: Error
	) {
		super(message);
		this.name = 'AppError';
		this.type = type;
		this.status = status;
		this.originalError = originalError;
	}
}

// Servicio de manejo de errores
class ErrorService {
	// Mapeo de códigos HTTP a tipos de error
	mapHttpToErrorType(status?: number): ErrorType {
		switch (status) {
			case 400:
				return ErrorType.VALIDATION;
			case 401:
				return ErrorType.AUTHENTICATION;
			case 403:
				return ErrorType.AUTHENTICATION;
			case 404:
				return ErrorType.NOT_FOUND;
			case 500:
			case 502:
			case 503:
			case 504:
				return ErrorType.SERVER;
			default:
				return ErrorType.UNKNOWN;
		}
	}

	// Traducción de errores a mensajes amigables
	getUserFriendlyMessage(error: AppError): string {
		const messages: Record<ErrorType, string> = {
			[ErrorType.NETWORK]: 'Problema de conexión. Verifica tu internet.',
			[ErrorType.VALIDATION]: 'Los datos proporcionados no son válidos.',
			[ErrorType.AUTHENTICATION]: 'No estás autorizado. Inicia sesión nuevamente.',
			[ErrorType.NOT_FOUND]: 'El recurso solicitado no existe.',
			[ErrorType.SERVER]: 'Error interno del servidor. Estamos trabajando en solucionarlo.',
			[ErrorType.UNKNOWN]: 'Ocurrió un error inesperado. Inténtalo más tarde.'
		};

		return messages[error.type] || messages[ErrorType.UNKNOWN];
	}

	logError(error: AppError) {
		console.error('Error registrado:', {
			type: error.type,
			message: error.message,
			status: error.status,
			stack: error.stack
		});
	}
}

export const errorService = new ErrorService();
