<script lang="ts">
	/**
	 * F-087-CAL · Componente "Mis cursos activos" para el dashboard del estudiante.
	 * Muestra los cursos inscritos agrupados por estado del PROGRAMA:
	 *   - 🟢 En ejecución (lo que está corriendo ahora)
	 *   - 🟡 Por iniciar (futuro)
	 *   - ⚫ Finalizados (histórico)
	 *
	 * Cada card muestra: nombre, código, fechas, progreso de módulos, saldo.
	 *
	 * Reutiliza el componente BadgeEstado para los labels de estado.
	 */
	import type { MyCoursesResumen } from '$lib/interfaces';
	import BadgeEstado from '$lib/components/programas/BadgeEstado.svelte';
	import { formatCurrency, formatDate } from '$lib/utils';

	export let data: MyCoursesResumen | null = null;
	export let loading = false;

	type EstadoPrograma = 'programado' | 'en_ejecucion' | 'cerrado';
	type CursoItems = MyCoursesResumen['items'];

	$: grupos = (() => {
		if (!data) return { en_ejecucion: [], programado: [], cerrado: [] } as Record<EstadoPrograma, CursoItems>;
		const g: Record<EstadoPrograma, CursoItems> = {
			en_ejecucion: [],
			programado: [],
			cerrado: []
		};
		for (const it of data.items) {
			const e = it.estado_programa as EstadoPrograma;
			if (e in g) g[e].push(it);
		}
		return g;
	})();

	function progresoPct(pagados: number, total: number): number {
		if (total <= 0) return 0;
		return Math.round((pagados / total) * 100);
	}
</script>

{#if loading}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
		<div class="animate-pulse">
			<div class="h-5 bg-slate-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
			<div class="space-y-3">
				<div class="h-16 bg-slate-100 dark:bg-gray-700 rounded"></div>
				<div class="h-16 bg-slate-100 dark:bg-gray-700 rounded"></div>
			</div>
		</div>
		<p class="text-xs text-slate-500 mt-3 text-center">Cargando tus cursos...</p>
	</div>
{:else if data && data.items.length > 0}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6">
		<header class="flex items-center justify-between mb-4">
			<h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
				<span class="text-2xl">📚</span>
				Mis Cursos
			</h2>
			{#if data.resumen.saldo_pendiente_total > 0}
				<span class="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
					Saldo pendiente: {formatCurrency(data.resumen.saldo_pendiente_total)}
				</span>
			{/if}
		</header>

		<!-- 🟢 EN EJECUCIÓN (destacado) -->
		{#if grupos.en_ejecucion.length > 0}
			<section class="mb-5">
				<h3 class="text-xs font-bold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-2">
					<span class="size-2 rounded-full bg-green-500"></span>
					En ejecución ({grupos.en_ejecucion.length})
				</h3>
				<div class="space-y-3">
					{#each grupos.en_ejecucion as curso (curso.enrollment_id)}
						<article class="border border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-900/10 rounded-lg p-4">
							<div class="flex items-start justify-between gap-2 mb-2">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 flex-wrap mb-1">
										<BadgeEstado estado={curso.estado_programa} size="sm" />
										<span class="text-xs text-slate-500 font-mono">{curso.curso_codigo}</span>
									</div>
									<h4 class="font-semibold text-slate-800 dark:text-white">{curso.curso_nombre}</h4>
								</div>
							</div>
							<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600 dark:text-slate-300">
								<div>
									<span class="text-slate-400">Inicio:</span><br />
									<span class="font-medium">{formatDate(curso.fecha_inicio)}</span>
								</div>
								<div>
									<span class="text-slate-400">Fin:</span><br />
									<span class="font-medium">{formatDate(curso.fecha_fin)}</span>
								</div>
								<div>
									<span class="text-slate-400">Módulos:</span><br />
									<span class="font-medium">{curso.modulos_pagados} / {curso.modulos_total} pagados</span>
								</div>
							</div>
							<!-- Barra de progreso -->
							<div class="mt-3">
								<div class="flex items-center justify-between text-[10px] text-slate-500 mb-1">
									<span>Progreso</span>
									<span class="font-bold">{progresoPct(curso.modulos_pagados, curso.modulos_total)}%</span>
								</div>
								<div class="h-1.5 bg-slate-200 dark:bg-gray-700 rounded-full overflow-hidden">
									<div
										class="h-full bg-green-500 transition-all"
										style="width: {progresoPct(curso.modulos_pagados, curso.modulos_total)}%"
									></div>
								</div>
							</div>
							{#if curso.saldo_pendiente > 0}
								<p class="text-xs text-amber-700 dark:text-amber-400 mt-2 font-medium">
									💰 Saldo pendiente: {formatCurrency(curso.saldo_pendiente)}
								</p>
							{/if}
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<!-- 🟡 POR INICIAR -->
		{#if grupos.programado.length > 0}
			<section class="mb-5">
				<h3 class="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-2">
					<span class="size-2 rounded-full bg-amber-500"></span>
					Por iniciar ({grupos.programado.length})
				</h3>
				<div class="space-y-2">
					{#each grupos.programado as curso (curso.enrollment_id)}
						<article class="border border-amber-200 dark:border-amber-800/50 bg-amber-50/30 dark:bg-amber-900/10 rounded-lg p-3">
							<div class="flex items-center gap-2 flex-wrap mb-1">
								<BadgeEstado estado={curso.estado_programa} size="sm" />
								<span class="text-xs text-slate-500 font-mono">{curso.curso_codigo}</span>
							</div>
							<h4 class="font-semibold text-slate-800 dark:text-white text-sm">{curso.curso_nombre}</h4>
							<p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
								Inicia el <span class="font-semibold">{formatDate(curso.fecha_inicio)}</span>
							</p>
						</article>
					{/each}
				</div>
			</section>
		{/if}

		<!-- ⚫ FINALIZADOS (colapsable en espíritu: menos detalle) -->
		{#if grupos.cerrado.length > 0}
			<section>
				<h3 class="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-2">
					<span class="size-2 rounded-full bg-slate-400"></span>
					Finalizados ({grupos.cerrado.length})
				</h3>
				<div class="space-y-2">
					{#each grupos.cerrado as curso (curso.enrollment_id)}
						<article class="border border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30 rounded-lg p-3">
							<div class="flex items-center gap-2 flex-wrap mb-1">
								<BadgeEstado estado={curso.estado_programa} size="sm" />
								<span class="text-xs text-slate-500 font-mono">{curso.curso_codigo}</span>
							</div>
							<h4 class="font-semibold text-slate-700 dark:text-slate-200 text-sm">{curso.curso_nombre}</h4>
							<p class="text-xs text-slate-500 mt-1">
								Finalizó el {formatDate(curso.fecha_fin)} · {curso.modulos_pagados} / {curso.modulos_total} módulos
							</p>
						</article>
					{/each}
				</div>
			</section>
		{/if}
	</div>
{:else}
	<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-slate-200 dark:border-gray-700 p-6 text-center">
		<div class="text-4xl mb-2">📭</div>
		<h3 class="text-base font-semibold text-slate-700 dark:text-white">Aún no tienes cursos inscritos</h3>
		<p class="text-xs text-slate-500 mt-1">Cuando te inscribas a un programa, aparecerá aquí.</p>
	</div>
{/if}
