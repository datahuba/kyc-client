<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import AdminDashboard from './components/AdminDashboard.svelte';
	import StudentDashboard from './components/StudentDashboard.svelte';
	import TeacherDashboard from './components/TeacherDashboard.svelte';

	let role = $derived($userStore.role || $userStore.user?.rol || '');
	let isLoading = $derived($userStore.loading);
	// Roles administrativos que comparten el Dashboard general (ISSUE-R-ROLES:
	// cpd/encargado_curso/coordinador agregados — faltaban aquí y causaban un
	// spinner infinito silencioso para esos roles).
	const ADMIN_DASHBOARD_ROLES = ['superadmin', 'admin', 'mae', 'cobranza', 'cpd', 'encargado_curso', 'coordinador'];
</script>

{#if isLoading}
	<div class="flex items-center justify-center h-64">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
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
