// ISSUE-Q-DOCUMENTOS-KYC (2026-07-09): estado de un documento/requisito que
// el estudiante debe subir para su inscripción (ej. CV, fotocopia de CI).
export interface Requisito {
	descripcion: string;
	estado: 'pendiente' | 'en_proceso' | 'aprobado' | 'rechazado';
	url?: string | null;
	motivo_rechazo?: string | null;
	revisado_por?: string | null;
	fecha_subida?: string | null;
}

export interface Enrollment {
	modulos: any;
	_id: string;
	// Fallback defensivo de `._id` usado en algunos componentes (ej. cobro en Caja).
	id?: string;
	requisitos?: Requisito[]; // ISSUE-Q-DOCUMENTOS-KYC
	cantidad_cuotas: number;
	costo_matricula: number;
	costo_total: number;
	created_at: string;
	curso_id: string;
	descuento_curso_aplicado: number;
	descuento_personalizado: number;
	descuento_curso_id?: string;
	descuento_estudiante_id?: string;
	// ISSUE-P-CARGO-MULTIITEM (2026-07-08): snapshot de la lista de ítems de
	// cargo adicional/complementario al programa, si el curso los tenía
	// definidos al inscribirse.
	cargo_adicional_items?: { nombre: string; costo: number }[];
	estado: string;
	estudiante_id: string;
	fecha_inscripcion: string;
	saldo_pendiente: number;
	total_a_pagar: number;
	total_pagado: number;
	updated_at: string;
	// Campos académicos y calculados que el backend (EnrollmentResponse) ya
	// devuelve; declarados aquí para eliminar errores de tipo en el kardex/libreta.
	nota_final?: number | null;
	nota_minima_beca?: number | null;
	siguiente_pago?: { concepto: string; numero_cuota: number; monto_sugerido: number } | null;
	cuotas_pagadas_info?: { cuotas_pagadas: number; cuotas_totales: number; porcentaje: number } | null;
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

// F-COBRANZA-035 (2026-07-22): resumen de inscritos para vista KPI.
// Pedido Lic. Sandra Zabala: "diferencia del total de inscritos
// inicialmente, cuantos son los activo y cuantos los pasivos".
export interface EnrollmentPasivos {
	total: number;
	congelado: number;
	pasivo: number;
	abandono: number;
}

export interface EnrollmentResumen {
	total_inicial: number;   // todos los inscritos MENOS cancelados
	activos: number;         // activo + pendiente_pago
	pendientes_pago: number; // sub-categoria de activos
	pasivos: EnrollmentPasivos;
	completados: number;
	cancelados: number;      // NO cuentan como inscritos
	curso_id: string | null;
}
