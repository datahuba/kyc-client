<script lang="ts">
	/**
	 * ComunicadoPopup.svelte
	 * ======================
	 * US-003 (2026-08-03): Pop-up de comunicados para el estudiante.
	 *
	 * - Carga los comunicados pendientes al montar
	 * - Muestra uno a la vez (carrusel con "Siguiente" / "Saltar")
	 * - Marca como visto al hacer click en "Entendido"
	 * - Se cierra al hacer click fuera o Escape
	 * - Si no hay pendientes, no se muestra nada
	 */
	import { onMount } from 'svelte';
	import { comunicadosService, type ComunicadoEstudiante } from '$lib/services/comunicados.service';
	import { ExclamationIcon, XIcon, ChevronRightIcon } from '$lib/icons/outline';
	import ExclamationCircleSolid from '$lib/icons/solid/exclamationCircleIcon.svelte';

	let pendientes = $state<ComunicadoEstudiante[]>([]);
	let indiceActual = $state(0);
	let cargando = $state(false);
	let visible = $state(false);
	let cerrando = $state(false);

	const comActual = $derived(pendientes[indiceActual]);

	onMount(async () => {
		await cargar();
		if (pendientes.length > 0) {
			visible = true;
		}
	});

	async function cargar() {
		cargando = true;
		try {
			const res = await comunicadosService.pendientes();
			pendientes = res.comunicados;
		} catch (e) {
			console.error('Error cargando comunicados pendientes:', e);
			pendientes = [];
		} finally {
			cargando = false;
		}
	}

	async function marcarVistoYAvanzar() {
		const com = comActual;
		if (!com) return;
		try {
			await comunicadosService.marcarVisto(com.id);
		} catch (e) {
			console.error('Error marcando como visto:', e);
		}
		avanzar();
	}

	function saltar() {
		// No marca como visto, solo cierra este. Pero al recargar la
		// página volverá a aparecer. Útil para "lo leo después".
		avanzar();
	}

	function avanzar() {
		if (indiceActual < pendientes.length - 1) {
			indiceActual++;
		} else {
			cerrar();
		}
	}

	function cerrar() {
		cerrando = true;
		setTimeout(() => {
			visible = false;
			cerrando = false;
		}, 150);
	}

	function onKeydown(e: KeyboardEvent) {
		if (!visible) return;
		if (e.key === 'Escape') {
			saltar();
		}
	}

	// Renderizar el contenido del comunicado.
	// Seguridad: escapamos el HTML y preservamos saltos de línea.
	function escapeAndPreserve(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	const contenidoSeguro = $derived(comActual ? escapeAndPreserve(comActual.contenido) : '');
</script>

<svelte:window onkeydown={onKeydown} />

{#if visible && comActual}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-150 {cerrando ? 'opacity-0' : 'opacity-100'}"
		role="dialog"
		aria-modal="true"
		aria-labelledby="comunicado-titulo"
		onclick={(e) => { if (e.target === e.currentTarget) saltar(); }}
	>
		<!-- Card -->
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col {cerrando ? 'scale-95' : 'scale-100'} transition-transform duration-150 {comActual.importancia === 'urgente' ? 'ring-2 ring-red-500' : ''}">
			<!-- Header -->
			<header class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start gap-3 shrink-0">
				{#if comActual.importancia === 'urgente'}
					<ExclamationCircleSolid class="size-6 text-red-500 shrink-0 mt-0.5" />
				{:else}
					<ExclamationCircleSolid class="size-6 text-primary-500 shrink-0 mt-0.5" />
				{/if}
				<div class="flex-1 min-w-0">
					<p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
						Comunicado {comActual.importancia === 'urgente' ? 'urgente' : 'oficial'}
					</p>
					<h2 id="comunicado-titulo" class="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-tight mt-0.5">
						{comActual.titulo}
					</h2>
					<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
						De: <strong>{comActual.autor_nombre}</strong> ({comActual.autor_rol})
					</p>
				</div>
				<button
					type="button"
					onclick={saltar}
					class="shrink-0 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					aria-label="Cerrar"
				>
					<XIcon class="size-4" />
				</button>
			</header>

			<!-- Body -->
			<div class="px-6 py-5 overflow-y-auto flex-1">
				<div class="text-sm sm:text-base text-gray-800 dark:text-gray-200 whitespace-pre-line leading-relaxed">
					{@html contenidoSeguro.replace(/\n/g, '<br/>')}
				</div>

				<!-- Adjuntos -->
				{#if comActual.adjuntos && comActual.adjuntos.length > 0}
					<div class="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
						<p class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Adjuntos:</p>
						<div class="space-y-1.5">
							{#each comActual.adjuntos as adj}
								<a
									href={adj.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm text-primary-600 dark:text-primary-400"
								>
									<ExclamationIcon class="size-4 shrink-0" />
									<span class="truncate">{adj.nombre}</span>
								</a>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<footer class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2 shrink-0">
				<span class="text-xs text-gray-500 dark:text-gray-400">
					{#if pendientes.length > 1}
						{indiceActual + 1} de {pendientes.length}
					{:else}
						Comunicado
					{/if}
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={saltar}
						class="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
					>
						Más tarde
					</button>
					<button
						type="button"
						onclick={marcarVistoYAvanzar}
						class="px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors inline-flex items-center gap-1.5"
					>
						{indiceActual < pendientes.length - 1 ? 'Entendido' : 'Entendido'}
						{#if indiceActual < pendientes.length - 1}
							<ChevronRightIcon class="size-3.5" />
						{/if}
					</button>
				</div>
			</footer>
		</div>
	</div>
{/if}
