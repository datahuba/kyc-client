/**
 * Servicio de Pre-registro de Estudiantes
 * ========================================
 *
 * ISSUE-Q-PRE-REGISTRO-FORM (2026-07-17): formularios dinámicos que el
 * super admin crea desde el panel. El visitante llena el form público
 * (sin auth), y CPD/Encargado de Curso lo aprueba creando un Student
 * con la convención 'Uagrm.<CI>'.
 *
 * Endpoints:
 *   PÚBLICOS (sin auth): /pre-registrations/public/{slug}
 *   ADMIN (auth):        /pre-registrations/forms, /pre-registrations/submissions
 */

import { apiKyC } from '$lib/config/apiKyC.config';

// ============================================================================
// Tipos
// ============================================================================

export interface PreRegistrationForm {
	_id: string;
	nombre: string;
	slug: string;
	descripcion?: string | null;
	programa_id?: string | null;
	programa_nombre?: string | null;
	programa_codigo?: string | null;
	fecha_inicio: string; // ISO
	fecha_fin: string;    // ISO
	estado: 'activo' | 'cerrado';
	created_by: string;
	created_at: string;
	submissions_total?: number;
	submissions_pendientes?: number;
}

export interface PreRegistrationFormCreate {
	nombre: string;
	slug: string;
	descripcion?: string;
	programa_id?: string | null;
	fecha_inicio: string;
	fecha_fin: string;
}

export interface PreRegistrationFormUpdate {
	nombre?: string;
	descripcion?: string | null;
	programa_id?: string | null;
	fecha_inicio?: string;
	fecha_fin?: string;
	estado?: 'activo' | 'cerrado';
}

export interface PreRegistration {
	_id: string;
	form_id: string;
	form_nombre?: string | null;
	programa_id?: string | null;
	programa_nombre?: string | null;
	data: {
		nombre: string;
		email: string;
		carnet: string;
		extension?: string | null;
		celular: string;
		fecha_nacimiento?: string | null;
		sexo?: string | null;
		domicilio?: string | null;
		mensaje?: string | null;
		[key: string]: any;
	};
	estado: 'pendiente' | 'aprobado' | 'rechazado';
	motivo_rechazo?: string | null;
	revisado_por?: string | null;
	fecha_revision?: string | null;
	migrated_to_student_id?: string | null;
	created_at: string;
}

export interface PreRegistrationSubmit {
	nombre: string;
	email: string;
	carnet: string;
	extension?: string;
	celular: string;
	fecha_nacimiento?: string;
	sexo?: 'masculino' | 'femenino';
	domicilio?: string;
	mensaje?: string;
}

export interface PreRegistrationCounters {
	forms_total: number;
	forms_activos: number;
	submissions_pendientes: number;
}

// ============================================================================
// Helpers de paginación
// ============================================================================

export interface PaginatedResponse<T> {
	data: T[];
	meta: {
		page: number;
		limit: number;
		totalItems: number;
		totalPages: number;
		hasNextPage: boolean;
		hasPrevPage: boolean;
	};
}

// ============================================================================
// Forms (admin)
// ============================================================================

export async function listForms(page = 1, perPage = 20) {
	return apiKyC.get<PaginatedResponse<PreRegistrationForm>>(
		`/pre-registrations/forms?page=${page}&per_page=${perPage}`
	);
}

export async function getForm(id: string) {
	return apiKyC.get<PreRegistrationForm>(`/pre-registrations/forms/${id}`);
}

export async function createForm(data: PreRegistrationFormCreate) {
	return apiKyC.post<PreRegistrationForm>('/pre-registrations/forms', data);
}

export async function updateForm(id: string, data: PreRegistrationFormUpdate) {
	return apiKyC.patch<PreRegistrationForm>(`/pre-registrations/forms/${id}`, data);
}

export async function closeForm(id: string) {
	return apiKyC.post<PreRegistrationForm>(`/pre-registrations/forms/${id}/close`, {});
}

export async function reopenForm(id: string) {
	return apiKyC.post<PreRegistrationForm>(`/pre-registrations/forms/${id}/reopen`, {});
}

export async function deleteForm(id: string) {
	return apiKyC.delete(`/pre-registrations/forms/${id}`);
}

// ============================================================================
// Submissions (admin)
// ============================================================================

export async function listSubmissions(opts: {
	page?: number;
	perPage?: number;
	formId?: string;
	estado?: 'pendiente' | 'aprobado' | 'rechazado';
} = {}) {
	const { page = 1, perPage = 20, formId, estado } = opts;
	const params = new URLSearchParams();
	params.set('page', String(page));
	params.set('per_page', String(perPage));
	if (formId) params.set('form_id', formId);
	if (estado) params.set('estado', estado);
	return apiKyC.get<PaginatedResponse<PreRegistration>>(
		`/pre-registrations/submissions?${params.toString()}`
	);
}

export async function approveSubmission(id: string) {
	// Devuelve un Student (modelo de la API) al aprobar
	return apiKyC.post<{ _id: string; nombre: string; email: string; carnet: string }>(
		`/pre-registrations/submissions/${id}/approve`,
		{}
	);
}

export async function rejectSubmission(id: string, motivo: string) {
	return apiKyC.post<PreRegistration>(
		`/pre-registrations/submissions/${id}/reject`,
		{ motivo }
	);
}

export async function getCounters() {
	return apiKyC.get<PreRegistrationCounters>('/pre-registrations/counters');
}

// ============================================================================
// Público (sin auth)
// ============================================================================

export async function getPublicForm(slug: string) {
	return apiKyC.getPublic<PreRegistrationForm>(`/pre-registrations/public/${slug}`);
}

export async function submitPublicForm(slug: string, data: PreRegistrationSubmit) {
	return apiKyC.postPublic<PreRegistration>(`/pre-registrations/public/${slug}`, data);
}
