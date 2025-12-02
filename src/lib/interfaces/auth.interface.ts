export interface LoginCredentials {
	username: string;
	password: string;
}

export interface LoginResponse {
	access_token: string;
	token_type: string;
	user_type: string;
	user_id: string;
	role: string;
}
