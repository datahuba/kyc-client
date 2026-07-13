export type Role =
	| 'docente'
	| 'admin'
	| 'superadmin'
	| 'mae'
	| 'cpd'
	| 'cobranza'
	| 'encargado_curso' // NUEVO (ISSUE-R-ROLES)
	| 'coordinador' // NUEVO (ISSUE-R-ROLES)
	| null;
export type UserType = 'user' | 'student';

export interface User {
	nombre: string;
	_id: string;
	username: string;
	email: string;
	role: Role;
	rol?: Role;
	user_type?: UserType; // 'user' for admin/teacher, 'student' for students
	activo: boolean;
	ultimo_acceso: string;
	created_at: string;
	updated_at: string;
	foto_url?: string; // Optional as it wasn't in the snippet but used in header
	nombre_funcional?: string | null; // ISSUE-R-ROLES: nombre por función/programa
	cursos_asignados?: string[]; // ISSUE-R-ROLES: cursos que puede operar (encargado_curso/cobranza)
	subtipo_coordinador?: string | null; // ISSUE-R-PERFIL-GENERICO: 'financiero'|'academico'|'investigacion'
	terminos_aceptados?: boolean; // ISSUE-Q-PRE: siempre true para personal admin/docente, real para estudiantes
	email_verificado?: boolean; // ISSUE-A-VERIFICACION: no bloqueante, solo informativo
	carnet?: string | null; // GAP-1 (audio 2026-07-08): CI del personal, usado para la contraseña por defecto 'Uagrm.<CI>'
	cv_url?: string | null; // HOJA-DE-VIDA-DOCENTE: CV para docentes
	// Cuando el usuario autenticado es un estudiante, el objeto en el store
	// (UserResponse) trae también estos campos propios del Student.
	registro?: string | null;
	codigo_registro?: string | null;
	perfil_completado?: boolean;
}


export interface CreateUserRequest {
	username: string;
	email: string;
	// GAP-1: opcional al crear si se provee `carnet` (se autogenera 'Uagrm.<CI>').
	password?: string;
	role: Role;
	activo?: boolean;
	nombre_funcional?: string | null; // ISSUE-R-ROLES
	cursos_asignados?: string[]; // ISSUE-R-ROLES
	carnet?: string | null; // GAP-1
	subtipo_coordinador?: string | null; // ISSUE-R-PERFIL-GENERICO
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {}

// Keep UserResponse for backward compatibility if needed, or alias it
export type UserResponse = User;
