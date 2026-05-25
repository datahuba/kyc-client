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
		const isAdminUser = user.role === 'admin' || user.role === 'superadmin';
		const isStudentUser = user.user_type === 'student';
		const isTeacherUser = user.user_type === 'user' && !isAdminUser;

		if (currentType === 'admin') {
			return isAdminUser
				? null
				: 'Estas credenciales no corresponden al portal Administrativo. Usa el portal Académico.';
		}

		if (currentType === 'academic' && currentAcademicRole === 'teacher') {
			return isTeacherUser
				? null
				: 'Estas credenciales no corresponden al portal de Docentes. Usa el portal correcto.';
		}

		if (currentType === 'academic' && currentAcademicRole === 'student') {
			return isStudentUser
				? null
				: 'Estas credenciales no corresponden al portal de Estudiantes. Usa el portal correcto.';
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
					// Admin, superadmin y docente (colección User) usan /auth/login
					loginResponse = await authService.login(credentials);
				}
				
				const token = loginResponse.access_token; 
				
				if (browser) {
					localStorage.setItem(AUTH_TOKEN_KEY, token);
				}

				// Fetch user details to sync with actual user type on server
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
				
				// Debug logging
				console.log('🔍 DEBUG LOGIN:');
				console.log('  user:', user);
				console.log('  user.user_type:', user.user_type);
				console.log('  user.role:', user.role);
				
				// IMPORTANTE: Sincronizar loginType y academicRole basado en user_type del servidor
				let syncedLoginType: 'admin' | 'academic' | null = null;
				let syncedAcademicRole: 'teacher' | 'student' | null = null;
				
				if (user.user_type === 'student') {
					// Es estudiante
					syncedLoginType = 'academic';
					syncedAcademicRole = 'student';
					console.log('  ✅ Sincronizado como ESTUDIANTE');
				} else if (user.user_type === 'user') {
					// Es admin o docente
					if (user.role === 'admin' || user.role === 'superadmin') {
						syncedLoginType = 'admin';
						syncedAcademicRole = null;
						console.log('  ✅ Sincronizado como ADMIN');
					} else {
						// Docente
						syncedLoginType = 'academic';
						syncedAcademicRole = 'teacher';
						console.log('  ✅ Sincronizado como DOCENTE');
					}
				} else {
					console.log('  ❌ user_type NO RECONOCIDO:', user.user_type);
					// Fallback: mantener los valores actuales
					syncedLoginType = currentType;
					syncedAcademicRole = currentAcademicRole;
				}
				
				// Guardar sincronizado en localStorage
				if (browser) {
					if (syncedLoginType) {
						localStorage.setItem(LOGIN_TYPE_KEY, syncedLoginType);
						console.log(`  ✅ localStorage[${LOGIN_TYPE_KEY}] = ${syncedLoginType}`);
					}
					if (syncedAcademicRole) {
						localStorage.setItem(ACADEMIC_ROLE_KEY, syncedAcademicRole);
						console.log(`  ✅ localStorage[${ACADEMIC_ROLE_KEY}] = ${syncedAcademicRole}`);
					} else {
						localStorage.removeItem(ACADEMIC_ROLE_KEY);
						console.log(`  ✅ localStorage[${ACADEMIC_ROLE_KEY}] REMOVED`);
					}
				}

				update(state => ({
					...state,
					user,
					token,
					isAuthenticated: true,
					loading: false,
					role: user.role,
					loginType: syncedLoginType,
					academicRole: syncedAcademicRole
				}));
				
				console.log('  📊 Store actualizado:');
				console.log(`    loginType: ${syncedLoginType}`);
				console.log(`    academicRole: ${syncedAcademicRole}`);
				
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

		logout: () => {
			if (browser) {
				localStorage.removeItem(AUTH_TOKEN_KEY);
				localStorage.removeItem(USER_DATA_KEY);
				localStorage.removeItem(AUTH_TOKEN_EXPIRY_KEY);
				// Keep LOGIN_TYPE_KEY and ACADEMIC_ROLE_KEY for quick re-login with same role
			}
			set(initialState);
			// Restore login type and academic role so user can re-login with same role selection
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
