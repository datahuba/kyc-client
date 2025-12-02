import { apiKyC } from '$lib/config';
import type { Discount, CreateDiscountRequest, UpdateDiscountRequest } from '$lib/interfaces';

class DiscountService {
	async getAll(skip = 0, limit = 100): Promise<Discount[]> {
		return await apiKyC.get<Discount[]>(`/discounts/?skip=${skip}&limit=${limit}`);
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
