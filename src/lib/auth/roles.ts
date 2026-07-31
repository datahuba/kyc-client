/**
 * F-REFACTOR-ROLES (2026-07-31)
 * ============================
 * Constantes de roles compartidas en todo el frontend.
 *
 * Antes: cada componente declaraba su propio array de roles inline, ej:
 *   const canEdit = ['admin', 'superadmin', 'cpd'].includes(currentRole);
 * Eso causaba:
 *   - Duplicacion: el mismo array aparecia en 17+ lugares.
 *   - Inconsistencia: a veces 'mae' estaba, a veces no.
 *   - Dificil de mantener: agregar un rol nuevo requeria buscar todos
 *     los arrays.
 *
 * Ahora: cualquier componente importa las constantes de este archivo.
 * Si se agrega un rol nuevo, se actualiza UNA linea.
 *
 * Convencion: cada constante se nombra por lo que PUEDE hacer, no por
 * quienes la componen. Ej: STAFF_CPD_AND_ADMIN no es lo mismo que
 * STAFF_ADMIN_ONLY.
 *
 * Fuente de verdad: el backend en models/enums.py (UserRole). Si se
 * agrega un rol nuevo en backend, agregarlo aqui tambien.
 */

// Roles base (single source of truth: models/enums.py UserRole)
export const ROLE_SUPERADMIN = 'superadmin';
export const ROLE_ADMIN = 'admin';
export const ROLE_MAE = 'mae';
export const ROLE_CPD = 'cpd';
export const ROLE_COBRANZA = 'cobranza';
export const ROLE_ENCARGADO_CURSO = 'encargado_curso';
export const ROLE_COORDINADOR = 'coordinador';
export const ROLE_DOCENTE = 'docente';
export const ROLE_STUDENT = 'student';

// ============================================================
// GRUPOS DE ROLES
// ============================================================

/** Todo el personal administrativo: superadmin, admin, mae, cpd, cobranza, encargado_curso, coordinador */
export const ALL_STAFF: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_MAE,
	ROLE_CPD,
	ROLE_COBRANZA,
	ROLE_ENCARGADO_CURSO,
	ROLE_COORDINADOR,
];

/** Personal con acceso a edicion/CRUD (no cobranza) */
export const STAFF_EDITOR: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_MAE,
	ROLE_CPD,
	ROLE_ENCARGADO_CURSO,
	ROLE_COORDINADOR,
];

/** Solo superadmin y admin */
export const STAFF_ADMIN_ONLY: string[] = [ROLE_SUPERADMIN, ROLE_ADMIN];

/** CPD + admin + superadmin (gestion academica) */
export const STAFF_CPD_AND_ADMIN: string[] = [ROLE_CPD, ROLE_ADMIN, ROLE_SUPERADMIN];

/** Puede iniciar/cerrar modulos de un programa (incluye encargado) */
export const STAFF_MODULOS: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_ENCARGADO_CURSO,
];

/** Puede aprobar/rechazar requisitos (documentos KYC) */
export const STAFF_REQUISITOS: string[] = [
	ROLE_CPD,
	ROLE_ADMIN,
	ROLE_SUPERADMIN,
	ROLE_ENCARGADO_CURSO,
	ROLE_COORDINADOR,
];

/** Puede validar/rechazar notas borrador (ISSUE-Q-NOTA-BORRADOR) */
export const STAFF_NOTAS_BORRADOR: string[] = [
	ROLE_CPD,
	ROLE_ADMIN,
	ROLE_SUPERADMIN,
];

/** Puede inscribir (POST /enrollments/) */
export const STAFF_INSCRIPCION: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_CPD,
	ROLE_ENCARGADO_CURSO,
	ROLE_COORDINADOR,
];

/** Puede editar inscripciones (PATCH /enrollments/{id}) */
export const STAFF_INSCRIPCION_EDIT: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_CPD,
];

/** Puede eliminar inscripciones (DELETE /enrollments/{id}) */
export const STAFF_INSCRIPCION_DELETE: string[] = [ROLE_SUPERADMIN];

/** Puede gestionar matricula exenta (ISSUE-M-EXENCION) */
export const STAFF_MATRICULA_EXENTA: string[] = [
	ROLE_MAE,
	ROLE_ADMIN,
	ROLE_SUPERADMIN,
];

/** Puede subir/reemplazar respaldo de beca (ISSUE-P-BECA-RESPALDO) */
export const STAFF_BECA_RESPALDO: string[] = [
	ROLE_CPD,
	ROLE_ADMIN,
	ROLE_SUPERADMIN,
];

/** Puede solicitar pasivo (ISSUE-R-SOLICITUD-PASIVO) */
export const STAFF_SOLICITUD_PASIVO: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_CPD,
	ROLE_ENCARGADO_CURSO,
	ROLE_STUDENT,
];

/** Puede reactivar inscripciones suspendidas */
export const STAFF_REACTIVAR: string[] = [
	ROLE_SUPERADMIN,
	ROLE_ADMIN,
	ROLE_CPD,
];

/** Solo superadmin (usuarios) */
export const ONLY_SUPERADMIN: string[] = [ROLE_SUPERADMIN];

// ============================================================
// HELPERS
// ============================================================

/** True si el rol esta en el grupo */
export function hasRole(currentRole: string, roles: string[]): boolean {
	return roles.includes(currentRole);
}

/** True si el rol es staff (no estudiante/docente) */
export function isStaff(currentRole: string): boolean {
	return ALL_STAFF.includes(currentRole);
}
