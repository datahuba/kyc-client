/**
 * Servicio de Certificados
 * ========================
 *
 * F-CERTIFICADOS (2026-07-29): endpoints /certificates/* del backend.
 * - POST /certificates/emit       (estudiante pide emisión)
 * - GET  /certificates/my          (lista del estudiante autenticado)
 * - GET  /certificates/by-enrollment/{id}  (auditoría / staff)
 * - GET  /certificates/{id}        (metadatos de un certificado)
 * - GET  /certificates/{id}/pdf    (descarga el PDF)
 */

import { apiKyC } from '$lib/config';
import type {
	Certificate,
	CertificateEmitRequest,
	CertificateListResponse
} from '$lib/interfaces';

class CertificateService {
	/**
	 * Emite un Certificado de Notas.
	 * Backend valida: programa finalizado (todos los módulos con nota) + saldo cero.
	 * Retorna 409 si ya existe uno emitido para el mismo enrollment.
	 */
	async emitNotas(enrollmentId: string): Promise<Certificate> {
		const payload: CertificateEmitRequest = {
			tipo: 'notas',
			enrollment_id: enrollmentId
		};
		return await apiKyC.post<Certificate>('/certificates/emit', payload);
	}

	/**
	 * Emite un Certificado de No Deudor hasta el módulo N.
	 * Backend valida que los módulos 1..N estén todos pagados.
	 */
	async emitNoDeudor(enrollmentId: string, hastaModuloN: number): Promise<Certificate> {
		const payload: CertificateEmitRequest = {
			tipo: 'no_deudor',
			enrollment_id: enrollmentId,
			hasta_modulo_n: hastaModuloN
		};
		return await apiKyC.post<Certificate>('/certificates/emit', payload);
	}

	/**
	 * Lista los certificados emitidos del estudiante autenticado.
	 */
	async listMy(): Promise<Certificate[]> {
		const resp = await apiKyC.get<CertificateListResponse>('/certificates/my');
		return resp.items;
	}

	/**
	 * Lista los certificados emitidos de una inscripción específica.
	 * Útil para mostrar el historial en el kardex del estudiante o para
	 * auditoría del staff.
	 */
	async listByEnrollment(enrollmentId: string): Promise<Certificate[]> {
		const resp = await apiKyC.get<CertificateListResponse>(
			`/certificates/by-enrollment/${enrollmentId}`
		);
		return resp.items;
	}

	/**
	 * Descarga el PDF de un certificado como Blob.
	 * El caller es responsable de invocar `URL.createObjectURL` y disparar
	 * la descarga.
	 */
	async downloadPdf(certId: string): Promise<Blob> {
		return await apiKyC.getBlob(`/certificates/${certId}/pdf`);
	}

	/**
	 * [Staff] Lista todos los certificados emitidos con filtros opcionales.
	 * FIX 2026-07-29 19:11: Kevin pidió que la sección sea visible para todos
	 * (estudiantes y staff). El staff tiene esta vista de auditoría.
	 */
	async listAdmin(filters: {
		student_id?: string;
		course_id?: string;
		enrollment_id?: string;
		tipo?: 'notas' | 'no_deudor';
		anio?: number | null;
		folio?: string;
		page?: number;
		per_page?: number;
	} = {}): Promise<CertificateListResponse> {
		const params = new URLSearchParams();
		if (filters.student_id) params.append('student_id', filters.student_id);
		if (filters.course_id) params.append('course_id', filters.course_id);
		if (filters.enrollment_id) params.append('enrollment_id', filters.enrollment_id);
		if (filters.tipo) params.append('tipo', filters.tipo);
		if (filters.anio) params.append('anio', filters.anio.toString());
		if (filters.folio) params.append('folio', filters.folio);
		if (filters.page) params.append('page', filters.page.toString());
		if (filters.per_page) params.append('per_page', filters.per_page.toString());

		const qs = params.toString();
		const url = `/certificates/admin/list${qs ? `?${qs}` : ''}`;
		return await apiKyC.get<CertificateListResponse>(url);
	}
}

export const certificateService = new CertificateService();
