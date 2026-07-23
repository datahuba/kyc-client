// student.interface.ts
export interface Titulo {
	año_expedicion: string;
	estado: string;
	fecha_verificacion: string;
	numero_titulo: string;
	titulo: string;
	titulo_url: string;
	universidad: string;
	verificado_por: string;
}

export interface Student {
	_id: string;
	// Algunas respuestas/patrones defensivos usan `.id` como fallback de `._id`.
	id?: string;
	activo: boolean;
	carnet?: string;
	// ISSUE-Q-COMPLEMENTO-CI (2026-07-08): complemento del CI (ej. '1D', '1J'),
	// distinto de `extension` (lugar de expedición del carnet).
	complemento_carnet?: string | null;
	celular: string;
	created_at: string;
	domicilio: string;
	email: string;
	extension: string;
	fecha_nacimiento: string;
	fecha_registro: string;
	foto_url: string;
	lista_cursos_ids: string[];
	lista_titulos_ids: string[];
	nombre: string;
	registro: string;
	updated_at: string;
	afiliacion_url?: string | null;
	afiliacion_estado?: 'pendiente' | 'verificado' | 'rechazado';
	afiliacion_motivo_rechazo?: string | null;
	// F-074-FIX-6 (2026-07-23): bug histórico -- el backend retorna `carnet_url`
	// (modelo Student) y NO `ci_url`. El template de profile leía
	// `profileData.ci_url` que era siempre `undefined`, por lo que el carnet
	// siempre aparecía como "Sin subir" aunque la URL estuviera guardada en BD.
	carnet_url?: string | null;
	carnet_estado?: 'pendiente' | 'verificado' | 'rechazado';
	carnet_motivo_rechazo?: string | null;
	cv_url?: string | null;
	cv_estado?: 'pendiente' | 'verificado' | 'rechazado';
	cv_motivo_rechazo?: string | null;
	titulo?: Titulo | null;
	// Datos oficiales UAGRM
	sexo?: string | null;
	estado_civil?: string | null;
	pais?: string | null;
	departamento?: string | null;
	provincia?: string | null;
	nacionalidad?: string | null;
	telefono?: string | null;
	modalidad_ingreso?: string | null;
	periodo?: string | null;
	tipo_sangre?: string | null;
	titulo_bachiller?: string | null;
	// ISSUE-Q-PRE: Términos y Condiciones
	terminos_aceptados?: boolean;
	fecha_aceptacion_terminos?: string | null;
	// ISSUE-A-VERIFICACION: no bloqueante, solo informativo
	email_verificado?: boolean;
	fecha_verificacion_email?: string | null;
}

export interface CreateStudentRequest {
	registro: string;
	carnet: string;
	complemento_carnet?: string;
	// ISSUE-Q-PASSWORD-UNIFICADA: opcional -- si se omite, el backend genera
	// 'Uagrm.<CI>' automáticamente (misma convención que docentes/staff).
	password?: string;
	course_id: string;
	nombre: string;
	extension: string;
	fecha_nacimiento: string;
	foto_url?: string;
	celular: string;
	email: string;
	domicilio: string;
	// Datos oficiales UAGRM (opcionales)
	sexo?: string;
	estado_civil?: string;
	pais?: string;
	departamento?: string;
	provincia?: string;
	nacionalidad?: string;
	telefono?: string;
	modalidad_ingreso?: string;
	periodo?: string;
	tipo_sangre?: string;
	titulo_bachiller?: string;
	// lista_cursos_ids?: string[];
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
	lista_cursos_ids?: string[];
	lista_titulos_ids?: string[];
	activo?: boolean;
	titulo?: TituloData;
}

export interface TituloData {
	titulo: string;
	numero_titulo: string;
	año_expedicion: string;
	universidad: string;
}

export interface ChangePasswordRequest {
	confirm_password: string;
	current_password: string;
	new_password: string;
}

export interface VerifyTituloData {
	titulo?: string;
	numero_titulo?: string;
	año_expedicion?: string;
	universidad?: string;
}

export interface UpdateStudentSelfRequest {
	celular?: string;
	domicilio?: string;
	// Datos oficiales UAGRM que el estudiante puede completar/editar por sí mismo
	// (reunión postgrado 2026-07-09), para aliviar la carga de CPD.
	telefono?: string;
	sexo?: string;
	estado_civil?: string;
	tipo_sangre?: string;
	pais?: string;
	departamento?: string;
	provincia?: string;
	nacionalidad?: string;
	modalidad_ingreso?: string;
	periodo?: string;
	titulo_bachiller?: string;
}
