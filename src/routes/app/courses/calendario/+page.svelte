<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService, type CalendarioItem } from '$lib/services/course.service';
	import BadgeEstado from '$lib/components/programas/BadgeEstado.svelte';
	import { alert } from '$lib/utils';

	type Vista = 'lista' | 'timeline';

	let items: CalendarioItem[] = [];
	let loading = true;
	let vista: Vista = 'lista';
	let filtroEstado: string = '';
	let filtroTipo: string = '';
	let filtroYear: number | '' = '';

	const TIPOS_CURSO = [
		{ value: '', label: 'Todos los tipos' },
		{ value: 'curso', label: 'Curso' },
		{ value: 'taller', label: 'Taller' },
		{ value: 'diplomado', label: 'Diplomado' },
		{ value: 'maestría', label: 'Maestría' },
		{ value: 'doctorado', label: 'Doctorado' },
		{ value: 'otro', label: 'Otro' }
	];

	const ESTADOS = [
		{ value: '', label: 'Todos los estados' },
		{ value: 'programado', label: '🟡 Próximos' },
		{ value: 'en_ejecucion', label: '🟢 En ejecución' },
		{ value: 'cerrado', label: '⚫ Cerrados' }
	];

	async function cargar() {
		loading = true;
		try {
			const year = filtroYear === '' ? undefined : Number(filtroYear);
			const filters: { tipo_curso?: string; estado?: string } = {};
			if (filtroTipo) filters.tipo_curso = filtroTipo;
			if (filtroEstado) filters.estado = filtroEstado;

			const resp = await courseService.getCalendario(year, filters);
			items = resp.items || [];
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar el calendario de programas');
			items = [];
		} finally {
			loading = false;
		}
	}

	onMount(cargar);

	$: if (filtroEstado !== undefined || filtroTipo !== undefined || filtroYear !== undefined) {
		// Trigger reload on filter change (skip on initial)
		if (!loading) cargar();
	}

	function formatDate(d: string | null): string {
		if (!d) return '—';
		try {
			const dt = new Date(d);
			return dt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
		} catch {
			return d;
		}
	}

	function formatMoney(n: number): string {
		return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(n);
	}

	// Agrupar por mes-año para vista timeline
	$: itemsAgrupados = (() => {
		const grupos: Record<string, CalendarioItem[]> = {};
		for (const it of items) {
			const ref = it.fecha_inicio || it.fecha_fin;
			if (!ref) {
				grupos['__sin_fecha'] = grupos['__sin_fecha'] || [];
				grupos['__sin_fecha'].push(it);
				continue;
			}
			const d = new Date(ref);
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
			grupos[key] = grupos[key] || [];
			grupos[key].push(it);
		}
		return Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b));
	})();

	function mesLabel(key: string): string {
		if (key === '__sin_fecha') return 'Sin fecha definida';
		const [y, m] = key.split('-');
		const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		return `${meses[Number(m) - 1]} ${y}`;
	}

	$: yearsDisponibles = (() => {
		const years = new Set<number>();
		for (const it of items) {
			const ref = it.fecha_inicio || it.fecha_fin;
			if (ref) years.add(new Date(ref).getFullYear());
		}
		return Array.from(years).sort((a, b) => b - a);
	})();
</script>

