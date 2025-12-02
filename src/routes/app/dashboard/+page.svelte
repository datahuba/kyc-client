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

	let loading = true;
	let stats = {
		students: { total: 0, active: 0 },
		courses: { total: 0, active: 0 },
		enrollments: { total: 0, active: 0 },
		payments: { total: 0, pending: 0, revenue: 0 }
	};

	let recentEnrollments: (Enrollment & { studentName?: string, courseName?: string })[] = [];
	let recentPayments: (Payment & { studentName?: string, courseName?: string })[] = [];

	onMount(async () => {
		try {
			const [students, courses, enrollments, payments] = await Promise.all([
				studentService.getAll(0, 1000),
				courseService.getAll(0, 1000),
				enrollmentService.getAll(0, 100), // Limit recent fetch? Or fetch all for stats?
				paymentService.getAll(0, 100)
			]);

			// Calculate Stats
			stats.students.total = students.length;
			stats.students.active = students.filter(s => s.activo).length;

			stats.courses.total = courses.length;
			stats.courses.active = courses.filter(c => c.activo).length;

			stats.enrollments.total = enrollments.length;
			stats.enrollments.active = enrollments.filter(e => e.estado === 'activo').length;

			stats.payments.total = payments.length;
			stats.payments.pending = payments.filter(p => p.estado_pago === 'pendiente').length;
			stats.payments.revenue = payments
				.filter(p => p.estado_pago === 'pagado' || p.estado_pago === 'aprobado') // Assuming 'aprobado' or 'pagado'
				.reduce((sum, p) => sum + p.cantidad_pago, 0);

			// Process Recent Activity
			// Map IDs to Names for display
			const studentsMap = students.reduce((acc, s) => ({ ...acc, [s._id]: s.nombre }), {} as Record<string, string>);
			const coursesMap = courses.reduce((acc, c) => ({ ...acc, [c._id]: c.nombre_programa }), {} as Record<string, string>);

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
					courseName: coursesMap[p.curso_id] || 'Desconocido'
				}));

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
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Estudiantes</p>
					<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.students.total}</p>
					<p class="text-xs text-green-600 mt-1">{stats.students.active} Activos</p>
				</div>
				<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
					<UsersIcon class="size-8" />
				</div>
			</div>

			<!-- Courses Card -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Cursos</p>
					<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.courses.total}</p>
					<p class="text-xs text-green-600 mt-1">{stats.courses.active} Activos</p>
				</div>
				<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
					<TagIcon class="size-8" />
				</div>
			</div>

			<!-- Enrollments Card -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Inscripciones</p>
					<p class="text-3xl font-bold text-gray-900 dark:text-white mt-1">{stats.enrollments.total}</p>
					<p class="text-xs text-green-600 mt-1">{stats.enrollments.active} Activas</p>
				</div>
				<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
					<ClipboardIcon class="size-8" />
				</div>
			</div>

			<!-- Revenue Card -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex items-center justify-between">
				<div>
					<p class="text-sm font-medium text-gray-500 dark:text-gray-400">Ingresos</p>
					<p class="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formatCurrency(stats.payments.revenue)}</p>
					<p class="text-xs text-yellow-600 mt-1">{stats.payments.pending} Pagos Pendientes</p>
				</div>
				<div class="p-3 bg-light-tertiary dark:bg-light-tertiary rounded-full text-light-primary dark:text-light-primary">
					<CreditCardIcon class="size-8" />
				</div>
			</div>
		</div>

		<!-- Recent Activity Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
			<!-- Recent Enrollments -->
			<Card>
				<div class="flex justify-between items-center mb-4">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Inscripciones Recientes</h3>
					<button onclick={() => goto('/app/enrollments')} class="text-sm text-primary-600 hover:text-primary-500">Ver todas</button>
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
										{new Date(enrollment.created_at).toLocaleDateString()}
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
					<button onclick={() => goto('/app/payments')} class="text-sm text-primary-600 hover:text-primary-500">Ver todos</button>
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
	{/if}
</div>