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
	academicRole: 'teacher' | 'student' | null;
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

	function clearAuthStorage() {
		if (!browser) return;
		localStorage.removeItem(AUTH_TOKEN_KEY);
		localStorage.removeItem(USER_DATA_KEY);
		localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
	}

	function validatePortalAccess(
		currentType: 'admin' | 'academic' | null,
		currentAcademicRole: 'teacher' | 'student' | null,
		user: UserResponse
	): string | null {
		// ISSUE M: Ampliación de validación de roles de la UAGRM
		const userRole = user.role || user.rol;
		const isAdminOrStaff = ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole as string);
		const isStudentUser = user.user_type === 'student';
		const isTeacherUser = userRole === 'docente' || userRole === 'teacher';

		if (currentType === 'admin') {
			return isAdminOrStaff
				? null
				: 'Estas credenciales no corresponden al portal Administrativo. Utilice el acceso que le corresponde.';
		}

		if (currentType === 'academic' && currentAcademicRole === 'teacher') {
			return isTeacherUser
				? null
				: 'Estas credenciales no corresponden al portal de Docentes.';
		}

		if (currentType === 'academic' && currentAcademicRole === 'student') {
			return isStudentUser
				? null
				: 'Estas credenciales no corresponden al portal de Estudiantes.';
		}

		return 'Primero selecciona un portal de acceso válido.';
	}

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
			let currentAcademicRole: 'teacher' | 'student' | null = null;
			
			update(state => {
				currentType = state.loginType;
				currentAcademicRole = state.academicRole;
				return { ...state, loading: true, error: null };
			});

			try {
				let loginResponse;
				if (currentType === 'academic' && currentAcademicRole === 'student') {
					loginResponse = await authService.loginStudent(credentials);
				} else {
					// Jerarquía administrativa y docente usan la misma colección de Users
					loginResponse = await authService.login(credentials);
				}
				
				const token = loginResponse.access_token; 
				
				if (browser) {
					localStorage.setItem(AUTH_TOKEN_KEY, token);
				}

				const user = await authService.getMe();
				const portalMismatchMessage = validatePortalAccess(currentType, currentAcademicRole, user);

				if (portalMismatchMessage) {
					clearAuthStorage();
					update(state => ({
						...state,
						user: null,
						token: null,
						isAuthenticated: false,
						loading: false,
						error: portalMismatchMessage,
						role: null
					}));
					throw new Error(portalMismatchMessage);
				}
				
				const userRole = user.role || user.rol;
				
				// Sincronización estricta basada en el rol del servidor
				let syncedLoginType: 'admin' | 'academic' | null = null;
				let syncedAcademicRole: 'teacher' | 'student' | null = null;
				
				if (user.user_type === 'student') {
					syncedLoginType = 'academic';
					syncedAcademicRole = 'student';
				} else if (userRole === 'docente' || userRole === 'teacher') {
					syncedLoginType = 'academic';
					syncedAcademicRole = 'teacher';
				} else if (['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(userRole as string)) {
					syncedLoginType = 'admin';
					syncedAcademicRole = null;
				} else {
					// Fallback de seguridad
					syncedLoginType = currentType;
					syncedAcademicRole = currentAcademicRole;
				}
				
				if (browser) {
					if (syncedLoginType) localStorage.setItem(LOGIN_TYPE_KEY, syncedLoginType);
					if (syncedAcademicRole) localStorage.setItem(ACADEMIC_ROLE_KEY, syncedAcademicRole);
					else localStorage.removeItem(ACADEMIC_ROLE_KEY);
				}

				update(state => ({
					...state,
					user,
					token,
					isAuthenticated: true,
					loading: false,
					role: userRole,
					loginType: syncedLoginType,
					academicRole: syncedAcademicRole
				}));
				
				if (browser) {
					localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
				}

			} catch (error: unknown) {
				clearAuthStorage();
				update(state => ({
					...state,
					loading: false,
					error: error instanceof Error ? error.message : 'Error al iniciar sesión'
				}));
				throw error;
			}
		},

		// ISSUE-Q-PRE: actualiza campos puntuales del usuario en memoria y en
		// localStorage sin necesitar un nuevo login (ej. tras aceptar términos).
		updateCurrentUser: (partial: Partial<UserResponse>) => {
			update(state => {
				if (!state.user) return state;
				const updatedUser = { ...state.user, ...partial };
				if (browser) {
					localStorage.setItem(USER_DATA_KEY, JSON.stringify(updatedUser));
				}
				return { ...state, user: updatedUser };
			});
		},

		logout: () => {
			if (browser) {
				localStorage.removeItem(AUTH_TOKEN_KEY);
				localStorage.removeItem(USER_DATA_KEY);
				localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
			}
			set(initialState);
			if (browser) {
				const loginType = localStorage.getItem(LOGIN_TYPE_KEY) as 'admin' | 'academic' | null;
				const academicRole = localStorage.getItem(ACADEMIC_ROLE_KEY) as 'teacher' | 'student' | null;
				if (loginType || academicRole) {
					update(state => ({ ...state, loginType, academicRole }));
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
						const userRole = user.role || user.rol;
						
						set({
							user,
							token,
							isAuthenticated: true,
							loading: false,
							error: null,
							loginType,
							academicRole,
							role: userRole
						});
					} catch (e) {
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
