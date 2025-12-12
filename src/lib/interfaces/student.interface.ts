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
}

export interface CreateStudentRequest {
	registro: string;
	carnet: string;
	password?: string;
	nombre: string;
	extension: string;
	fecha_nacimiento: string;
	foto_url?: string;
	celular: string;
	email: string;
	domicilio: string;
	es_estudiante_interno: string;
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
