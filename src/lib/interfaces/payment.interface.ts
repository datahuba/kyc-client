export interface Payment {
	_id: string;
	cantidad_pago: number;
	concepto: string;
	created_at: string;
	curso_id: string;
	descuento_aplicado: number;
	estado_pago: string;
	estudiante_id: string;
	fecha_subida: string;
	imagen_voucher_url: string;
	inscripcion_id: string;
	numero_transaccion: string;
	updated_at: string;
}

export interface CreatePaymentRequest {
	inscripcion_id: string;
	estudiante_id: string;
	curso_id: string;
	numero_transaccion: string;
	concepto: string;
	cantidad_pago: number;
	descuento_aplicado: number;
	imagen_voucher_url: string;
	numero_cuota: number;
}

export interface UpdatePaymentRequest extends Partial<CreatePaymentRequest> {
	estado_pago?: string;
	fecha_pagada?: string;
}
