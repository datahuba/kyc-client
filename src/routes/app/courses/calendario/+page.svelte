<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService, type CalendarioItem } from '$lib/services/course.service';
	import BadgeEstado from '$lib/components/programas/BadgeEstado.svelte';
	import { alert } from '$lib/utils';

	type Vista = 'lista' | 'timeline' | 'semana';

	// F-080 FIX (2026-07-27): usar $state (Svelte 5) en vez de let para que
	// las variables sean reactivas. El bug era que con `let` + `$:` el filtro
	// reactivo se disparaba antes del primer onMount y quedaba en loop infinito.
	let items = $state<CalendarioItem[]>([]);
	let loading = $state(true);
	let vista: Vista = $state('lista');
	let filtroEstado = $state<string>('');
	let filtroTipo = $state<string>('');
	let filtroYear = $state<number | ''>('');

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
		{ value: 'programado', label: '🟡 Por iniciar' },
		{ value: 'en_ejecucion', label: '🟢 En ejecución' },
		{ value: 'cerrado', label: '⚫ Finalizados' }
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

	function formatDate(d: string | null): string {
		if (!d) return '—';
		try {
			const dt = new Date(d);
			return dt.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', year: 'numeric' });
		} catch {
			return d;
		}
	}

	/**
	 * F-087-CAL · Devuelve un texto contextual sobre el avance del programa:
	 *   - programado: "Inicia en X días" (o "Inicia hoy" / "Inicia en 1 día")
	 *   - en_ejecucion: "Lleva X días · Faltan Y días" (o "Último día" si hoy = fecha_fin)
	 *   - cerrado: "Finalizó hace X días"
	 * Devuelve string vacío si no hay fechas suficientes.
	 */
	function avanceLabel(estadoCalc: string, fechaInicio: string | null, fechaFin: string | null): string {
		if (!fechaInicio || !fechaFin) return '';
		const inicio = new Date(fechaInicio);
		const fin = new Date(fechaFin);
		const hoy = new Date();
		// Normalizar a inicio del día para comparaciones justas
		inicio.setHours(0, 0, 0, 0);
		fin.setHours(0, 0, 0, 0);
		hoy.setHours(0, 0, 0, 0);
		const MS_PER_DAY = 24 * 60 * 60 * 1000;
		const dias = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);

		if (estadoCalc === 'programado') {
			// f > 0 → inicio es en el futuro
			// f < 0 → inicio ya pasó (caso borde: estado aún calculado como programado)
			// f === 0 → hoy es el día de inicio
			const f = dias(inicio, hoy);
			if (f > 0) return `Inicia en ${f} ${f === 1 ? 'día' : 'días'}`;
			if (f === 0) return 'Inicia hoy';
			return `Inició hace ${Math.abs(f)} ${Math.abs(f) === 1 ? 'día' : 'días'}`;
		}
		if (estadoCalc === 'en_ejecucion') {
			const lleva = dias(hoy, inicio);
			const faltan = dias(fin, hoy);
			if (faltan === 0) return `Último día · lleva ${lleva} ${lleva === 1 ? 'día' : 'días'}`;
			return `Lleva ${lleva} ${lleva === 1 ? 'día' : 'días'} · faltan ${faltan} ${faltan === 1 ? 'día' : 'días'}`;
		}
		if (estadoCalc === 'cerrado') {
			const f = dias(hoy, fin);
			return `Finalizó hace ${f} ${f === 1 ? 'día' : 'días'}`;
		}
		return '';
	}

	function formatMoney(n: number): string {
		return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(n);
	}

	// Agrupar por mes-año para vista timeline (reactivo con $derived)
	const itemsAgrupados = $derived.by(() => {
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
	});

	function mesLabel(key: string): string {
		if (key === '__sin_fecha') return 'Sin fecha definida';
		const [y, m] = key.split('-');
		const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		return `${meses[Number(m) - 1]} ${y}`;
	}

	const yearsDisponibles = $derived.by(() => {
		const years = new Set<number>();
		for (const it of items) {
			const ref = it.fecha_inicio || it.fecha_fin;
			if (ref) years.add(new Date(ref).getFullYear());
		}
		return Array.from(years).sort((a, b) => b - a);
	});

	// F-087-CAL · KPIs de estado (cuenta considerando TODOS los programas del
	// año, no solo los filtrados por estado — para que cada KPI muestre el
	// total real y el usuario pueda comparar).
	const kpis = $derived.by(() => {
		const counts = { total: items.length, programado: 0, en_ejecucion: 0, cerrado: 0 };
		for (const it of items) {
			const e = it.estado_calculado as keyof typeof counts;
			if (e in counts && e !== 'total') counts[e]++;
		}
		return counts;
	});

	// F-087-CAL · Vista semanal: items agrupados por día de la semana actual
	// (Lun-Dom), con navegación prev/next/semana-actual. Estilo Google Calendar.
	let semanaOffset = $state(0); // 0 = semana actual, -1 = anterior, +1 = siguiente

	// Calcula el lunes de la semana (offset=0 → semana actual)
	function lunesDeSemana(offset: number): Date {
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const dow = hoy.getDay(); // 0 = Dom, 1 = Lun, ..., 6 = Sáb
		const diff = dow === 0 ? -6 : 1 - dow; // ajustar a lunes
		const lunes = new Date(hoy);
		lunes.setDate(hoy.getDate() + diff + offset * 7);
		return lunes;
	}

	const semanaActual = $derived.by(() => {
		const lunes = lunesDeSemana(semanaOffset);
		const dias: { fecha: Date; key: string; label: string; items: CalendarioItem[] }[] = [];
		const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
		const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		for (let i = 0; i < 7; i++) {
			const fecha = new Date(lunes);
			fecha.setDate(lunes.getDate() + i);
			const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
			dias.push({
				fecha,
				key,
				label: `${diasSemana[i]} ${fecha.getDate()} ${meses[fecha.getMonth()]}`,
				items: []
			});
		}
		// Asignar items al día correspondiente
		for (const it of items) {
			const ref = it.fecha_inicio || it.fecha_fin;
			if (!ref) continue;
			const d = new Date(ref);
			const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			const dia = dias.find((x) => x.key === k);
			if (dia) dia.items.push(it);
		}
		return dias;
	});

	const semanaLabel = $derived.by(() => {
		const lunes = lunesDeSemana(semanaOffset);
		const domingo = new Date(lunes);
		domingo.setDate(lunes.getDate() + 6);
		const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
		return `${lunes.getDate()} ${meses[lunes.getMonth()]} – ${domingo.getDate()} ${meses[domingo.getMonth()]} ${domingo.getFullYear()}`;
	});

	function esHoy(fecha: Date): boolean {
		const h = new Date();
		return fecha.getFullYear() === h.getFullYear() &&
			fecha.getMonth() === h.getMonth() &&
			fecha.getDate() === h.getDate();
	}

	function setFiltroEstado(estado: string) {
		// Si ya está activo ese filtro, lo limpiamos (toggle). Si no, lo aplicamos.
		filtroEstado = filtroEstado === estado ? '' : estado;
		onFiltroChange();
	}

	function onFiltroChange() {
		cargar();
	}
