export interface Modulo {
	docente_id: string;
	nombre: string;
	costo: number;
}

export interface Course {
	_id: string;
	activo: boolean;
	cantidad_cuotas: number;
	codigo: string;
	costo_total_interno: number;
	created_at: string;
	descuento_curso: number;
	fecha_fin: string;
	fecha_inicio: string;
	inscritos: string[];
	matricula_interno: number;
	// ISSUE-P-PRECIO-UNICO (2026-07-08): precio único para todos los
	// estudiantes. cargo_adicional_* es un gasto complementario opcional al
	// programa (ej. un taller incluido), no un precio diferenciado.
	cargo_adicional_monto?: number | null;
	cargo_adicional_concepto?: string | null;
	modalidad: string;
	nombre_programa: string;
	observacion: string;
	tipo_curso: string;
	updated_at: string;
	modulos?: Modulo[]; // <--- ¡Añadimos los Módulos aquí!
}

export interface CreateCourseRequest {
	codigo: string;
	nombre_programa: string;
	tipo_curso: string;
	modalidad: string;
	costo_total_interno: number;
	matricula_interno: number;
	cargo_adicional_monto?: number | null;
	cargo_adicional_concepto?: string | null;
	cantidad_cuotas: number;
	descuento_curso: number;
	observacion?: string;
	fecha_inicio: string;
	fecha_fin: string;
	activo: boolean;
	descuento_id?: string | null;
	modulos?: Modulo[]; // <--- ¡Y aquí también!
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
