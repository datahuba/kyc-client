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
			<!-- Students Card -->
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

			<!-- Courses Card -->
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

			<!-- Enrollments Card -->
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

			<!-- Revenue Card -->
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
			<!-- Recent Enrollments -->
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

			<!-- Recent Payments -->
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
				<div class="grid grid-cols-1 gap-4">
					{#each courseBreakdown as course}
						<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-5 hover:shadow-md transition-shadow">
							<!-- Header row -->
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
								<div class="flex items-center gap-3">
									<div>
										<span class="text-base font-semibold text-gray-900 dark:text-white">{course.nombre}</span>
										<span class="ml-2 text-xs text-gray-400 dark:text-gray-500">({course.codigo})</span>
									</div>
									<span class={`px-2 py-0.5 text-xs font-medium rounded-full ${course.activo ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
										{course.activo ? 'Activo' : 'Inactivo'}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<span class="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{course.tipo}</span>
									<span class="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 capitalize">{course.modalidad}</span>
								</div>
							</div>

							<!-- Stats row -->
							<div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
								<!-- Inscritos -->
								<a href={`/app/enrollments?curso_id=${course.id}`} class="group text-center p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
									<p class="text-2xl font-bold text-blue-700 dark:text-blue-300">{course.inscritos}</p>
									<p class="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Inscritos</p>
									{#if course.inscritosActivos < course.inscritos}
										<p class="text-xs text-blue-500 dark:text-blue-500 mt-0.5">{course.inscritosActivos} activos</p>
									{/if}
								</a>

								<!-- Ingresos -->
								<a href={`/app/payments?curso_id=${course.id}`} class="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors">
									<p class="text-lg font-bold text-green-700 dark:text-green-300 leading-tight">{formatCurrency(course.ingresos)}</p>
									<p class="text-xs text-green-600 dark:text-green-400 mt-0.5">Recaudado</p>
								</a>

								<!-- Saldo pendiente -->
								<div class="text-center p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
									<p class="text-lg font-bold text-orange-700 dark:text-orange-300 leading-tight">{formatCurrency(course.saldoPendiente)}</p>
									<p class="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Por cobrar</p>
								</div>

								<!-- Pagos pendientes de aprobar -->
								<a href={`/app/payments`} class="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors">
									<p class="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{course.pagosPendientes}</p>
									<p class="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">
										{course.pagosPendientes === 1 ? 'Pago pendiente' : 'Pagos pendientes'}
									</p>
								</a>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

	{/if}
</div>