<script lang="ts">
	import { onMount } from 'svelte';
	import { studentService, courseService, enrollmentService, paymentService } from '$lib/services';
	import type { Enrollment, Payment } from '$lib/interfaces';
	import { UsersIcon, ClipboardIcon, TagIcon } from '$lib/icons/outline';
	import { CreditCardIcon } from '$lib/icons/solid';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { goto } from '$app/navigation';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';
	import { formatDate } from '$lib/utils';

	let loading = true;
	let stats = {
		students: { total: 0, active: 0 },
		courses: { total: 0, active: 0 },
		enrollments: { total: 0, active: 0 },
		payments: { total: 0, pending: 0, revenue: 0 }
	};

	let recentEnrollments: (Enrollment & { studentName?: string, courseName?: string })[] = [];
	let recentPayments: (Payment & { studentName?: string, courseName?: string })[] = [];

	interface CourseBreakdown {
		id: string;
		nombre: string;
		codigo: string;
		tipo: string;
		modalidad: string;
		activo: boolean;
		inscritos: number;
		inscritosActivos: number;
		ingresos: number;
		saldoPendiente: number;
		pagosPendientes: number;
	}
	let courseBreakdown: CourseBreakdown[] = [];
	let groupedByType: Record<string, CourseBreakdown[]> = {};
	let expandedGroups: Set<string> = new Set();

	const TYPE_ORDER = ['maestría', 'doctorado', 'diplomado', 'curso', 'taller', 'seminario', 'otro'];

	const TYPE_LABELS: Record<string, string> = {
		'maestría': 'Maestrías',
		'doctorado': 'Doctorados',
		'diplomado': 'Diplomados',
		'curso': 'Cursos',
		'taller': 'Talleres',
		'seminario': 'Seminarios',
		'otro': 'Otros'
	};

	const TYPE_COLORS: Record<string, { bg: string; text: string; border: string; badge: string; accent: string }> = {
		'maestría':  { bg: 'bg-purple-50 dark:bg-purple-900/20',  text: 'text-purple-700 dark:text-purple-300',  border: 'border-purple-200 dark:border-purple-800',  badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', accent: 'bg-purple-400' },
		'doctorado': { bg: 'bg-indigo-50 dark:bg-indigo-900/20',  text: 'text-indigo-700 dark:text-indigo-300',  border: 'border-indigo-200 dark:border-indigo-800',  badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', accent: 'bg-indigo-400' },
		'diplomado': { bg: 'bg-blue-50 dark:bg-blue-900/20',      text: 'text-blue-700 dark:text-blue-300',      border: 'border-blue-200 dark:border-blue-800',      badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', accent: 'bg-blue-400' },
		'curso':     { bg: 'bg-teal-50 dark:bg-teal-900/20',      text: 'text-teal-700 dark:text-teal-300',      border: 'border-teal-200 dark:border-teal-800',      badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300', accent: 'bg-teal-400' },
		'taller':    { bg: 'bg-orange-50 dark:bg-orange-900/20',  text: 'text-orange-700 dark:text-orange-300',  border: 'border-orange-200 dark:border-orange-800',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', accent: 'bg-orange-400' },
		'seminario': { bg: 'bg-pink-50 dark:bg-pink-900/20',      text: 'text-pink-700 dark:text-pink-300',      border: 'border-pink-200 dark:border-pink-800',      badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', accent: 'bg-pink-400' },
		'otro':      { bg: 'bg-gray-50 dark:bg-gray-800',          text: 'text-gray-700 dark:text-gray-300',      border: 'border-gray-200 dark:border-gray-700',      badge: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', accent: 'bg-gray-400' }
	};

	function getTypeStyle(tipo: string) {
		return TYPE_COLORS[tipo] ?? TYPE_COLORS['otro'];
	}

	function toggleGroup(tipo: string) {
		if (expandedGroups.has(tipo)) {
			expandedGroups.delete(tipo);
		} else {
			expandedGroups.add(tipo);
		}
		expandedGroups = new Set(expandedGroups);
	}

	function buildGrouped(courses: CourseBreakdown[]) {
		const grouped: Record<string, CourseBreakdown[]> = {};
		for (const c of courses) {
			const key = c.tipo ?? 'otro';
			if (!grouped[key]) grouped[key] = [];
			grouped[key].push(c);
		}
		return grouped;
	}

	onMount(async () => {
		try {
			const [
				studentsRes,
				coursesRes,
				enrollmentsRes,
				paymentsRes
			] = await Promise.all([
				studentService.getAll(),
				courseService.getAll(),
				enrollmentService.getAll(1, 100),
				paymentService.getAll(1, 100)
			]);

			const students = studentsRes.data ?? [];
			const courses = coursesRes.data ?? [];
			const enrollments = enrollmentsRes.data ?? [];
			const payments = paymentsRes.data ?? [];

			// ===== STATS =====
			stats.students.total = studentsRes.meta?.totalItems ?? students.length;
			stats.students.active = students.filter(s => s.activo).length;

			stats.courses.total = coursesRes.meta?.totalItems ?? courses.length;
			stats.courses.active = courses.filter(c => c.activo).length;

			stats.enrollments.total = enrollmentsRes.meta?.totalItems ?? enrollments.length;
			stats.enrollments.active = enrollments.filter(e => e.estado === 'activo').length;

			stats.payments.total = paymentsRes.meta?.totalItems ?? payments.length;
			stats.payments.pending = payments.filter(p => p.estado_pago === 'pendiente').length;
			stats.payments.revenue = payments
				.filter(p => p.estado_pago === 'aprobado' || p.estado_pago === 'pagado')
				.reduce((sum, p) => sum + p.cantidad_pago, 0);

			// ===== MAPS =====
			const studentsMap = students.reduce(
				(acc, s) => ({ ...acc, [s._id]: s.nombre }),
				{} as Record<string, string>
			);

			const coursesMap = courses.reduce(
				(acc, c) => ({ ...acc, [c._id]: c.nombre_programa }),
				{} as Record<string, string>
			);

			// ===== RECENTS =====
			recentEnrollments = enrollments
				.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
				.slice(0, 5)
				.map(e => ({
					...e,
					studentName: studentsMap[e.estudiante_id] || 'Desconocido',
					courseName: coursesMap[e.curso_id] || 'Desconocido'
				}));

			recentPayments = payments
				.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
				.slice(0, 5)
				.map(p => ({
					...p,
					studentName: studentsMap[p.estudiante_id] || 'Desconocido',
					courseName: coursesMap[p.curso_id] || '—'
				}));

			// ===== DESGLOSE POR CURSO =====
			courseBreakdown = courses.map(course => {
				const courseEnrollments = enrollments.filter(e => e.curso_id === course._id);
				const coursePayments = payments.filter(p => p.curso_id === course._id);

				const inscritos = courseEnrollments.length;
				const inscritosActivos = courseEnrollments.filter(e => e.estado === 'activo').length;
				const ingresos = coursePayments
					.filter(p => p.estado_pago === 'aprobado' || p.estado_pago === 'pagado')
					.reduce((sum, p) => sum + p.cantidad_pago, 0);
				const saldoPendiente = courseEnrollments
					.reduce((sum, e) => sum + (e.saldo_pendiente ?? 0), 0);
				const pagosPendientes = coursePayments
					.filter(p => p.estado_pago === 'pendiente').length;

				return {
					id: course._id,
					nombre: course.nombre_programa,
					codigo: course.codigo,
					tipo: course.tipo_curso,
					modalidad: course.modalidad,
					activo: course.activo,
					inscritos,
					inscritosActivos,
					ingresos,
					saldoPendiente,
					pagosPendientes
				};
			}).sort((a, b) => b.inscritos - a.inscritos);

			groupedByType = buildGrouped(courseBreakdown);
			expandedGroups = new Set(Object.keys(groupedByType));

		} catch (error) {
			console.error('Error loading dashboard data:', error);
		} finally {
			loading = false;
		}
	});

	function formatCurrency(amount: number) {
		return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(amount);
	}
</script>

<div class="space-y-8">

	{#if loading}
		<DashboardSkeleton />
	{:else}
  	<Heading level="h1">Dashboard</Heading>

		<!-- Stats Grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
			<a href="/app/students" class="block">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
					<div>
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Estudiantes</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.students.total}</p>
						<p class="text-xs text-green-600 mt-1">{stats.students.active} Activos</p>
					</div>
					<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
						<UsersIcon class="size-8" />
					</div>
				</div>
			</a>

			<a href="/app/courses" class="block">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
					<div>
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Cursos</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.courses.total}</p>
						<p class="text-xs text-green-600 mt-1">{stats.courses.active} Activos</p>
					</div>
					<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
						<TagIcon class="size-8" />
					</div>
				</div>
			</a>

			<a href="/app/enrollments" class="block">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
					<div>
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Inscripciones</p>
						<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.enrollments.total}</p>
						<p class="text-xs text-green-600 mt-1">{stats.enrollments.active} Activas</p>
					</div>
					<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
						<ClipboardIcon class="size-8" />
					</div>
				</div>
			</a>

			<a href="/app/payments" class="block">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
					<div>
						<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Ingresos</p>
						<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(stats.payments.revenue)}</p>
						<p class="text-xs text-yellow-600 mt-1">{stats.payments.pending} Pagos Pendientes</p>
					</div>
					<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
						<CreditCardIcon class="size-8" />
					</div>
				</div>
			</a>
		</div>

		<!-- Recent Activity Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<Card>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Inscripciones Recientes</h3>
					<a href="/app/enrollments" class="text-sm text-primary-600 hover:text-primary-500 hover:scale-105">Ver todas</a>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead>
							<tr>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Curso</th>
								<th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Fecha</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each recentEnrollments as enrollment}
								<tr>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white">{enrollment.studentName}</td>
									<td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{enrollment.courseName}</td>
									<td class="px-4 py-3 text-sm text-right text-gray-500 dark:text-gray-400">
										{formatDate(enrollment.created_at)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if recentEnrollments.length === 0}
						<p class="text-center text-gray-500 py-4">No hay inscripciones recientes</p>
					{/if}
				</div>
			</Card>

			<Card>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Pagos Recientes</h3>
					<a href="/app/payments" class="text-sm text-primary-600 hover:text-primary-500 hover:scale-105">Ver todos</a>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead>
							<tr>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estudiante</th>
								<th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Monto</th>
								<th class="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Estado</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each recentPayments as payment}
								<tr>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white">{payment.studentName}</td>
									<td class="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">{formatCurrency(payment.cantidad_pago)}</td>
									<td class="px-4 py-3 text-sm text-right">
										<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
											${payment.estado_pago === 'aprobado' || payment.estado_pago === 'pagado' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
											  payment.estado_pago === 'pendiente' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
											  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
											{payment.estado_pago}
										</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if recentPayments.length === 0}
						<p class="text-center text-gray-500 py-4">No hay pagos recientes</p>
					{/if}
				</div>
			</Card>
		</div>

		<!-- Course Breakdown Section -->
		<div>
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Desglose por Curso</h2>
				<a href="/app/courses" class="text-sm text-primary-600 hover:text-primary-500 hover:scale-105">Ver cursos</a>
			</div>

			{#if courseBreakdown.length === 0}
				<Card>
					<p class="text-center text-gray-500 py-6">No hay cursos registrados</p>
				</Card>
			{:else}
				<div class="space-y-4">
					{#each [...TYPE_ORDER.filter(t => groupedByType[t]), ...Object.keys(groupedByType).filter(t => !TYPE_ORDER.includes(t))] as tipo}
						{@const style = getTypeStyle(tipo)}
						{@const group = groupedByType[tipo]}
						{@const isOpen = expandedGroups.has(tipo)}
						{@const totalInscritos = group.reduce((s, c) => s + c.inscritos, 0)}
						{@const totalIngresos = group.reduce((s, c) => s + c.ingresos, 0)}
						{@const totalPendientes = group.reduce((s, c) => s + c.pagosPendientes, 0)}

						<div class={`rounded-xl border ${style.border} overflow-hidden shadow-sm`}>
							<!-- Accordion header -->
							<button
								type="button"
								onclick={() => toggleGroup(tipo)}
								class={`w-full flex items-center justify-between px-6 py-4 ${style.bg} hover:brightness-95 transition-all`}
							>
								<div class="flex items-center gap-3 flex-wrap">
									<span class={`text-base font-bold ${style.text}`}>{TYPE_LABELS[tipo] ?? tipo}</span>
									<span class={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${style.badge}`}>
										{group.length} {group.length === 1 ? 'curso' : 'cursos'}
									</span>
									<span class="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 ml-1">
										<span>{totalInscritos} inscritos</span>
										<span>·</span>
										<span>{formatCurrency(totalIngresos)} recaudado</span>
										{#if totalPendientes > 0}<span>· <span class="text-yellow-600 font-medium">{totalPendientes} pend.</span></span>{/if}
									</span>
								</div>
								<svg class={`size-5 shrink-0 ${style.text} transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</button>

							{#if isOpen}
								<div class="bg-gray-50 dark:bg-gray-900/30 p-5 space-y-6">
									{#each group as course}
										<!-- Nombre del curso -->
										<div>
											<div class="flex items-center gap-2 mb-3">
												<div class={`w-1 h-5 rounded-full shrink-0 ${style.accent}`}></div>
												<p class="text-sm font-bold text-gray-900 dark:text-white">{course.nombre}</p>
												<span class="text-xs font-mono text-gray-400">{course.codigo}</span>
												<span class={`px-1.5 py-0.5 text-xs font-medium rounded-full ${course.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
													{course.activo ? 'Activo' : 'Inactivo'}
												</span>
												<span class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 capitalize">{course.modalidad}</span>
											</div>

											<!-- 4 cards exactamente igual al Stats Grid del dashboard -->
											<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

												<!-- Inscritos -->
												<a href={`/app/students?curso_id=${course.id}`} class="block">
													<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
														<div>
															<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Inscritos</p>
															<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{course.inscritos}</p>
															<p class="text-xs text-green-600 mt-1">{course.inscritosActivos} Activos</p>
														</div>
														<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
															<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
														</div>
													</div>
												</a>

												<!-- Pagos Pendientes -->
												<a href={`/app/payments?curso_id=${course.id}`} class="block">
													<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
														<div>
															<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Pagos Pendientes</p>
															<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{course.pagosPendientes}</p>
															<p class="text-xs text-yellow-600 mt-1">{course.pagosPendientes} Por Revisar</p>
														</div>
														<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
															<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
														</div>
													</div>
												</a>

												<!-- Recaudado -->
												<a href={`/app/payments?curso_id=${course.id}`} class="block">
													<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between hover:scale-105 transition-transform hover:shadow-lg">
														<div>
															<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Recaudado</p>
															<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(course.ingresos)}</p>
															<p class="text-xs text-green-600 mt-1">Pagos Aprobados</p>
														</div>
														<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
															<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
														</div>
													</div>
												</a>

												<!-- Por Cobrar -->
												<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
													<div>
														<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Por Cobrar</p>
														<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(course.saldoPendiente)}</p>
														<p class="text-xs text-orange-500 mt-1">Saldo Pendiente</p>
													</div>
													<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
														<svg class="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
													</div>
												</div>

											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

	{/if}
</div>
