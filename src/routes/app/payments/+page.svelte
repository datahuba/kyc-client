<script lang="ts">
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/stores';
	import { paymentService, studentService, courseService } from '$lib/services';
	import type { Payment, Student, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import PaymentForm from '$lib/features/payments/PaymentForm.svelte';
	import { Pagination } from '$lib/components/ui';
	import { 
		PlusIcon, 
		DotsVerticalIcon, 
		CheckIcon, 
		XIcon, 
		RefreshIcon,
		DownloadIcon
	} from '$lib/icons/outline';
	import { alert, formatDate, formatCurrency } from '$lib/utils';
	import Select from '$lib/components/ui/select.svelte';
	

	let payments: Payment[] = $state([]);
	let loading = $state(true);
	
	// Pagination
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Filters
	let filters = $state({
		q: '',
		estado: '',
		curso_id: '',
		estudiante_id: ''
	});
	let debounceTimer: any;

	// Helper lists for filters
	let studentsList: Student[] = $state([]);
	let coursesList: Course[] = $state([]);

	// State
	let isCreateModalOpen = $state(false);
	let isApproveModalOpen = $state(false);
	let isRejectModalOpen = $state(false);
	
	let paymentToAction: Payment | null = $state(null);
	let actionLoading = $state(false);
	let rejectReason = $state('');

	// Dropdown
	let openDropdownId: string | null = $state(null);
	let selectedPayment: Payment | null = $state(null);

	// Computed
	let isAdmin = $derived($userStore.role === 'admin' || $userStore.role === 'superadmin');
	let isStudent = $derived($userStore.role === 'student');
	let coursesMap = $derived(
		coursesList.reduce((acc, c) => ({ ...acc, [c._id]: c }), {} as Record<string, typeof coursesList[0]>)
	);

	async function loadPayments() {
		loading = true;
		try {
			// Populate lists for filters (Admin only)
			if (isAdmin && studentsList.length === 0) {
				const studentsRes = await studentService.getAll(1, 100);
				studentsList = studentsRes.data;
			}
			if (coursesList.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				coursesList = coursesRes.data;
			}

			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.estado) filterParams.estado = filters.estado;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;
			if (filters.estudiante_id) filterParams.estudiante_id = filters.estudiante_id;

			const result = await paymentService.getAll(page, limit, filterParams); 
			
			// Handle response structure depending if it returns array (student) or PaginatedResponse
			// If student/role restricted, it might return array directly based on implementation details of previous modules
			// but we designed PaymentService.getAll to return PaginatedResponse.
			// Let's assume consistent PaginatedResponse unless backend behaves differently for students
			
			// Checking result structure just in case
			const response = result as any;
			if (response && Array.isArray(response)) {
				// Fallback if backend returns array
				payments = response;
				totalItems = response.length;
				totalPages = 1;
			} else if (response && response.data) {
				payments = response.data;
				totalItems = response.meta.totalItems;
				totalPages = response.meta.totalPages;
			} else {
				payments = [];
				totalItems = 0;
			}

		} catch (error: any) {
			console.error(error);
			alert('error', error.message || 'Error al cargar pagos');
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadPayments();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadPayments();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadPayments();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadPayments();
	}

	onMount(async () => {
		// Pre-load courses (and students for admin) so the select renders with the correct option
		const results = await Promise.all([
			courseService.getAll(1, 100),
			isAdmin ? studentService.getAll(1, 100) : Promise.resolve(null)
		]);
		coursesList = results[0].data;
		if (results[1]) studentsList = (results[1] as any).data;

		// Now set filter from URL — options are already populated, so select reflects correctly
		const cursoIdParam = $appPage.url.searchParams.get('curso_id');
		if (cursoIdParam) {
			filters.curso_id = cursoIdParam;
		}
		loadPayments();
	});

	function toggleDropdown(id: string) {
		openDropdownId = openDropdownId === id ? null : id;
	}

	// Actions
	function handleApproveClick(payment: Payment) {
		paymentToAction = payment;
		isApproveModalOpen = true;
		openDropdownId = null;
	}

	function handleRejectClick(payment: Payment) {
		paymentToAction = payment;
		rejectReason = '';
		isRejectModalOpen = true;
		openDropdownId = null;
	}

	async function confirmApprove() {
		if (!paymentToAction) return;
		actionLoading = true;
		try {
			await paymentService.approve(paymentToAction._id);
			alert('success', 'Pago aprobado correctamente');
			isApproveModalOpen = false;
			loadPayments();
		} catch (error: any) {
			alert('error', error.message || 'Error al aprobar pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
		}
	}

	async function confirmReject() {
		if (!paymentToAction) return;
		if (!rejectReason.trim()) {
			alert('error', 'Debe ingresar un motivo');
			return;
		}
		actionLoading = true;
		try {
			await paymentService.reject(paymentToAction._id, rejectReason);
			alert('success', 'Pago rechazado correctamente');
			isRejectModalOpen = false;
			loadPayments();
		} catch (error: any) {
			actionLoading = false;
			alert('error', error.message || 'Error al rechazar pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
			rejectReason = '';
		}
	}

	function handleViewDetails(payment: Payment) {
		selectedPayment = payment;
		openDropdownId = null;
	}

	function getDropdownOptions(payment: Payment) {
		const options = [];

		options.push({
			label: 'Ver Detalles',
			id: 'view',
			icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`,
			action: () => handleViewDetails(payment)
		});

		if (isAdmin && payment.estado_pago === 'pendiente') {
			options.push(
				{
					label: 'Aprobar Pago',
					id: 'approve',
					icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
					action: () => handleApproveClick(payment)
				},
				{
					label: 'Rechazar Pago',
					id: 'reject',
					icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
					action: () => handleRejectClick(payment)
				}
			);
		}

		return options;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pendiente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'aprobado': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
			case 'rechazado': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}


	let csvLoading = $state(false);

	// Función para descargar CSV (todos los registros con filtros actuales)
	async function downloadCSV() {
		csvLoading = true;
		try {
			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.estado) filterParams.estado = filters.estado;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;
			if (filters.estudiante_id) filterParams.estudiante_id = filters.estudiante_id;

			const res = await paymentService.getAll(1, 1000, filterParams) as any;
			const allPayments: Payment[] = Array.isArray(res) ? res : (res?.data ?? []);

			if (allPayments.length === 0) {
				alert('error', 'No hay datos para descargar');
				return;
			}

			const courseName = filters.curso_id
				? (coursesList.find(c => c._id === filters.curso_id)?.codigo ?? filters.curso_id)
				: 'todos';
			const filename = `pagos_${courseName}_${new Date().toISOString().slice(0,10)}.csv`;

			const headers = ['Remitente','Banco','Monto Comprobante','Fecha Comprobante','Cuenta Destino','Fecha Registro','Concepto','Monto/Cuota','Nº Transacción', isAdmin ? 'Estudiante ID' : '', 'Curso', 'Estado'];
			const rows = allPayments.map(p => [
				p.remitente || 'No disponible',
				p.banco || 'No disponible',
				formatCurrency(p.monto_comprobante ?? 0),
				p.fecha_comprobante || '---',
				p.cuenta_destino || '---',
				formatDate(p.created_at),
				p.concepto,
				p.cantidad_pago,
				p.numero_transaccion,
				isAdmin ? p.estudiante_id : '',
				`"${coursesMap[p.curso_id]?.nombre_programa ?? '—'}"`,
				p.estado_pago
			]);

			const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
			const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.setAttribute('href', url);
			link.setAttribute('download', filename);
			link.click();
			URL.revokeObjectURL(url);
		} catch (error) {
			console.error('Error al exportar CSV:', error);
			alert('error', 'Error al generar el archivo');
		} finally {
			csvLoading = false;
		}
	}

</script>

<div class="space-y-6">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div>
			<Heading level="h1">Gestión de Pagos</Heading>
			<p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
				{#if isAdmin}Administre los pagos recibidos{:else}Historial de sus pagos realizados{/if}
			</p>
		</div>
		
		<div class="flex gap-3 w-full md:w-auto">
			<Button variant="secondary" onclick={loadPayments} loading={loading}>
				{#snippet leftIcon()} <RefreshIcon class="size-5" /> {/snippet}
			</Button>
			<Button variant="secondary" onclick={downloadCSV} loading={csvLoading}>
				{#snippet leftIcon()} <DownloadIcon class="size-5" /> {/snippet}
				Descargar CSV
			</Button>
			{#if isStudent}
				<Button onclick={() => isCreateModalOpen = true} loading={loading}>
					{#snippet leftIcon()} <PlusIcon class="size-5" /> {/snippet}
					Registrar Pago
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
		<!-- Search -->
		<div class="md:col-span-1">
			<label for="search" class="sr-only">Buscar</label>
			<div class="relative">
				<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
					<svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
						<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
					</svg>
				</div>
				<input
					type="text"
					id="search"
					bind:value={filters.q}
					class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
					placeholder="Buscar..."
					oninput={handleSearchInput}
				/>
			</div>
		</div>
		
		<!-- Estado -->
		<div>
			<select
				bind:value={filters.estado}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="">Todos los estados</option>
				<option value="pendiente">Pendiente</option>
				<option value="aprobado">Aprobado</option>
				<option value="rechazado">Rechazado</option>
			</select>
		</div>

		{#if isAdmin}
			<!-- Curso -->
			<div class="flex flex-col gap-1">
				<div class="relative">
					<select
						bind:value={filters.curso_id}
						onchange={handleFilterChange}
						class="block w-full rounded-md border-0 py-1.5 pr-8 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6
							{filters.curso_id
								? 'ring-2 ring-inset ring-primary-500 bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-500'
								: 'ring-1 ring-inset ring-gray-300 dark:bg-gray-700 dark:text-white dark:ring-gray-600'}"
					>
						<option value="">Todos los cursos</option>
						{#each coursesList as course}
							<option value={course._id}>{course.nombre_programa}</option>
						{/each}
						</select>
					{#if filters.curso_id}
						<button
							type="button"
							onclick={() => { filters.curso_id = ''; page = 1; handleFilterChange(); }}
							class="absolute right-7 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors z-10"
							title="Quitar filtro de curso"
							aria-label="Quitar filtro de curso"
						>
							<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					{/if}
				</div>
				{#if filters.curso_id}
					<span class="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400">
						<svg class="size-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd" /></svg>
						Filtro activo
					</span>
				{/if}
			</div>

			<!-- Estudiante -->
			<div>
				<select
					bind:value={filters.estudiante_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="">Todos los estudiantes</option>
					{#each studentsList as student}
						<option value={student._id}>{student.nombre}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>



	{#if loading && payments.length === 0}
		<TableSkeleton columns={10} rows={10} />
	{:else}
		<div class="w-full overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº Transacción</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remitente</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Banco</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto Comprobante</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Comprobante</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cuenta destino</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Registro</th>
							<!-- <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th> -->
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto/Cuota</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
							<th scope="col" class="relative px-6 py-3"><span class="sr-only">Acciones</span></th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
						{#each payments as payment}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
									{payment.numero_transaccion}
								</td>
								<td class="px-6 py-4 text-sm max-w-[200px]">
									{#if coursesMap[payment.curso_id]}
										<button
											type="button"
											onclick={() => { filters.curso_id = payment.curso_id; page = 1; handleFilterChange(); }}
											class="inline-flex flex-col items-start text-left group"
											title="Filtrar por este curso"
										>
											<span class="text-gray-900 dark:text-white font-medium group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight">{coursesMap[payment.curso_id].nombre_programa}</span>
											<span class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{coursesMap[payment.curso_id].codigo}</span>
										</button>
									{:else}
										<span class="text-gray-400 dark:text-gray-500 text-xs">—</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
									{payment.remitente || 'No disponible'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
									{payment.banco || 'No disponible'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
									{payment.monto_comprobante ? formatCurrency(payment.monto_comprobante) : '0.00'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
									{formatDate(payment.fecha_comprobante || '---')}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
									{payment.cuenta_destino || '---'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-white">
									{formatDate(payment.created_at || '---')}
								</td>
								<!-- <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-white">
									{payment.concepto}
								</td> -->
								<td class="px-6 py-4 whitespace-nowrap text-sm text-green-600 dark:text-green-400">
									{formatCurrency(payment.cantidad_pago)}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.estado_pago)}`}>
										{payment.estado_pago}
									</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative">
									<button onclick={() => toggleDropdown(payment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
										<DotsVerticalIcon class="size-5" />
									</button>
									{#if openDropdownId === payment._id}
										<div class="absolute right-0 mt-2 w-48 z-10">
											<DropdownMenu 
												options={getDropdownOptions(payment)} 
												isOpen={true} 
												width="w-48" 
												class="origin-top-right right-0"
											/>
										</div>
									{/if}
								</td>
							</tr>
						{/each}
						{#if payments.length === 0}
							<tr>
								<td colspan={isAdmin ? 7 : 6} class="px-6 py-4 text-center text-sm text-gray-500 dark:text-white">
									No se encontraron pagos.
								</td>
							</tr>
						{/if}
					</tbody>
			</table>
		
		</div>

		<Pagination
			currentPage={page}
			{totalPages}
			{totalItems}
			{limit}
			onPageChange={handlePageChange}
			onLimitChange={handleLimitChange}
		/>
	{/if}

	<!-- Create Payment Modal -->
	<Modal
		isOpen={isCreateModalOpen}
		title="Registrar Nuevo Pago"
		onClose={() => isCreateModalOpen = false}
		maxWidth="sm:max-w-xl"
	>
		<PaymentForm 
			onSuccess={() => {
				isCreateModalOpen = false;
				loadPayments();
			}}
			onCancel={() => isCreateModalOpen = false}
		/>
	</Modal>

	<!-- Approve Confirmation Modal -->
	<ModalConfirm
		isOpen={isApproveModalOpen}
		message={`¿Confirma que desea APROBAR este pago de ${formatCurrency(paymentToAction?.cantidad_pago || 0)}?`}
		onConfirm={confirmApprove}
		onCancel={() => isApproveModalOpen = false}
		loading={actionLoading}
	/>

	<!-- Reject Input Modal -->
	<Modal
		isOpen={isRejectModalOpen}
		title="Rechazar Pago"
		onClose={() => isRejectModalOpen = false}
		maxWidth="sm:max-w-lg"
	>
		<div class="space-y-4 p-4">
			<p class="text-sm text-gray-500">
				Ingrese el motivo del rechazo para informar al estudiante.
			</p>
			<div>
				<label for="rejectReason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
				<textarea
					id="rejectReason"
					bind:value={rejectReason}
					rows="3"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					placeholder="Ej: Comprobante ilegible, monto incorrecto..."
				></textarea>
			</div>
			<div class="flex justify-end gap-3 mt-4">
				<Button variant="secondary" onclick={() => isRejectModalOpen = false} disabled={actionLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmReject} loading={actionLoading}>Rechazar</Button>
			</div>
		</div>
	</Modal>

	<!-- View Payment Details Modal -->
	<Modal
		isOpen={!!selectedPayment}
		title="Detalles del Pago"
		onClose={() => selectedPayment = null}
		maxWidth="sm:max-w-2xl"
	>
		{#if selectedPayment}
			<div class="space-y-6 p-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="estdianteID" class="block text-xs font-medium text-gray-900 uppercase">Estudiante ID</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="estudianteID">{selectedPayment.estudiante_id}</p>
					</div>
					<div>
						<label for="remitente" class="block text-xs font-medium text-gray-900 uppercase">Remitente</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="remitente">{selectedPayment.remitente || 'No disponible'}</p>
					</div>
					<div>
						<label for="banco" class="block text-xs font-medium text-gray-900 uppercase">Banco</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="banco">
							{selectedPayment.banco || 'No registrado'}
						</p>
					</div>

					<div>
						<label for="montoComprobante" class="block text-xs font-medium text-gray-900 uppercase">Monto Comprobante (Bs)</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="montoComprobante">
							{selectedPayment.monto_comprobante ? formatCurrency(selectedPayment.monto_comprobante) : '---'}
						</p>
					</div>
					
					<div>
						<label for="fechaComprobante" class="block text-xs font-medium text-gray-900 uppercase">Fecha Comprobante</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="fechaComprobante">
							{selectedPayment.fecha_comprobante ? formatDate(selectedPayment.fecha_comprobante) : '---'}
						</p>
					</div>
					
					<div>
						<label for="cuentaDestino" class="block text-xs font-medium text-gray-900 uppercase">Cuenta Destino</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="cuentaDestino">
							{selectedPayment.cuenta_destino || '---'}
						</p>
					</div>
					<!-- <div>
						<label class="block text-xs font-medium text-gray-500 uppercase">Fecha</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1">{formatDate(selectedPayment.created_at)}</p>
					</div> -->
					<!-- <div>
						<label class="block text-xs font-medium text-gray-500 uppercase">Concepto</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1">{selectedPayment.concepto}</p>
					</div> -->
					<div>
						<label for="monto" class="block text-xs font-medium text-gray-900 uppercase">Monto/Cuota</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="monto">{formatCurrency(selectedPayment.cantidad_pago)}</p>
					</div>
					<div>
						<label for="numeroTransaccion" class="block text-xs font-medium text-gray-900 uppercase">Nº Transacción</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="numeroTransaccion">{selectedPayment.numero_transaccion}</p>
					</div>
					<div>
						<label for="estado" class="block text-xs font-medium text-gray-900 uppercase">Estado</label>
						<span class={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedPayment.estado_pago)}`}>
							{selectedPayment.estado_pago}
						</span>
					</div>
				</div>

				<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
					<label for="comprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Comprobante</label>
					{#if selectedPayment.comprobante_url}
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900 flex justify-center items-center min-h-[200px]">
							{#if selectedPayment.comprobante_url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) || selectedPayment.comprobante_url.includes('cloudinary')} 
								<!-- Simple heuristic for images, assuming cloudinary urls without specific extension might be images or using img tag handles it if it is an image resource -->
								<img 
									src={selectedPayment.comprobante_url} 
									alt="Comprobante" 
									class="max-w-full max-h-[500px] object-contain" 
								/>
							{:else}
								<div class="text-center p-6">
									<p class="text-sm text-gray-500 mb-2">El comprobante es un documento (PDF u otro).</p>
									<Button variant="outline" onclick={() => window.open(selectedPayment?.comprobante_url, '_blank')}>
										Abrir en nueva pestaña
									</Button>
								</div>
							{/if}
						</div>
					{:else}
						<p class="text-sm text-gray-500 italic">No hay comprobante adjunto.</p>
					{/if}
				</div>

				<div class="flex justify-end">
					<Button variant="secondary" onclick={() => selectedPayment = null}>Cerrar</Button>
				</div>
			</div>
		{/if}
	</Modal>
</div>
