<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import AdminDashboard from './components/AdminDashboard.svelte';
	import StudentDashboard from './components/StudentDashboard.svelte';
	import TeacherDashboard from './components/TeacherDashboard.svelte';
	import { onMount } from 'svelte';
	import { alert } from '$lib/utils';

	let role = $derived($userStore.role || $userStore.user?.rol || '');
	let isLoading = $derived($userStore.loading);

	// ISS-003: detectar si el loading se queda colgado (>8s) y mostrar error visible
	// en lugar de un spinner infinito silencioso.
	let loadingStuck = $state(false);
	let loadingTimer: any;

	$effect(() => {
		if (isLoading) {
			loadingStuck = false;
			if (loadingTimer) clearTimeout(loadingTimer);
			loadingTimer = setTimeout(() => {
				if ($userStore.loading) {
					loadingStuck = true;
					alert('warning', 'La carga del dashboard está tardando. Verifica tu conexión.');
				}
			}, 8000);
		} else {
			loadingStuck = false;
			if (loadingTimer) clearTimeout(loadingTimer);
		}
	});

	// Roles administrativos que comparten el Dashboard general (ISSUE-R-ROLES:
	// cpd/encargado_curso/coordinador agregados — faltaban aquí y causaban un
	// spinner infinito silencioso para esos roles).
	const ADMIN_DASHBOARD_ROLES = ['superadmin', 'admin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'];

	// ISS-003: función para reintentar carga
	function retry() {
		location.reload();
	}
</script>

{#if isLoading && !loadingStuck}
	<div class="flex items-center justify-center h-64">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
	</div>
{:else if loadingStuck}
	<div class="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
		<svg class="size-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
		<p class="text-base font-semibold text-gray-700 dark:text-gray-300">La carga está tardando más de lo normal</p>
		<p class="text-sm text-gray-500 dark:text-gray-400 max-w-md">
			Verificá tu conexión a internet. Si el problema persiste, intentá recargar la página.
		</p>
		<button
			type="button"
			onclick={retry}
			class="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 active:scale-95 transition-all"
		>
			<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
			Reintentar
		</button>
	</div>
{:else if ADMIN_DASHBOARD_ROLES.includes(role)}
	<AdminDashboard />
{:else if ['teacher', 'docente'].includes(role)}
	<TeacherDashboard />
{:else if role === 'student'}
	<StudentDashboard />
{:else}
	<!-- Rol resuelto pero no reconocido: mostrar el error en vez de un spinner
	     infinito silencioso, para que un bug de RBAC nunca quede invisible. -->
	<div class="flex flex-col items-center justify-center h-64 gap-3 text-center px-4">
		<svg class="size-10 text-light-error dark:text-dark-error" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
		<p class="text-sm font-semibold text-gray-700 dark:text-gray-300">No se pudo determinar tu panel de inicio.</p>
		<p class="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
			Rol detectado: <code class="font-mono">{role || 'ninguno'}</code>. Si esto persiste,
			cierra sesión y vuelve a ingresar, o contacta a soporte.
		</p>
	</div>
{/if}
