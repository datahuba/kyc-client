export interface Enrollment {
	_id: string;
	created_at: string;
	curso_id: string;
	descuento_personalizado: number;
	es_estudiante_interno: string;
	estado: string;
	estudiante_id: string;
	fecha_inscripcion: string;
	formulario_inscripcion_url: string;
	saldo_pendiente: number;
	tipo_pago: string;
	total_a_pagar: number;
	total_pagado: number;
	updated_at: string;
}

export interface CreateEnrollmentRequest {
	estudiante_id: string;
	curso_id: string;
	es_estudiante_interno: string;
	tipo_pago: 'contado' | 'cuotas';
	descuento_personalizado: number;
	formulario_inscripcion_url?: string;
}

export interface UpdateEnrollmentRequest {
	estado?: string;
	formulario_inscripcion_url?: string;
	descuento_personalizado?: number;
	total_a_pagar?: number;
	total_pagado?: number;
	saldo_pendiente?: number;
}
