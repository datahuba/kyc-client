<script lang="ts">
	/**
	 * /app/bug-reports — Reportar un Error
	 *
	 * F-REPORTE-BUGS (2026-08-17, Kevin): "crear un nuevo modulo en el sidebar
	 * para todos los perfiles excepto docentes y estudiantes, solo perfiles
	 * adm, que puedan reportar bugs o errores con un detalle del error mas una
	 * captura o imagen cargada o pdf".
	 *
	 * Quién ve qué (lo impone el backend, acá solo se refleja en la UI):
	 * cualquiera del staff reporta y ve SUS reportes; admin/superadmin ven los
	 * de todos y les cambian el estado; borrar es solo de superadmin.
	 *
	 * Detalle de diseño: al abrir el formulario se precarga el campo "página"
	 * con la última ruta visitada. Es el dato que más sirve para ubicar el
	 * problema y el que nadie se acuerda de escribir.
	 */
	import { onMount } from 'svelte';
	import { page as pageStore } from '$app/stores';
	import {
		bugReportService,
		MAX_ADJUNTOS,
		type BugReport,
		type BugEstado,
		type BugSeveridad,
		type BugStats
	} from '$lib/services/bug-report.service';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import { ExclamationIcon, PlusIcon, TrashIcon, PhotographIcon } from '$lib/icons/outline';

	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import Pagination from '$lib/components/ui/pagination.svelte';

	// ---------- Estado de la lista ----------
	let reportes = $state<BugReport[]>([]);
	let stats = $state<BugStats | null>(null);
	let loading = $state(true);
	let paginaActual = $state(1);
	let totalPaginas = $state(1);
	let totalItems = $state(0);
	const POR_PAGINA = 20;

	let filtroEstado = $state('');
	let filtroSeveridad = $state('');
	let soloMios = $state(false);

	// ---------- Estado del formulario ----------
	let modalNuevoAbierto = $state(false);
	let enviando = $state(false);
	let fTitulo = $state('');
	let fDescripcion = $state('');
	let fSeveridad = $state<BugSeveridad>('media');
	let fModulo = $state('');
	let fPagina = $state('');
	let fArchivos = $state<File[]>([]);
	let inputArchivos = $state<HTMLInputElement | null>(null);

	// ---------- Estado del panel de detalle / gestión ----------
	let detalleAbierto = $state<BugReport | null>(null);
	let nuevoEstado = $state<BugEstado>('en_revision');
	let respuesta = $state('');
	let guardandoEstado = $state(false);

	const rol = $derived($userStore?.user?.rol || $userStore?.role || '');
	const puedeGestionar = $derived(rol === 'admin' || rol === 'superadmin');
	const puedeBorrar = $derived(rol === 'superadmin');

	// La última ruta visitada antes de entrar acá. Sirve para precargar el
	// campo "página" del formulario.
	let ultimaRuta = $state('');

	const SEVERIDADES: { valor: BugSeveridad; etiqueta: string; ayuda: string }[] = [
		{ valor: 'critica', etiqueta: 'Crítica', ayuda: 'Bloquea el trabajo o afecta dinero' },
		{ valor: 'alta', etiqueta: 'Alta', ayuda: 'Falla importante, hay forma de rodearla' },
		{ valor: 'media', etiqueta: 'Media', ayuda: 'Molesta, pero se puede seguir' },
		{ valor: 'baja', etiqueta: 'Baja', ayuda: 'Detalle visual o de texto' }
	];

	const MODULOS = [
		'Pagos / Finanzas',
		'Inscripciones',
		'Estudiantes',
		'Programas y Módulos',
		'Notas y Calificaciones',
		'Certificados',
		'Descuentos y Becas',
		'Solicitudes',
		'Aula Virtual',
		'Usuarios y Accesos',
		'Otro'
	];

	const ESTADOS: { valor: BugEstado; etiqueta: string }[] = [
		{ valor: 'abierto', etiqueta: 'Abierto' },
		{ valor: 'en_revision', etiqueta: 'En revisión' },
		{ valor: 'resuelto', etiqueta: 'Resuelto' },
		{ valor: 'descartado', etiqueta: 'Descartado' }
	];

	// Tope por archivo. Más que esto casi siempre es un video o un PDF
	// escaneado sin comprimir, y hace fallar la subida sin explicar por qué.
	const MAX_MB = 10;

	function claseSeveridad(s: string): string {
		if (s === 'critica') return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
		if (s === 'alta') return 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300';
		if (s === 'baja') return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
		return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
	}

	function claseEstado(e: string): string {
		if (e === 'resuelto') return 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300';
		if (e === 'descartado') return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
		if (e === 'en_revision') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
		return 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300';
	}

	function etiquetaEstado(e: string): string {
		return ESTADOS.find((x) => x.valor === e)?.etiqueta ?? e;
	}

	/**
	 * El backend persiste en UTC. Si el ISO viene sin zona, el navegador lo
	 * interpretaría como hora local y mostraría 4 horas de más. Se normaliza
	 * antes de formatear (regla del proyecto).
	 */
	function fechaHora(iso: string | null): string {
		if (!iso) return '—';
		let s = iso.replace(' ', 'T').replace(/\.\d+/, '');
		if (!/[Zz]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
		const d = new Date(s);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleString('es-BO', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function esImagen(url: string): boolean {
		return /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(url);
	}

	function nombreAdjunto(url: string, i: number): string {
		try {
			const limpio = url.split('?')[0];
			const base = limpio.substring(limpio.lastIndexOf('/') + 1);
			return base || `Adjunto ${i + 1}`;
		} catch {
			return `Adjunto ${i + 1}`;
		}
	}

	async function cargar() {
		loading = true;
		try {
			const [lista, s] = await Promise.all([
				bugReportService.listar(paginaActual, POR_PAGINA, {
					estado: filtroEstado || undefined,
					severidad: filtroSeveridad || undefined,
					solo_mios: soloMios || undefined
				}),
				bugReportService.stats()
			]);
			reportes = lista.items ?? lista.data ?? [];
			totalPaginas = lista.meta?.totalPages || 1;
			totalItems = lista.meta?.totalItems || 0;
			stats = s;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudieron cargar los reportes');
			reportes = [];
		} finally {
			loading = false;
		}
	}

	function aplicarFiltros() {
		paginaActual = 1;
		cargar();
	}

	function irAPagina(p: number) {
		paginaActual = p;
		cargar();
	}

	function abrirNuevo() {
		fTitulo = '';
		fDescripcion = '';
		fSeveridad = 'media';
		fModulo = '';
		fPagina = ultimaRuta;
		fArchivos = [];
		if (inputArchivos) inputArchivos.value = '';
		modalNuevoAbierto = true;
	}

	function elegirArchivos(ev: Event) {
		const input = ev.target as HTMLInputElement;
		const elegidos = Array.from(input.files ?? []);

		const pesados = elegidos.filter((f) => f.size > MAX_MB * 1024 * 1024);
		if (pesados.length) {
			alert('error', `Estos archivos pasan los ${MAX_MB} MB: ${pesados.map((f) => f.name).join(', ')}`);
		}
		const validos = elegidos.filter((f) => f.size <= MAX_MB * 1024 * 1024);

		// Se construye la lista completa y se asigna una sola vez.
		const combinados = [...fArchivos, ...validos];
		if (combinados.length > MAX_ADJUNTOS) {
			alert('warning', `Se admiten hasta ${MAX_ADJUNTOS} adjuntos. Se tomaron los primeros.`);
		}
		fArchivos = combinados.slice(0, MAX_ADJUNTOS);
		input.value = '';
	}

	function quitarArchivo(idx: number) {
		fArchivos = fArchivos.filter((_, i) => i !== idx);
	}

	async function enviar() {
		if (fTitulo.trim().length < 5) {
			alert('error', 'El título necesita al menos 5 caracteres.');
			return;
		}
		if (fDescripcion.trim().length < 10) {
			alert('error', 'Contá un poco más: qué esperabas que pasara y qué pasó.');
			return;
		}
		enviando = true;
		try {
			const creado = await bugReportService.crear({
				titulo: fTitulo.trim(),
				descripcion: fDescripcion.trim(),
				severidad: fSeveridad,
				pagina: fPagina.trim() || undefined,
				modulo: fModulo || undefined,
				archivos: fArchivos
			});
			if (creado.adjuntos_fallidos?.length) {
				alert(
					'warning',
					`El reporte se guardó, pero no se pudieron subir: ${creado.adjuntos_fallidos.join(', ')}`
				);
			} else {
				alert('success', 'Reporte enviado. Gracias por tomarte el trabajo de describirlo.');
			}
			modalNuevoAbierto = false;
			paginaActual = 1;
			await cargar();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar el reporte');
		} finally {
			enviando = false;
		}
	}

	function abrirDetalle(r: BugReport) {
		detalleAbierto = r;
		nuevoEstado = r.estado;
		respuesta = r.respuesta ?? '';
	}

	async function guardarEstado() {
		if (!detalleAbierto) return;
		if ((nuevoEstado === 'resuelto' || nuevoEstado === 'descartado') && !respuesta.trim()) {
			alert('error', 'Al resolver o descartar hay que explicar qué se hizo.');
			return;
		}
		guardandoEstado = true;
		try {
			await bugReportService.cambiarEstado(detalleAbierto.id, nuevoEstado, respuesta.trim() || undefined);
			alert('success', 'Estado actualizado');
			detalleAbierto = null;
			await cargar();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo actualizar el estado');
		} finally {
			guardandoEstado = false;
		}
	}

	async function eliminar(r: BugReport) {
		if (!confirm(`¿Eliminar definitivamente el reporte "${r.titulo}"?`)) return;
		try {
			await bugReportService.eliminar(r.id);
			alert('success', 'Reporte eliminado');
			if (detalleAbierto?.id === r.id) detalleAbierto = null;
			await cargar();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo eliminar el reporte');
		}
	}

	onMount(() => {
		// Ruta previa: sirve para precargar "página" en el formulario.
		try {
			const ref = document.referrer;
			if (ref) {
				const u = new URL(ref);
				if (u.origin === $pageStore.url.origin && u.pathname !== '/app/bug-reports') {
					ultimaRuta = u.pathname + u.search;
				}
			}
		} catch {
			ultimaRuta = '';
		}
		cargar();
	});
</script>

<svelte:head>
	<title>Reportar un Error · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
		<header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-primary-700 sm:text-3xl dark:text-primary-300">
					Reportar un Error
				</h1>
				<p class="mt-1 max-w-2xl text-sm text-light-four dark:text-dark-four">
					Si algo no funciona como esperabas, contalo acá con una captura. Queda
					registrado con tu nombre y la pantalla donde pasó, en vez de perderse en un
					mensaje suelto.
				</p>
			</div>
			<Button variant="primary" size="md" onclick={abrirNuevo}>
				<PlusIcon class="mr-2 size-4" />
				Reportar un error
			</Button>
		</header>

		{#if stats}
			<div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
				{#each ESTADOS as e (e.valor)}
					<button
						type="button"
						onclick={() => {
							filtroEstado = filtroEstado === e.valor ? '' : e.valor;
							aplicarFiltros();
						}}
						class={`rounded-lg border p-3 text-left transition-colors ${
							filtroEstado === e.valor
								? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/30'
								: 'border-gray-200 bg-white hover:border-primary-300 dark:border-gray-800 dark:bg-dark-secondary'
						}`}
					>
						<p class="text-xs font-medium text-light-four dark:text-dark-four">{e.etiqueta}</p>
						<p class="mt-0.5 text-xl font-bold text-gray-800 dark:text-gray-100">
							{stats[e.valor] ?? 0}
						</p>
					</button>
				{/each}
			</div>
		{/if}

		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<select
				bind:value={filtroSeveridad}
				onchange={aplicarFiltros}
				aria-label="Filtrar por severidad"
				class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
			>
				<option value="">Todas las severidades</option>
				{#each SEVERIDADES as s (s.valor)}
					<option value={s.valor}>{s.etiqueta}</option>
				{/each}
			</select>

			{#if puedeGestionar}
				<label class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
					<input
						type="checkbox"
						bind:checked={soloMios}
						onchange={aplicarFiltros}
						class="size-4 rounded border-gray-300 text-primary-600"
					/>
					Ver solo los míos
				</label>
			{/if}

			{#if filtroEstado || filtroSeveridad || soloMios}
				<button
					type="button"
					class="text-sm font-medium text-primary-600 hover:underline dark:text-primary-400"
					onclick={() => {
						filtroEstado = '';
						filtroSeveridad = '';
						soloMios = false;
						aplicarFiltros();
					}}
				>
					Limpiar filtros
				</button>
			{/if}

			<span class="text-sm text-light-four sm:ml-auto dark:text-dark-four">
				{totalItems}
				{totalItems === 1 ? 'reporte' : 'reportes'}
			</span>
		</div>

		{#if loading}
			<div class="space-y-3">
				{#each Array(4) as _, i (i)}
					<div class="h-24 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
				{/each}
			</div>
		{:else if reportes.length === 0}
			<EmptyState
				title={filtroEstado || filtroSeveridad || soloMios
					? 'Ningún reporte con esos filtros'
					: 'Todavía no hay reportes'}
				description={filtroEstado || filtroSeveridad || soloMios
					? 'Probá quitando algún filtro.'
					: 'Cuando encuentres algo que no funciona, reportalo desde el botón de arriba.'}
				icon="inbox"
				variant="bordered"
			/>
		{:else}
			<ul class="space-y-3">
				{#each reportes as r (r.id)}
					<li>
						<button
							type="button"
							onclick={() => abrirDetalle(r)}
							class="w-full rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors hover:border-primary-300 dark:border-gray-800 dark:bg-dark-secondary dark:hover:border-primary-600"
						>
							<div class="flex flex-wrap items-start justify-between gap-2">
								<h2 class="font-semibold text-gray-800 dark:text-gray-100">{r.titulo}</h2>
								<div class="flex shrink-0 gap-1.5">
									<span
										class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${claseSeveridad(r.severidad)}`}
									>
										{SEVERIDADES.find((s) => s.valor === r.severidad)?.etiqueta ?? r.severidad}
									</span>
									<span
										class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${claseEstado(r.estado)}`}
									>
										{etiquetaEstado(r.estado)}
									</span>
								</div>
							</div>
							<p class="mt-1.5 line-clamp-2 text-sm text-light-four dark:text-dark-four">
								{r.descripcion}
							</p>
							<div
								class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"
							>
								<span>{r.reportado_por_nombre} · {r.reportado_por_rol}</span>
								<span>{fechaHora(r.created_at)}</span>
								{#if r.modulo}<span class="font-medium">{r.modulo}</span>{/if}
								{#if r.adjuntos.length}
									<span class="inline-flex items-center gap-1">
										<PhotographIcon class="size-3.5" />
										{r.adjuntos.length}
									</span>
								{/if}
							</div>
						</button>
					</li>
				{/each}
			</ul>

			{#if totalPaginas > 1}
				<div class="mt-5">
					<Pagination
						currentPage={paginaActual}
						totalPages={totalPaginas}
						{totalItems}
						limit={POR_PAGINA}
						onPageChange={irAPagina}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>

<!-- ============ Modal: nuevo reporte ============ -->
<Modal
	isOpen={modalNuevoAbierto}
	title="Reportar un error"
	onClose={() => (modalNuevoAbierto = false)}
	maxWidth="sm:max-w-2xl"
>
	<div class="space-y-4">
		<div>
			<label
				for="bug-titulo"
				class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				¿Qué pasó? <span class="text-light-error">*</span>
			</label>
			<input
				id="bug-titulo"
				type="text"
				bind:value={fTitulo}
				maxlength="150"
				placeholder="Ej: El total de Cuentas por Cobrar no coincide con el del Dashboard"
				class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
			/>
		</div>

		<div>
			<label
				for="bug-descripcion"
				class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Contalo con detalle <span class="text-light-error">*</span>
			</label>
			<textarea
				id="bug-descripcion"
				bind:value={fDescripcion}
				rows="5"
				maxlength="4000"
				placeholder="Qué esperabas que pasara, qué pasó en su lugar, y los pasos para verlo de nuevo."
				class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
			></textarea>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				{fDescripcion.length}/4000
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label
					for="bug-severidad"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					¿Qué tan grave es?
				</label>
				<select
					id="bug-severidad"
					bind:value={fSeveridad}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
				>
					{#each SEVERIDADES as s (s.valor)}
						<option value={s.valor}>{s.etiqueta} — {s.ayuda}</option>
					{/each}
				</select>
			</div>

			<div>
				<label
					for="bug-modulo"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					¿En qué parte del sistema?
				</label>
				<select
					id="bug-modulo"
					bind:value={fModulo}
					class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
				>
					<option value="">Sin especificar</option>
					{#each MODULOS as m (m)}
						<option value={m}>{m}</option>
					{/each}
				</select>
			</div>
		</div>

		<div>
			<label
				for="bug-pagina"
				class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Pantalla donde pasó
			</label>
			<input
				id="bug-pagina"
				type="text"
				bind:value={fPagina}
				maxlength="500"
				placeholder="/app/payments"
				class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
			/>
			{#if ultimaRuta && fPagina === ultimaRuta}
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Se cargó sola desde la pantalla anterior. Cambiala si el problema fue en otra.
				</p>
			{/if}
		</div>

		<div>
			<p class="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
				Capturas o PDF <span class="font-normal text-gray-500">(hasta {MAX_ADJUNTOS})</span>
			</p>
			<input
				bind:this={inputArchivos}
				type="file"
				multiple
				accept="image/*,application/pdf"
				onchange={elegirArchivos}
				disabled={fArchivos.length >= MAX_ADJUNTOS}
				aria-label="Adjuntar capturas o PDF"
				class="block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-primary-700 hover:file:bg-primary-100 dark:text-gray-300 dark:file:bg-primary-900/40 dark:file:text-primary-300"
			/>
			{#if fArchivos.length}
				<ul class="mt-2 space-y-1">
					{#each fArchivos as a, i (a.name + i)}
						<li
							class="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5 text-sm dark:bg-gray-800"
						>
							<span class="truncate text-gray-700 dark:text-gray-300">{a.name}</span>
							<button
								type="button"
								onclick={() => quitarArchivo(i)}
								aria-label={`Quitar ${a.name}`}
								class="ml-2 shrink-0 text-gray-400 hover:text-red-600"
							>
								<TrashIcon class="size-4" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		<div class="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
			<Button variant="secondary" onclick={() => (modalNuevoAbierto = false)} disabled={enviando}>
				Cancelar
			</Button>
			<Button variant="primary" onclick={enviar} disabled={enviando} loading={enviando}>
				Enviar reporte
			</Button>
		</div>
	</div>
</Modal>

<!-- ============ Modal: detalle ============ -->
<Modal
	isOpen={detalleAbierto !== null}
	title={detalleAbierto?.titulo ?? 'Detalle'}
	onClose={() => (detalleAbierto = null)}
	maxWidth="sm:max-w-2xl"
>
	{#if detalleAbierto}
		<div class="space-y-4">
			<div class="flex flex-wrap gap-1.5">
				<span
					class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${claseSeveridad(detalleAbierto.severidad)}`}
				>
					{SEVERIDADES.find((s) => s.valor === detalleAbierto?.severidad)?.etiqueta ??
						detalleAbierto.severidad}
				</span>
				<span
					class={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${claseEstado(detalleAbierto.estado)}`}
				>
					{etiquetaEstado(detalleAbierto.estado)}
				</span>
				{#if detalleAbierto.modulo}
					<span
						class="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						{detalleAbierto.modulo}
					</span>
				{/if}
			</div>

			<p class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
				{detalleAbierto.descripcion}
			</p>

			<dl class="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-xs text-gray-500 dark:text-gray-400">Reportado por</dt>
					<dd class="text-gray-800 dark:text-gray-200">
						{detalleAbierto.reportado_por_nombre} ({detalleAbierto.reportado_por_rol})
					</dd>
				</div>
				<div>
					<dt class="text-xs text-gray-500 dark:text-gray-400">Fecha</dt>
					<dd class="text-gray-800 dark:text-gray-200">{fechaHora(detalleAbierto.created_at)}</dd>
				</div>
				{#if detalleAbierto.pagina}
					<div class="sm:col-span-2">
						<dt class="text-xs text-gray-500 dark:text-gray-400">Pantalla</dt>
						<dd class="break-all text-gray-800 dark:text-gray-200">{detalleAbierto.pagina}</dd>
					</div>
				{/if}
			</dl>

			{#if detalleAbierto.adjuntos.length}
				<div>
					<p class="mb-2 text-xs text-gray-500 dark:text-gray-400">Evidencia adjunta</p>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
						{#each detalleAbierto.adjuntos as url, i (url)}
							<a
								href={url}
								target="_blank"
								rel="noopener noreferrer"
								class="block overflow-hidden rounded-md border border-gray-200 transition-colors hover:border-primary-400 dark:border-gray-700"
							>
								{#if esImagen(url)}
									<img
										src={url}
										alt={`Adjunto ${i + 1}`}
										loading="lazy"
										class="h-24 w-full bg-gray-50 object-cover dark:bg-gray-800"
									/>
								{:else}
									<span
										class="flex h-24 w-full items-center justify-center bg-gray-50 px-2 text-center text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300"
									>
										{nombreAdjunto(url, i)}
									</span>
								{/if}
							</a>
						{/each}
					</div>
				</div>
			{/if}

			{#if detalleAbierto.respuesta}
				<div class="rounded-md border-l-4 border-primary-400 bg-primary-50 p-3 dark:bg-primary-900/20">
					<p class="text-xs font-semibold text-primary-800 dark:text-primary-300">
						Respuesta de {detalleAbierto.atendido_por ?? 'el equipo'} · {fechaHora(
							detalleAbierto.fecha_atencion
						)}
					</p>
					<p class="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
						{detalleAbierto.respuesta}
					</p>
				</div>
			{/if}

			{#if puedeGestionar}
				<div class="space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
					<p class="text-sm font-semibold text-gray-800 dark:text-gray-200">Gestionar</p>
					<div>
						<label
							for="bug-nuevo-estado"
							class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Estado
						</label>
						<select
							id="bug-nuevo-estado"
							bind:value={nuevoEstado}
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
						>
							{#each ESTADOS as e (e.valor)}
								<option value={e.valor}>{e.etiqueta}</option>
							{/each}
						</select>
					</div>
					<div>
						<label
							for="bug-respuesta"
							class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
						>
							Respuesta
							{#if nuevoEstado === 'resuelto' || nuevoEstado === 'descartado'}
								<span class="text-light-error">*</span>
							{/if}
						</label>
						<textarea
							id="bug-respuesta"
							bind:value={respuesta}
							rows="3"
							maxlength="2000"
							placeholder="Qué se hizo, o por qué se descarta."
							class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-dark-secondary dark:text-gray-100"
						></textarea>
					</div>
					<div class="flex flex-wrap justify-end gap-2">
						{#if puedeBorrar}
							<Button
								variant="destructive"
								onclick={() => detalleAbierto && eliminar(detalleAbierto)}
								disabled={guardandoEstado}
							>
								<TrashIcon class="mr-2 size-4" />
								Eliminar
							</Button>
						{/if}
						<Button
							variant="primary"
							onclick={guardarEstado}
							disabled={guardandoEstado}
							loading={guardandoEstado}
						>
							Guardar
						</Button>
					</div>
				</div>
			{:else}
				<div class="flex items-start gap-2 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
					<ExclamationIcon class="mt-0.5 size-4 shrink-0 text-gray-400" />
					<p class="text-xs text-gray-600 dark:text-gray-400">
						El seguimiento lo hace el equipo de administración. Vas a ver la respuesta acá
						mismo cuando lo atiendan.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</Modal>
