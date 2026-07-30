/**
 * Interfaces para Solicitudes de Trámite
 * =====================================
 *
 * F-TRAMITES-SOLICITUD (2026-07-29): tipos compartidos entre
 * /app/requests y sus componentes.
 *
 * 4 tipos de solicitudes que el estudiante crea desde la UI:
 *   - convalidacion | tutoria | readmision | titulacion
 */

export type TipoTramite = 'convalidacion' | 'tutoria' | 'readmision' | 'titulacion';

export type EstadoTramite =
	| 'pendiente'
	| 'en_revision'
	| 'aprobada'
	| 'rechazada'
	| 'cancelada';

export interface ArchivoAdjunto {
	nombre_campo: 'carta' | 'certificado_nota' | 'comprobante_pago' | 'otro';
	url: string;
	nombre_archivo?: string | null;
	mime_type?: string | null;
	subido_en?: string;
}

export interface TramiteSolicitud {
	id: string;
	tipo: TipoTramite;
	estudiante_id: string;
	enrollment_id?: string | null;

	nombre_completo: string;
	ci?: string | null;
	email?: string | null;
	telefono?: string | null;

	motivo: string;
	programa_relacionado?: string | null;
	modulos_relacionados: string[];
	monto_pago_bs?: number | null;

	archivos: ArchivoAdjunto[];

	estado: EstadoTramite;
	fecha_revision?: string | null;
	revisado_por?: string | null;
	motivo_rechazo?: string | null;
	motivo_cancelacion?: string | null;
	fecha_cancelacion?: string | null;

	created_at: string;
	updated_at: string;
}

export interface TramiteSolicitudCreateRequest {
	tipo: TipoTramite;
	enrollment_id?: string | null;

	nombre_completo: string;
	ci?: string | null;
	email?: string | null;
	telefono?: string | null;

	motivo: string;
	programa_relacionado?: string | null;
	modulos_relacionados?: string[];
	monto_pago_bs?: number | null;

	archivos: ArchivoAdjunto[];
}

export interface TramiteEstadisticas {
	por_tipo: Record<string, Record<string, number>>;
	por_estado: Record<string, number>;
	total: number;
	pendientes_hoy: number;
}

export const TIPO_TRAMITE_LABELS: Record<TipoTramite, string> = {
	convalidacion: 'Convalidación',
	tutoria: 'Tutoría',
	readmision: 'Readmisión',
	titulacion: 'Titulación'
};

export const TIPO_TRAMITE_DESCRIPCION: Record<TipoTramite, string> = {
	convalidacion:
		'Convalidar materias cursadas en otra institución. Adjunta carta, certificado de nota y comprobante de pago.',
	tutoria:
		'Solicitar tutoría para tu trabajo final o tesis. Adjunta carta, certificado de nota y comprobante de pago.',
	readmision:
		'Para quienes estudiaron hace años y no defendieron. La escuela de postgrado autoriza por algún motivo. Adjunta una carta.',
	titulacion:
		'Solicitud formal del título una vez completado el programa. Adjunta carta y comprobante de pago.'
};

export const TIPO_TRAMITE_ICON: Record<TipoTramite, string> = {
	convalidacion: '🎓',
	tutoria: '👨‍🏫',
	readmision: '🔄',
	titulacion: '📜'
};

export const ESTADO_TRAMITE_LABELS: Record<EstadoTramite, string> = {
	pendiente: 'Pendiente',
	en_revision: 'En revisión',
	aprobada: 'Aprobada',
	rechazada: 'Rechazada',
	cancelada: 'Cancelada'
};

export const ESTADO_TRAMITE_COLORS: Record<EstadoTramite, string> = {
	pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
	en_revision: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
	aprobada: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
	rechazada: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
	cancelada: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
};

/** Lista de archivos requeridos por tipo. La UI muestra los campos de upload
 *  según este mapa. */
export const ARCHIVOS_REQUERIDOS: Record<TipoTramite, string[]> = {
	convalidacion: ['carta', 'certificado_nota', 'comprobante_pago'],
	tutoria: ['carta', 'certificado_nota', 'comprobante_pago'],
	readmision: ['carta'],
	titulacion: ['carta', 'comprobante_pago']
};

export const ARCHIVO_LABELS: Record<string, string> = {
	carta: 'Carta de solicitud',
	certificado_nota: 'Certificado de nota',
	comprobante_pago: 'Comprobante de pago',
	otro: 'Otro documento'
};
