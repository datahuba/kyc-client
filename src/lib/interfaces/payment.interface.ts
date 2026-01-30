export interface Payment {
	_id: string;
	cantidad_pago: number;
	comprobante_url: string;
	concepto: string;
	created_at: string;
	curso_id: string;
	estado_pago: string;
	estudiante_id: string;
	fecha_subida: string;
	inscripcion_id: string;
	numero_transaccion: string;
	updated_at: string;
}

export interface CreatePaymentFormData {
	file: File;
	inscripcion_id: string;
	numero_transaccion: string;
	remitente: string;
	fecha_comprobante: string; // YYYY-MM-DD
	monto_comprobante: number;
	banco: string;
	glosa?: string;
	cuenta_destino: string;
	descuento_aplicado?: number;
}

export interface UpdatePaymentRequest extends Partial<CreatePaymentFormData> {
	estado_pago?: string;
	fecha_pagada?: string;
}
