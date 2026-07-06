export interface Enrollment {
	modulos: any;
	_id: string;
	cantidad_cuotas: number;
	costo_matricula: number;
	costo_total: number;
	created_at: string;
	curso_id: string;
	descuento_curso_aplicado: number;
	descuento_personalizado: number;
	descuento_curso_id?: string;
	descuento_estudiante_id?: string;
	es_estudiante_interno: string;
	estado: string;
	estudiante_id: string;
	fecha_inscripcion: string;
	saldo_pendiente: number;
	total_a_pagar: number;
	total_pagado: number;
	updated_at: string;
	formulario_inscripcion_url?: string;
	beca_respaldo_url?: string | null; // ISSUE-P-BECA-RESPALDO
	matricula_pagada?: boolean;
	matricula_exenta?: boolean; // ISSUE-M-EXENCION
	matricula_exenta_otorgada_por?: string | null; // ISSUE-M-EXENCION
	matricula_exenta_fecha?: string | null; // ISSUE-M-EXENCION
	// ISSUE-P-CONGELADO
	motivo_suspension?: string | null;
	fecha_congelamiento?: string | null;
	tasa_congelamiento_pagada?: boolean;
	fecha_abandono?: string | null;
	multa_reincorporacion_pendiente?: boolean;
}

export interface CreateEnrollmentRequest {
	estudiante_id: string;
	curso_id: string;
	descuento_personalizado: number;
	descuento_id?: string;
}

export interface UpdateEnrollmentRequest {
	estado?: string;
	formulario_inscripcion_url?: string;
	descuento_personalizado?: number;
	total_a_pagar?: number;
	total_pagado?: number;
	saldo_pendiente?: number;
}
