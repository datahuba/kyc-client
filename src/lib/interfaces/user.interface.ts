export type Role = 'docente' | 'admin' | 'superadmin' | 'mae' | 'cpd' | 'cobranza' | null;
export type UserType = 'user' | 'student';

export interface User {
	_id: string;
	username: string;
	email: string;
	role: Role;
	rol?: Role;
	user_type?: UserType; // 'user' for admin/teacher, 'student' for students
	activo: boolean;
	ultimo_acceso: string;
	created_at: string;
	updated_at: string;
	foto_url?: string; // Optional as it wasn't in the snippet but used in header
}


export interface CreateUserRequest {
	username: string;
	email: string;
	password?: string; // Optional for update? No, required for create.
	role: Role;
	activo?: boolean;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {}

// Keep UserResponse for backward compatibility if needed, or alias it
export type UserResponse = User;
