<script lang="ts">
	import type { Student, Enrollment } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import { formatCurrency } from '$lib/utils';
	import { userStore } from '$lib/stores/userStore';
	import { apiKyC } from '$lib/config/apiKyc.config'; // IMPORTACIÓN DEL CLIENTE ESTÁNDAR DE TU PROYECTO

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

	// Estados reactivos financieros (Svelte 5 - Runas)
	let financialSummary = $state<{
		total_invertido: number;
		pagado: number;
		en_proceso: number;
		saldo_pendiente: number;
	} | null>(null);

	let financialLoading = $state(false);
	let financialError = $state<string | null>(null);

	// Obtener ID resiliente para MongoDB
	const studentId = $derived(student?._id || student?.id);

	// Filtro de rol CPD (ignora mayúsculas/minúsculas)
	const isCpd = $derived(
		$userStore?.rol?.toUpperCase() === 'CPD' || 
		$userStore?.user?.rol?.toUpperCase() === 'CPD' ||
		$userStore?.role?.toUpperCase() === 'CPD' ||
		$userStore?.user?.role?.toUpperCase() === 'CPD'
	);

	// Efecto reactivo para fetch dinámico controlado
	$effect(() => {
		if (isOpen && studentId && !isCpd) {
			fetchFinancialSummary(studentId);
		} else {
			financialSummary = null;
			financialError = null;
		}
	});

	// Petición HTTP limpia, estandarizada y segura utilizando apiKyC
	async function fetchFinancialSummary(id: string) {
		financialLoading = true;
		financialError = null;
		try {
			// Consumimos el endpoint utilizando el cliente estándar apiKyC de la universidad
			financialSummary = await apiKyC.get<{
				total_invertido: number;
				pagado: number;
				en_proceso: number;
				saldo_pendiente: number;
			}>(`/students/${id}/financial-summary`);
		} catch (err: any) {
			console.error('Error fetching financial summary:', err);
			financialError = err.message || 'Error de conexión';
		} finally {
			financialLoading = false;
		}
	}
</script>

<Modal {isOpen} title={student ? `Inscripciones de ${student.nombre}` : 'Inscripciones'} onClose={onClose} maxWidth="sm:max-w-4xl">
	<div class="p-6">
		
		<!-- FICHA DE ESTADO DE CUENTA (ISSUE-P-FICHA) -->
		{#if !isCpd && student}
			<div class="mb-6 bg-gray-50 dark:bg-gray-800/40 p-5 rounded-xl border border-gray-200 dark:border-gray-700/80">
				<h3 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
					Ficha de Estado de Cuenta del Estudiante
				</h3>
				
				{#if financialLoading}
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
						{#each Array(4) as _}
							<div class="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
						{/each}
					</div>
				{:else if financialError}
					<div class="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg">
						No se pudo cargar la información financiera: {financialError}
					</div>
				{:else if financialSummary}
					<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
						<!-- Total Invertido -->
						<div class="bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800 shadow-sm">
							<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Invertido</span>
							<span class="text-base md:text-lg font-black text-gray-900 dark:text-white mt-1 block">
								{formatCurrency(financialSummary.total_invertido)}
							</span>
						</div>
						
						<!-- Pagado -->
						<div class="bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800 shadow-sm">
							<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Pagado</span>
							<span class="text-base md:text-lg font-black text-green-600 dark:text-green-400 mt-1 block">
								{formatCurrency(financialSummary.pagado)}
							</span>
						</div>
						
						<!-- En Proceso -->
						<div class="bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800 shadow-sm">
							<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">En Proceso</span>
							<span class="text-base md:text-lg font-black text-amber-600 dark:text-amber-400 mt-1 block">
								{formatCurrency(financialSummary.en_proceso)}
							</span>
						</div>
						
						<!-- Saldo Pendiente -->
						<div class="bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-gray-150 dark:border-gray-800 shadow-sm">
							<span class="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Saldo Pendiente</span>
							<span class={`text-base md:text-lg font-black mt-1 block ${financialSummary.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
								{formatCurrency(financialSummary.saldo_pendiente)}
							</span>
						</div>
					</div>
				{/if}
			</div>
		{/if}

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
