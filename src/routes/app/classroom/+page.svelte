<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';

	onMount(() => {
		const loginType = $userStore.loginType;
		const academicRole = $userStore.academicRole;

		if (loginType === 'admin') {
			// Administrativo → vista de administración (crear clases, enlazar docentes)
			goto('/app/classroom/admin', { replaceState: true });
		} else if (loginType === 'academic' && academicRole === 'teacher') {
			// Docente → vista docente
			goto('/app/classroom/docente', { replaceState: true });
		} else {
			// Estudiante → vista estudiante
			goto('/app/classroom/estudiante', { replaceState: true });
		}
	});
</script>

<!-- Redirigiendo según rol... -->
<div class="flex items-center justify-center h-64">
	<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
</div>
