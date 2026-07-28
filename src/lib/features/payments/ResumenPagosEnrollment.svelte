<script lang="ts">
	/**
	 * F-049 (2026-07-28) · Resumen enriquecido de pagos por enrollment.
	 *
	 * Muestra desglose por módulo + saldo a favor + saldo pendiente.
	 * Caso real: Luis Valdez pagó 300 Bs cuando su módulo costaba 294.
	 * El estudiante SÍ ve el saldo a favor pero cobranza NO (antes de F-049).
	 *
	 * Uso:
	 *   <ResumenPagosEnrollment enrollmentId={enrollment._id} />
	 */
	import { onMount } from 'svelte';
	import { paymentService, type ResumenPagosEnrollment as ResumenPagosType } from '$lib/services/payment.service';
	import { formatCurrency } from '$lib/utils';

	interface Props {
		enrollmentId: string;
		compact?: boolean;
	}

	let { enrollmentId, compact = false }: Props = $props();

	let resumen = $state<ResumenPagosType | null>(null);
	let loading = $state(false);
	let error = $state<string | null>(null);

	onMount(async () => {
		await cargar();
	});

	async function cargar() {
		loading = true;
		error = null;
		try {
			resumen = await paymentService.getResumenPagosEnrollment(enrollmentId);
		} catch (e: any) {
			error = e?.message || 'Error al cargar el resumen';
		} finally {
			loading = false;
		}
	}
</script>

{#if loading}
	<div class="flex items-center justify-center py-6">
		<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
	</div>
{:else if error}
	<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3 text-sm text-red-800 dark:text-red-200">
		{error}
	</div>
{:else if resumen}
	{@const haySaldoAFavor = resumen.saldo_a_favor > 0}
	{@const haySaldoPendiente = resumen.saldo_pendiente > 0}

	<div class="space-y-4">
		<!-- KPIs principales -->
		<div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
				<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Total a pagar</p>
				<p class="text-xl font-bold text-gray-900 dark:text-white mt-1">
					{formatCurrency(resumen.total_a_pagar)}
				</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
				<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Total pagado</p>
				<p class="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
					{formatCurrency(resumen.total_pagado)}
				</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
				{#if haySaldoAFavor}
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Saldo a favor</p>
					<p class="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
						+{formatCurrency(resumen.saldo_a_favor)}
					</p>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						El estudiante pagó de más
					</p>
				{:else if haySaldoPendiente}
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Saldo pendiente</p>
					<p class="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
						{formatCurrency(resumen.saldo_pendiente)}
					</p>
				{:else}
					<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Estado</p>
					<p class="text-xl font-bold text-green-600 dark:text-green-400 mt-1">
						✓ Completo
					</p>
				{/if}
			</div>
		</div>

		<!-- Desglose por módulo (solo si NO es compact) -->
		{#if !compact && resumen.modulos && resumen.modulos.length > 0}
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
					<h4 class="text-sm font-semibold text-gray-900 dark:text-white">
						Desglose por módulo
					</h4>
				</div>
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-900/50">
							<tr>
								<th class="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Módulo</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Costo</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Pagado</th>
								<th class="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Saldo</th>
								<th class="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Estado</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each resumen.modulos as m}
								<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/30">
									<td class="px-4 py-2 text-sm text-gray-900 dark:text-white">{m.nombre}</td>
									<td class="px-4 py-2 text-sm text-right text-gray-700 dark:text-gray-300">
										{formatCurrency(m.monto)}
									</td>
									<td class="px-4 py-2 text-sm text-right text-green-600 dark:text-green-400 font-medium">
										{formatCurrency(m.monto_pagado)}
									</td>
									<td class="px-4 py-2 text-sm text-right {m.saldo_modulo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500'}">
										{formatCurrency(m.saldo_modulo)}
									</td>
									<td class="px-4 py-2 text-center">
										{#if m.pagado}
											<span class="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
												Pagado
											</span>
										{:else if m.monto_pagado > 0}
											<span class="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
												Parcial
											</span>
										{:else}
											<span class="inline-flex text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
												Pendiente
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Resumen de pagos (estados) -->
		{#if !compact}
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
				<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-2 text-center">
					<p class="text-xs text-amber-700 dark:text-amber-300">Pendientes</p>
					<p class="text-lg font-bold text-amber-800 dark:text-amber-200">{resumen.pendientes}</p>
				</div>
				<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded p-2 text-center">
					<p class="text-xs text-green-700 dark:text-green-300">Aprobados</p>
					<p class="text-lg font-bold text-green-800 dark:text-green-200">{resumen.aprobados}</p>
				</div>
				<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2 text-center">
					<p class="text-xs text-red-700 dark:text-red-300">Rechazados</p>
					<p class="text-lg font-bold text-red-800 dark:text-red-200">{resumen.rechazados}</p>
				</div>
				<div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 text-center">
					<p class="text-xs text-gray-500 dark:text-gray-400">Anulados</p>
					<p class="text-lg font-bold text-gray-700 dark:text-gray-300">{resumen.anulados}</p>
				</div>
			</div>
		{/if}
	</div>
{/if}
