import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { authService } from '$lib/services/auth.service';
import type { UserResponse, LoginCredentials, Role } from '$lib/interfaces';
import { AUTH_TOKEN_EXPIRY_KEY, AUTH_TOKEN_KEY, LOGIN_TYPE_KEY, USER_DATA_KEY, ACADEMIC_ROLE_KEY } from '$lib/constants';

interface UserState {
	user: UserResponse | null;
	token: string | null;
	isAuthenticated: boolean;
	loading: boolean;
	error: string | null;
	loginType: 'admin' | 'academic' | null;
	academicRole: 'teacher' | 'student' | null; // Only used when loginType is 'academic'
	role: Role;
}

const initialState: UserState = {
	user: null,
	token: null,
	isAuthenticated: false,
	loading: false,
	error: null,
	loginType: null,
	academicRole: null,
	role: null
};

function createUserStore() {
	const { subscribe, set, update } = writable<UserState>(initialState);

	return {
		subscribe,
		
		setLoginType: (type: 'admin' | 'academic' | null) => {
			update(state => ({ ...state, loginType: type }));
			if (browser) {
				if (type) {
					localStorage.setItem(LOGIN_TYPE_KEY, type);
				} else {
					localStorage.removeItem(LOGIN_TYPE_KEY);
				}
			}
		},

		setAcademicRole: (academicRole: 'teacher' | 'student' | null) => {
			update(state => ({ ...state, academicRole }));
			if (browser) {
				if (academicRole) {
					localStorage.setItem(ACADEMIC_ROLE_KEY, academicRole);
				} else {
					localStorage.removeItem(ACADEMIC_ROLE_KEY);
				}
			}
		},

		login: async (credentials: LoginCredentials) => {
			let currentType: 'admin' | 'academic' | null = null;
			
			update(state => {
				currentType = state.loginType;
				return { ...state, loading: true, error: null };
			});

			try {
				let loginResponse;
				if (currentType === 'academic') {
					loginResponse = await authService.loginStudent(credentials);
				} else {
					// Default to admin if not specified or explicitly admin
					loginResponse = await authService.login(credentials);
				}
				
				const token = loginResponse.access_token; 
				
				if (browser) {
					localStorage.setItem(AUTH_TOKEN_KEY, token);
				}

				// Fetch user details
				const user = await authService.getMe();

				update(state => ({
					...state,
					user,
					token,
					isAuthenticated: true,
					loading: false,
					role: user.role
				}));
				
				if (browser) {
					localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
				}

			} catch (error: unknown) {
				update(state => ({
					...state,
					loading: false,
					error: error instanceof Error ? error.message : 'Error al iniciar sesión'
				}));
				throw error;
			}
		},

		logout: () => {
			if (browser) {
				localStorage.removeItem(AUTH_TOKEN_KEY);
				localStorage.removeItem(USER_DATA_KEY);
				localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
				localStorage.removeItem(ACADEMIC_ROLE_KEY);
			}
			set(initialState);
			// Restore login type if it exists in local storage so the UI knows where to go
			if (browser) {
				const loginType = localStorage.getItem(LOGIN_TYPE_KEY) as 'admin' | 'academic' | null;
				if (loginType) {
					update(state => ({ ...state, loginType }));
				}
			}
		},

		init: () => {
			if (browser) {
				const token = localStorage.getItem(AUTH_TOKEN_KEY);
				const userData = localStorage.getItem(USER_DATA_KEY);
				const loginType = localStorage.getItem(LOGIN_TYPE_KEY) as 'admin' | 'academic' | null;
				const academicRole = localStorage.getItem(ACADEMIC_ROLE_KEY) as 'teacher' | 'student' | null;
				
				if (token && userData) {
					try {
						const user = JSON.parse(userData);
						set({
							user,
							token,
							isAuthenticated: true,
							loading: false,
							error: null,
							loginType,
							academicRole,
							role: user.role
						});
					} catch (e) {
						console.error('Error parsing user data from local storage', e);
						localStorage.removeItem(AUTH_TOKEN_KEY);
						localStorage.removeItem(USER_DATA_KEY);
						set({ ...initialState, loginType, academicRole });
					}
				} else {
					set({ ...initialState, loginType, academicRole });
				}
			}
		}
	};
}

export const userStore = createUserStore();
