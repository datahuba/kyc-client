<script lang="ts">
	/**
	 * F-REFACTOR-ERRORS (2026-07-31)
	 * ===============================
	 * Modal de detalle de un error log.
	 *
	 * Antes vivia inline en routes/app/admin/errors/+page.svelte (515
	 * lineas). Eso hacia la pagina dificil de leer y mezclaba la lista
	 * con el detalle.
	 *
	 * Ahora: este componente recibe el `selectedError` y un callback
	 * `onClose`. La pagina padre solo se ocupa de la lista y filtros.
	 *
	 * Para usar: importar y renderizar con:
	 *   <ErrorDetailModal
	 *     error={selectedError}
	 *     onClose={() => selectedError = null}
	 *   />
	 */
	import type { ErrorLogDetail } from '$lib/interfaces';
	import { formatErrorTimestamp } from '$lib/utils/errorFormatters';

	interface Props {
		error: ErrorLogDetail | null;
		onClose: () => void;
	}

	let { error, onClose }: Props = $props();

	function handleBackdropClick(event: MouseEvent) {
		// F-XXX: cerrar solo si el click fue en el backdrop, no en el contenido
		if (event.target === event.currentTarget) onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') onClose();
	}
</script>

{#if error}
	<div
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">
					Detalle del error {error.error_type}
				</h2>
				<button
					onclick={onClose}
					class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
					aria-label="Cerrar modal"
				>
					✕
				</button>
			</div>
			<div class="overflow-y-auto p-6 space-y-4">
				<div class="grid grid-cols-2 gap-4 text-sm">
					<div>
						<p class="text-xs text-gray-500 uppercase">Timestamp</p>
						<p>{formatErrorTimestamp(error.timestamp)}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Status</p>
						<p class="font-bold text-red-600">{error.status_code}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Method</p>
						<p>{error.method}</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Path</p>
						<code class="text-xs">{error.path}</code>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">User</p>
						<p class="text-xs">
							{error.user_email || '—'}
							{#if error.user_type}
								<span class="text-gray-500">({error.user_type})</span>
							{/if}
						</p>
					</div>
					<div>
						<p class="text-xs text-gray-500 uppercase">Environment</p>
						<p>{error.environment}</p>
					</div>
				</div>

				<div>
					<p class="text-xs text-gray-500 uppercase mb-1">Mensaje</p>
					<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{error.message}</pre>
				</div>

				{#if error.query_params}
					<div>
						<p class="text-xs text-gray-500 uppercase mb-1">Query params</p>
						<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{error.query_params}</pre>
					</div>
				{/if}

				{#if error.request_body}
					<div>
						<p class="text-xs text-gray-500 uppercase mb-1">Request body</p>
						<pre class="bg-gray-50 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto">{error.request_body}</pre>
					</div>
				{/if}

				<div>
					<p class="text-xs text-gray-500 uppercase mb-1">Stack trace</p>
					<pre class="bg-gray-900 text-green-300 dark:bg-black p-3 rounded text-xs overflow-x-auto max-h-96">{error.stack_trace || 'No disponible'}</pre>
				</div>
			</div>
		</div>
	</div>
{/if}