<svelte:head>
	<title>Calendario de Programas · Posgrado UAGRM</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">📅 Calendario de Programas</h1>
		<p class="text-sm text-slate-600 mt-1">
			Vista general de todos los programas académicos: en ejecución, próximos y cerrados.
		</p>
	</header>

	<!-- Filtros y toggle de vista -->
	<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2">
			<label for="filtro-year" class="text-xs font-semibold text-slate-600">Año:</label>
			<select
				id="filtro-year"
				bind:value={filtroYear}
				class="text-sm border border-slate-300 rounded px-2 py-1 bg-white"
			>
				<option value="">Todos</option>
				{#each yearsDisponibles as y}
					<option value={y}>{y}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-center gap-2">
			<label for="filtro-tipo" class="text-xs font-semibold text-slate-600">Tipo:</label>
			<select
				id="filtro-tipo"
				bind:value={filtroTipo}
				class="text-sm border border-slate-300 rounded px-2 py-1 bg-white"
			>
				{#each TIPOS_CURSO as t}
					<option value={t.value}>{t.label}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-center gap-2">
			<label for="filtro-estado" class="text-xs font-semibold text-slate-600">Estado:</label>
			<select
				id="filtro-estado"
				bind:value={filtroEstado}
				class="text-sm border border-slate-300 rounded px-2 py-1 bg-white"
			>
				{#each ESTADOS as e}
					<option value={e.value}>{e.label}</option>
				{/each}
			</select>
		</div>

		<div class="ml-auto flex items-center gap-1 bg-slate-100 rounded p-1">
			<button
				type="button"
				class="px-3 py-1 text-xs font-semibold rounded transition {vista === 'lista'
					? 'bg-white shadow text-slate-800'
					: 'text-slate-500 hover:text-slate-700'}"
				on:click={() => (vista = 'lista')}
			>
				📋 Lista
			</button>
			<button
				type="button"
				class="px-3 py-1 text-xs font-semibold rounded transition {vista === 'timeline'
					? 'bg-white shadow text-slate-800'
					: 'text-slate-500 hover:text-slate-700'}"
				on:click={() => (vista = 'timeline')}
			>
				📊 Timeline
			</button>
		</div>
	</div>

	<!-- Contenido -->
	{#if loading}
		<div class="text-center py-12 text-slate-500">
			<div class="animate-pulse text-4xl mb-2">⏳</div>
			Cargando programas...
		</div>
	{:else if items.length === 0}
		<div class="text-center py-12 text-slate-500">
			<div class="text-4xl mb-2">📭</div>
			No hay programas para los filtros seleccionados.
		</div>
	{:else if vista === 'lista'}
		<!-- Vista LISTA -->
		<div class="space-y-3">
			{#each items as item (item.id)}
				<article
					class="bg-white rounded-lg shadow-sm border border-slate-200 p-4 hover:shadow-md transition flex flex-col md:flex-row md:items-center gap-3"
				>
					<div class="flex-1 min-w-0">
						<div class="flex items-center gap-2 flex-wrap mb-1">
							<BadgeEstado estado={item.estado_calculado} />
							<span class="text-xs text-slate-500 font-mono">{item.codigo}</span>
							{#if !item.activo}
								<span class="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
									INACTIVO
								</span>
							{/if}
						</div>
						<h2 class="text-base font-semibold text-slate-800 truncate">
							{item.nombre_programa}
						</h2>
						<p class="text-xs text-slate-600 mt-1">
							<span class="capitalize">{item.modalidad}</span>
							·
							<span class="capitalize">{item.tipo_curso}</span>
							·
							{item.cantidad_modulos} módulo{item.cantidad_modulos === 1 ? '' : 's'}
							·
							{item.cantidad_inscritos} inscrito{item.cantidad_inscritos === 1 ? '' : 's'}
						</p>
					</div>
					<div class="flex flex-col md:items-end gap-1 text-xs text-slate-600">
						<div>
							<span class="font-semibold">Inicio:</span> {formatDate(item.fecha_inicio)}
						</div>
						<div>
							<span class="font-semibold">Fin:</span> {formatDate(item.fecha_fin)}
						</div>
						<div class="text-slate-500">
							{formatMoney(item.costo_total_interno)}
							{#if item.matricula_interno > 0}
								+ {formatMoney(item.matricula_interno)} matrícula
							{/if}
						</div>
					</div>
				</article>
			{/each}
		</div>
	{:else}
		<!-- Vista TIMELINE agrupada por mes -->
		<div class="space-y-6">
			{#each itemsAgrupados as [mesKey, grupo]}
				<section>
					<h2 class="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">
						{mesLabel(mesKey)}
					</h2>
					<div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
						{#each grupo as item, i (item.id)}
							<div
								class="flex items-center gap-3 p-3 {i < grupo.length - 1
									? 'border-b border-slate-100'
									: ''}"
							>
								<div class="text-xs text-slate-400 font-mono w-20 shrink-0">
									{formatDate(item.fecha_inicio || item.fecha_fin)}
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 flex-wrap">
										<span class="font-semibold text-slate-800 text-sm">
											{item.nombre_programa}
										</span>
										<BadgeEstado estado={item.estado_calculado} size="sm" />
									</div>
									<div class="text-xs text-slate-500 mt-0.5">
										{item.codigo} · {item.cantidad_modulos} módulos · {item.cantidad_inscritos} inscritos
									</div>
								</div>
								<div class="text-xs text-slate-600 shrink-0">
									{formatMoney(item.costo_total_interno)}
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}

	<!-- Footer con total -->
	{#if !loading && items.length > 0}
		<div class="mt-6 text-xs text-slate-500 text-center">
			{items.length} programa{items.length === 1 ? '' : 's'} encontrado{items.length === 1 ? '' : 's'}
		</div>
	{/if}
</div>
