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
 *
 * F-CERT-APROBACION (2026-07-30): flujo de solicitud + aprobación.
 * - POST /certificates/requests/   (estudiante crea solicitud)
 * - GET  /certificates/requests/my (estudiante ve las suyas)
 * - GET  /certificates/requests/   (staff ve la cola)
 * - PATCH /certificates/requests/{id}/approve (staff aprueba)
 * - PATCH /certificates/requests/{id}/reject  (staff rechaza)
 * - PATCH /certificates/requests/{id}/in-review
 * - PATCH /certificates/requests/{id}/cancel  (estudiante cancela)
 */

import { apiKyC } from '$lib/config';
import type {
	Certificate,
	CertificateEmitRequest,
	CertificateListResponse,
	CertificateRequest,
	CertificateRequestCreate,
	CertificateRequestListResponse,
	CertificateRequestStats
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

	// ========================================================================
	// F-CERT-APROBACION (2026-07-30): flujo de solicitud + aprobación
	// ========================================================================

	/**
	 * [Estudiante] Crea una solicitud de certificado.
	 * La solicitud queda en estado 'pendiente' hasta que el encargado del
	 * programa (o admin/superadmin) la apruebe.
	 */
	async createRequest(data: CertificateRequestCreate): Promise<CertificateRequest> {
		return await apiKyC.post<CertificateRequest>('/certificates/requests/', data);
	}

	/**
	 * [Estudiante] Lista mis solicitudes de certificado.
	 */
	async listMyRequests(): Promise<CertificateRequest[]> {
		return await apiKyC.get<CertificateRequest[]>('/certificates/requests/my');
	}

	/**
	 * [Estudiante] Cancela mi solicitud (solo si está pendiente o en revisión).
	 */
	async cancelMyRequest(requestId: string, motivo_cancelacion?: string): Promise<CertificateRequest> {
		return await apiKyC.patch<CertificateRequest>(
			`/certificates/requests/${requestId}/cancel`,
			{ motivo_cancelacion }
		);
	}

	/**
	 * [Staff] Cola de solicitudes (filtrada automáticamente por cursos_asignados
	 * del encargado, o todas si es admin/superadmin/CPD/etc).
	 */
	async listRequestsQueue(
		estado?: 'pendiente' | 'en_revision' | 'aprobada' | 'rechazada' | 'cancelada',
		page = 1,
		perPage = 20
	): Promise<CertificateRequestListResponse> {
		const params = new URLSearchParams();
		if (estado) params.append('estado', estado);
		params.append('page', page.toString());
		params.append('per_page', perPage.toString());
		const qs = params.toString();
		return await apiKyC.get<CertificateRequestListResponse>(
			`/certificates/requests/${qs ? `?${qs}` : ''}`
		);
	}

	/**
	 * [Staff] Estadísticas de la cola (KPIs del panel del encargado).
	 */
	async getRequestsStats(): Promise<CertificateRequestStats> {
		return await apiKyC.get<CertificateRequestStats>('/certificates/requests/stats');
	}

	/**
	 * [Encargado] Marcar solicitud en revisión.
	 */
	async markRequestInReview(requestId: string): Promise<CertificateRequest> {
		return await apiKyC.patch<CertificateRequest>(
			`/certificates/requests/${requestId}/in-review`,
			{}
		);
	}

	/**
	 * [Encargado/Admin] Aprobar solicitud. Al aprobar, se emite el Certificate.
	 */
	async approveRequest(requestId: string): Promise<CertificateRequest> {
		return await apiKyC.patch<CertificateRequest>(
			`/certificates/requests/${requestId}/approve`,
			{}
		);
	}

	/**
	 * [Encargado/Admin] Rechazar solicitud con motivo.
	 */
	async rejectRequest(requestId: string, motivo_rechazo: string): Promise<CertificateRequest> {
		return await apiKyC.patch<CertificateRequest>(
			`/certificates/requests/${requestId}/reject`,
			{ motivo_rechazo }
		);
	}
}

export const certificateService = new CertificateService();
