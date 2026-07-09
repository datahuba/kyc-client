<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { enrollmentService, courseService } from '$lib/services';
	import type { Enrollment, Course } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';
	import { formatCurrency, formatDate, alert } from '$lib/utils';
	import { apiKyC } from '$lib/config/apiKyC.config';

	let enrollments: Enrollment[] = $state([]);
	let coursesMap: Record<string, Course> = $state({});
	let availableCourses: Course[] = $state([]);
	let loading = $state(true);

	// ISSUE-R-SOLICITUD-INSCRIPCION: solicitudes de inscripción ya enviadas
	// por el estudiante (para deshabilitar el botón "Solicitar" en esa tarjeta).
	let requestedCourseIds = $state<Set<string>>(new Set());
	let requestModalOpen = $state(false);
	let requestTargetCourse = $state<Course | null>(null);
	let requestMensaje = $state('');
	let requestLoading = $state(false);

	function openRequestModal(course: Course) {
		requestTargetCourse = course;
		requestMensaje = '';
		requestModalOpen = true;
	}

	async function confirmRequestEnrollment() {
		if (!requestTargetCourse) return;
		requestLoading = true;
		try {
			await apiKyC.post('/enrollment-requests/', {
				curso_id: requestTargetCourse._id,
				mensaje: requestMensaje.trim() || undefined
			});
			alert('success', 'Solicitud enviada. El CPD revisará tu inscripción pronto.');
			requestedCourseIds = new Set([...requestedCourseIds, requestTargetCourse._id]);
			requestModalOpen = false;
			requestTargetCourse = null;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar la solicitud');
		} finally {
			requestLoading = false;
		}
	}

	// Variables derivadas para las estadísticas rápidas
	let totalDeuda = $derived(enrollments.reduce((sum, enr) => sum + (enr.saldo_pendiente || 0), 0));
	let cursosActivos = $derived(enrollments.filter(e => e.estado === 'activo' || e.estado === 'pendiente_pago').length);

	// Últimos cursos inscritos (más recientes primero)
	let latestEnrollments = $derived(
		[...enrollments].sort(
			(a, b) => new Date(b.fecha_inscripcion).getTime() - new Date(a.fecha_inscripcion).getTime()
		)
	);

	// Tarjetas de inscripción colapsables (ISSUE-X-COMPACT)
	let expandedEnrollments = $state<Set<string>>(new Set());
	function toggleEnrollment(id: string) {
		const next = new Set(expandedEnrollments);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedEnrollments = next;
	}

	onMount(async () => {
		if ($userStore.user?._id) {
			try {
				const [enrRes, coursesRes, myRequestsRes] = await Promise.all([
					enrollmentService.getByStudentId($userStore.user._id),
					courseService.getAll(1, 100),
					apiKyC.get<any[]>('/enrollment-requests/me').catch(() => [])
				]);
				
				enrollments = Array.isArray(enrRes) ? enrRes : (enrRes as any).data || [];
				const courses = coursesRes.data || [];
				// Construir el mapa en un objeto local y asignarlo una sola vez al $state
				// (evita el warning assignment_value_stale de Svelte 5 por mutar el proxy en el forEach)
				const nuevoMapa: Record<string, Course> = {};
				for (const c of courses) {
					nuevoMapa[c._id] = c;
				}
				coursesMap = nuevoMapa;

				// Programas disponibles = cursos activos en los que el estudiante NO está inscrito
				const enrolledIds = new Set(enrollments.map((e) => e.curso_id));
				availableCourses = courses.filter((c) => c.activo && !enrolledIds.has(c._id)).slice(0, 12);

				// Solicitudes ya enviadas (pendientes o aprobadas) para deshabilitar el botón
				const solicitudesActivas = (Array.isArray(myRequestsRes) ? myRequestsRes : []).filter(
					(r: any) => r.estado === 'pendiente' || r.estado === 'aprobado'
				);
				requestedCourseIds = new Set(solicitudesActivas.map((r: any) => r.curso_id));
			} catch (error) {
				console.error("Error al cargar dashboard de estudiante", error);
			} finally {
				loading = false;
			}
		}
	});
