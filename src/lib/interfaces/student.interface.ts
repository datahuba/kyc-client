export interface Student {
	_id: string;
	activo: boolean;
	carrera: string;
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
}

export interface CreateStudentRequest {
	registro: string;
	password?: string;
	nombre: string;
	extension: string;
	fecha_nacimiento: string;
	foto_url?: string;
	celular: string;
	email: string;
	domicilio: string;
	carrera: string;
	es_estudiante_interno: string;
}

export interface UpdateStudentRequest extends Partial<CreateStudentRequest> {
	lista_cursos_ids?: string[];
	lista_titulos_ids?: string[];
	activo?: boolean;
}
