<script lang="ts">
	import { onMount } from 'svelte';
	import { courseService, type CalendarioItem } from '$lib/services/course.service';
	import { userStore } from '$lib/stores/userStore';
	import BadgeEstado from '$lib/components/programas/BadgeEstado.svelte';
	import { alert } from '$lib/utils';
	import FormularioInscripcionModal from '$lib/features/enrollments/FormularioInscripcionModal.svelte';

	let items = $state<CalendarioItem[]>([]);
	let loading = $state(true);

	let currentUser: any = $state(null);
	userStore.subscribe((state) => {
		currentUser = state.user;
	});

	// Semana visible. semanaOffset = 0 → semana actual, -1 anterior, +1 siguiente.
	let semanaOffset = $state(0);

	// Programa seleccionado para el modal de detalle
	let selectedPrograma = $state<CalendarioItem | null>(null);

	// Helper: lunes de la semana con offset
	function lunesDeSemana(offset: number): Date {
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const dow = hoy.getDay();
		const diff = dow === 0 ? -6 : 1 - dow;
		const lunes = new Date(hoy);
		lunes.setDate(hoy.getDate() + diff + offset * 7);
		return lunes;
	}

	async function cargar() {
		loading = true;
		try {
			const resp = await courseService.getCalendario(undefined, {});
			items = resp.items || [];
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar el calendario de programas');
			items = [];
		} finally {
			loading = false;
		}
	}

	onMount(cargar);

	// Mes actualmente "foco" para el mini-calendario (cambia con la navegación)
	let mesFoco = $state(new Date());

	const meses = [
		'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
		'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
	];
	const mesesCortos = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
	const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
	const diasSemanaMin = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

	function fmtDateKey(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// Semana visible como 7 días derivados
	const semanaActual = $derived.by(() => {
		const lunes = lunesDeSemana(semanaOffset);
		// Sincronizar mesFoco con la semana visible (para el mini-calendario)
		mesFoco = new Date(lunes);
		const dias: { fecha: Date; key: string; esHoy: boolean; items: CalendarioItem[] }[] = [];
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		for (let i = 0; i < 7; i++) {
			const fecha = new Date(lunes);
			fecha.setDate(lunes.getDate() + i);
			dias.push({
				fecha,
				key: fmtDateKey(fecha),
				esHoy: fecha.getTime() === hoy.getTime(),
				items: []
			});
		}
		// Asignar items según intersección con el rango
		for (const it of items) {
			const inicio = it.fecha_inicio ? new Date(it.fecha_inicio) : null;
			const fin = it.fecha_fin ? new Date(it.fecha_fin) : null;
			if (!inicio && !fin) continue;
			// Mostrar en cada día de la semana donde el programa está vigente
			for (const dia of dias) {
				const inicioOK = !inicio || dia.fecha >= inicio;
				const finOK = !fin || dia.fecha <= fin;
				if (inicioOK && finOK) {
					dia.items.push(it);
				}
			}
		}
		return dias;
	});

	const semanaLabel = $derived.by(() => {
		const lunes = lunesDeSemana(semanaOffset);
		const domingo = new Date(lunes);
		domingo.setDate(lunes.getDate() + 6);
		const mismoMes = lunes.getMonth() === domingo.getMonth();
		const mismoAnio = lunes.getFullYear() === domingo.getFullYear();
		if (mismoMes && mismoAnio) {
			return `${meses[lunes.getMonth()]} ${lunes.getDate()} – ${domingo.getDate()}, ${domingo.getFullYear()}`;
		}
		if (mismoAnio) {
			return `${mesesCortos[lunes.getMonth()]} ${lunes.getDate()} – ${mesesCortos[domingo.getMonth()]} ${domingo.getDate()}, ${domingo.getFullYear()}`;
		}
		return `${mesesCortos[lunes.getMonth()]} ${lunes.getDate()}, ${lunes.getFullYear()} – ${mesesCortos[domingo.getMonth()]} ${domingo.getDate()}, ${domingo.getFullYear()}`;
	});

	// Mini-calendario: 6 filas × 7 columnas
	const miniCalendario = $derived.by(() => {
		const year = mesFoco.getFullYear();
		const month = mesFoco.getMonth();
		// Primer día del mes (0=Dom, 1=Lun, ...)
		const primerDia = new Date(year, month, 1);
		let dow = primerDia.getDay();
		dow = dow === 0 ? 6 : dow - 1; // ajustar a lunes
		// Primer lunes a mostrar
		const inicio = new Date(primerDia);
		inicio.setDate(primerDia.getDate() - dow);
		const celdas: { fecha: Date; esDelMes: boolean; esHoy: boolean; key: string }[] = [];
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		for (let i = 0; i < 42; i++) {
			const d = new Date(inicio);
			d.setDate(inicio.getDate() + i);
			celdas.push({
				fecha: d,
				esDelMes: d.getMonth() === month,
				esHoy: d.getTime() === hoy.getTime(),
				key: fmtDateKey(d)
			});
		}
		return celdas;
	});

	function esMismoDia(a: Date, b: Date): boolean {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	}

	function prevMes() {
		const d = new Date(mesFoco);
		d.setDate(1);
		d.setMonth(d.getMonth() - 1);
		mesFoco = d;
	}

	function nextMes() {
		const d = new Date(mesFoco);
		d.setDate(1);
		d.setMonth(d.getMonth() + 1);
		mesFoco = d;
	}

	function irAHoy() {
		semanaOffset = 0;
		mesFoco = new Date();
	}

	function irASemanaDe(fecha: Date) {
		const target = new Date(fecha);
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const lunesActual = lunesDeSemana(0);
		const diffDias = Math.floor((target.getTime() - lunesActual.getTime()) / (1000 * 60 * 60 * 24));
		semanaOffset = Math.floor(diffDias / 7);
		mesFoco = new Date(target);
	}

	function badgeClass(estado: string): string {
		switch (estado) {
			case 'programado':
				return 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200';
			case 'en_ejecucion':
				return 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200';
			case 'cerrado':
				return 'bg-slate-200 text-slate-700 border-slate-300 hover:bg-slate-300';
			default:
				return 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
		}
	}

	function dotColor(estado: string): string {
		switch (estado) {
			case 'programado': return 'bg-amber-500';
			case 'en_ejecucion': return 'bg-emerald-500';
			case 'cerrado': return 'bg-slate-400';
			default: return 'bg-slate-300';
		}
	}

	function formatMoney(n: number): string {
		return new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB' }).format(n);
	}

	function formatDateLargo(d: string | null): string {
		if (!d) return '—';
		try {
			return new Date(d).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' });
		} catch { return d; }
	}

	function colorPorTipo(tipo: string): string {
		const map: Record<string, string> = {
			diplomado: 'border-l-blue-500 bg-blue-50/60',
			maestría: 'border-l-purple-500 bg-purple-50/60',
			doctorado: 'border-l-rose-500 bg-rose-50/60',
			curso: 'border-l-cyan-500 bg-cyan-50/60',
			taller: 'border-l-orange-500 bg-orange-50/60'
		};
		return map[tipo] || 'border-l-slate-400 bg-slate-50/60';
	}

	function abrirDetalle(item: CalendarioItem) {
		selectedPrograma = item;
	}

	function cerrarDetalle() {
		selectedPrograma = null;
		inscriptionOpen = false;
	}

	// F-CATALOGO-INSCRIPCION (2026-07-30): abrir el FormularioInscripcionModal
	// con el programa seleccionado. Es el flujo oficial: el estudiante genera
	// el PDF, lo firma, y lo entrega en secretaría.
	let inscriptionOpen = $state(false);

	function handleInscribirme() {
		if (!selectedPrograma) return;
		inscriptionOpen = true;
	}

	function closeInscription() {
		inscriptionOpen = false;
	}
</script>

<svelte:head>
	<title>Calendario de Programas · Posgrado UAGRM</title>
</svelte:head>

<div class="min-h-screen bg-slate-50">
	<!-- Header -->
	<header class="bg-white border-b border-slate-200">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
			<div>
				<h1 class="text-2xl font-bold text-slate-900 flex items-center gap-2">
					<span class="text-2xl">📅</span> Calendario de Programas
				</h1>
				<p class="text-sm text-slate-500 mt-1">
					Programas académicos: en ejecución, por iniciar y finalizados. Click en un programa para ver detalle.
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					onclick={irAHoy}
					class="px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
				>
					Hoy
				</button>
				<button
					type="button"
					onclick={() => (semanaOffset = semanaOffset - 1)}
					class="w-9 h-9 flex items-center justify-center border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
					aria-label="Semana anterior"
				>
					‹
				</button>
				<button
					type="button"
					onclick={() => (semanaOffset = semanaOffset + 1)}
					class="w-9 h-9 flex items-center justify-center border border-slate-300 rounded-md hover:bg-slate-50 text-slate-700"
					aria-label="Semana siguiente"
				>
					›
				</button>
				<h2 class="ml-2 text-lg font-semibold text-slate-800 min-w-[220px] text-center">{semanaLabel}</h2>
			</div>
		</div>
	</header>

	<!-- Main: sidebar + grid -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
		<!-- Sidebar (mini calendario + leyenda) -->
		<aside class="space-y-5">
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
				<div class="flex items-center justify-between mb-3">
					<button
						type="button"
						onclick={prevMes}
						class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
						aria-label="Mes anterior"
					>
						‹
					</button>
					<h3 class="text-sm font-semibold text-slate-800">
						{meses[mesFoco.getMonth()]} {mesFoco.getFullYear()}
					</h3>
					<button
						type="button"
						onclick={nextMes}
						class="w-7 h-7 flex items-center justify-center rounded hover:bg-slate-100 text-slate-600"
						aria-label="Mes siguiente"
					>
						›
					</button>
				</div>
				<!-- Encabezado días semana -->
				<div class="grid grid-cols-7 mb-1">
					{#each diasSemanaMin as d}
						<div class="text-center text-[11px] font-semibold text-slate-400 py-1">{d}</div>
					{/each}
				</div>
				<!-- 6 filas × 7 cols = 42 celdas -->
				<div class="grid grid-cols-7 gap-y-0.5">
					{#each miniCalendario as cell (cell.key)}
						<button
							type="button"
							onclick={() => irASemanaDe(cell.fecha)}
							class="aspect-square flex items-center justify-center text-xs rounded-full transition
								{cell.esHoy
									? 'bg-primary-600 text-white font-bold hover:bg-primary-700'
									: cell.esDelMes
										? 'text-slate-800 hover:bg-slate-100'
										: 'text-slate-300 hover:bg-slate-50'}"
							aria-label={cell.fecha.toLocaleDateString('es-BO')}
						>
							{cell.fecha.getDate()}
						</button>
					{/each}
				</div>
			</div>

			<!-- Leyenda -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
				<h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Estados</h3>
				<div class="space-y-2 text-sm">
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 rounded-full bg-amber-500"></span>
						<span class="text-slate-700">Por iniciar</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 rounded-full bg-emerald-500"></span>
						<span class="text-slate-700">En ejecución</span>
					</div>
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 rounded-full bg-slate-400"></span>
						<span class="text-slate-700">Finalizados</span>
					</div>
				</div>
			</div>

			<!-- Resumen -->
			<div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
				<h3 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Total de programas</h3>
				<div class="text-3xl font-bold text-slate-900">{items.length}</div>
				<p class="text-xs text-slate-500 mt-1">
					Mostrando {semanaActual.reduce((acc, d) => acc + d.items.length, 0)} eventos esta semana
				</p>
			</div>
		</aside>

		<!-- Grid principal -->
		<main class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
			{#if loading}
				<div class="text-center py-20 text-slate-500">
					<div class="animate-pulse text-4xl mb-2">⏳</div>
					Cargando programas...
				</div>
			{:else}
				<!-- Encabezado días -->
				<div class="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
					{#each semanaActual as dia, i (dia.key)}
						<div class="text-center py-3 border-r last:border-r-0 border-slate-200 {dia.esHoy ? 'bg-primary-50' : ''}">
							<div class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
								{diasSemana[i]}
							</div>
							<div class="text-2xl font-bold mt-0.5 {dia.esHoy ? 'text-primary-600' : 'text-slate-800'}">
								{dia.fecha.getDate()}
							</div>
						</div>
					{/each}
				</div>

				<!-- Celdas -->
				<div class="grid grid-cols-7 min-h-[500px] divide-x divide-slate-200">
					{#each semanaActual as dia (dia.key)}
						<div class="p-2 space-y-1.5 overflow-y-auto {dia.esHoy ? 'bg-primary-50/30' : ''}">
							{#if dia.items.length === 0}
								<div class="text-[11px] text-slate-300 italic text-center mt-6">—</div>
							{:else}
								{#each dia.items as it (it.id)}
									<button
										type="button"
										onclick={() => abrirDetalle(it)}
										class="block w-full text-left text-[11px] p-2 rounded border-l-4 border border-slate-200 hover:shadow-sm transition cursor-pointer {colorPorTipo(it.tipo_curso)}"
									>
										<div class="flex items-center gap-1 mb-0.5">
											<span class="w-1.5 h-1.5 rounded-full {dotColor(it.estado_calculado)}"></span>
											<span class="font-bold text-slate-800 truncate" title={it.nombre_programa}>
												{it.nombre_programa}
											</span>
										</div>
										<div class="flex items-center gap-1 text-[9px] text-slate-600">
											<span class="font-mono">{it.codigo}</span>
											<span>·</span>
											<span class="capitalize">{it.tipo_curso}</span>
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</main>
	</div>
</div>

<!-- Modal de detalle del programa -->
{#if selectedPrograma}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={cerrarDetalle}
		onkeydown={(e) => e.key === 'Escape' && cerrarDetalle()}
		tabindex="-1"
	>
		<div
			class="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
			role="document"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header con color por tipo -->
			<div class="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2 mb-1.5">
						<BadgeEstado estado={selectedPrograma.estado_calculado} size="sm" />
						<span class="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
							{selectedPrograma.codigo}
						</span>
					</div>
					<h2 class="text-base font-bold text-slate-900 leading-tight">
						{selectedPrograma.nombre_programa}
					</h2>
					<p class="text-xs text-slate-500 mt-1 capitalize">
						{selectedPrograma.modalidad} · {selectedPrograma.tipo_curso} · {selectedPrograma.cantidad_modulos} módulo{selectedPrograma.cantidad_modulos === 1 ? '' : 's'}
					</p>
				</div>
				<button
					type="button"
					onclick={cerrarDetalle}
					class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 shrink-0"
					aria-label="Cerrar"
				>
					✕
				</button>
			</div>

			<!-- Body -->
			<div class="px-6 py-4 space-y-3 text-sm">
				<div class="flex items-center justify-between py-2 border-b border-slate-100">
					<span class="text-slate-500">Inicio</span>
					<span class="font-semibold text-slate-800">{formatDateLargo(selectedPrograma.fecha_inicio)}</span>
				</div>
				<div class="flex items-center justify-between py-2 border-b border-slate-100">
					<span class="text-slate-500">Fin</span>
					<span class="font-semibold text-slate-800">{formatDateLargo(selectedPrograma.fecha_fin)}</span>
				</div>
				<div class="flex items-center justify-between py-2 border-b border-slate-100">
					<span class="text-slate-500">Inscritos</span>
					<span class="font-semibold text-slate-800">{selectedPrograma.cantidad_inscritos}</span>
				</div>
				<div class="flex items-center justify-between py-2 border-b border-slate-100">
					<span class="text-slate-500">Costo colegiatura</span>
					<span class="font-bold text-primary-700">{formatMoney(selectedPrograma.costo_total_interno)}</span>
				</div>
				{#if selectedPrograma.matricula_interno > 0}
					<div class="flex items-center justify-between py-2 border-b border-slate-100">
						<span class="text-slate-500">+ Matrícula</span>
						<span class="font-semibold text-slate-800">{formatMoney(selectedPrograma.matricula_interno)}</span>
					</div>
				{/if}
			</div>

			<!-- Footer con acción -->
			<div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={cerrarDetalle}
					class="px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 rounded-md transition"
				>
					Cerrar
				</button>
				<button
					type="button"
					onclick={handleInscribirme}
					class="px-4 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-md shadow-sm transition"
				>
					Inscribirme
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- F-CATALOGO-INSCRIPCION (2026-07-30): modal de formulario de inscripción oficial -->
<FormularioInscripcionModal
	isOpen={inscriptionOpen}
	onClose={closeInscription}
	programa={selectedPrograma?.nombre_programa ?? ''}
	student={currentUser}
/>
