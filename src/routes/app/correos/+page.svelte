<script lang="ts">
	/**
	 * /app/correos — Registro de Correos
	 *
	 * F-CORREOS-REGISTRO (2026-08-17, Kevin): "ver cuáles son las que llegan a
	 * los usuarios". Antes no había forma: el envío devolvía un booleano y los
	 * errores iban a la consola del servidor.
	 *
	 * La pantalla resuelve tres preguntas concretas:
	 *   1. ¿Cuánto cupo queda hoy? (Brevo admite 300/día y los estudiantes ya
	 *      son 305, así que un comunicado masivo agota el día entero)
	 *   2. ¿Le llegó el correo a esta persona?
	 *   3. ¿Qué quedó esperando y por qué?
	 */
	import { onMount } from 'svelte';
	import {
		emailLogService,
		ETIQUETA_TIPO,
		type EmailLog,
		type EmailStats
	} from '$lib/services/email-log.service';
	import { alert } from '$lib/utils';
	import { RefreshIcon, MailIcon, SearchIcon } from '$lib/icons/outline';

	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import Pagination from '$lib/components/ui/pagination.svelte';

	let logs = $state<EmailLog[]>([]);
	let stats = $state<EmailStats | null>(null);
	let loading = $state(true);
	let procesando = $state(false);

	let paginaActual = $state(1);
	let totalPaginas = $state(1);
	let totalItems = $state(0);
	const POR_PAGINA = 25;

	let filtroEstado = $state('');
	let filtroPrioridad = $state('');
	let busqueda = $state('');
	// Se separa lo tipeado de lo aplicado para no consultar en cada tecla.
	let busquedaAplicada = $state('');
	let temporizador: ReturnType<typeof setTimeout> | null = null;

	let detalle = $state<EmailLog | null>(null);
	let cargandoDetalle = $state(false);

	const ESTADOS = [
		{ valor: 'enviado', etiqueta: 'Enviado' },
		{ valor: 'encolado', etiqueta: 'Esperando cupo' },
		{ valor: 'fallido', etiqueta: 'Falló' },
		{ valor: 'descartado', etiqueta: 'Descartado' }
	];

	function claseEstado(e: string): string {
		if (e === 'enviado')
			return 'bg-light-success/10 text-light-success dark:bg-dark-success/20 dark:text-dark-success';
		if (e === 'encolado')
			return 'bg-light-warning/15 text-amber-800 dark:bg-light-warning/20 dark:text-amber-300';
		if (e === 'fallido')
			return 'bg-light-error/10 text-light-error dark:bg-dark-error/20 dark:text-dark-error';
		return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
	}

	function etiquetaEstado(e: string): string {
		return ESTADOS.find((x) => x.valor === e)?.etiqueta ?? e;
	}

	function clasePrioridad(p: string): string {
		if (p === 'critica')
			return 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300';
		if (p === 'alta') return 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300';
		return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
	}

	/**
	 * El backend persiste en UTC. Sin normalizar, el navegador interpreta el ISO
	 * sin zona como hora local y muestra 4 horas de más (regla del proyecto).
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
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function etiquetaTipo(t: string): string {
		return ETIQUETA_TIPO[t] ?? t;
	}

	async function cargar() {
		loading = true;
		try {
			const [lista, s] = await Promise.all([
				emailLogService.listar(paginaActual, POR_PAGINA, {
					estado: filtroEstado || undefined,
					prioridad: filtroPrioridad || undefined,
					destinatario: busquedaAplicada || undefined
				}),
				emailLogService.stats()
			]);
			logs = lista.items ?? lista.data ?? [];
			totalPaginas = lista.meta?.totalPages || 1;
			totalItems = lista.meta?.totalItems || 0;
			stats = s;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar el registro de correos');
			logs = [];
		} finally {
			loading = false;
		}
	}

	function aplicarFiltros() {
		paginaActual = 1;
		cargar();
	}

	function onBuscar() {
		if (temporizador) clearTimeout(temporizador);
		temporizador = setTimeout(() => {
			busquedaAplicada = busqueda.trim();
			aplicarFiltros();
		}, 300);
	}

	async function procesarCola() {
		if (procesando) return;
		procesando = true;
		try {
			const r = await emailLogService.procesarCola(100);
			if (r.procesados === 0) {
				alert('info', 'No había correos pendientes.');
			} else {
				const partes = [`${r.enviados} enviados`];
				if (r.sin_cupo) partes.push(`${r.sin_cupo} siguen sin cupo`);
				if (r.fallidos) partes.push(`${r.fallidos} fallaron`);
				alert('success', `Cola procesada: ${partes.join(', ')}.`);
			}
			await cargar();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo procesar la cola');
		} finally {
			procesando = false;
		}
	}

	async function abrirDetalle(l: EmailLog) {
		detalle = l;
		cargandoDetalle = true;
		try {
			detalle = await emailLogService.detalle(l.id);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar el detalle');
		} finally {
			cargandoDetalle = false;
		}
	}

	onMount(cargar);
</script>

<svelte:head>
	<title>Registro de Correos · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
		<header class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
			<div>
				<h1 class="text-2xl font-bold text-primary-700 sm:text-3xl dark:text-primary-300">
					Registro de Correos
				</h1>
				<p class="mt-1 max-w-2xl text-sm text-light-four dark:text-dark-four">
					Qué se envió, a quién y si llegó. Antes no quedaba rastro de ningún correo.
				</p>
			</div>
			<div class="flex gap-2">
				<Button variant="secondary" size="md" onclick={cargar} disabled={loading}>
					<RefreshIcon class="mr-2 size-4" />Actualizar
				</Button>
				<Button variant="primary" size="md" onclick={procesarCola} loading={procesando}>
					Procesar pendientes
				</Button>
			</div>
		</header>

		{#if stats}
			<!-- Cupo del día. Es lo primero que se mira: con 305 estudiantes y un
			     tope de 300, un comunicado masivo agota el día entero. -->
			<div class="mb-5 rounded-xl border border-gray-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<p class="text-xs font-semibold uppercase tracking-wider text-light-four dark:text-dark-four">
						Cupo de hoy
					</p>
					<p class="text-sm text-light-four dark:text-dark-four">
						<span class="font-bold text-gray-800 dark:text-gray-100">{stats.enviados_hoy}</span>
						de {stats.cuota_diaria} enviados
					</p>
				</div>

				<div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
					<div
						class="h-full rounded-full transition-all duration-500 {stats.disponible_resto === 0
							? 'bg-light-error dark:bg-dark-error'
							: 'bg-primary-600 dark:bg-primary-500'}"
						style="width: {Math.min(100, (stats.enviados_hoy / Math.max(1, stats.cuota_diaria)) * 100)}%"
					></div>
				</div>

				<div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div>
						<p class="text-[11px] text-light-four dark:text-dark-four">Quedan para credenciales</p>
						<p class="text-lg font-bold text-primary-700 dark:text-primary-300">
							{stats.disponible_criticos}
						</p>
					</div>
					<div>
						<p class="text-[11px] text-light-four dark:text-dark-four">Quedan para el resto</p>
						<p class="text-lg font-bold text-gray-800 dark:text-gray-100">{stats.disponible_resto}</p>
					</div>
					<div>
						<p class="text-[11px] text-light-four dark:text-dark-four">Esperando cupo</p>
						<p class="text-lg font-bold text-amber-700 dark:text-amber-400">{stats.encolados}</p>
					</div>
					<div>
						<p class="text-[11px] text-light-four dark:text-dark-four">Fallidos</p>
						<p class="text-lg font-bold text-light-error dark:text-dark-error">{stats.fallidos}</p>
					</div>
				</div>

				<p class="mt-3 text-xs text-light-four dark:text-dark-four">
					Los correos con credenciales de acceso tienen {stats.cupo_reservado_criticos} lugares
					reservados que un envío masivo no puede consumir: sin ese correo el estudiante no
					puede entrar al sistema.
				</p>
			</div>
		{/if}

		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
			<div class="relative flex-1 sm:max-w-xs">
				<SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={busqueda}
					oninput={onBuscar}
					placeholder="Buscar por correo…"
					aria-label="Buscar por correo del destinatario"
					class="w-full rounded-md border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm text-gray-800 dark:border-dark-border dark:bg-dark-surface dark:text-gray-100"
				/>
			</div>

			<select
				bind:value={filtroEstado}
				onchange={aplicarFiltros}
				aria-label="Filtrar por estado"
				class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-dark-border dark:bg-dark-surface dark:text-gray-100"
			>
				<option value="">Todos los estados</option>
				{#each ESTADOS as e (e.valor)}
					<option value={e.valor}>{e.etiqueta}</option>
				{/each}
			</select>

			<select
				bind:value={filtroPrioridad}
				onchange={aplicarFiltros}
				aria-label="Filtrar por prioridad"
				class="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-dark-border dark:bg-dark-surface dark:text-gray-100"
			>
				<option value="">Todas las prioridades</option>
				<option value="critica">Críticos</option>
				<option value="alta">Alta</option>
				<option value="normal">Normal</option>
			</select>

			<span class="text-sm text-light-four sm:ml-auto dark:text-dark-four">
				{totalItems} {totalItems === 1 ? 'correo' : 'correos'}
			</span>
		</div>

		{#if loading}
			<div class="space-y-2">
				{#each Array(6) as _, i (i)}
					<div class="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
				{/each}
			</div>
		{:else if logs.length === 0}
			<EmptyState
				title={busquedaAplicada || filtroEstado || filtroPrioridad
					? 'Ningún correo con esos filtros'
					: 'Todavía no se envió ningún correo'}
				description={busquedaAplicada || filtroEstado || filtroPrioridad
					? 'Probá quitando algún filtro.'
					: 'Acá van a aparecer los correos a medida que el sistema los envíe.'}
				icon="inbox"
				variant="bordered"
			/>
		{:else}
			<ul class="space-y-2">
				{#each logs as l (l.id)}
					<li>
						<button
							type="button"
							onclick={() => abrirDetalle(l)}
							class="w-full rounded-lg border border-gray-200 bg-white p-3 text-left transition-colors hover:border-primary-300 dark:border-dark-border dark:bg-dark-surface dark:hover:border-primary-600"
						>
							<div class="flex flex-wrap items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
										{l.asunto}
									</p>
									<p class="mt-0.5 truncate text-xs text-light-four dark:text-dark-four">
										{l.destinatario_nombre ? `${l.destinatario_nombre} · ` : ''}{l.destinatario}
									</p>
								</div>
								<div class="flex shrink-0 flex-wrap gap-1.5">
									{#if l.prioridad === 'critica'}
										<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold {clasePrioridad(l.prioridad)}">
											Crítico
										</span>
									{/if}
									<span class="rounded-full px-2 py-0.5 text-[11px] font-semibold {claseEstado(l.estado)}">
										{etiquetaEstado(l.estado)}
									</span>
								</div>
							</div>
							<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
								<span>{etiquetaTipo(l.tipo)}</span>
								<span>{fechaHora(l.fecha_envio ?? l.created_at)}</span>
								{#if l.intentos > 1}<span>{l.intentos} intentos</span>{/if}
								{#if l.error}
									<span class="truncate text-light-error dark:text-dark-error" title={l.error}>
										{l.error}
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
						onPageChange={(p) => {
							paginaActual = p;
							cargar();
						}}
					/>
				</div>
			{/if}
		{/if}
	</div>
</div>

<Modal
	isOpen={detalle !== null}
	title={detalle?.asunto ?? 'Correo'}
	onClose={() => (detalle = null)}
	maxWidth="sm:max-w-3xl"
>
	{#if detalle}
		<div class="space-y-4">
			<dl class="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
				<div>
					<dt class="text-xs text-light-four dark:text-dark-four">Para</dt>
					<dd class="break-all text-gray-800 dark:text-gray-200">
						{detalle.destinatario_nombre ? `${detalle.destinatario_nombre} · ` : ''}{detalle.destinatario}
					</dd>
				</div>
				<div>
					<dt class="text-xs text-light-four dark:text-dark-four">Tipo</dt>
					<dd class="text-gray-800 dark:text-gray-200">{etiquetaTipo(detalle.tipo)}</dd>
				</div>
				<div>
					<dt class="text-xs text-light-four dark:text-dark-four">Estado</dt>
					<dd>
						<span class="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold {claseEstado(detalle.estado)}">
							{etiquetaEstado(detalle.estado)}
						</span>
					</dd>
				</div>
				<div>
					<dt class="text-xs text-light-four dark:text-dark-four">Enviado</dt>
					<dd class="text-gray-800 dark:text-gray-200">{fechaHora(detalle.fecha_envio)}</dd>
				</div>
			</dl>

			{#if detalle.error}
				<div class="rounded-md border-l-4 border-light-error bg-light-error/5 p-3">
					<p class="text-xs font-semibold text-light-error dark:text-dark-error">
						Último error ({detalle.intentos} {detalle.intentos === 1 ? 'intento' : 'intentos'})
					</p>
					<p class="mt-1 break-words text-sm text-gray-700 dark:text-gray-300">{detalle.error}</p>
				</div>
			{/if}

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-light-four dark:text-dark-four">
					Contenido enviado
				</p>
				{#if cargandoDetalle}
					<div class="h-40 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"></div>
				{:else if detalle.cuerpo_html}
					<!-- En un iframe aislado: el HTML del correo trae sus propios
					     estilos y, suelto en la página, los pisaría. `sandbox` sin
					     allow-scripts lo deja inerte. -->
					<iframe
						title="Contenido del correo"
						sandbox=""
						srcdoc={detalle.cuerpo_html}
						class="h-96 w-full rounded-lg border border-gray-200 bg-white dark:border-dark-border"
					></iframe>
				{:else}
					<p class="text-sm italic text-light-four dark:text-dark-four">
						No se guardó el contenido de este correo.
					</p>
				{/if}
			</div>

			<div class="flex justify-end border-t border-gray-200 pt-4 dark:border-dark-border">
				<Button variant="secondary" onclick={() => (detalle = null)}>Cerrar</Button>
			</div>
		</div>
	{/if}
</Modal>
