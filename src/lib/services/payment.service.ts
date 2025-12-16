import { apiKyC } from '$lib/config';
import type { Payment, CreatePaymentRequest, UpdatePaymentRequest } from '$lib/interfaces';

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

	async create(data: CreatePaymentRequest): Promise<Payment> {
		return await apiKyC.post<Payment>('/payments/', data);
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

}

export const paymentService = new PaymentService();
