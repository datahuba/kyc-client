<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { studentService, certificateService, enrollmentService, courseService } from '$lib/services';
	import type { Student, Enrollment, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import {
		ClipboardIcon,
		TagIcon,
		UserIcon,
		AcademicCapIcon,
		FileTextIcon,
		BellIcon
	} from '$lib/icons/outline';
	import { CreditCardIcon, ShieldIcon, CalendarIcon } from '$lib/icons/solid';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { goto } from '$app/navigation';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';

	let loading = true;
	let studentData: Student | null = null;
	let greeting = '';
	let interval: any;

	// F-DASH-ESTUDIANTE (2026-07-30): quick stats + módulos pendientes.
	let cantidadCertificados = $state(0);
	let myEnrollments = $state<Enrollment[]>([]);
	let coursesById = $state<Record<string, Course>>({});

	// Lista plana de módulos con su estado "En curso" / "No iniciado"
	type ModuloEstado = {
		enrollmentId: string;
		moduloIndex: number;
		cursoNombre: string;
		cursoCodigo: string;
		nombre: string;
		estado: 'en_curso' | 'no_iniciado' | 'finalizado';
		iniciadoEn: string | null;
	};

	const modulosPendientes = $derived.by(() => {
		const lista: ModuloEstado[] = [];
		for (const enr of myEnrollments) {
			const course = coursesById[String(enr.curso_id)];
			const cursoNombre = course?.nombre_programa ?? 'Curso';
			const cursoCodigo = course?.codigo ?? '';
			if (!enr.modulos) continue;
			enr.modulos.forEach((m: any, idx: number) => {
				let estado: ModuloEstado['estado'];
				if (m.iniciado_en && m.estado_academico !== 'Aprobado' && m.estado_academico !== 'Reprobado') {
					estado = 'en_curso';
				} else if (m.estado_academico === 'Aprobado' || m.estado_academico === 'Reprobado') {
					estado = 'finalizado';
				} else {
					estado = 'no_iniciado';
				}
				lista.push({
					enrollmentId: String(enr._id),
					moduloIndex: idx,
					cursoNombre,
					cursoCodigo,
					nombre: m.nombre || `Módulo ${idx + 1}`,
					estado,
					iniciadoEn: m.iniciado_en || null
				});
			});
		}
		return lista;
	});

	const totalEnCurso = $derived(modulosPendientes.filter((m) => m.estado === 'en_curso').length);
	const totalNoIniciado = $derived(modulosPendientes.filter((m) => m.estado === 'no_iniciado').length);
	const totalFinalizado = $derived(modulosPendientes.filter((m) => m.estado === 'finalizado').length);

	// F-DASH-COUNTDOWN (2026-07-30): próximo programa a iniciar (con countdown).
	// El estudiante ve cuántos días faltan para que arranque su próximo programa.
	const proximoPrograma = $derived.by(() => {
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const candidatos: { nombre: string; codigo: string; fecha: Date; dias: number }[] = [];
		for (const e of myEnrollments) {
			const course = coursesById[String(e.curso_id)];
			if (!course?.fecha_inicio) continue;
			const inicio = new Date(course.fecha_inicio);
			inicio.setHours(0, 0, 0, 0);
			const dias = Math.round((inicio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
			if (dias >= 0) {
				candidatos.push({
					nombre: course.nombre_programa,
					codigo: course.codigo,
					fecha: inicio,
					dias
				});
			}
		}
		candidatos.sort((a, b) => a.dias - b.dias);
		return candidatos[0] || null;
	});

	function setGreeting() {
		const hour = new Date().getHours();
		if (hour < 12) greeting = 'Buenos días';
		else if (hour < 18) greeting = 'Buenas tardes';
		else greeting = 'Buenas noches';
	}

	onMount(() => {
		setGreeting();
		interval = setInterval(setGreeting, 60000);

		(async () => {
			try {
				const userId = $userStore.user?._id;
				if (userId) {
					studentData = await studentService.getById(userId);
				}
			} catch (error) {
				console.error('Error loading student data:', error);
			} finally {
				loading = false;
			}
		})();

		// Stats secundarios (no bloquean el load principal)
		(async () => {
			try {
				// F-FIX-CERT-GETMY (2026-08-16): antes llamaba a `getMy()`, que NO
				// existe en CertificateService (el método real es `listMy()`). La
				// llamada tiraba TypeError, el `catch {}` vacío se lo tragaba en
				// silencio y el contador quedaba SIEMPRE en 0 aunque el estudiante
				// tuviera certificados emitidos.
				const certs = await certificateService.listMy();
				cantidadCertificados = Array.isArray(certs) ? certs.length : 0;
			} catch (e) {
				console.error('[dashboard] no se pudo cargar el contador de certificados', e);
			}
		})();

		// Cargar mis enrollments con detalle de módulos
		(async () => {
			try {
				const res = await enrollmentService.getMyCoursesResumen();
				const items = (res as any).items || [];
				myEnrollments = items;
				// Cargar info de cursos en batch
				const courseIds: string[] = Array.from(new Set<string>(items.map((e: any) => String(e.curso_id)).filter(Boolean)));
				for (const cid of courseIds) {
					try {
						const c: any = await courseService.getById(cid);
						coursesById[cid] = c;
					} catch {}
				}
			} catch (e) {
				console.error('Error loading my enrollments:', e);
			}
		})();

		return () => clearInterval(interval);
	});

	const studentShortcuts = [
		{
			title: 'Mis Inscripciones',
			subtitle: 'Libreta, módulos y pagos',
			icon: ClipboardIcon,
			href: '/app/enrollments',
			color: 'from-blue-500 to-blue-600'
		},
		{
			title: 'Certificados',
			subtitle: 'Notas y No Deudor',
			icon: ShieldIcon,
			href: '/app/certificates',
			color: 'from-emerald-500 to-emerald-600'
		},
		{
			title: 'Calendario',
			subtitle: 'Programas en ejecución',
			icon: CalendarIcon,
			href: '/app/courses/calendario',
			color: 'from-purple-500 to-purple-600'
		},
		{
			title: 'Solicitudes',
			subtitle: 'Trámites y constancias',
			icon: FileTextIcon,
			href: '/app/requests',
			color: 'from-amber-500 to-amber-600'
		},
		{
			title: 'Mis Pagos',
			subtitle: 'Historial y deudas',
			icon: CreditCardIcon,
			href: '/app/payments',
			color: 'from-rose-500 to-rose-600'
		},
		{
			title: 'Mi Perfil',
			subtitle: 'Datos personales',
			icon: UserIcon,
			href: '/app/profile',
			color: 'from-slate-500 to-slate-600'
		},
		{
			title: 'Mi Aula',
			subtitle: 'Clases y materiales',
			icon: AcademicCapIcon,
			href: '/app/classroom',
			color: 'from-cyan-500 to-cyan-600'
		},
		{
			title: 'Notificaciones',
			subtitle: 'Buzón y avisos',
			icon: BellIcon,
			href: '/app/profile',
			color: 'from-pink-500 to-pink-600'
		}
	];
</script>

<div class="space-y-8">
	{#if loading}
		<DashboardSkeleton />
	{:else if studentData}
		<div>
			<Heading level="h1">{greeting}, {studentData.nombre.split(' ')[0]}!</Heading>
			<p class="text-gray-500 dark:text-gray-400 mt-2">Bienvenido a tu panel de estudiante. ¿Qué deseas hacer hoy?</p>

			<!-- F-DASH-COUNTDOWN (2026-07-30): banner con countdown del próximo
			     programa a iniciar. Muestra cuántos días faltan y CTA al calendario. -->
			{#if proximoPrograma}
				<a
					href="/app/courses/calendario"
					class="mt-4 block bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-4 hover:shadow-md transition-shadow group"
				>
					<div class="flex items-center gap-3">
						<div class="shrink-0 w-12 h-12 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
							<CalendarIcon className="size-6" />
						</div>
						<div class="flex-1 min-w-0">
							<p class="text-xs text-purple-700 dark:text-purple-300 font-semibold uppercase tracking-wider">
								Próximo programa
							</p>
							<p class="text-sm font-bold text-slate-900 dark:text-white truncate" title={proximoPrograma.nombre}>
								{proximoPrograma.nombre}
							</p>
							<p class="text-[11px] text-slate-500 dark:text-slate-400">
								Inicia el {proximoPrograma.fecha.toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}
							</p>
						</div>
						<div class="shrink-0 text-right">
							<p class="text-3xl font-black text-purple-600 dark:text-purple-400 leading-none">
								{proximoPrograma.dias}
							</p>
							<p class="text-[10px] text-slate-500 uppercase font-semibold">
								{proximoPrograma.dias === 1 ? 'día' : 'días'}
							</p>
						</div>
					</div>
				</a>
			{/if}

			<!-- F-DASH-ESTUDIANTE: 8 accesos rápidos con descripción y color por tipo -->
			<div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
				{#each studentShortcuts as shortcut}
					<button
						onclick={() => goto(shortcut.href)}
						class="relative bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm hover:shadow-lg transition-all text-left w-full group cursor-pointer border border-slate-200 dark:border-slate-700 overflow-hidden"
					>
						<div class={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${shortcut.color}`}></div>
						<div class={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${shortcut.color} text-white mb-3 shadow-sm`}>
							<shortcut.icon class="size-5" />
						</div>
						<h3 class="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
							{shortcut.title}
						</h3>
						<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
							{shortcut.subtitle}
						</p>
					</button>
				{/each}
			</div>

			<!-- F-DASH-MODULOS (2026-07-30): módulos de mis cursos con estado. -->
			{#if modulosPendientes.length > 0}
				<div class="mt-8">
					<Card>
						<div class="flex items-center justify-between mb-4">
							<div>
								<h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
									<AcademicCapIcon class="size-5 text-primary-600" />
									Mis Módulos
								</h3>
								<p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
									Estado de los módulos en tus programas
								</p>
							</div>
							<div class="flex items-center gap-3 text-xs">
								<span class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-emerald-500"></span>
									<span class="font-semibold text-slate-700">{totalEnCurso}</span>
									<span class="text-slate-500">en curso</span>
								</span>
								<span class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-amber-500"></span>
									<span class="font-semibold text-slate-700">{totalNoIniciado}</span>
									<span class="text-slate-500">pendiente</span>
								</span>
								<span class="flex items-center gap-1.5">
									<span class="w-2 h-2 rounded-full bg-slate-400"></span>
									<span class="font-semibold text-slate-700">{totalFinalizado}</span>
									<span class="text-slate-500">finalizado</span>
								</span>
							</div>
						</div>
						<div class="space-y-2 max-h-80 overflow-y-auto">
							{#each modulosPendientes as m, i (i)}
								<div class="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
									<!-- Indicador de estado -->
									<div class={`w-2 h-10 rounded-full shrink-0 ${
										m.estado === 'en_curso' ? 'bg-emerald-500' :
										m.estado === 'finalizado' ? 'bg-slate-400' : 'bg-amber-500'
									}`}></div>
									<div class="min-w-0 flex-1">
										<p class="text-sm font-semibold text-slate-800 truncate" title={m.nombre}>
											{m.nombre}
										</p>
										<p class="text-[11px] text-slate-500 truncate">
											<span class="font-mono">{m.cursoCodigo}</span> · {m.cursoNombre}
										</p>
									</div>
									<div class="shrink-0 text-right">
										{#if m.estado === 'en_curso'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700">
												▶ En curso
											</span>
										{:else if m.estado === 'finalizado'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 text-slate-600">
												✓ Finalizado
											</span>
										{:else}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 text-amber-700">
												⏸ Pendiente
											</span>
										{/if}
									</div>
								</div>
							{/each}
						</div>
						<div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-center">
							<Button variant="secondary" onclick={() => goto('/app/enrollments')}>
								Ver libreta completa
							</Button>
						</div>
					</Card>
				</div>
			{/if}

			<!-- Quick Info -->
			<div class="mt-8">
				<Card>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información Rápida</h3>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="size-10 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Carnet</p>
								<p class="font-medium text-gray-900 dark:text-white">{studentData.carnet}</p>
							</div>
						</div>
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
							<div class="size-10 shrink-0 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-gray-500 dark:text-gray-400">Registro</p>
								<p class="font-medium text-gray-900 dark:text-white break-all" title={studentData.registro}>
									{studentData.registro}
								</p>
							</div>
						</div>
						<div class="flex items-center space-x-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
							<div class="size-10 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
								<ShieldIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Certificados emitidos</p>
								<p class="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{cantidadCertificados}</p>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	{:else}
		<div class="text-center py-10">
			<Heading level="h2">Error cargando perfil</Heading>
			<p class="text-gray-500">No se pudo cargar la información del estudiante.</p>
		</div>
	{/if}
</div>
