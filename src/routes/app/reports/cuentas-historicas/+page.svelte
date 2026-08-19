<script lang="ts">
	/**
	 * /app/reports/cuentas-historicas — Cuentas Históricas
	 *
	 * F-CUENTAS-HISTORICAS (2026-08-16, Kevin): los programas históricos
	 * dejaron de contar en el Dashboard y en Cuentas por Cobrar — no son
	 * cartera corriente, son expediente. Esta pantalla es su contraparte:
	 * "solo son datos para tener guardados pero debemos siempre tenerlos en
	 * cuenta con nuevos informes solo de esos programas".
	 *
	 * Ordenado por deuda pendiente descendente, porque lo primero que se
	 * quiere saber de un histórico es qué quedó sin cobrar.
	 */
	import { onMount } from 'svelte';
	import { cuentasHistoricasService, type HistResumen } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert, formatCurrency } from '$lib/utils';
	import { DownloadIcon } from '$lib/icons/outline';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';

	let resumen = $state<HistResumen | null>(null);
	let loading = $state(true);
	let descargando = $state(false);
	let expandidos = $state(new Set<string>());

	const rolesStaff = ['superadmin', 'admin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'];
	const esStaff = $derived(rolesStaff.includes($userStore.role || ''));

	function alternar(cursoId: string) {
		const siguiente = new Set(expandidos);
		if (siguiente.has(cursoId)) siguiente.delete(cursoId);
		else siguiente.add(cursoId);
		expandidos = siguiente;
	}

	async function cargar() {
		loading = true;
		try {
			resumen = await cuentasHistoricasService.getResumen();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar el informe de cuentas históricas');
			resumen = null;
		} finally {
			loading = false;
		}
	}

	/**
	 * Descarga el XLSX con el Bearer en la cabecera.
	 *
	 * Nota: la página de Cuentas por Cobrar hace esto poniendo el token en la
	 * QUERY STRING (`?token=...`), lo que lo deja en el historial del
	 * navegador y en los logs del servidor. Acá se manda por header, que es
	 * lo correcto.
	 */
	async function descargarXlsx() {
		if (!resumen || descargando) return;
		descargando = true;
		try {
			const base = (import.meta.env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
			const token = localStorage.getItem('kyc_token');
			const resp = await fetch(`${base}${cuentasHistoricasService.getXlsxUrl()}`, {
				headers: token ? { Authorization: `Bearer ${token}` } : {}
			});
			if (!resp.ok) throw new Error(`El servidor respondió ${resp.status}`);

			const blob = await resp.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `cuentas-historicas-${new Date().toISOString().slice(0, 10)}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo descargar el archivo');
		} finally {
			descargando = false;
		}
	}

	function detalleDe(cursoId: string) {
		return (resumen?.detalle ?? []).filter((d) => d.curso_id === cursoId);
	}

	onMount(cargar);
</script>

<svelte:head>
	<title>Cuentas Históricas · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
		<header class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
			<div>
				<h1 class="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-300">
					Cuentas Históricas
				</h1>
				<p class="text-sm text-light-four dark:text-dark-four mt-1 max-w-2xl">
					Programas ya finalizados, cargados de forma retroactiva. <b>No cuentan</b> en el
					Dashboard ni en Cuentas por Cobrar — no son cartera corriente. Se conservan acá
					como expediente, ordenados por lo que quedó sin cobrar.
				</p>
			</div>
			{#if resumen && resumen.total_programas > 0}
				<Button
					variant="primary"
					size="md"
					onclick={descargarXlsx}
					disabled={descargando}
					ariaLabel="Descargar informe de cuentas históricas en Excel"
				>
					<DownloadIcon class="w-4 h-4 mr-2" />
					{descargando ? 'Generando…' : 'Descargar XLSX'}
				</Button>
			{/if}
		</header>

		{#if loading}
			<div class="space-y-4">
				<Skeleton variant="block" lines={3} />
				<Skeleton variant="block" lines={4} />
			</div>
		{:else if !esStaff}
			<EmptyState
				variant="bordered"
				size="md"
				title="Acceso restringido"
				description="Esta sección es solo para personal administrativo."
			/>
		{:else if !resumen || resumen.total_programas === 0}
			<EmptyState
				variant="bordered"
				size="md"
				title="No hay programas históricos con inscripciones"
				description="Cuando se marque un programa como histórico y tenga estudiantes, su expediente económico aparecerá acá."
			/>
		{:else}
			<!-- Totales -->
			<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<Card variant="bordered" padding="md">
					<p class="text-xs uppercase font-semibold text-light-four dark:text-dark-four tracking-wider">
						Saldo sin cobrar
					</p>
					<p class="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1 tabular-nums">
						{formatCurrency(resumen.saldo_pendiente)}
					</p>
					<p class="text-xs text-light-four dark:text-dark-four mt-1">
						de {formatCurrency(resumen.total_esperado)} esperados
					</p>
				</Card>
				<Card variant="bordered" padding="md">
					<p class="text-xs uppercase font-semibold text-light-four dark:text-dark-four tracking-wider">
						Cobrado
					</p>
					<p class="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
						{formatCurrency(resumen.total_cobrado)}
					</p>
					<p class="text-xs text-light-four dark:text-dark-four mt-1">
						{resumen.avance_pct}% del total esperado
					</p>
				</Card>
				<Card variant="bordered" padding="md">
					<p class="text-xs uppercase font-semibold text-light-four dark:text-dark-four tracking-wider">
						Programas
					</p>
					<p class="text-2xl font-extrabold text-primary-700 dark:text-primary-300 mt-1 tabular-nums">
						{resumen.total_programas}
					</p>
					<p class="text-xs text-light-four dark:text-dark-four mt-1">con inscripciones</p>
				</Card>
				<Card variant="bordered" padding="md">
					<p class="text-xs uppercase font-semibold text-light-four dark:text-dark-four tracking-wider">
						Estudiantes
					</p>
					<p class="text-2xl font-extrabold text-primary-700 dark:text-primary-300 mt-1 tabular-nums">
						{resumen.total_estudiantes}
					</p>
					<p class="text-xs text-light-four dark:text-dark-four mt-1">en total</p>
				</Card>
			</section>

			<!-- Desglose por programa -->
			<section class="space-y-3">
				<h2 class="text-lg font-semibold text-light-one dark:text-dark-one">
					Desglose por programa
				</h2>

				{#each resumen.por_curso as curso (curso.curso_id)}
					{@const abierto = expandidos.has(curso.curso_id)}
					{@const filas = detalleDe(curso.curso_id)}
					<Card variant="bordered" padding="none">
						<button
							type="button"
							class="w-full text-left px-4 py-3 hover:bg-light-secondary/50 dark:hover:bg-dark-surface/50 transition-colors"
							onclick={() => alternar(curso.curso_id)}
							aria-expanded={abierto}
						>
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div class="min-w-0">
									<p class="font-semibold text-light-one dark:text-dark-one truncate">
										{curso.curso_nombre}
									</p>
									<p class="text-xs text-light-four dark:text-dark-four">
										{curso.curso_codigo || '—'} · {curso.cantidad_estudiantes}
										estudiante{curso.cantidad_estudiantes === 1 ? '' : 's'}
									</p>
								</div>
								<div class="flex items-center gap-5 shrink-0">
									<div class="text-right">
										<p class="text-[10px] uppercase tracking-wide text-light-four dark:text-dark-four">
											Sin cobrar
										</p>
										<p
											class="font-bold tabular-nums {curso.saldo_pendiente > 0
												? 'text-red-600 dark:text-red-400'
												: 'text-emerald-700 dark:text-emerald-400'}"
										>
											{formatCurrency(curso.saldo_pendiente)}
										</p>
									</div>
									<div class="text-right w-16">
										<p class="text-[10px] uppercase tracking-wide text-light-four dark:text-dark-four">
											Avance
										</p>
										<p class="font-semibold tabular-nums text-light-one dark:text-dark-one">
											{curso.avance_pct}%
										</p>
									</div>
								</div>
							</div>
							<div class="mt-2 h-1.5 w-full rounded-full bg-light-four/20 dark:bg-dark-four/20 overflow-hidden">
								<div
									class="h-full rounded-full bg-emerald-600 dark:bg-emerald-500"
									style="width: {Math.min(100, curso.avance_pct)}%"
								></div>
							</div>
						</button>

						{#if abierto}
							<div class="border-t border-light-four/20 dark:border-dark-border overflow-x-auto">
								<table class="w-full text-sm min-w-[560px]">
									<thead class="bg-light-secondary/60 dark:bg-dark-surface/60">
										<tr>
											<th class="px-4 py-2 text-left text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">Estudiante</th>
											<th class="px-4 py-2 text-left text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">Registro</th>
											<th class="px-4 py-2 text-left text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">Estado</th>
											<th class="px-4 py-2 text-right text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">A pagar</th>
											<th class="px-4 py-2 text-right text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">Pagado</th>
											<th class="px-4 py-2 text-right text-xs uppercase tracking-wide text-light-four dark:text-dark-four font-semibold">Saldo</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-light-four/15 dark:divide-dark-border">
										{#each filas as d (d.enrollment_id)}
											<tr class="hover:bg-light-secondary/40 dark:hover:bg-dark-surface/40">
												<td class="px-4 py-2 text-light-one dark:text-dark-one">{d.estudiante_nombre}</td>
												<td class="px-4 py-2 text-light-four dark:text-dark-four tabular-nums">{d.estudiante_registro || '—'}</td>
												<td class="px-4 py-2 text-light-four dark:text-dark-four">{d.estado}</td>
												<td class="px-4 py-2 text-right tabular-nums text-light-one dark:text-dark-one">{formatCurrency(d.total_a_pagar)}</td>
												<td class="px-4 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(d.total_pagado)}</td>
												<td
													class="px-4 py-2 text-right tabular-nums font-semibold {d.saldo > 0
														? 'text-red-600 dark:text-red-400'
														: 'text-light-four dark:text-dark-four'}"
												>
													{formatCurrency(d.saldo)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</Card>
				{/each}
			</section>
		{/if}
	</div>
</div>
