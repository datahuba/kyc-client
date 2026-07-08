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
	activo: boolean;
	carnet?: string;
	celular: string;
	created_at: string;
	domicilio: string;
	email: string;
	es_estudiante_interno: string;
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
	ci_url?: string | null;
	cv_url?: string | null;
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
	password: string;
	course_id: string;
	nombre: string;
	extension: string;
	fecha_nacimiento: string;
	foto_url?: string;
	celular: string;
	email: string;
	domicilio: string;
	es_estudiante_interno: string;
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
}
