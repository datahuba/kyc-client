import type { Role } from "$lib/interfaces";

export function getRouteByRole(role: Role): string {
	switch (role) {
		case 'superadmin':
		case 'admin':
			return '/app/dashboard';
		case 'student':
			return '/app/students/dashboard';
		default:
			return '/app/dashboard'; // Default fallback
	}
}
