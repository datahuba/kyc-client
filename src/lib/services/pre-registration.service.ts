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
	// F-2026-08-11-CAMPOS-EC: campos opcionales del Diplomado Gestión
	// Tributaria y demás programas de educación continua. Si el estudiante
	// se inscribe a un diplomado EC, los llena desde la planilla de Lisa.
	registro_universitario?: string;
	avance_academico_codigo?: number;
	formulario_descuento_numero?: number;
	carrera_codigo?: string;
	descuento_porcentaje?: number; // 0.0 - 1.0
	// F-2026-08-11-CAMPOS-EC-MODALIDAD (reunion UAGRM 2026-08-11, seccion 4):
	// procedencia (codigo departamento Bolivia) + modalidad (presencial/virtual)
	// + carta_firmada_url (URL del PDF firmado por el director). El backend
	// rechaza la submission si modalidad='virtual' o procedencia != 'SCZ' y
	// carta_firmada_url esta vacia (regla de la reunion).
	procedencia?: 'SCZ' | 'LPZ' | 'CBA' | 'TJA' | 'CHS' | 'POT' | 'ORU' | 'BEN' | 'PND';
	modalidad?: 'presencial' | 'virtual';
	carta_firmada_url?: string;
	// F-2026-08-11-CAMPOS-EC-RESOLUCION (Kevin 22:37): OPCIONAL.
	// URL de la resolucion del programa que el estudiante subio.
	resolucion_url?: string;
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

// F-2026-08-11-CAMPOS-EC-MODALIDAD-FILE (Kevin 22:17): subir la carta firmada
// directamente desde el wizard en vez de pegar un link externo. UX mejor:
// el visitante elige el archivo de su maquina, ve el preview, y el sistema
// lo sube a Cloudinary. Devuelve la URL publica que se guarda en cartaFirmadaUrl.
export interface CartaFirmadaUploadResult {
	url: string;
	public_id: string;
	resource_type: string;
	mime_type: string;
	size_bytes: number;
}

export async function uploadCartaFirmada(slug: string, file: File): Promise<CartaFirmadaUploadResult> {
	const form = new FormData();
	form.append('file', file);
	// postFormData se encarga de: armar la URL completa, poner el Authorization
	// si hay token, NO setear Content-Type (browser pone el boundary), y
	// manejar errores con la misma logica que el resto del sistema.
	return apiKyC.postFormData<CartaFirmadaUploadResult>(
		`/pre-registrations/public/${encodeURIComponent(slug)}/upload-carta`,
		form,
		{ requireAuth: false }
	);
}

// F-2026-08-11-CAMPOS-EC-RESOLUCION (Kevin 22:37): misma mecanica que la carta
// firmada pero para la resolucion del programa. Es OPCIONAL: el estudiante
// puede incluirla si ya la tiene a mano, o el admin la sube despues.
export async function uploadResolucion(slug: string, file: File): Promise<CartaFirmadaUploadResult> {
	const form = new FormData();
	form.append('file', file);
	return apiKyC.postFormData<CartaFirmadaUploadResult>(
		`/pre-registrations/public/${encodeURIComponent(slug)}/upload-resolucion`,
		form,
		{ requireAuth: false }
	);
}
