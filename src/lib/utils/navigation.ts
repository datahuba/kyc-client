import type { Role } from "$lib/interfaces";

export function getRouteByRole(
	role: Role,
	loginType?: 'admin' | 'academic' | null,
	academicRole?: 'teacher' | 'student' | null
): string {
	// For academic login, use academicRole to determine route
	if (loginType === 'academic') {
		if (academicRole === 'teacher') {
			return '/app/classroom'; // Teachers go to classroom
		} else {
			return '/app/students/dashboard'; // Students go to their dashboard
		}
	}

	// For admin and regular logins, use the role. Se compara como string porque
	// el tipo Role no incluye 'student' (los estudiantes entran por academicRole
	// arriba); mantener el case preserva el comportamiento sin error de tipos.
	switch (role as string) {
		case 'superadmin':
		case 'admin':
			return '/app/dashboard';
		case 'student':
			return '/app/students/dashboard';
		default:
			return '/app/dashboard'; // Default fallback
	}
}
