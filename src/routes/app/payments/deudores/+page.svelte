<script lang="ts">
	/**
	 * F-088 (2026-07-29): Vista "Deudores" unificada para Cobranza.
	 *
	 * Pedido de Lic. Sandra Zabala en reunión 2026-07-29: una vista a "un solo
	 * golpe visual" donde pueda ver, para un curso, qué estudiantes deben qué
	 * módulos. Antes tenía que descargar módulo por módulo en Excel y filtrar
	 * manualmente los que no pagaron.
	 *
	 * Layout: estudiantes como filas, módulos como columnas, con estado visual
	 * por celda (verde = pagado, rojo = debe, gris = no_le_toca). Toggle "Solo
	 * deudores" para enfocarse solo en los que deben algo. Botón "Exportar a
	 * Excel" que genera el mismo layout para enviar por WhatsApp / imprimir.
	 *
	 * Permisos: solo personal económico (cobranza/admin/superadmin/mae/cpd).
	 * Ruta: /app/payments/deudores (declarada dentro del grupo Financiero).
	 */
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { paymentService, courseService } from '$lib/services';
	import type { DeudoresResponse, DeudoresEstudiante, DeudoresModulo, DeudoresMatricula, Course } from '$lib/services/payment.service';
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import { DownloadIcon, CheckIcon, RefreshIcon } from '$lib/icons/outline';
	import { CreditCardIcon, ExclamationCircleIcon } from '$lib/icons/solid';

	let cursos: Course[] = $state([]);
	let cursoSeleccionado: string = $state('');
	let soloDeudores = $state(true);
	let data: DeudoresResponse | null = $state(null);
	let loading = $state(false);
	let error = $state('');

	// Búsqueda local sobre la lista de estudiantes
	let searchTerm = $state('');

	const fmt = (n: number) =>
		n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

	// Estudiantes filtrados (por búsqueda local y por toggle)
	let estudiantesFiltrados = $derived.by<DeudoresEstudiante[]>(() => {
		if (!data) return [];
		const term = searchTerm.trim().toLowerCase();
		let lista = data.estudiantes;
		if (term) {
			lista = lista.filter(
				(e) =>
					e.nombre.toLowerCase().includes(term) ||
					e.ci.toLowerCase().includes(term) ||
					e.registro.toLowerCase().includes(term) ||
					(e.email || '').toLowerCase().includes(term) ||
					(e.celular || '').toLowerCase().includes(term)
			);
		}
		return lista;
	});

	// Resumen derivado (recalcula cuando cambia data o soloDeudores)
	let resumen = $derived(data?.resumen ?? null);

	async function loadCursos() {
		try {
			const resp: any = await courseService.getAll(1, 100);
			const lista: Course[] = Array.isArray(resp) ? resp : resp.data ?? [];
			cursos = lista.filter((c) => c.estado === 'activo' || c.estado === 'ejecucion' || c.estado === 'publicado' || !c.estado);
		} catch (e) {
			console.error('Error cargando cursos', e);
		}
	}

	async function loadDeudores() {
		if (!cursoSeleccionado) {
			data = null;
			return;
		}
		loading = true;
		error = '';
		try {
			data = await paymentService.getDeudores(cursoSeleccionado, soloDeudores);
		} catch (e: any) {
			console.error('Error cargando deudores', e);
			error = e?.response?.data?.detail || e?.message || 'Error al cargar deudores';
			data = null;
		} finally {
			loading = false;
		}
	}

	function getCeldaClass(estado: 'pagado' | 'debe' | 'no_le_toca') {
		switch (estado) {
			case 'pagado':
				return 'bg-green-50 text-green-800 border-green-200';
			case 'debe':
				return 'bg-red-50 text-red-800 border-red-200 font-semibold';
			case 'no_le_toca':
				return 'bg-gray-50 text-gray-400 border-gray-200';
		}
	}

	function getCeldaIcon(estado: 'pagado' | 'debe' | 'no_le_toca') {
		switch (estado) {
			case 'pagado':
				return '✓';
			case 'debe':
				return '✗';
			case 'no_le_toca':
				return '—';
		}
	}

	function getDeudorRowClass(est: DeudoresEstudiante) {
		if (est.deuda_total > 0.01) return 'hover:bg-amber-50/40';
		return 'hover:bg-gray-50';
	}

	async function exportExcel() {
		if (!cursoSeleccionado) return;
		try {
			const blob = await paymentService.getDeudoresXLSX(cursoSeleccionado, soloDeudores);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			const codigo = (data?.curso?.codigo || 'curso').replace(/[^\w-]/g, '_');
			a.download = `deudores_${codigo}_${new Date().toISOString().slice(0, 10)}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (e: any) {
			error = `Error al exportar: ${e?.message || e}`;
		}
	}

	$effect(() => {
		// Re-cargar cuando cambia el curso o el toggle
		cursoSeleccionado;
		soloDeudores;
		// No auto-cargar si no hay curso (evita flash vacío)
		if (cursoSeleccionado) loadDeudores();
	});

	onMount(() => {
		loadCursos();
	});
</script>

<div class="space-y-4">
	<!-- Header con título + selector de curso + acciones -->
	<Card>
		<div class="flex flex-col gap-4">
			<div class="flex items-start gap-3">
				<div class="rounded-xl bg-primary-50 dark:bg-primary-900/30 p-2 shrink-0">
					<CreditCardIcon class="size-7 text-primary-700 dark:text-primary-300" />
				</div>
				<div class="flex-1 min-w-0">
					<Heading>
						<span>Deudores</span>
					</Heading>
					<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
						Vista unificada para cobranza: a un golpe visual, qué estudiantes
						deben qué módulos del curso.
					</p>
				</div>
			</div>

			<!-- Controles: selector de curso + filtro + export -->
			<div class="flex flex-col md:flex-row gap-3 md:items-end">
				<div class="flex-1 min-w-0">
					<label for="curso-select" class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
						Curso
					</label>
					<select
						id="curso-select"
						bind:value={cursoSeleccionado}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
					>
						<option value="">Selecciona un curso...</option>
						{#each cursos as c (c._id)}
							<option value={c._id}>{c.codigo ? `${c.codigo} — ` : ''}{c.nombre_programa}</option>
						{/each}
					</select>
				</div>

				<div class="md:w-64">
					<label for="search-input" class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
						Buscar estudiante
					</label>
					<input
						id="search-input"
						type="text"
						bind:value={searchTerm}
						placeholder="Nombre, CI, registro, email..."
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
					/>
				</div>

				<label class="inline-flex items-center gap-2 cursor-pointer select-none md:pb-0.5">
					<input
						type="checkbox"
						bind:checked={soloDeudores}
						class="size-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
					/>
					<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
						Solo deudores
					</span>
				</label>

				<button
					type="button"
					onclick={exportExcel}
					disabled={!data || loading}
					class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
				>
					<DownloadIcon class="size-4" />
					Exportar Excel
				</button>

				<button
					type="button"
					onclick={loadDeudores}
					disabled={!cursoSeleccionado || loading}
					class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
					title="Recargar"
				>
					<RefreshIcon class="size-4" />
				</button>
			</div>
		</div>
	</Card>

	<!-- Error -->
	{#if error}
		<Card>
			<div class="flex items-start gap-3 text-red-700">
				<ExclamationCircleIcon class="size-5 shrink-0 mt-0.5" />
				<div class="text-sm">{error}</div>
			</div>
		</Card>
	{/if}

	<!-- Loading inicial -->
	{#if loading && !data}
		<Card>
			<div class="py-12 text-center text-gray-500">
				<div class="inline-block size-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
				<p class="text-sm">Cargando deudores...</p>
			</div>
		</Card>
	{/if}

	<!-- Estado vacío: sin curso seleccionado -->
	{#if !cursoSeleccionado && !loading}
		<Card>
			<div class="py-12 text-center text-gray-500">
				<svg class="size-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
					<path stroke-linecap="round" stroke-linejoin="round" d="M3 4.5h18M6 12h12M10 19.5h4" />
				</svg>
				<p class="text-sm">Selecciona un curso para ver los deudores.</p>
			</div>
		</Card>
	{/if}

	<!-- Resumen: KPI cards -->
	{#if data && resumen}
		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<Card>
				<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Estudiantes</p>
				<p class="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">
					{resumen.total_estudiantes}
				</p>
				{#if !soloDeudores}
					<p class="text-[10px] text-gray-400 mt-0.5">Todos los inscritos</p>
				{:else}
					<p class="text-[10px] text-gray-400 mt-0.5">Con deuda</p>
				{/if}
			</Card>
			<Card>
				<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Deudores</p>
				<p class="text-2xl font-extrabold text-red-600 dark:text-red-400 mt-1">
					{resumen.total_deudores}
				</p>
				<p class="text-[10px] text-gray-400 mt-0.5">Deben Bs. {fmt(resumen.deuda_total_curso)}</p>
			</Card>
			<Card>
				<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Deuda Matrícula</p>
				<p class="text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1">
					Bs. {fmt(resumen.por_columna.matricula.monto_pendiente)}
				</p>
				<p class="text-[10px] text-gray-400 mt-0.5">
					{resumen.por_columna.matricula.deben} deben
				</p>
			</Card>
			<Card>
				<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Módulos con deuda</p>
				<p class="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-1">
					{resumen.por_columna.modulos.filter((m) => m.deben > 0).length}
				</p>
				<p class="text-[10px] text-gray-400 mt-0.5">de {resumen.por_columna.modulos.length} módulos</p>
			</Card>
		</div>
	{/if}

	<!-- Tabla matriz: estudiantes × módulos -->
	{#if data && !loading}
		<Card>
			<div class="flex items-center justify-between mb-3">
				<div>
					<h3 class="text-base font-bold text-gray-900 dark:text-gray-100">
						{data.curso.nombre}
					</h3>
					{#if data.curso.codigo}
						<p class="text-xs text-gray-500">{data.curso.codigo}</p>
					{/if}
				</div>
				<div class="text-xs text-gray-500">
					<span class="inline-flex items-center gap-1.5">
						<span class="size-2.5 rounded-sm bg-green-500"></span> Pagado
					</span>
					<span class="inline-flex items-center gap-1.5 ml-3">
						<span class="size-2.5 rounded-sm bg-red-500"></span> Debe
					</span>
					<span class="inline-flex items-center gap-1.5 ml-3">
						<span class="size-2.5 rounded-sm bg-gray-300"></span> No le toca
					</span>
				</div>
			</div>

			{#if estudiantesFiltrados.length === 0}
				<div class="py-8 text-center text-gray-500 text-sm">
					{#if soloDeudores}
						¡Excelente! No hay deudores en este curso. 🎉
					{:else if searchTerm}
						Sin resultados para "{searchTerm}".
					{:else}
						No hay estudiantes inscritos en este curso.
					{/if}
				</div>
			{:else}
				<!-- Tabla con scroll horizontal en mobile -->
				<div class="overflow-x-auto -mx-4 px-4">
					<table class="w-full text-xs border-collapse min-w-[800px]">
						<thead>
							<tr class="bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100">
								<th class="text-left p-2 font-bold sticky left-0 bg-primary-50 dark:bg-primary-900/30 z-10 min-w-[180px]">
									Estudiante
								</th>
								<th class="text-left p-2 font-bold min-w-[110px]">CI</th>
								<th class="text-left p-2 font-bold min-w-[100px]">Celular</th>
								<th class="text-center p-2 font-bold min-w-[110px]">Matrícula</th>
								{#each data.curso.modulos as m, idx (idx)}
									<th class="text-center p-2 font-bold min-w-[110px]">{m}</th>
								{/each}
								<th class="text-right p-2 font-bold min-w-[110px]">Deuda total</th>
							</tr>
						</thead>
						<tbody>
							{#each estudiantesFiltrados as est (est.estudiante_id)}
								<tr class="border-t border-gray-200 dark:border-gray-700 {getDeudorRowClass(est)}">
									<td class="p-2 sticky left-0 bg-white dark:bg-gray-900 z-10">
										<div class="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={est.nombre}>
											{est.nombre}
										</div>
										<div class="text-[10px] text-gray-500">
											{est.registro}
											{#if est.estado_inscripcion && est.estado_inscripcion !== 'activo'}
												· <span class="uppercase font-bold">{est.estado_inscripcion}</span>
											{/if}
										</div>
									</td>
									<td class="p-2 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
										{est.ci || '—'}
									</td>
									<td class="p-2 text-gray-700 dark:text-gray-300">
										<a href={`https://wa.me/${(est.celular || '').replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" class="text-emerald-700 hover:underline">
											{est.celular || '—'}
										</a>
									</td>
									<td class="p-2 text-center">
										<div class={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${getCeldaClass(est.matricula.estado)}`}>
											<div class="flex items-center gap-1">
												<span class="text-base leading-none">{getCeldaIcon(est.matricula.estado)}</span>
												{#if est.matricula.estado !== 'no_le_toca'}
													<span>Bs. {fmt(est.matricula.pagado)} / {fmt(est.matricula.costo)}</span>
												{/if}
											</div>
										</div>
									</td>
									{#each est.modulos as mod (mod.i)}
										<td class="p-2 text-center">
											<div class={`inline-block rounded border px-1.5 py-0.5 text-[11px] ${getCeldaClass(mod.estado)}`}>
												<div class="flex items-center gap-1">
													<span class="text-base leading-none">{getCeldaIcon(mod.estado)}</span>
													{#if mod.estado !== 'no_le_toca'}
														<span>Bs. {fmt(mod.pagado)} / {fmt(mod.costo)}</span>
													{/if}
												</div>
											</div>
										</td>
									{/each}
									<td class="p-2 text-right">
										{#if est.deuda_total > 0.01}
											<div class="inline-block rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-800">
												Bs. {fmt(est.deuda_total)}
											</div>
										{:else}
											<span class="text-gray-400 text-[11px]">—</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>
	{/if}
</div>
