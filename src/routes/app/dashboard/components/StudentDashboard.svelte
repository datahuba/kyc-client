<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { enrollmentService, courseService } from '$lib/services';
	import type { Enrollment, Course } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';
	import { formatCurrency, formatDate } from '$lib/utils';

	let enrollments: Enrollment[] = $state([]);
	let coursesMap: Record<string, Course> = $state({});
	let loading = $state(true);

	// Variables derivadas para las estadísticas rápidas
	let totalDeuda = $derived(enrollments.reduce((sum, enr) => sum + (enr.saldo_pendiente || 0), 0));
	let cursosActivos = $derived(enrollments.filter(e => e.estado === 'activo' || e.estado === 'pendiente_pago').length);

	onMount(async () => {
		if ($userStore.user?._id) {
			try {
				const [enrRes, coursesRes] = await Promise.all([
					enrollmentService.getByStudentId($userStore.user._id),
					courseService.getAll(1, 100)
				]);
				
				enrollments = Array.isArray(enrRes) ? enrRes : (enrRes as any).data || [];
				const courses = coursesRes.data || [];
				courses.forEach(c => coursesMap[c._id] = c);
			} catch (error) {
				console.error("Error al cargar dashboard de estudiante", error);
			} finally {
				loading = false;
			}
		}
	});
</script>

<div class="space-y-8">
	{#if loading}
		<DashboardSkeleton />
	{:else}
		<!-- 1. Tarjeta de Bienvenida y Perfil Rápido -->
		<div class="bg-slate-900 rounded-2xl shadow-xl p-8 sm:p-10 text-white overflow-hidden relative">
			<!-- Decoración de fondo -->
			<div class="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl pointer-events-none"></div>
			<div class="absolute bottom-0 right-32 -mb-10 w-32 h-32 bg-white opacity-5 rounded-full blur-xl pointer-events-none"></div>
			
			<div class="relative z-10 flex flex-col md:flex-row items-center gap-6">
				<!-- Avatar Letra -->
				<div class="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center text-4xl font-extrabold shadow-inner shrink-0 text-white">
					{$userStore.user?.nombre?.charAt(0).toUpperCase() || 'E'}
				</div>
				
				<!-- Info Estudiante -->
				<div class="text-center md:text-left flex-1">
					<!-- SUGERENCIA IMPLEMENTADA: Mensaje de bienvenida personalizado con nombre completo -->
					<h2 class="text-3xl font-bold mb-2 text-white">¡Bienvenido, {$userStore.user?.nombre || 'Estudiante'}!</h2>
					<p class="text-slate-300 mb-5 text-base font-medium">Bienvenido a tu portal académico de postgrado de la UAGRM.</p>
					
					<div class="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm font-medium">
						<div class="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shadow-sm text-slate-200">
							<svg class="size-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
							<!-- BUG 1 SOLUCIONADO: Mapeo seguro con tres opciones de fallback (registro, codigo_registro o username) -->
							<span>Registro: {$userStore.user?.registro || $userStore.user?.codigo_registro || $userStore.user?.username || 'N/A'}</span>
						</div>
						<div class="flex items-center gap-2 bg-slate-800 px-4 py-2 rounded-xl border border-slate-700 shadow-sm text-slate-200">
							<svg class="size-4 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
							<span>{$userStore.user?.email || 'No registrado'}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 2. Tarjetas de Estadísticas Globales -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
			<Card class="flex items-center gap-5 p-6 hover:shadow-md transition-shadow">
				<div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 dark:text-blue-400 shrink-0">
					<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
				</div>
				<div>
					<p class="text-sm font-semibold text-gray-500 dark:text-gray-400">Total Programas</p>
					<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{enrollments.length}</p>
				</div>
			</Card>
			
			<Card class="flex items-center gap-5 p-6 hover:shadow-md transition-shadow">
				<div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-2xl text-green-600 dark:text-green-400 shrink-0">
					<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
				<div>
					<p class="text-sm font-semibold text-gray-500 dark:text-gray-400">Programas Activos</p>
					<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{cursosActivos}</p>
				</div>
			</Card>
			
			<Card class="flex items-center gap-5 p-6 hover:shadow-md transition-shadow">
				<div class="p-4 bg-red-50 dark:bg-red-900/20 rounded-2xl text-red-600 dark:text-red-400 shrink-0">
					<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
				</div>
				<div>
					<p class="text-sm font-semibold text-gray-500 dark:text-gray-400">Deuda Global</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(totalDeuda)}</p>
				</div>
			</Card>
		</div>

		<!-- 3. Rejilla de Cursos Inscritos -->
		<div class="pt-2">
			<Heading level="h2" class="mb-6">Mis Inscripciones a Detalle</Heading>
			
			{#if enrollments.length === 0}
				<Card>
					<div class="text-center py-16">
						<div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-5">
							<svg class="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
						</div>
						<h3 class="text-xl font-semibold text-gray-900 dark:text-white">Sin inscripciones</h3>
						<p class="text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">Aún no tienes asignaciones activas. Cuando un administrador te inscriba a un programa, aparecerá aquí.</p>
					</div>
				</Card>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each enrollments as enr}
						<Card class="flex flex-col justify-between hover:shadow-xl transition-all duration-300 border-t-4 border-t-blue-600">
							<div>
								<div class="flex justify-between items-start mb-5">
									<span class={`px-3 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${enr.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : enr.estado === 'pendiente_pago' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' : 'bg-gray-100 text-gray-800'}`}>
										{enr.estado.replace('_', ' ')}
									</span>
								</div>
								
								<h3 class="text-lg font-bold text-gray-900 dark:text-white leading-snug">
									{coursesMap[enr.curso_id]?.nombre_programa || 'Curso Desconocido'}
								</h3>
								<p class="text-sm text-gray-500 mt-2 flex items-center gap-1.5">
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
									Inscrito el {formatDate(enr.fecha_inscripcion)}
								</p>
								
								<div class="mt-6 space-y-3 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
									<div class="flex justify-between text-sm">
										<span class="text-gray-500 font-medium">Inversión Total:</span>
										<span class="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(enr.total_a_pagar)}</span>
									</div>
									<div class="w-full h-px bg-gray-200 dark:bg-gray-700"></div>
									<div class="flex justify-between text-sm">
										<span class="text-gray-500 font-medium">Saldo Pendiente:</span>
										<span class={`font-bold text-lg ${enr.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
											{formatCurrency(enr.saldo_pendiente)}
										</span>
									</div>
								</div>
							</div>
							<div class="mt-6">
								<a href={`/app/enrollments`} class="flex items-center justify-center gap-2 w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-bold transition-colors shadow-sm">
									<span>Ver Módulos y Pagos</span>
									<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
								</a>
							</div>
						</Card>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
