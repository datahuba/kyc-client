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
}

export const discountService = new DiscountService();
