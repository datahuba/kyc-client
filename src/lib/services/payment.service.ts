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

}

export const paymentService = new PaymentService();
