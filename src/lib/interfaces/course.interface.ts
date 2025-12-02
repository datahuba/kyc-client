export interface Course {
	_id: string;
	activo: boolean;
	cantidad_cuotas: number;
	codigo: string;
	costo_total_externo: number;
	costo_total_interno: number;
	created_at: string;
	descuento_general: number;
	fecha_fin: string;
	fecha_inicio: string;
	inscritos: string[];
	matricula_externo: number;
	matricula_interno: number;
	modalidad: string;
	monto_cuota_externo: number;
	monto_cuota_interno: number;
	nombre_programa: string;
	observacion: string;
	requisitos: string[];
	tipo_curso: string;
	updated_at: string;
}

export interface CreateCourseRequest {
	codigo: string;
	nombre_programa: string;
	tipo_curso: string;
	modalidad: string;
	costo_total_interno: number;
	monto_cuota_interno: number;
	matricula_interno: number;
	costo_total_externo: number;
	monto_cuota_externo: number;
	matricula_externo: number;
	cantidad_cuotas: number;
	descuento_general: number;
	observacion?: string;
	requisitos?: string[];
	fecha_inicio: string;
	fecha_fin: string;
	activo: boolean;
}

export interface UpdateCourseRequest extends Partial<CreateCourseRequest> {
	inscritos?: string[];
}
