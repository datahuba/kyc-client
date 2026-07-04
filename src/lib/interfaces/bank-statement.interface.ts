// ISSUE-P-EXTRACTO: registro y cruce MANUAL del extracto bancario (sin integración con el banco por ahora)

export interface BankStatementEntry {
	_id: string;
	fecha_movimiento: string;
	banco: string;
	monto: number;
	tipo_movimiento: 'deposito' | 'transferencia';
	referencia?: string | null;
	origen: 'manual' | 'importado';
	registrado_por: string;
	payment_id?: string | null;
	notas?: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreateBankStatementEntryRequest {
	fecha_movimiento: string;
	banco: string;
	monto: number;
	tipo_movimiento: 'deposito' | 'transferencia';
	referencia?: string;
	notas?: string;
}

export interface BankStatementEntryFilters {
	fecha_desde?: string;
	fecha_hasta?: string;
	banco?: string;
	monto?: number;
	solo_sin_cruzar?: boolean;
}
