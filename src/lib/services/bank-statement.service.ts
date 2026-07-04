import { apiKyC } from '$lib/config';
import type {
	BankStatementEntry,
	CreateBankStatementEntryRequest,
	BankStatementEntryFilters
} from '$lib/interfaces';

// ISSUE-P-EXTRACTO: registro y cruce MANUAL del extracto bancario
class BankStatementService {
	async getAll(
		page = 1,
		per_page = 20,
		filters?: BankStatementEntryFilters
	): Promise<import('$lib/interfaces/response.interface').PaginatedResponse<BankStatementEntry>> {
		const params = new URLSearchParams({
			page: page.toString(),
			per_page: per_page.toString()
		});

		if (filters?.fecha_desde) params.append('fecha_desde', filters.fecha_desde);
		if (filters?.fecha_hasta) params.append('fecha_hasta', filters.fecha_hasta);
		if (filters?.banco) params.append('banco', filters.banco);
		if (filters?.monto !== undefined) params.append('monto', filters.monto.toString());
		if (filters?.solo_sin_cruzar) params.append('solo_sin_cruzar', 'true');

		return await apiKyC.get<import('$lib/interfaces/response.interface').PaginatedResponse<BankStatementEntry>>(
			`/bank-statements/?${params.toString()}`
		);
	}

	async create(data: CreateBankStatementEntryRequest): Promise<BankStatementEntry> {
		return await apiKyC.post<BankStatementEntry>('/bank-statements/', data);
	}

	async match(entryId: string, paymentId: string): Promise<BankStatementEntry> {
		return await apiKyC.post<BankStatementEntry>(`/bank-statements/${entryId}/match`, {
			payment_id: paymentId
		});
	}

	async getForPayment(paymentId: string): Promise<BankStatementEntry | null> {
		return await apiKyC.get<BankStatementEntry | null>(`/bank-statements/by-payment/${paymentId}`);
	}
}

export const bankStatementService = new BankStatementService();
