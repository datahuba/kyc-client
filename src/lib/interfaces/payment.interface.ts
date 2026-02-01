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
	// Campos nuevos opcionales para no romper los pagos viejos
    banco?: string;
    remitente?: string;
    cuenta_destino?: string;
    monto_comprobante?: number;
    fecha_comprobante?: string;
}

export interface CreatePaymentFormData {
	file: File;
	inscripcion_id: string;
	numero_transaccion: string;
	descuento_aplicado?: number;
	// Nuevos campos obligatorios para la creación
    remitente: string;
    banco: string;
    monto_comprobante: number;
    fecha_comprobante: string;
    cuenta_destino: string;
}

export interface UpdatePaymentRequest extends Partial<CreatePaymentFormData> {
	estado_pago?: string;
	fecha_pagada?: string;
}