</script>

<svelte:head>
	<title>Calendario de Programas · Posgrado UAGRM</title>
</svelte:head>

<div class="p-6 max-w-7xl mx-auto">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-slate-800">📅 Calendario de Programas</h1>
		<p class="text-sm text-slate-600 mt-1">
			Vista general de todos los programas académicos: en ejecución, por iniciar y finalizados.
		</p>
	</header>

	<!-- F-087-CAL · KPIs de estado (clickables como atajo de filtro) -->
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
		<button
			type="button"
			onclick={() => setFiltroEstado('')}
			class="text-left p-3 rounded-lg border transition shadow-sm
				{filtroEstado === ''
					? 'bg-slate-800 text-white border-slate-800'
					: 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}"
		>
			<div class="text-[10px] uppercase font-semibold opacity-80">Total</div>
			<div class="text-2xl font-bold mt-1">{kpis.total}</div>
			<div class="text-[10px] opacity-80">programas</div>
		</button>
		<button
			type="button"
			onclick={() => setFiltroEstado('programado')}
			class="text-left p-3 rounded-lg border transition shadow-sm
				{filtroEstado === 'programado'
					? 'bg-amber-500 text-white border-amber-500'
					: 'bg-amber-50 text-amber-900 border-amber-200 hover:border-amber-400'}"
		>
			<div class="text-[10px] uppercase font-semibold opacity-80">🟡 Por iniciar</div>
			<div class="text-2xl font-bold mt-1">{kpis.programado}</div>
			<div class="text-[10px] opacity-80">futuro</div>
		</button>
		<button
			type="button"
			onclick={() => setFiltroEstado('en_ejecucion')}
			class="text-left p-3 rounded-lg border transition shadow-sm
				{filtroEstado === 'en_ejecucion'
					? 'bg-green-600 text-white border-green-600'
					: 'bg-green-50 text-green-900 border-green-200 hover:border-green-400'}"
		>
			<div class="text-[10px] uppercase font-semibold opacity-80">🟢 En ejecución</div>
			<div class="text-2xl font-bold mt-1">{kpis.en_ejecucion}</div>
			<div class="text-[10px] opacity-80">corriendo ahora</div>
		</button>
		<button
			type="button"
			onclick={() => setFiltroEstado('cerrado')}
			class="text-left p-3 rounded-lg border transition shadow-sm
				{filtroEstado === 'cerrado'
					? 'bg-slate-600 text-white border-slate-600'
					: 'bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-500'}"
		>
			<div class="text-[10px] uppercase font-semibold opacity-80">⚫ Finalizados</div>
			<div class="text-2xl font-bold mt-1">{kpis.cerrado}</div>
			<div class="text-[10px] opacity-80">histórico</div>
		</button>
	</div>

	<!-- Filtros y toggle de vista -->
	<div class="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6 flex flex-wrap items-center gap-3">
		<div class="flex items-center gap-2">
			<label for="filtro-year" class="text-xs font-semibold text-slate-600">Año:</label>
			<select
				id="filtro-year"
				bind:value={filtroYear}
				onchange={onFiltroChange}
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
				onchange={onFiltroChange}
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
				onchange={onFiltroChange}
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
				onclick={() => (vista = 'lista')}
			>
				📋 Lista
			</button>
			<button
				type="button"
				class="px-3 py-1 text-xs font-semibold rounded transition {vista === 'timeline'
					? 'bg-white shadow text-slate-800'
					: 'text-slate-500 hover:text-slate-700'}"
				onclick={() => (vista = 'timeline')}
			>
				📊 Timeline
			</button>
			<button
				type="button"
				class="px-3 py-1 text-xs font-semibold rounded transition {vista === 'semana'
					? 'bg-white shadow text-slate-800'
					: 'text-slate-500 hover:text-slate-700'}"
				onclick={() => {
					vista = 'semana';
					semanaOffset = 0;
				}}
			>
				🗓️ Semana
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
						{#if avanceLabel(item.estado_calculado, item.fecha_inicio, item.fecha_fin)}
							<div class="text-slate-700 font-medium italic">
								{avanceLabel(item.estado_calculado, item.fecha_inicio, item.fecha_fin)}
							</div>
						{/if}
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
									{#if avanceLabel(item.estado_calculado, item.fecha_inicio, item.fecha_fin)}
										<div class="text-[11px] text-slate-700 italic mt-0.5">
											{avanceLabel(item.estado_calculado, item.fecha_inicio, item.fecha_fin)}
										</div>
									{/if}
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
	{:else if vista === 'semana'}
		<!-- Vista SEMANA (estilo Google Calendar) -->
		<div class="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
			<!-- Header con navegación de semana -->
			<div class="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50">
				<div class="flex items-center gap-2">
					<button
						type="button"
						class="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100"
						onclick={() => (semanaOffset = semanaOffset - 1)}
						aria-label="Semana anterior"
					>
						‹
					</button>
					<button
						type="button"
						class="px-3 py-1 text-xs font-semibold border border-slate-300 rounded hover:bg-slate-100"
						class:hidden={semanaOffset === 0}
						onclick={() => (semanaOffset = 0)}
					>
						Hoy
					</button>
					<button
						type="button"
						class="px-2 py-1 text-sm border border-slate-300 rounded hover:bg-slate-100"
						onclick={() => (semanaOffset = semanaOffset + 1)}
						aria-label="Semana siguiente"
					>
						›
					</button>
				</div>
				<h2 class="text-sm font-bold text-slate-700">{semanaLabel}</h2>
				<div class="w-20"></div>
			</div>
			<!-- Grid de 7 días -->
			<div class="grid grid-cols-7 divide-x divide-slate-200">
				{#each semanaActual as dia (dia.key)}
					<div class="min-h-[180px] p-2 {esHoy(dia.fecha) ? 'bg-amber-50 dark:bg-amber-900/10' : ''}">
						<div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1 {esHoy(dia.fecha) ? 'text-amber-700' : ''}">
							{dia.label}
							{#if esHoy(dia.fecha)}
								<span class="ml-1 px-1.5 py-0.5 text-[9px] rounded bg-amber-500 text-white">HOY</span>
							{/if}
						</div>
						{#if dia.items.length === 0}
							<div class="text-[10px] text-slate-300 italic">—</div>
						{:else}
							<div class="space-y-1">
								{#each dia.items as it (it.id)}
									<div class="text-[11px] p-1.5 rounded border bg-white border-slate-200 hover:shadow cursor-default">
										<div class="font-semibold text-slate-800 truncate" title={it.nombre_programa}>
											{it.nombre_programa}
										</div>
										<div class="flex items-center gap-1 mt-0.5">
											<BadgeEstado estado={it.estado_calculado} size="sm" />
											<span class="text-[9px] text-slate-500">{it.codigo}</span>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Footer con total -->
	{#if !loading && items.length > 0}
		<div class="mt-6 text-xs text-slate-500 text-center">
			{items.length} programa{items.length === 1 ? '' : 's'} encontrado{items.length === 1 ? '' : 's'}
		</div>
	{/if}
</div>
