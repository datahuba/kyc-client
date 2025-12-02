<script lang="ts">
	import { onMount } from 'svelte';
	import { paymentService, studentService, courseService } from '$lib/services';
	import type { Payment, Student, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import PaymentForm from '$lib/features/payments/PaymentForm.svelte';
	import { alert } from '$lib/utils';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';

	let payments: Payment[] = [];
	let studentsMap: Record<string, Student> = {};
	let coursesMap: Record<string, Course> = {};
	let loading = false;
	let error = '';
	let skip = 0;
	let limit = 100;

	// Modal state
	let isFormOpen = false;
	let selectedPayment: Payment | null = null;
	let showDeleteModal = false;
	let paymentToDelete: Payment | null = null;
	let deleteLoading = false;

	// Dropdown state
	let openDropdownId: string | null = null;

	onMount(() => {
		loadData();
	});

	async function loadData() {
		loading = true;
		try {
			const [paymentsData, studentsData, coursesData] = await Promise.all([
				paymentService.getAll(skip, limit),
				studentService.getAll(0, 1000),
				courseService.getAll(0, 1000)
			]);
			
			payments = paymentsData;
			
			studentsData.forEach(s => studentsMap[s._id] = s);
			coursesData.forEach(c => coursesMap[c._id] = c);
			
		} catch (e: any) {
			error = e.message || 'Error al cargar pagos';
			alert('error', error);
		} finally {
			loading = false;
		}
	}

	function handleCreate() {
		selectedPayment = null;
		isFormOpen = true;
	}

	function handleEdit(payment: Payment) {
		selectedPayment = payment;
		isFormOpen = true;
	}

	function confirmDelete(payment: Payment) {
		paymentToDelete = payment;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (!paymentToDelete) return;
		deleteLoading = true;
		try {
			await paymentService.delete(paymentToDelete._id);
			alert('success', 'Pago eliminado correctamente');
			payments = payments.filter(p => p._id !== paymentToDelete!._id);
			showDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar pago');
		} finally {
			deleteLoading = false;
			paymentToDelete = null;
		}
	}

	async function handleApprove(id: string) {
		try {
			await paymentService.approve(id);
			alert('success', 'Pago aprobado correctamente');
			loadData(); // Reload to update status
			openDropdownId = null;
		} catch (e: any) {
			alert('error', e.message || 'Error al aprobar pago');
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadData();
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(payment: Payment) {
		const options = [
			{
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(payment)
			},
			{
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(payment),
				divider: true
			}
		];

		if (payment.estado_pago === 'pendiente') {
			options.unshift({
				label: 'Aprobar',
				id: 'approve',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => handleApprove(payment._id)
			});
		}

		return options;
	}

	function getStudentName(id: string) {
		return studentsMap[id]?.nombre || 'Desconocido';
	}

	function getCourseName(id: string) {
		return coursesMap[id]?.nombre_programa || 'Desconocido';
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Pagos</Heading>
		<Button onclick={handleCreate}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Nuevo Pago
		</Button>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={5} />
	{:else if payments.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay pagos registrados.</p>
		</div>
	{:else}
		<!-- Desktop Table -->
		<div class="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow">
			<table class="divide-y divide-gray-200 dark:divide-gray-700 w-full table-auto">
				<thead class="bg-gray-50 dark:bg-gray-900">
					<tr>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concepto</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
						<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
						<th scope="col" class="relative px-6 py-3">
							<span class="sr-only">Acciones</span>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
					{#each payments as payment}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900 dark:text-white">{getStudentName(payment.estudiante_id)}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">{getCourseName(payment.curso_id)}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{payment.concepto}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400">TRX: {payment.numero_transaccion}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-bold text-gray-900 dark:text-white">{payment.cantidad_pago}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-900 dark:text-white">{new Date(payment.fecha_subida).toLocaleDateString()}</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payment.estado_pago === 'aprobado' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
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
				</tbody>
			</table>
		</div>

		<!-- Mobile Cards -->
		<div class="md:hidden grid grid-cols-1 gap-4">
			{#each payments as payment}
				<Card>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white">{getStudentName(payment.estudiante_id)}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">{payment.concepto}</p>
						</div>
						<div class="relative">
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
						</div>
					</div>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Monto:</span>
							<span class="font-bold text-gray-900 dark:text-white">{payment.cantidad_pago}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Fecha:</span>
							<span class="font-medium text-gray-900 dark:text-white">{new Date(payment.fecha_subida).toLocaleDateString()}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Estado:</span>
							<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${payment.estado_pago === 'aprobado' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
								{payment.estado_pago}
							</span>
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<!-- Create/Edit Modal -->
	<Modal
		isOpen={isFormOpen}
		title={selectedPayment ? 'Editar Pago' : 'Nuevo Pago'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<PaymentForm
			payment={selectedPayment}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar este pago? Esta acción no se puede deshacer.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			paymentToDelete = null;
		}}
		loading={deleteLoading}
	/>
</div>
