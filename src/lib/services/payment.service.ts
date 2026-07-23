import { apiKyC } from '$lib/config';
import type { Payment, CreatePaymentFormData, UpdatePaymentRequest } from '$lib/interfaces';

class PaymentService {
	async getAll(
		page = 1,
		per_page = 10,
		filters?: {
			q?: string;
			estado?: string;
			curso_id?: string;
			estudiante_id?: string;
			tipo_concepto?: string;
		}
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<Payment>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});

		if (filters?.q) params.append('q', filters.q);
		if (filters?.estado) params.append('estado', filters.estado);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);
		if (filters?.tipo_concepto) params.append('tipo_concepto', filters.tipo_concepto);

		return await apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<Payment>>(
			`/payments/?${params.toString()}`
		);
	}

	async create(data: any): Promise<Payment> {
		const formData = new FormData();
		
		formData.append('inscripcion_id', data.inscripcion_id);
        formData.append('monto_comprobante', data.monto_comprobante.toString());
		
		// ISSUE-P-CANALES: Campos dinámicos agregados para el algoritmo de Prorrateo y Caja
		if (data.metodo_pago) formData.append('metodo_pago', data.metodo_pago);
		if (data.concepto) formData.append('concepto', data.concepto);
		if (data.numero_transaccion) formData.append('numero_transaccion', data.numero_transaccion);
        if (data.remitente) formData.append('remitente', data.remitente);
        if (data.banco) formData.append('banco', data.banco);
        if (data.fecha_comprobante) formData.append('fecha_comprobante', data.fecha_comprobante);
		if (data.cuenta_destino) formData.append('cuenta_destino', data.cuenta_destino);

		if (data.descuento_aplicado) {
			formData.append('descuento_aplicado', data.descuento_aplicado.toString());
		}

		// BUG FIX: Evitar que FormData envíe el string "null" a FastAPI si no hay archivo
		if (data.file && data.file !== null && data.file !== undefined) {
			formData.append('file', data.file);
		}

		return await apiKyC.post<Payment>('/payments/', formData);
	}

	async update(id: string, data: UpdatePaymentRequest): Promise<Payment> {
		return await apiKyC.put<Payment>(`/payments/${id}`, data);
	}

	async delete(id: string): Promise<Payment> {
		return await apiKyC.delete<Payment>(`/payments/${id}`);
	}

	async approve(id: string): Promise<Payment> {
		return await apiKyC.put<Payment>(`/payments/${id}/aprobar`, {});
	}

	async reject(id: string, motivo: string): Promise<Payment> {
		return await apiKyC.put<Payment>(`/payments/${id}/rechazar`, { motivo });
	}

	// ROLLBACK FINANCIERO (Anulación de pago)
	async revert(id: string, motivo: string): Promise<Payment> {
		return await apiKyC.put<Payment>(`/payments/${id}/anular`, { motivo });
	}

	// F-COBRANZA-011 (2026-07-21): Cobranza sube el comprobante de pago en
	// nombre del estudiante cuando este no puede hacerlo por sí mismo.
	// Restringido por backend a superadmin/admin/cobranza. La UI solo expone
	// este método desde el menú de 3 puntos en /app/payments.
	async uploadByEncargado(
		paymentId: string,
		file: File,
		opts?: { numero_transaccion?: string; remitente?: string; fecha_comprobante?: string }
	): Promise<Payment> {
		const formData = new FormData();
		formData.append('file', file);
		if (opts?.numero_transaccion) formData.append('numero_transaccion', opts.numero_transaccion);
		if (opts?.remitente) formData.append('remitente', opts.remitente);
		if (opts?.fecha_comprobante) formData.append('fecha_comprobante', opts.fecha_comprobante);
		return await apiKyC.post<Payment>(`/payments/${paymentId}/upload-by-encargado`, formData);
	}

	// F-COBRANZA-017 (2026-07-22): Cobranza REGISTRA un pago COMPLETO en
	// nombre del estudiante. A diferencia de uploadByEncargado (que solo
	// adjunta el comprobante a un pago existente), este método CREA un
	// pago nuevo desde cero con todos los datos. El pago nace APROBADO.
	// El botón "Añadir pago" en /app/payments (esquina superior derecha)
	// abre el modal AddPagoByStaffModal que invoca este método.
	async createByStaff(data: {
		estudiante_id: string;
		inscripcion_id: string;
		metodo_pago: string;
		monto_comprobante: number;
		cantidad_pago: number;
		concepto?: string;
		numero_transaccion?: string;
		banco?: string;
		remitente?: string;
		fecha_comprobante?: string;
		cuenta_destino?: string;
		file?: File;
	}): Promise<Payment> {
		const formData = new FormData();
		formData.append('estudiante_id', data.estudiante_id);
		formData.append('inscripcion_id', data.inscripcion_id);
		formData.append('metodo_pago', data.metodo_pago);
		formData.append('monto_comprobante', data.monto_comprobante.toString());
		formData.append('cantidad_pago', data.cantidad_pago.toString());
		if (data.concepto) formData.append('concepto', data.concepto);
		if (data.numero_transaccion) formData.append('numero_transaccion', data.numero_transaccion);
		if (data.banco) formData.append('banco', data.banco);
		if (data.remitente) formData.append('remitente', data.remitente);
		if (data.fecha_comprobante) formData.append('fecha_comprobante', data.fecha_comprobante);
		if (data.cuenta_destino) formData.append('cuenta_destino', data.cuenta_destino);
		if (data.file) formData.append('file', data.file);
		return await apiKyC.post<Payment>('/payments/by-staff', formData);
	}

	// ISSUE-P-DASHBOARD-COBRANZA: resumen económico agregado (incluye matrícula
	// como ingreso, respeta segmentación por curso). Solo roles económicos.
	async getResumenEconomico(): Promise<ResumenEconomico> {
		return await apiKyC.get<ResumenEconomico>('/payments/dashboard/resumen-economico');
	}

	// ISSUE-P-REPORTE: tabla interactiva de ingresos por fecha/curso/estado
	// F-COBRANZA-003 (2026-07-21): filtro opcional por estudiante_id.
	async getReporteCaja(
		page = 1,
		per_page = 20,
		filters?: {
			fecha_desde?: string;
			fecha_hasta?: string;
			curso_id?: string;
			estudiante_id?: string;
			estado?: string;
		}
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<Payment> & { resumen: ReporteCajaResumen }> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});
		if (filters?.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
		if (filters?.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);
		if (filters?.estado) params.append('estado', filters.estado);

		return await apiKyC.get(`/payments/reportes/caja?${params.toString()}`);
	}

	// ISSUE-P-REPORTE: descarga el Excel autenticado (requiere Authorization header,
	// por eso no se puede usar un <a href> directo como en un endpoint público)
	// F-COBRANZA-003 (2026-07-21): filtro opcional por estudiante_id.
	async downloadReporteCajaExcel(filters?: {
		fecha_desde?: string;
		fecha_hasta?: string;
		curso_id?: string;
		estudiante_id?: string;
		estado?: string;
	}): Promise<void> {
		const params = new URLSearchParams();
		if (filters?.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
		if (filters?.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);
		if (filters?.estado) params.append('estado', filters.estado);

		const blob = await apiKyC.getBlob(`/payments/reportes/excel?${params.toString()}`);
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `reporte_caja_${filters?.fecha_desde ?? ''}_${filters?.fecha_hasta ?? ''}.xlsx`;
		link.click();
		URL.revokeObjectURL(url);
	}

	// F-COBRANZA-043 (2026-07-22): descarga el PDF del Reporte de Caja.
	// Mismos datos que el XLSX + las 4 tarjetas KPI (Cantidad, Total Aprobado,
	// Total Pendiente, Total Anulado) en formato visual landscape A4.
	// Kevin: "se deberia pooder tener esa opcion de descargar como pdf en el
	// mismo modelo que creaste me gusto ... debe ser los mismos datos qu el
	// excel que exportas mas lo delc arte que te dije ahorita".
	async downloadReporteCajaPDF(filters?: {
		fecha_desde?: string;
		fecha_hasta?: string;
		curso_id?: string;
		estudiante_id?: string;
		estado?: string;
	}): Promise<void> {
		const params = new URLSearchParams();
		if (filters?.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
		if (filters?.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);
		if (filters?.estado) params.append('estado', filters.estado);

		const blob = await apiKyC.getBlob(`/payments/reportes/caja/pdf?${params.toString()}`);
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `reporte_caja_${filters?.fecha_desde ?? 'inicio'}_${filters?.fecha_hasta ?? 'hoy'}.pdf`;
		link.click();
		URL.revokeObjectURL(url);
	}

	// F-COBRANZA-016 (2026-07-21): exporta la lista de pagos a XLSX (reemplaza
	// al CSV manual). Mismas reglas de RBAC que GET /payments/.
	async downloadPaymentsExcel(filters?: {
		q?: string;
		estado?: string;
		curso_id?: string;
		estudiante_id?: string;
		tipo_concepto?: string;
	}): Promise<void> {
		const params = new URLSearchParams();
		if (filters?.q) params.append('q', filters.q);
		if (filters?.estado) params.append('estado', filters.estado);
		if (filters?.curso_id) params.append('curso_id', filters.curso_id);
		if (filters?.estudiante_id) params.append('estudiante_id', filters.estudiante_id);
		if (filters?.tipo_concepto) params.append('tipo_concepto', filters.tipo_concepto);

		const blob = await apiKyC.getBlob(`/payments/export/excel?${params.toString()}`);
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		const ts = new Date().toISOString().slice(0, 10);
		link.download = `pagos_${ts}.xlsx`;
		link.click();
		URL.revokeObjectURL(url);
	}

	// F-074 (2026-07-23): Vista Matricial de Pagos (estilo Excel de Sandra)
	// Filas = estudiantes, columnas = MATRÍCULA | MODULO 1..N | TOTAL INGRESOS | POR COBRAR
	async getMatriz(moduloIndex?: number | null): Promise<MatrizPagosResponse> {
		const params = new URLSearchParams();
		if (moduloIndex !== null && moduloIndex !== undefined) {
			params.append('modulo_index', String(moduloIndex));
		}
		const qs = params.toString();
		const url = qs ? `/payments/matriz?${qs}` : '/payments/matriz';
		return await apiKyC.get<MatrizPagosResponse>(url);
	}

	async getResumenModulos(): Promise<ResumenModulosResponse> {
		return await apiKyC.get<ResumenModulosResponse>('/payments/resumen-modulos');
	}

}

export interface ReporteCajaResumen {
	cantidad_pagos: number;
	total_aprobado: number;
	total_pendiente: number;
	total_anulado: number;
}

export interface ResumenEconomico {
	ingreso_matricula: number;
	ingreso_colegiatura: number;
	total_ingresos: number;
	total_esperado: number;
	por_cobrar: number;
	cobros_pendientes: number;
	total_inscritos: number;
}

// F-074 (2026-07-23): Tipos para la vista matricial de pagos
export interface MatrizModulo {
	i: number;
	nombre: string;
	costo: number;
	monto_pagado: number;
	estado: 'Pendiente' | 'Parcial' | 'Pagado' | string;
	por_cobrar: number;
}

export interface MatrizEstudiante {
	estudiante_id: string;
	nombre: string;
	registro: string;
	curso_id: string;
	curso_nombre: string;
	estado_inscripcion: string;
	matricula_pagada: boolean;
	matricula_monto: number;
	matricula_pagado: number;
	modulos: MatrizModulo[];
	total_ingresos: number;
	por_cobrar: number;
	// F-074-FIX-4 (2026-07-23): auditoría de descuentos/becas
	beca_porcentaje: number;
	ahorro: number;
	costo_sin_descuento: number;
	pago_todo: boolean;
}

export interface MatrizCurso {
	_id: string;
	nombre: string;
	codigo?: string;
	modulos: string[];
}

export interface MatrizTotales {
	matricula: {
		costo_total: number;
		pagado: number;
		pendiente: number;
		estudiantes_pagaron: number;
	};
	modulos: Array<{
		i: number;
		nombre: string;
		costo_total: number;
		pagado: number;
		pendiente: number;
		estudiantes_pagaron: number;
		estudiantes_pendientes: number;
	}>;
	total_ingresos: number;
	por_cobrar: number;
	total_inscritos: number;
	// F-074-FIX-4: contadores globales
	estudiantes_pagaron_todo: number;
	estudiantes_con_beca: number;
	ahorro_total_por_descuentos: number;
}

export interface MatrizPagosResponse {
	cursos: MatrizCurso[];
	estudiantes: MatrizEstudiante[];
	totales_por_columna: MatrizTotales;
	filtros_aplicados: {
		modulo_index: number | null;
		cursos_count: number;
	};
}

export interface ResumenModulosResponse {
	matricula: {
		cantidad_pagos: number;
		monto_total: number;
		monto_pendiente: number;
		estudiantes_cursando: number;
	};
	modulos: Array<{
		i: number;
		nombre: string;
		cantidad_pagos: number;
		monto_total: number;
		monto_pendiente: number;
		estudiantes_cursando: number;
	}>;
}

export const paymentService = new PaymentService();