</script>

<!-- BUG 5 FIX: Cambio de space-y a un padding fluido y contención estricta -->
<div class="flex flex-col gap-6 w-full max-w-7xl mx-auto">
	{#if loading}
		<DashboardSkeleton />
	{:else}
		<!-- 1. Tarjeta de Bienvenida y Perfil Rápido (compacta) -->
		<div class="bg-gradient-to-br from-primary-700 to-primary-950 rounded-2xl shadow-lg p-4 sm:p-5 text-white overflow-hidden relative">
			<!-- Decoración de fondo -->
			<div class="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl pointer-events-none"></div>
			<div class="absolute bottom-0 right-32 -mb-10 w-28 h-28 bg-white opacity-5 rounded-full blur-xl pointer-events-none"></div>
			
			<div class="relative z-10 flex flex-col sm:flex-row items-center sm:items-center gap-3 sm:gap-4">
				<!-- Avatar Letra -->
				<div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-white/10 border-2 border-white/25 flex items-center justify-center text-lg sm:text-xl font-extrabold shadow-inner shrink-0 text-white">
					{$userStore.user?.nombre?.charAt(0).toUpperCase() || 'E'}
				</div>
				
				<!-- Info Estudiante -->
				<div class="text-center sm:text-left flex-1 min-w-0">
					<h2 class="text-base sm:text-lg font-bold mb-0.5 text-white truncate">¡Bienvenido, {$userStore.user?.nombre || 'Estudiante'}!</h2>
					<p class="text-white/70 mb-3 text-xs font-medium">Portal académico de Postgrado · Contaduría Pública UAGRM.</p>
					
					<!-- Chips de contacto compactos -->
					<div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] font-medium">
						<div class="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/20 shadow-sm text-white/90">
							<svg class="size-3.5 opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>
							<span>Registro: {$userStore.user?.registro || $userStore.user?.codigo_registro || $userStore.user?.username || 'N/A'}</span>
						</div>
						<div class="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/20 shadow-sm text-white/90 break-all max-w-full">
							<svg class="size-3.5 opacity-80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
							<span class="line-clamp-1 break-all">{$userStore.user?.email || 'No registrado'}</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- 2. Tarjetas de Estadísticas Globales -->
		<!-- ISSUE-X-COMPACT (fix 2026-07-09, reportado por el usuario: las tarjetas
		     quedaban demasiado grandes con mucho espacio vacío para lo poco que
		     muestran). Reducido padding/ícono/tipografía, quitado el col-span-2 de
		     la tercera tarjeta (ya no hace falta ocupar 2 columnas en tablet). -->
		<!-- FIX (2026-07-09, reportado por el usuario: "los iconos no encajan bien"):
		     Card envuelve el contenido en su propio <div class="card-content">, así
		     que "flex items-center justify-between" puesto directamente en Card no
		     actúa sobre estos 2 divs (quedan apilados verticalmente por defecto,
		     descolocando el ícono debajo del texto en vez de al lado). Se mueve el
		     flex a un wrapper propio DENTRO del Card. -->
		<div class="grid grid-cols-3 gap-3 sm:gap-4">
			<Card padding="none" class="p-3 sm:p-4 hover:shadow-md transition-shadow min-w-0">
				<div class="flex items-center justify-between gap-2">
					<div class="min-w-0">
						<p class="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Total Programas</p>
						<p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{enrollments.length}</p>
					</div>
					<div class="p-2 sm:p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-300 shrink-0">
						<svg class="size-4 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
					</div>
				</div>
			</Card>
			
			<Card padding="none" class="p-3 sm:p-4 hover:shadow-md transition-shadow min-w-0">
				<div class="flex items-center justify-between gap-2">
					<div class="min-w-0">
						<p class="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Activos</p>
						<p class="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{cursosActivos}</p>
					</div>
					<div class="p-2 sm:p-2.5 bg-green-50 dark:bg-green-900/20 rounded-lg text-green-600 dark:text-green-400 shrink-0">
						<svg class="size-4 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
				</div>
			</Card>
			
			<Card padding="none" class="p-3 sm:p-4 hover:shadow-md transition-shadow min-w-0">
				<div class="flex items-center justify-between gap-2">
					<div class="min-w-0">
						<p class="text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">Deuda Global</p>
						<!-- BUG 5 FIX: Truncamiento inteligente si la cifra es muy larga -->
						<p class="text-sm sm:text-lg font-bold text-red-600 dark:text-red-400 mt-0.5 truncate" title={formatCurrency(totalDeuda)}>
							{formatCurrency(totalDeuda)}
						</p>
					</div>
					<div class="p-2 sm:p-2.5 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 shrink-0">
						<svg class="size-4 sm:size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
					</div>
				</div>
			</Card>
		</div>

		<!-- 2.5 Slide horizontal dinámico: Programas Disponibles -->
		{#if availableCourses.length > 0}
			<div>
				<div class="flex items-center justify-between mb-3">
					<Heading level="h2" class="text-lg sm:text-xl">Programas Disponibles</Heading>
					<span class="hidden sm:inline text-xs text-gray-400 dark:text-gray-500">Desliza para ver más →</span>
				</div>
				<div class="flex gap-4 overflow-x-auto pb-3 snap-x -mx-1 px-1 scrollbar-hide">
					{#each availableCourses as course (course._id)}
						<div class="snap-start shrink-0 w-64 sm:w-72 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all duration-300">
							<div class="h-1.5 bg-gradient-to-r from-primary-600 to-primary-800"></div>
							<div class="p-4">
								<span class="inline-block px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 capitalize">{course.tipo_curso}</span>
								<h3 class="mt-2 text-sm font-bold text-gray-900 dark:text-white line-clamp-2 leading-snug min-h-[2.5rem]" title={course.nombre_programa}>{course.nombre_programa}</h3>
								<div class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
									<span class="capitalize">{course.modalidad}</span>
									<span>·</span>
									<span>{course.cantidad_cuotas} módulos</span>
								</div>
								{#if course.cargo_adicional_items && course.cargo_adicional_items.length > 0}
									<div class="mt-2 space-y-0.5">
										{#each course.cargo_adicional_items as item}
											<p class="text-[10px] text-light-warning dark:text-dark-warning">
												+ {formatCurrency(item.costo)} ({item.nombre})
											</p>
										{/each}
									</div>
								{/if}
								<div class="mt-3 flex items-center justify-between pt-2 border-t border-gray-100 dark:border-dark-border">
									<span class="text-sm font-black text-primary-700 dark:text-primary-300">{formatCurrency(course.costo_total_interno || 0)}</span>
									{#if requestedCourseIds.has(course._id)}
										<span class="text-xs font-semibold text-light-warning dark:text-dark-warning">Solicitud enviada</span>
									{:else}
										<button
											type="button"
											onclick={() => openRequestModal(course)}
											class="text-xs font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400"
										>
											Solicitar Inscripción →
										</button>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 3. Rejilla de Últimos Cursos Inscritos -->
		<div class="pt-2">
			<div class="flex items-center justify-between mb-4 sm:mb-5">
				<Heading level="h2" class="text-lg sm:text-xl">Últimos Cursos Inscritos</Heading>
				{#if enrollments.length > 3}
					<a href="/app/enrollments" class="text-sm font-semibold text-primary-600 hover:text-primary-800 dark:text-primary-400">Ver todas ({enrollments.length})</a>
				{/if}
			</div>
			
			{#if enrollments.length === 0}
				<Card>
					<div class="text-center py-12 sm:py-16 px-4">
						<div class="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-4 sm:mb-5">
							<svg class="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
						</div>
						<h3 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">Sin inscripciones</h3>
						<p class="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-sm mx-auto">Aún no tienes asignaciones activas. Cuando un administrador te inscriba a un programa, aparecerá aquí.</p>
					</div>
				</Card>
			{:else}
				<!-- ISSUE-X-COMPACT: tarjetas compactas y desplegables -->
				<div class="space-y-3">
					{#each latestEnrollments.slice(0, 3) as enr (enr._id)}
						{@const isOpen = expandedEnrollments.has(enr._id)}
						{@const nombre = coursesMap[enr.curso_id]?.nombre_programa || 'Curso Desconocido'}
						<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border border-l-4 border-l-primary-600 rounded-xl shadow-sm overflow-hidden">
							<!-- Cabecera colapsable -->
							<button
								type="button"
								onclick={() => toggleEnrollment(enr._id)}
								class="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-dark-background/40 transition-colors"
								aria-expanded={isOpen}
							>
								<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${enr.estado === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-400' : enr.estado === 'pendiente_pago' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-400' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
									{enr.estado.replace('_', ' ')}
								</span>
								<span class="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate" title={nombre}>{nombre}</span>
								<span class={`shrink-0 text-sm font-bold ${enr.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(enr.saldo_pendiente)}</span>
								<svg class={`shrink-0 size-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
							</button>

							<!-- Detalle desplegable -->
							{#if isOpen}
								<div class="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-dark-border">
									<p class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-2">
										<svg class="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
										Inscrito el {formatDate(enr.fecha_inscripcion)}
									</p>
									<div class="mt-2 grid grid-cols-2 gap-3">
										<div class="bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2.5">
											<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wide">Inversión Total</span>
											<span class="block text-sm font-bold text-gray-800 dark:text-white">{formatCurrency(enr.total_a_pagar)}</span>
										</div>
										<div class="bg-gray-50 dark:bg-dark-background/40 rounded-lg p-2.5">
											<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wide">Saldo Pendiente</span>
											<span class={`block text-sm font-bold ${enr.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(enr.saldo_pendiente)}</span>
										</div>
									</div>
									<div class="mt-3 flex gap-2">
										<a href="/app/enrollments" class="flex-1 flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-dark-background/60 dark:hover:bg-dark-background text-gray-700 dark:text-gray-200 py-2 rounded-lg text-xs font-bold transition-colors">
											<span>Ver Módulos</span>
										</a>
										{#if enr.saldo_pendiente > 0}
											<a href={`/app/payments?pagar=${enr._id}`} class="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg text-xs font-bold transition-colors">
												<span>Pagar</span>
												<svg class="size-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
											</a>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- ISSUE-R-SOLICITUD-INSCRIPCION: modal de confirmación de solicitud -->
<Modal
	isOpen={requestModalOpen}
	title="Solicitar Inscripción"
	onClose={() => { if (!requestLoading) requestModalOpen = false; }}
	maxWidth="sm:max-w-lg"
>
	<div class="p-4 space-y-4">
		{#if requestTargetCourse}
			<p class="text-sm text-gray-700 dark:text-gray-300">
				Estás solicitando inscribirte a <strong>{requestTargetCourse.nombre_programa}</strong>.
				El CPD revisará tu solicitud y, si la aprueba, se creará tu inscripción con la matrícula y
				módulos correspondientes.
			</p>
			<div>
				<label for="request-mensaje" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
					Comentario (opcional)
				</label>
				<textarea
					id="request-mensaje"
					bind:value={requestMensaje}
					rows="3"
					maxlength="500"
					class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500"
					placeholder="Ej: Quisiera confirmar el horario del módulo 1..."
				></textarea>
			</div>
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => requestModalOpen = false} disabled={requestLoading}>Cancelar</Button>
				<Button onclick={confirmRequestEnrollment} loading={requestLoading}>Enviar Solicitud</Button>
			</div>
		{/if}
	</div>
</Modal>
