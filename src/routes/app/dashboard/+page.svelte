<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import AdminDashboard from './components/AdminDashboard.svelte';
	import StudentDashboard from './components/StudentDashboard.svelte';
	import TeacherDashboard from './components/TeacherDashboard.svelte';
	
	let role = $derived($userStore.role || $userStore.user?.rol || '');
</script>

<!-- ISSUE L/M: Agregados 'mae' y 'cobranza' al Dashboard Administrativo -->
{#if ['superadmin', 'admin', 'mae', 'cobranza'].includes(role)}
	<AdminDashboard />
{:else if ['teacher', 'docente'].includes(role)}
	<TeacherDashboard />
{:else if role === 'student'}
	<StudentDashboard />
{:else}
	<!-- Fallback visual mientras el store resuelve el rol del usuario -->
	<div class="flex items-center justify-center h-64">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
	</div>
{/if}
