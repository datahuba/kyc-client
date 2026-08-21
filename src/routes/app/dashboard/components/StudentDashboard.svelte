<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { studentService, enrollmentService, courseService } from '$lib/services';
	import type { Enrollment, Course } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';
	import ComunicadoPopup from '$lib/components/comunicados/ComunicadoPopup.svelte';
	import { formatCurrency, formatDate, alert } from '$lib/utils';
	import { apiKyC } from '$lib/config/apiKyC.config';
	import { CreditCardIcon, BookIcon } from '$lib/icons/solid';
	import { UsersIcon, AcademicCapIcon, FileTextIcon } from '$lib/icons/outline';

	let enrollments: Enrollment[] = $state([]);
	let coursesMap: Record<string, any> = $state({});
	let availableCourses: any[] = $state([]);
	let loading = $state(true);
	let studentProfile = $state<any>(null);

	// Solicitudes de inscripción ya enviadas por el estudiante
	let requestedCourseIds = $state<Set<string>>(new Set());
	let requestModalOpen = $state(false);
	let requestTargetCourse = $state<any | null>(null);
	let requestMensaje = $state('');
	let requestLoading = $state(false);

	function resolveDocStatus(url?: string, estado?: string): string {
		if (estado === 'verificado') return 'verificado';
		if (estado === 'rechazado') return 'rechazado';
		if (estado === 'pendiente' || (url && url.trim().length > 0)) return 'pendiente';
		return 'sin_subir';
	}

	// Validación documental
	let docStatus = $derived.by(() => {
		const u = studentProfile || ($userStore.user as any);
		if (!u) return { completo: false, items: [] as { label: string; estado: string; verificado: boolean; obligatorio: boolean }[] };

		const cvState = resolveDocStatus(u.cv_url, u.cv_estado);
		const carnetState = resolveDocStatus(u.carnet_url, u.carnet_estado);
		const afiliacionState = resolveDocStatus(u.afiliacion_url, u.afiliacion_estado);
		const tituloState = resolveDocStatus(u.titulo?.titulo_url || (u.titulo as any)?.url, u.titulo?.estado);

		const esPregrado = u.es_primer_carrera ?? u.es_estudiante_interno ?? false;

		const items = [
			{ label: 'Carnet de Identidad', estado: carnetState, verificado: carnetState === 'verificado', obligatorio: true },
			{ label: 'Curriculum Vitae (CV)', estado: cvState, verificado: cvState === 'verificado', obligatorio: !esPregrado },
			{ label: 'Certificado de Afiliación', estado: afiliacionState, verificado: afiliacionState === 'verificado', obligatorio: !esPregrado },
			{ label: 'Título Profesional', estado: tituloState, verificado: tituloState === 'verificado', obligatorio: !esPregrado }
		];
		const obligatorios = items.filter((i) => i.obligatorio);
		return { completo: obligatorios.every((i) => i.verificado), items };
	});
	let documentosCompletos = $derived(docStatus.completo);

	function openRequestModal(course: any) {
		requestTargetCourse = course;
		requestMensaje = '';
		requestModalOpen = true;
	}

	async function confirmRequestEnrollment() {
		if (!requestTargetCourse) return;
		requestLoading = true;
		try {
			await apiKyC.post('/enrollment-requests/', {
				curso_id: requestTargetCourse._id || requestTargetCourse.id,
				mensaje: requestMensaje.trim() || undefined
			});
			alert('success', 'Solicitud enviada. El CPD revisará tu inscripción pronto.');
			requestedCourseIds = new Set([...requestedCourseIds, requestTargetCourse._id || requestTargetCourse.id]);
			requestModalOpen = false;
			requestTargetCourse = null;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar la solicitud');
		} finally {
			requestLoading = false;
		}
	}

	// Variables financieras y académicas
	let totalInversion = $derived(enrollments.reduce((sum, enr) => sum + (enr.total_a_pagar || 0), 0));
	let totalPagado = $derived(enrollments.reduce((sum, enr) => sum + (enr.total_pagado || 0), 0));
	let totalDeuda = $derived(enrollments.reduce((sum, enr) => sum + (enr.saldo_pendiente || 0), 0));
	let porcentajePagado = $derived(totalInversion > 0 ? Math.min(100, Math.round((totalPagado / totalInversion) * 100)) : 0);
	let cursosActivos = $derived(enrollments.filter(e => e.estado === 'activo' || e.estado === 'pendiente_pago').length);

	// Últimos cursos inscritos
	let latestEnrollments = $derived(
		[...enrollments].sort(
			(a, b) => new Date(b.fecha_inscripcion).getTime() - new Date(a.fecha_inscripcion).getTime()
		)
	);

	// Tarjetas de inscripción colapsables
	let expandedEnrollments = $state<Set<string>>(new Set());
	function toggleEnrollment(id: string) {
		const next = new Set(expandedEnrollments);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		expandedEnrollments = next;
	}

	onMount(async () => {
		if ($userStore.isAuthenticated) {
			loading = true;
			try {
				const [misInscripciones, profileRes, cursosDisponiblesRes, myRequestsRes] = await Promise.all([
					apiKyC.get<Enrollment[]>('/enrollments/me').catch(() => []),
					apiKyC.get<any>('/students/me').catch(() => null),
					apiKyC.get<any[]>('/courses/disponibles').catch(() => []),
					apiKyC.get<any[]>('/enrollment-requests/my').catch(() => [])
				]);

				studentProfile = profileRes;
				enrollments = misInscripciones || [];

				const rawCursos = Array.isArray(cursosDisponiblesRes) ? cursosDisponiblesRes : [];
				const cursosComoCourse = rawCursos.map((c: any) => ({
					_id: c.id || c._id,
					id: c.id || c._id,
					codigo: c.codigo,
					nombre_programa: c.nombre_programa,
					tipo_curso: c.tipo_curso,
					modalidad: c.modalidad,
					fecha_inicio: c.fecha_inicio,
					fecha_fin: c.fecha_fin,
					costo_total_interno: c.costo_total_interno,
					matricula_interno: c.matricula_interno,
					cantidad_cuotas: c.cantidad_cuotas || c.cantidad_modulos || 1,
					modulos: Array(c.cantidad_modulos || 0).fill({}),
					activo: true,
					inscritos: []
				}));

				const nuevoMapa: Record<string, any> = {};
				for (const c of cursosComoCourse) {
					nuevoMapa[c._id] = c;
				}
				coursesMap = nuevoMapa;

				// Programas disponibles que el alumno no tiene
				const enrolledIds = new Set(enrollments.map((e) => e.curso_id));
				availableCourses = cursosComoCourse.filter((c) => !enrolledIds.has(c._id)).slice(0, 12);

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

<div class="flex flex-col gap-5 w-full max-w-7xl mx-auto">
	{#if loading}
		<DashboardSkeleton />
	{:else}
		<!-- 1. Tarjeta Hero Fintech / Académica (Mobile-First) -->
		<div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-800 via-primary-900 to-slate-950 text-white shadow-xl border border-white/10 p-5 sm:p-6">
			<!-- Glow decorativo -->
			<div class="absolute -top-16 -right-16 size-48 rounded-full bg-white/10 blur-3xl pointer-events-none"></div>
			<div class="absolute -bottom-20 -left-12 size-40 rounded-full bg-blue-500/10 blur-2xl pointer-events-none"></div>

			<div class="relative z-10 flex flex-col gap-4">
				<!-- Cabecera de Usuario -->
				<div class="flex items-center gap-3.5">
					<div class="size-13 sm:size-14 rounded-2xl bg-white/15 border border-white/30 backdrop-blur-md flex items-center justify-center text-xl font-black text-white shadow-inner shrink-0">
						{$userStore.user?.nombre?.charAt(0).toUpperCase() || 'E'}
					</div>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 text-white backdrop-blur-sm">
								ESTUDIANTE
							</span>
							{#if documentosCompletos}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
									KYC Verificado
								</span>
							{:else}
								<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
									Doc. Pendiente
								</span>
							{/if}
						</div>
						<h1 class="text-base sm:text-xl font-extrabold text-white truncate mt-1">
							¡Hola, {$userStore.user?.nombre?.split(' ')[0] || 'Estudiante'}!
						</h1>
						<p class="text-white/70 text-xs font-medium truncate">
							Registro: {$userStore.user?.registro || $userStore.user?.codigo_registro || $userStore.user?.username || 'N/A'}
						</p>
					</div>
				</div>

				<!-- Barra de Balance Fintech (Total vs Pagado vs Deuda) -->
				{#if enrollments.length > 0}
					<div class="mt-1 p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
						<div class="flex justify-between items-end mb-2">
							<div>
								<span class="text-[10px] font-bold uppercase tracking-wider text-white/70">Estado de Cuenta</span>
								<p class="text-lg sm:text-2xl font-black text-white leading-tight mt-0.5">
									{formatCurrency(totalPagado)}
									<span class="text-xs font-medium text-white/70">/ {formatCurrency(totalInversion)}</span>
								</p>
							</div>
							<div class="text-right">
								<span class="text-[10px] font-bold uppercase tracking-wider text-white/70">Saldo Deudor</span>
								<p class="text-sm sm:text-base font-bold {totalDeuda > 0 ? 'text-rose-300' : 'text-emerald-300'} leading-tight mt-0.5">
									{totalDeuda > 0 ? formatCurrency(totalDeuda) : 'Al día'}
								</p>
							</div>
						</div>

						<!-- Barra de progreso -->
						<div class="w-full bg-black/25 rounded-full h-2 overflow-hidden">
							<div
								class="bg-gradient-to-r from-emerald-400 to-teal-300 h-full rounded-full transition-all duration-500 ease-out"
								style={`width: ${porcentajePagado}%;`}
							></div>
						</div>
						<div class="flex justify-between items-center text-[10px] font-semibold text-white/75 mt-1.5">
							<span>{porcentajePagado}% cancelado</span>
							<a href="/app/payments" class="text-white hover:underline flex items-center gap-1 font-bold">
								Ver detalle &rarr;
							</a>
						</div>
					</div>
				{/if}
			</div>
		</div>

		<!-- 2. Accesos Rápidos Táctiles (4 Botones Móviles Estilo App) -->
		<div class="grid grid-cols-4 gap-2.5 sm:gap-4">
			<a
				href="/app/payments"
				class="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-95 transition-all text-center group"
			>
				<div class="size-11 rounded-2xl bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5">
					<CreditCardIcon class="size-5.5" />
				</div>
				<span class="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Mis Pagos</span>
			</a>

			<a
				href="/app/certificates"
				class="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-95 transition-all text-center group"
			>
				<div class="size-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5">
					<FileTextIcon class="size-5.5" />
				</div>
				<span class="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Certificados</span>
			</a>

			<a
				href="/app/classroom"
				class="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-95 transition-all text-center group"
			>
				<div class="size-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5">
					<BookIcon class="size-5.5" />
				</div>
				<span class="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Aula Virtual</span>
			</a>

			<a
				href="/app/enrollments"
				class="flex flex-col items-center justify-center p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md active:scale-95 transition-all text-center group"
			>
				<div class="size-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-105 transition-transform mb-1.5">
					<AcademicCapIcon class="size-5.5" />
				</div>
				<span class="text-[11px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Mis Notas</span>
			</a>
		</div>

		<!-- 3. Alerta de Documentación Pendiente (si aplica) -->
		{#if !documentosCompletos}
			<div class="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-900 dark:text-amber-200 shadow-sm">
				<div class="flex items-start gap-3">
					<div class="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 shrink-0">
						<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
					</div>
					<div class="flex-1 min-w-0">
						<h4 class="text-sm font-bold text-amber-950 dark:text-amber-100">Documentación de Admisión</h4>
						<p class="text-xs mt-0.5 text-amber-800/80 dark:text-amber-300/80">
							Sube tus requisitos para habilitar la inscripción a nuevos programas académicos.
						</p>
						<a
							href="/app/profile"
							class="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm"
						>
							<span>Subir Documentos</span>
							<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
						</a>
					</div>
				</div>
			</div>
		{/if}

		<!-- 4. Programas Disponibles (Carrusel Horizontal Táctil) -->
		{#if availableCourses.length > 0}
			<div class="pt-1">
				<div class="flex items-center justify-between mb-3 px-1">
					<Heading level="h2" class="text-base sm:text-lg font-bold">Programas Disponibles</Heading>
					<span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Desliza &rarr;</span>
				</div>

				<div class="flex gap-3.5 overflow-x-auto pb-2.5 snap-x snap-mandatory -mx-1 px-1 scrollbar-hide">
					{#each availableCourses as course (course._id)}
						<div class="snap-start shrink-0 w-64 sm:w-72 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between p-4">
							<div>
								<div class="flex items-center justify-between gap-2">
									<span class="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-100 dark:border-primary-900/40">
										{course.tipo_curso}
									</span>
									<span class="text-[11px] font-medium text-slate-400 capitalize">{course.modalidad}</span>
								</div>
								<h3 class="mt-2 text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug min-h-[2.5rem]" title={course.nombre_programa}>
									{course.nombre_programa}
								</h3>
								<p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
									{course.cantidad_cuotas} módulos académicos
								</p>
							</div>

							<div class="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
								<span class="text-sm font-black text-primary-700 dark:text-primary-400">
									{formatCurrency(course.costo_total_interno || 0)}
								</span>
								{#if requestedCourseIds.has(course._id)}
									<span class="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md">
										Enviada
									</span>
								{:else}
									<button
										type="button"
										onclick={() => openRequestModal(course)}
										disabled={!documentosCompletos}
										class={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors ${documentosCompletos ? 'bg-primary-50 hover:bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300' : 'text-slate-400 bg-slate-100 dark:bg-slate-800 cursor-not-allowed'}`}
									>
										Solicitar &rarr;
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- 5. Mis Programas Inscritos (Tarjetas Táctiles) -->
		<div class="pt-1">
			<div class="flex items-center justify-between mb-3 px-1">
				<Heading level="h2" class="text-base sm:text-lg font-bold">Mis Programas</Heading>
				{#if enrollments.length > 3}
					<a href="/app/enrollments" class="text-xs font-bold text-primary-700 dark:text-primary-400">Ver todos ({enrollments.length})</a>
				{/if}
			</div>

			{#if enrollments.length === 0}
				<div class="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
					<div class="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
						<AcademicCapIcon class="size-6" />
					</div>
					<h3 class="text-sm font-bold text-slate-900 dark:text-white">Sin programas inscritos</h3>
					<p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
						Solicita un programa en la sección superior o acércate a Coordinación Académica.
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each latestEnrollments.slice(0, 3) as enr (enr._id || (enr as any).id)}
						{@const isOpen = expandedEnrollments.has(enr._id || (enr as any).id)}
						{@const nombre = coursesMap[enr.curso_id]?.nombre_programa || (enr as any).curso_nombre || (enr as any).programa_nombre || 'Programa de Posgrado'}
						<div class="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden transition-all">
							<!-- Cabecera de la Tarjeta Táctil -->
							<button
								type="button"
								onclick={() => toggleEnrollment(enr._id)}
								class="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
								aria-expanded={isOpen}
							>
								<div class={`size-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${enr.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'}`}>
									{enr.estado === 'activo' ? 'ACT' : 'PEN'}
								</div>
								<div class="min-w-0 flex-1">
									<h4 class="text-sm font-bold text-slate-900 dark:text-white truncate" title={nombre}>
										{nombre}
									</h4>
									<div class="flex items-center gap-2 mt-0.5 text-xs">
										<span class="text-slate-500 dark:text-slate-400">Saldo:</span>
										<span class={`font-bold ${enr.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
											{formatCurrency(enr.saldo_pendiente)}
										</span>
									</div>
								</div>
								<svg class={`size-4.5 text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>

							<!-- Desplegable con Acciones -->
							{#if isOpen}
								<div class="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800/80">
									<div class="grid grid-cols-2 gap-2 mt-2">
										<div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
											<span class="text-[10px] font-bold text-slate-400 uppercase">Inversión Total</span>
											<p class="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">{formatCurrency(enr.total_a_pagar)}</p>
										</div>
										<div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50">
											<span class="text-[10px] font-bold text-slate-400 uppercase">Abonado</span>
											<p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(enr.total_pagado)}</p>
										</div>
									</div>

									<div class="flex gap-2 mt-3">
										<a
											href="/app/enrollments"
											class="flex-1 py-2 text-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold active:scale-95 transition-all"
										>
											Ver Módulos
										</a>
										{#if enr.saldo_pendiente > 0}
											<a
												href={`/app/payments?pagar=${enr._id}`}
												class="flex-1 py-2 text-center rounded-xl bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold active:scale-95 transition-all shadow-sm"
											>
												Pagar Cuota
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

<!-- Modal de Confirmación de Solicitud de Inscripción -->
<Modal
	isOpen={requestModalOpen}
	title="Solicitar Inscripción"
	onClose={() => { if (!requestLoading) requestModalOpen = false; }}
	maxWidth="sm:max-w-lg"
>
	<div class="p-4 space-y-4">
		{#if requestTargetCourse}
			<p class="text-sm text-slate-700 dark:text-slate-300">
				Estás solicitando inscribirte a <strong>{requestTargetCourse.nombre_programa}</strong>.
				El CPD revisará tu solicitud y se te habilitará la matrícula.
			</p>
			<div>
				<label for="request-mensaje" class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
					Comentario (opcional)
				</label>
				<textarea
					id="request-mensaje"
					bind:value={requestMensaje}
					rows="3"
					maxlength="500"
					class="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
					placeholder="Ej: Quisiera consultar sobre el horario..."
				></textarea>
			</div>
			<div class="flex justify-end gap-2.5">
				<Button variant="secondary" onclick={() => requestModalOpen = false} disabled={requestLoading}>Cancelar</Button>
				<Button onclick={confirmRequestEnrollment} loading={requestLoading}>Enviar Solicitud</Button>
			</div>
		{/if}
	</div>
</Modal>

<ComunicadoPopup />

<style>
	.scrollbar-hide::-webkit-scrollbar { display: none; }
	.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
