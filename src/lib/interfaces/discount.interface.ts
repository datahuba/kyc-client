export interface Discount {
	_id: string;
	activo: boolean;
	created_at: string;
	lista_estudiantes: string[];
	nombre: string;
	porcentaje: number;
	updated_at: string;
	nota_minima_requerida?: number | null; // ISSUE-P-RECALCULO-NOTA
}

export interface CreateDiscountRequest {
	activo: boolean;
	lista_estudiantes: string[];
	nombre: string;
	porcentaje: number;
	nota_minima_requerida?: number | null; // ISSUE-P-RECALCULO-NOTA
}

export interface UpdateDiscountRequest extends Partial<CreateDiscountRequest> {}
