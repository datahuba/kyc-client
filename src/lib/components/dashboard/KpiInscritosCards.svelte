<script lang="ts">
	// F-COBRANZA-041 (2026-07-22): Componente compartido de KPI de inscritos.
	// Se renderiza en el Dashboard (F-041) y se quitó de /app/enrollments.
	// Refleja el endpoint GET /enrollments/stats/resumen.
	// Pedido original Lic. Sandra Zabala (vía Telegram 10:34 GMT-4):
	// "diferencia del total de inscritos inicialmente, cuantos son los activo
	// y cuantos los pasivos".
	// Total inicial = todos los inscritos MENOS cancelados.
	import type { EnrollmentResumen } from '$lib/interfaces';

	interface Props {
		resumen: EnrollmentResumen | null;
		loading?: boolean;
	}

	let { resumen, loading = false }: Props = $props();
</script>

{#if resumen}
	<div>
		<div class="flex items-center justify-between mb-4">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Inscritos</h2>
			<a href="/app/enrollments" class="text-sm text-primary-600 hover:text-primary-500 hover:scale-105 transition-transform">
				Ver detalle
			</a>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-5 gap-3">
			<!-- Total inicial -->
			<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
				<div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total Inicial</div>
				{#if loading}
					<div class="h-7 w-12 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
				{:else}
					<div class="text-2xl font-black text-gray-900 dark:text-white mt-1">{resumen.total_inicial}</div>
				{/if}
				<div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Inscritos (excl. cancelados)</div>
			</div>

			<!-- Activos -->
			<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-green-200 dark:border-green-900">
				<div class="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wide">Activos</div>
				{#if loading}
					<div class="h-7 w-12 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
				{:else}
					<div class="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{resumen.activos}</div>
				{/if}
				<div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
					{#if resumen.pendientes_pago > 0}
						({resumen.pendientes_pago} pendiente pago)
					{:else}
						Cursando
					{/if}
				</div>
			</div>

			<!-- Pasivos total -->
			<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-amber-200 dark:border-amber-900">
				<div class="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wide">Pasivos</div>
				{#if loading}
					<div class="h-7 w-12 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
				{:else}
					<div class="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{resumen.pasivos.total}</div>
				{/if}
				<div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Suspendidos (no cursan)</div>
			</div>

			<!-- Pasivos detalle -->
			<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
				<div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Detalle Pasivos</div>
				<div class="text-sm text-gray-700 dark:text-gray-300 mt-2 space-y-0.5">
					<div class="flex justify-between">
						<span>Congelados:</span>
						<span class="font-semibold text-amber-600 dark:text-amber-400">{resumen.pasivos.congelado}</span>
					</div>
					<div class="flex justify-between">
						<span>Pasivos:</span>
						<span class="font-semibold text-amber-600 dark:text-amber-400">{resumen.pasivos.pasivo}</span>
					</div>
					<div class="flex justify-between">
						<span>Abandono:</span>
						<span class="font-semibold text-amber-600 dark:text-amber-400">{resumen.pasivos.abandono}</span>
					</div>
				</div>
			</div>

			<!-- Completados -->
			<div class="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-blue-200 dark:border-blue-900">
				<div class="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">Completados</div>
				{#if loading}
					<div class="h-7 w-12 mt-2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
				{:else}
					<div class="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{resumen.completados}</div>
				{/if}
				<div class="text-xs text-gray-400 dark:text-gray-500 mt-1">Terminaron el curso</div>
			</div>
		</div>
	</div>
{/if}
