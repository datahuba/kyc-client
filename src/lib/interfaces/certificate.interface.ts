/**
 * Interfaces para Certificados
 * =============================
 *
 * F-CERTIFICADOS (2026-07-29): tipos compartidos entre la vista de
 * /app/certificates y los componentes hijos.
 */

export type TipoCertificado = 'notas' | 'no_deudor';

export interface CertificateModulo {
	nombre: string;
	nota: number | null;
	literal: string | null;
	estado: string | null;
	fecha_inicio: string | null;
	fecha_fin: string | null;
}

export interface Certificate {
	id: string;
	tipo: TipoCertificado;
	folio: string;            // "N° 042/2026"
	numero: number;
	anio: number;
	student_id: string;
	course_id: string;
	enrollment_id: string;
	modulos_snapshot: CertificateModulo[];
	hasta_modulo_n: number | null;
	programa_nombre: string;
	programa_codigo: string;
	programa_version: string;
	programa_edicion: string;
	estudiante_nombre: string;
	estudiante_registro: string;
	estudiante_ci: string;
	estudiante_extension: string | null;
	estudiante_complemento: string | null;
	emitido_en: string;       // ISO UTC
	emitido_por: string;
	verificacion_code: string;
	pdf_url: string;
	pdf_filename: string;
}

export interface CertificateListResponse {
	items: Certificate[];
	total: number;
}

export interface CertificateEmitRequest {
	tipo: TipoCertificado;
	enrollment_id: string;
	hasta_modulo_n?: number;
}
