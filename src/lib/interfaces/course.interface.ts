export interface Course {
	_id: string;
	activo: boolean;
	cantidad_cuotas: number;
	codigo: string;
	costo_total_externo: number;
	costo_total_interno: number;
	created_at: string;
	descuento_curso: number;
	fecha_fin: string;
	fecha_inicio: string;
	inscritos: string[];
	matricula_externo: number;
	matricula_interno: number;
	modalidad: string;
	nombre_programa: string;
	observacion: string;
	tipo_curso: string;
	updated_at: string;
}

export interface CreateCourseRequest {
	codigo: string;
	nombre_programa: string;
	tipo_curso: string;
	modalidad: string;
	costo_total_interno: number;
	matricula_interno: number;
	costo_total_externo: number;
	matricula_externo: number;
	cantidad_cuotas: number;
	descuento_curso: number;
	observacion?: string;
	fecha_inicio: string;
	fecha_fin: string;
	activo: boolean;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
	inscritos?: string[];
}

export interface CourseStudent {
	estudiante_id: string;
	nombre: string;
	carnet: string;
	contacto: {
		email: string;
		celular: string;
	};
	inscripcion: {
		id: string;
		fecha_inscripcion: string;
		estado: string;
		tipo_estudiante: string;
	};
	financiero: {
		total_a_pagar: number;
		total_pagado: number;
		saldo_pendiente: number;
		avance_pago: number;
	};
}
