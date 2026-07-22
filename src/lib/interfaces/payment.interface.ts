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
    metodo_pago?: string;
    en_ventana_reversion?: boolean; // ISSUE-P-REVERSION
    // F-COBRANZA-033 (2026-07-22): Kevin pidió ver en el detalle QUIÉN subió
    // el comprobante (estudiante o staff), no solo el "remitente" de la
    // transferencia. El backend ya retorna este campo (model_dump() incluye
    // todo el modelo Payment). El prefijo "STAFF:" indica que fue subido
    // por un usuario de cobranza/admin/superadmin.
    verificado_por?: string;
    // F-COBRANZA-033: nombre del estudiante resuelto por el backend
    // (enrich_payments_with_details_bulk). Útil para mostrar "Estudiante:
    // Juan Pérez" cuando verificado_por es "SISTEMA (auto-aprobación)".
    nombre_estudiante?: string;
    // F-COBRANZA-036 (2026-07-22): C.I. (carnet_identidad) del estudiante.
    // Si no tiene CI, cae al registro universitario. Pedido Lic. Sandra
    // Zabala para mostrar en la columna del reporte de caja.
    estudiante_ci?: string;
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
