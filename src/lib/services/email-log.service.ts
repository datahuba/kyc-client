/**
 * Servicio del Registro de Correos
 * ================================
 *
 * F-CORREOS-REGISTRO (2026-08-17, Kevin): "ver cuáles son las que llegan a los
 * usuarios". Antes no había forma de saberlo — el envío devolvía un booleano y
 * los errores iban a la consola del servidor.
 *
 * RBAC: solo admin y superadmin. El registro guarda el cuerpo de los correos, y
 * el de credenciales trae la contraseña inicial del alumno en texto plano.
 */

import { apiKyC } from '$lib/config';

export type EstadoEmail = 'enviado' | 'fallido' | 'encolado' | 'descartado';
export type PrioridadEmail = 'critica' | 'alta' | 'normal';

export interface EmailLog {
	id: string;
	destinatario: string;
	destinatario_nombre: string | null;
	asunto: string;
	tipo: string;
	prioridad: PrioridadEmail;
	estado: EstadoEmail;
	intentos: number;
	error: string | null;
	fecha_envio: string | null;
	created_at: string;
	/** Solo viene en el detalle: en el listado serían cientos de KB por página. */
	cuerpo_html?: string | null;
}

export interface EmailLogListado {
	items: EmailLog[];
	data: EmailLog[];
	meta: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPrevPage: boolean;
	};
}

export interface EmailStats {
	cuota_diaria: number;
	cupo_reservado_criticos: number;
	enviados_hoy: number;
	/** Los críticos usan la cuota completa; el resto se detiene antes. */
	disponible_criticos: number;
	disponible_resto: number;
	encolados: number;
	fallidos: number;
	descartados: number;
}

export interface ResumenProceso {
	procesados: number;
	enviados: number;
	sin_cupo: number;
	fallidos: number;
}

/**
 * Etiquetas legibles de cada flujo. El backend guarda el identificador; acá se
 * traduce para que el panel no muestre `credenciales_preinscripcion`.
 */
export const ETIQUETA_TIPO: Record<string, string> = {
	credenciales_preinscripcion: 'Credenciales de acceso',
	reset_password: 'Restablecer contraseña',
	verificacion_email: 'Verificación de correo',
	inscripcion_aprobada: 'Inscripción aprobada',
	pago_aprobado: 'Pago aprobado',
	nota_validada: 'Nota validada',
	recordatorio_pago: 'Recordatorio de pago',
	comunicado: 'Comunicado',
	pre_registro_recibido: 'Pre-inscripción recibida',
	otro: 'Otro'
};

class EmailLogService {
	async listar(
		page = 1,
		perPage = 25,
		filtros: {
			estado?: string;
			tipo?: string;
			prioridad?: string;
			destinatario?: string;
		} = {}
	): Promise<EmailLogListado> {
		const params = new URLSearchParams();
		params.append('page', String(page));
		params.append('per_page', String(perPage));
		if (filtros.estado) params.append('estado', filtros.estado);
		if (filtros.tipo) params.append('tipo', filtros.tipo);
		if (filtros.prioridad) params.append('prioridad', filtros.prioridad);
		if (filtros.destinatario) params.append('destinatario', filtros.destinatario);
		return await apiKyC.get<EmailLogListado>(`/email-logs/?${params.toString()}`);
	}

	async stats(): Promise<EmailStats> {
		return await apiKyC.get<EmailStats>('/email-logs/stats');
	}

	/** Detalle con el HTML exacto que se envió. */
	async detalle(id: string): Promise<EmailLog> {
		return await apiKyC.get<EmailLog>(`/email-logs/${id}`);
	}

	/**
	 * Reintenta los encolados y fallidos. El backend procesa por prioridad, así
	 * que un lote de comunicados no posterga una credencial.
	 */
	async procesarCola(limite = 100): Promise<ResumenProceso> {
		return await apiKyC.post<ResumenProceso>(`/email-logs/procesar?limite=${limite}`, {});
	}
}

export const emailLogService = new EmailLogService();
