/**
 * Interfaces TypeScript para CertificateRequest
 * =============================================
 *
 * F-CERT-APROBACION (2026-07-30): el estudiante crea una solicitud de
 * certificado y el encargado del programa (o admin/superadmin) la aprueba.
 * Al aprobar, se emite el Certificate real (folio + PDF).
 *
 * Estados:
 *   - pendiente: recién creada, sin revisar
 *   - en_revision: encargado la está mirando
 *   - aprobada: aprobada + Certificate emitido
 *   - rechazada: rechazada con motivo
 *   - cancelada: el estudiante la canceló
 */

export type CertificateRequestTipo = 'notas' | 'no_deudor';
export type CertificateRequestEstado =
	| 'pendiente'
	| 'en_revision'
	| 'aprobada'
	| 'rechazada'
	| 'cancelada';

export interface CertificateRequest {
	id: string;
	tipo: CertificateRequestTipo;
	estado: CertificateRequestEstado;

	estudiante_id: string;
	enrollment_id: string;
	course_id: string;
	hasta_modulo_n?: number | null;

	nombre_completo: string;
	programa_nombre: string;
	programa_codigo: string;
	motivo: string;

	fecha_revision?: string | null;
	revisado_por?: string | null;
	motivo_rechazo?: string | null;
	motivo_cancelacion?: string | null;
	fecha_cancelacion?: string | null;

	certificate_id?: string | null;

	created_at?: string;
	updated_at?: string;
}

export interface CertificateRequestCreate {
	tipo: CertificateRequestTipo;
	enrollment_id: string;
	hasta_modulo_n?: number | null;
	motivo: string;
}

export interface CertificateRequestListResponse {
	items: CertificateRequest[];
	total: number;
}

export interface CertificateRequestStats {
	pendientes: number;
	en_revision: number;
	aprobadas_hoy: number;
	rechazadas_hoy: number;
	total_pendientes: number;
}
