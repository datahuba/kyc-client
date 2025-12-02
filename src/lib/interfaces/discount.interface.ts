export interface Discount {
	_id: string;
	activo: boolean;
	created_at: string;
	lista_estudiantes: string[];
	nombre: string;
	porcentaje: number;
	updated_at: string;
}

export interface CreateDiscountRequest {
	activo: boolean;
	lista_estudiantes: string[];
	nombre: string;
	porcentaje: number;
}

export interface UpdateDiscountRequest extends Partial<CreateDiscountRequest> {}
