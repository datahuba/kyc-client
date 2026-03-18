import { redirect } from '@sveltejs/kit';
import { get } from 'svelte/store';
import { userStore } from '$lib/stores/userStore';

export function load() {
	const state = get(userStore);
	const loginType = state.loginType;
	const academicRole = state.academicRole;

	console.log('📍 Page Redirect (classroom):');
	console.log(`  loginType: ${loginType}`);
	console.log(`  academicRole: ${academicRole}`);

	if (loginType === 'admin') {
		console.log('  → Redirigiendo a /app/classroom/admin');
		throw redirect(307, '/app/classroom/admin');
	} else if (loginType === 'academic' && academicRole === 'teacher') {
		console.log('  → Redirigiendo a /app/classroom/docente');
		throw redirect(307, '/app/classroom/docente');
	} else if (loginType === 'academic' && academicRole === 'student') {
		console.log('  → Redirigiendo a /app/classroom/estudiante');
		throw redirect(307, '/app/classroom/estudiante');
	} else {
		console.log('  → Redirigiendo a /app/classroom/estudiante (fallback)');
		throw redirect(307, '/app/classroom/estudiante');
	}
}
