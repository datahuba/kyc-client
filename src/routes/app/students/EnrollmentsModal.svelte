<script lang="ts">
	import type { Student, Enrollment } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import { formatCurrency } from '$lib/utils';

	interface Props {
		isOpen: boolean;
		student: Student | null;
		enrollmentsLoading: boolean;
		studentEnrollments: Enrollment[];
		onClose: () => void;
	}

	let {
		isOpen,
		student,
		enrollmentsLoading,
		studentEnrollments,
		onClose
	}: Props = $props();
</script>

<Modal {isOpen} title={student ? `Inscripciones de ${student.nombre}` : 'Inscripciones'} onClose={onClose} maxWidth="sm:max-w-4xl">
	<div class="p-6">
		{#if enrollmentsLoading}
			<div class="flex justify-center py-8"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>
		{:else if studentEnrollments.length === 0}
			<div class="text-center py-8 text-gray-500">No se encontraron inscripciones para este estudiante.</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Montos</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Saldo</th>
							<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
						{#each studentEnrollments as enrollment (enrollment._id)}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{new Date(enrollment.fecha_inscripcion).toLocaleDateString()}</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-xs text-gray-500">Total: {formatCurrency(enrollment.total_a_pagar)}</div>
									<div class="text-xs text-green-600">Pagado: {formatCurrency(enrollment.total_pagado)}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(enrollment.saldo_pendiente)}</span>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enrollment.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{enrollment.estado}</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
		<div class="mt-6 flex justify-end"><Button variant="secondary" onclick={onClose}>Cerrar</Button></div>
	</div>
</Modal>
