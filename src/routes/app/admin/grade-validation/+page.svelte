<script lang="ts">
	/**
	 * F-070 (2026-07-22) · Validación de Notas
	 * ========================================
	 *
	 * Página para que CPD/Superadmin gestione las notas pendientes de
	 * validación que cargaron los docentes (ISSUE-Q-NOTA-BORRADOR).
	 *
	 * Permite:
	 * - Listar todas las notas pendientes con filtros (curso, módulo, búsqueda)
	 * - Aprobar (validar) varias notas en bulk
	 * - Aprobar/rechazar/editar individualmente
	 *
	 * Solo accesible para cpd/superadmin.
	 */

	import { onMount } from 'svelte';
	import { gradeValidationService, courseService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type { NotaPendiente, BulkValidarItem } from '$lib/interfaces/grade-validation.interface';
	import type { Course } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';

	let loading = $state(true);
	let items: NotaPendiente[] = $state([]);
	let total = $state(0);
	let selectedIds = $state<Set<string>>(new Set());
	let bulkProcessing = $state(false);

	// Filtros
	let selectedCurso = $state('');
	let selectedModulo = $state('');
	let estudianteQuery = $state('');

	// Datos auxiliares
	let cursos: Course[] = $state([]);
	let modulosDelCurso: { index: number; nombre: string }[] = $state([]);

	// Modal de edición
	let editingItem = $state<NotaPendiente | null>(null);
	let editNota = $state<number | null>(null);
	let editMotivo = $state('');
	let savingEdit = $state(false);

	// Permisos: cpd, admin, superadmin (F-070)
	const isAllowed = $derived(
		$userStore.user?.role === 'cpd' ||
		$userStore.user?.role === 'admin' ||
		$userStore.user?.role === 'superadmin'
	);

	// Construir key único para selectedIds (enrollment_id + modulo_index)
	function keyOf(item: NotaPendiente): string {
		return `${item.enrollment_id}::${item.modulo_index}`;
	}

	onMount(async () => {
		if (!isAllowed) {
			loading = false;
			return;
		}
		// cargar cursos para el filtro
		try {
			const res = await courseService.getAll(1, 200);
			cursos = (res as any).data || (res as any).items || (Array.isArray(res) ? res : []);
		} catch (e: any) {
			console.error('Error cargando cursos:', e);
		}
		await load();
	});

	async function load() {
		loading = true;
		selectedIds = new Set();
		try {
			const res = await gradeValidationService.listarNotasPendientes({
				curso_id: selectedCurso || undefined,
				modulo_index: selectedModulo ? Number(selectedModulo) : undefined,
				estudiante_query: estudianteQuery || undefined,
			});
			items = res.items;
			total = res.total;
		} catch (error: any) {
			alert('error', error.message || 'Error al cargar las notas pendientes');
		} finally {
			loading = false;
		}
	}

	// cuando cambia el curso, actualizar la lista de modulos
	$effect(() => {
		if (selectedCurso) {
			const c = cursos.find(x => (x._id || (x as any).id) === selectedCurso);
			modulosDelCurso = (c?.modulos || []).map((m, i) => ({ index: i, nombre: m.nombre }));
		} else {
			modulosDelCurso = [];
		}
		selectedModulo = '';
	});

	function toggleSelect(item: NotaPendiente) {
		const k = keyOf(item);
		const next = new Set(selectedIds);
		if (next.has(k)) next.delete(k);
		else next.add(k);
		selectedIds = next;
	}

	function toggleSelectAll() {
		if (selectedIds.size === items.length) {
			selectedIds = new Set();
		} else {
			selectedIds = new Set(items.map(keyOf));
		}
	}

	async function bulkApprove() {
		if (selectedIds.size === 0) {
			alert('warning', 'Selecciona al menos una nota para aprobar.');
			return;
		}
		if (!confirm(`¿Aprobar ${selectedIds.size} notas? Esta acción convierte los borradores en notas oficiales.`)) return;

		bulkProcessing = true;
		try {
			const itemsToSend: BulkValidarItem[] = items
				.filter(i => selectedIds.has(keyOf(i)))
				.map(i => ({ enrollment_id: i.enrollment_id, modulo_index: i.modulo_index }));
			const res = await gradeValidationService.bulkValidar(itemsToSend);
			alert(
				res.fallidos === 0 ? 'success' : 'warning',
				`Aprobadas: ${res.exitosos} | Fallidas: ${res.fallidos}`
			);
			await load();
		} catch (error: any) {
			alert('error', error.message || 'Error al aprobar en bulk');
		} finally {
			bulkProcessing = false;
		}
	}

	async function approveOne(item: NotaPendiente) {
		if (!confirm(`¿Aprobar la nota de ${item.estudiante_nombre} (${item.modulo_nombre}) con ${item.nota_borrador}?`)) return;
		try {
			await gradeValidationService.bulkValidar([{ enrollment_id: item.enrollment_id, modulo_index: item.modulo_index }]);
			alert('success', 'Nota aprobada.');
			await load();
		} catch (error: any) {
			alert('error', error.message || 'Error al aprobar');
		}
	}

	async function rejectOne(item: NotaPendiente) {
		if (!confirm(`¿Rechazar la nota borrador de ${item.estudiante_nombre}? El docente deberá cargar una nueva.`)) return;
		try {
			await gradeValidationService.rechazarBorrador(item.enrollment_id, item.modulo_index);
			alert('success', 'Borrador rechazado. El docente deberá cargar una nueva nota.');
			await load();
		} catch (error: any) {
			alert('error', error.message || 'Error al rechazar');
		}
	}

	function openEdit(item: NotaPendiente) {
		editingItem = item;
		editNota = item.nota_borrador;
		editMotivo = '';
	}

	function closeEdit() {
		editingItem = null;
		editNota = null;
		editMotivo = '';
	}

	async function saveEdit() {
		if (!editingItem || editNota === null) return;
		if (editNota < 0 || editNota > 100) {
			alert('error', 'La nota debe estar entre 0 y 100');
			return;
		}
		savingEdit = true;
		try {
			await gradeValidationService.editarNotaValidada(
				editingItem.enrollment_id,
				editingItem.modulo_index,
				editNota,
				editMotivo || undefined
			);
			alert('success', 'Nota actualizada correctamente.');
			closeEdit();
			await load();
		} catch (error: any) {
			alert('error', error.message || 'Error al editar la nota');
		} finally {
			savingEdit = false;
		}
	}

	function getNotaBadgeClass(nota: number): string {
		if (nota >= 51) return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
		return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
	}
</script>

<div class="space-y-6 max-w-7xl mx-auto">
	<div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
		<div>
			<Heading level="h1">Validación de Notas</Heading>
			<p class="text-gray-500 dark:text-gray-400 mt-1">
				Notas cargadas por docentes que requieren aprobación de CPD/Administración
			</p>
		</div>
		{#if selectedIds.size > 0}
			<div class="flex items-center gap-2">
				<span class="text-sm text-gray-600 dark:text-gray-400">
					{selectedIds.size} seleccionada{selectedIds.size > 1 ? 's' : ''}
				</span>
				<Button variant="primary" loading={bulkProcessing} onclick={bulkApprove}>
					✓ Aprobar Seleccionadas
				</Button>
			</div>
		{/if}
	</div>

	{#if !isAllowed}
		<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-6 text-center">
			<p class="text-amber-800 dark:text-amber-200 font-medium">
				⚠️ Esta página solo está disponible para CPD/Admin/Superadmin.
			</p>
			<p class="text-sm text-amber-700 dark:text-amber-300 mt-2">
				Tu rol actual: <strong>{$userStore.user?.role || $userStore.user?.rol || 'desconocido'}</strong>
			</p>
		</div>
	{:else}
		<!-- Filtros -->
		<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
			<div class="flex flex-col md:flex-row gap-3 items-end">
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Curso</label>
					<select bind:value={selectedCurso} class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm">
						<option value="">Todos los cursos</option>
						{#each cursos as c}
							<option value={c._id || (c as any).id}>{c.codigo} — {c.nombre_programa || ''}</option>
						{/each}
					</select>
				</div>
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Módulo</label>
					<select bind:value={selectedModulo} disabled={!selectedCurso} class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm disabled:opacity-50">
						<option value="">Todos los módulos</option>
						{#each modulosDelCurso as m}
							<option value={m.index}>M{m.index + 1}: {m.nombre}</option>
						{/each}
					</select>
				</div>
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Buscar estudiante</label>
					<input
						type="text"
						bind:value={estudianteQuery}
						placeholder="Nombre, registro o CI"
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
					/>
				</div>
				<Button variant="primary" onclick={load} loading={loading}>
					🔍 Buscar
				</Button>
			</div>
		</div>

		<!-- Resumen -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Pendientes</p>
				<p class="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{total}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Visibles en tabla</p>
				<p class="text-3xl font-bold text-gray-700 dark:text-gray-300 mt-1">{items.length}</p>
			</div>
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
				<p class="text-xs text-gray-500 dark:text-gray-400 uppercase">Seleccionadas</p>
				<p class="text-3xl font-bold text-primary-600 dark:text-primary-400 mt-1">{selectedIds.size}</p>
			</div>
		</div>

		{#if loading}
			<div class="flex items-center justify-center py-12">
				<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
			</div>
		{:else if items.length === 0}
			<div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-6 text-center">
				<p class="text-green-800 dark:text-green-200 font-medium">
					✅ No hay notas pendientes de validación con los filtros aplicados.
				</p>
			</div>
		{:else}
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full">
						<thead class="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
							<tr>
								<th class="px-4 py-3 text-left">
									<input
										type="checkbox"
										checked={selectedIds.size === items.length && items.length > 0}
										onchange={toggleSelectAll}
										class="rounded border-gray-300"
									/>
								</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Estudiante</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Curso / Módulo</th>
								<th class="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Nota Borrador</th>
								<th class="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Docente</th>
								<th class="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Acciones</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
							{#each items as item (keyOf(item))}
								{@const k = keyOf(item)}
								<tr class="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 {selectedIds.has(k) ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}">
									<td class="px-4 py-3">
										<input
											type="checkbox"
											checked={selectedIds.has(k)}
											onchange={() => toggleSelect(item)}
											class="rounded border-gray-300"
										/>
									</td>
									<td class="px-4 py-3">
										<p class="text-sm font-medium text-gray-900 dark:text-white">{item.estudiante_nombre}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">
											{item.estudiante_registro || '—'} / {item.estudiante_ci || '—'}
										</p>
									</td>
									<td class="px-4 py-3">
										<p class="text-sm font-medium text-gray-700 dark:text-gray-300">{item.curso_codigo}</p>
										<p class="text-xs text-gray-500 dark:text-gray-400">{item.modulo_nombre}</p>
									</td>
									<td class="px-4 py-3 text-center">
										<span class={`inline-flex text-base font-bold px-3 py-1 rounded-full ${getNotaBadgeClass(item.nota_borrador)}`}>
											{item.nota_borrador}
										</span>
									</td>
									<td class="px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
										{item.docente_nombre || item.docente_username || '—'}
									</td>
									<td class="px-4 py-3 text-right">
										<div class="flex items-center justify-end gap-2">
											<button
												onclick={() => approveOne(item)}
												class="text-xs font-semibold text-green-600 dark:text-green-400 hover:underline"
												title="Aprobar nota"
											>
												✓ Aprobar
											</button>
											<button
												onclick={() => rejectOne(item)}
												class="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
												title="Rechazar borrador"
											>
												✕ Rechazar
											</button>
											<button
												onclick={() => openEdit(item)}
												class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
												title="Editar nota validada"
											>
												✎ Editar
											</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Modal de edición -->
{#if editingItem}
	<div
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full overflow-hidden">
			<div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">Editar Nota</h2>
				<button onclick={closeEdit} class="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">✕</button>
			</div>
			<div class="p-6 space-y-4">
				<div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Estudiante</p>
					<p class="text-base font-semibold text-gray-900 dark:text-white">{editingItem.estudiante_nombre}</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 dark:text-gray-400">Curso / Módulo</p>
					<p class="text-sm text-gray-900 dark:text-white">{editingItem.curso_codigo} — {editingItem.modulo_nombre}</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nota (0-100)</label>
					<input
						type="number"
						min="0"
						max="100"
						step="0.01"
						bind:value={editNota}
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
					/>
					<p class="text-xs text-gray-500 mt-1">Aprobado: ≥51, Reprobado: &lt;51</p>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo del ajuste (auditoría)</label>
					<textarea
						bind:value={editMotivo}
						rows="3"
						placeholder="Opcional. Ej: corrección de digitación, revisión de segunda instancia..."
						class="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
					></textarea>
				</div>
			</div>
			<div class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
				<Button variant="secondary" onclick={closeEdit}>Cancelar</Button>
				<Button variant="primary" loading={savingEdit} onclick={saveEdit}>Guardar</Button>
			</div>
		</div>
	</div>
{/if}
