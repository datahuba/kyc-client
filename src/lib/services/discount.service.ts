import { apiKyC } from '$lib/config';
import type { Discount, CreateDiscountRequest, UpdateDiscountRequest } from '$lib/interfaces';

class DiscountService {
	async getAll(
		page = 1,
		per_page = 10
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<Discount>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});
		return await apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<Discount>>(
			`/discounts/?${params.toString()}`
		);
	}

	async create(data: CreateDiscountRequest): Promise<Discount> {
		return await apiKyC.post<Discount>('/discounts/', data);
	}

	async update(id: string, data: UpdateDiscountRequest): Promise<Discount> {
		return await apiKyC.put<Discount>(`/discounts/${id}`, data);
	}

	async delete(id: string): Promise<Discount> {
		return await apiKyC.delete<Discount>(`/discounts/${id}`);
	}

	async addStudent(discountId: string, studentId: string): Promise<Discount> {
		return await apiKyC.post<Discount>(`/discounts/${discountId}/students/${studentId}`, {});
	}

	async removeStudent(discountId: string, studentId: string): Promise<Discount> {
		return await apiKyC.delete<Discount>(`/discounts/${discountId}/students/${studentId}`);
	}

	// ISSUE-P-DESCUENTO-RESOLUCION: subir/reemplazar el documento de resolución que respalda el descuento
	async uploadResolucion(discountId: string, file: File): Promise<Discount> {
		const formData = new FormData();
		formData.append('file', file);
		// F-FIX-TIMEOUT-60S-DISCOUNT (2026-08-09, Kevin): upload de PDF a
		// Cloudinary puede tardar >30s. customTimeout 60s.
		return await apiKyC.post<Discount>(`/discounts/${discountId}/resolucion`, formData, { customTimeout: 60000 });
	}
}

export const discountService = new DiscountService();
