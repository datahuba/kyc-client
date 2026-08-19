<script lang="ts">
	/**
	 * /app/academico/supervision — Supervisión Académica (coordinador)
	 * ===================================================================
	 * F-COORD-ACADEMICO-SUPERVISION (2026-08-19, Kevin, aprobando la
	 * propuesta): "me parece bien lo de que deberia hacer hazlo" — sobre
	 * "pantalla de 'mis Encargados de Curso supervisados' + estado
	 * academico consolidado de sus programas (notas cargadas, modulos
	 * ejecutados, etc.)".
	 *
	 * Hasta ahora un coordinador academico era, en la practica, un
	 * encargado de curso mas: veia la lista de Programas igual que
	 * cualquiera, sin ninguna vista que consolidara el estado de TODOS
	 * los programas que supervisa de un vistazo. Esta es esa vista.
	 *
	 * La columna "Cobertura de notas" es deliberada: es exactamente el
	 * numero que habria detectado en el momento el problema real de la
	 * sesion del 2026-08-18 (38 de 54 inscripciones de DIPL-IA-2026 sin
	 * nota del modulo 1, encontrado recien cuando Kevin lo reviso a mano).
	 * Por eso la tabla ordena primero los programas con MENOS cobertura:
	 * son los que necesitan atencion.
	 */
	import { onMount } from 'svelte';
	import { courseService } from '$lib/services';
	import type { SupervisionPrograma } from '$lib/services/course.service';
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { alert } from '$lib/utils';
	import { goto } from '$app/navigation';

	let programas: SupervisionPrograma[] = $state([]);
	let loading = $state(true);
	let error = $state('');

	onMount(async () => {
		try {
			programas = await courseService.getSupervisionAcademica();
		} catch (e: any) {
			error = e?.message || 'No se pudo cargar la supervisión académica.';
			alert('error', error);
		} finally {
			loading = false;
		}
	});

	function colorCobertura(pct: number): string {
		if (pct >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		if (pct >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
		return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	}

	function colorEstado(estado: string): string {
		switch (estado) {
			case 'en_ejecucion':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'programado':
				return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
			case 'cerrado':
				return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300';
			default:
				return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
		}
	}
</script>

<svelte:head>
	<title>Supervisión Académica · KYC DataHub</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<Heading level="h2">Supervisión Académica</Heading>
		<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
			De un vistazo: los programas que supervisás, quién los administra, y si el estado
			académico está al día. Los programas con menos cobertura de notas aparecen primero —
			son los que necesitan atención.
		</p>
	</div>

	{#if loading}
		<TableSkeleton rows={5} columns={6} />
	{:else if error}
		<Card>
			<p class="p-6 text-sm text-red-600 dark:text-red-400">{error}</p>
		</Card>
	{:else if programas.length === 0}
		<EmptyState
			title="No hay programas para supervisar"
			description="No tenés programas asignados todavía, o tu cuenta no tiene cursos_asignados cargados."
		/>
	{:else}
		<Card padding="none">
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
					<thead class="bg-gray-50 dark:bg-dark-background/60">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500"
								>Programa</th
							>
							<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500"
								>Estado</th
							>
							<th class="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-gray-500"
								>Encargados</th
							>
							<th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
								>Inscritos</th
							>
							<th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
								>Módulos ejecutados</th
							>
							<th class="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-gray-500"
								>Cobertura de notas</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white dark:divide-dark-border dark:bg-dark-surface">
						{#each programas as p (p.curso_id)}
							<tr
								class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
								onclick={() => goto(`/app/courses?q=${encodeURIComponent(p.codigo)}`)}
							>
								<td class="px-4 py-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{p.nombre_programa}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400">{p.codigo}</p>
								</td>
								<td class="px-4 py-3">
									<span
										class="rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide {colorEstado(
											p.estado
										)}"
									>
										{p.estado}
									</span>
								</td>
								<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
									{#if p.encargados.length === 0}
										<span class="text-amber-600 dark:text-amber-400">Sin encargado asignado</span>
									{:else}
										{p.encargados.map((e) => e.nombre).join(', ')}
									{/if}
								</td>
								<td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
									{p.inscritos}
								</td>
								<td class="px-4 py-3 text-center text-sm text-gray-700 dark:text-gray-300">
									{p.modulos_ejecutados} / {p.modulos_total}
								</td>
								<td class="px-4 py-3 text-center">
									<span
										class="rounded-full px-2.5 py-1 text-xs font-bold {colorCobertura(p.cobertura_notas_pct)}"
										title="{p.inscripciones_con_alguna_nota} de {p.inscritos} inscripciones tienen al menos una nota cargada"
									>
										{p.cobertura_notas_pct}%
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</Card>
	{/if}
</div>
