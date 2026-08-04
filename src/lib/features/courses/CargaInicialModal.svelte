<script lang="ts">
	// F-US-006-3TIPOS-3A-FE (2026-08-04): modal de carga inicial de estudiantes
	// para programas en_ejecucion o historicos. El admin/encargado pega los
	// carnets de los estudiantes que ya estaban/estan en el programa y el
	// sistema los inscribe con el flag es_carga_inicial=True.
	import { onMount } from 'svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { studentService } from '$lib/services';
	import { apiKyC } from '$lib/config';
	import { alert } from '$lib/utils';
	import type { Course } from '$lib/interfaces';
	import { UsersIcon, CheckIcon } from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		course: Course | null;
		onSuccess?: () => void;
	}

	let { isOpen, onClose, course, onSuccess }: Props = $props();

	// Carnets pegados (uno por linea o separados por coma/espacio)
	let carnetsText = $state('');
	let moduloInicialIndex = $state<number | null>(null);
	let matriculaPagada = $state(true);
	let cargando = $state(false);

	// Estudiantes resueltos (de carnet a {id, nombre, carnet})
	let estudiantesResueltos = $state<{ id: string; nombre: string; carnet: string; encontrado: boolean }[]>([]);
	let etapa = $state<'input' | 'preview' | 'result'>('input');
	let resultado = $state<{ exitosos: number; ya_inscritos: number; fallidos: number; detalles: any[] } | null>(null);

	// Reset al abrir/cerrar
	$effect(() => {
		if (!isOpen) {
			carnetsText = '';
			moduloInicialIndex = null;
			matriculaPagada = true;
			estudiantesResueltos = [];
			etapa = 'input';
			resultado = null;
		}
	});

	function parseCarnets(text: string): string[] {
		return text
			.split(/[\n,;\s]+/)
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
	}

	async function resolverCarnets() {
		const carnets = parseCarnets(carnetsText);
		if (carnets.length === 0) {
			alert('error', 'Pega al menos un carnet de estudiante');
			return;
		}
		if (carnets.length > 200) {
			alert('error', 'Maximo 200 carnets por carga. Divide en lotes mas chicos.');
			return;
		}

		cargando = true;
		try {
			// Buscar cada carnet (puede ser lento si son 200, pero OK)
			// Optimizacion: si el backend permite busqueda multiple, usar eso
			const promesas = carnets.map(async (carnet) => {
				try {
					const resp = await studentService.getAll(1, 5, { q: carnet });
					const match = resp.data.find((s: any) => s.carnet === carnet);
					if (match) {
						return { id: match._id, nombre: match.nombre, carnet: match.carnet, encontrado: true };
					}
					return { id: '', nombre: '', carnet, encontrado: false };
				} catch {
					return { id: '', nombre: '', carnet, encontrado: false };
				}
			});
			estudiantesResueltos = await Promise.all(promesas);
			etapa = 'preview';
		} catch (e: any) {
			alert('error', e?.message || 'Error al buscar carnets');
		} finally {
			cargando = false;
		}
	}

	async function confirmarCarga() {
		if (!course) return;
		const encontrados = estudiantesResueltos.filter((e) => e.encontrado && e.id);
		if (encontrados.length === 0) {
			alert('error', 'No hay estudiantes encontrados para cargar');
			return;
		}

		cargando = true;
		try {
			const payload = {
				estudiantes: encontrados.map((e) => ({
					estudiante_id: e.id,
					modulo_inicial_index: moduloInicialIndex !== null ? moduloInicialIndex : undefined,
					matricula_pagada: matriculaPagada,
				})),
			};

			const resp = await apiKyC.post<any>(`/courses/${course._id}/initial-enrollments`, payload);

			resultado = {
				exitosos: resp.exitosos || 0,
				ya_inscritos: resp.ya_inscritos || 0,
				fallidos: resp.fallidos || 0,
				detalles: resp.resultados || [],
			};
			etapa = 'result';

			if (resp.exitosos > 0) {
				alert('success', `${resp.exitosos} estudiante(s) inscrito(s) como carga inicial`);
				if (onSuccess) onSuccess();
			}
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar estudiantes');
		} finally {
			cargando = false;
		}
	}

	function cerrar() {
		onClose();
	}

	let totalCarnets = $derived(parseCarnets(carnetsText).length);
	let encontradosCount = $derived(estudiantesResueltos.filter((e) => e.encontrado).length);
	let noEncontradosCount = $derived(estudiantesResueltos.filter((e) => !e.encontrado).length);
	let esEnEjecucion = $derived(course?.estado_calculado === 'en_ejecucion');
	let modulosDelCurso = $derived((course as any)?.modulos || []);
</script>

<Modal {isOpen} onClose={cerrar} title="Carga Inicial de Estudiantes" size="lg">
	{#if !course}
		<p class="text-sm text-gray-500">No hay programa seleccionado.</p>
	{:else}
		<div class="space-y-4">
			<!-- Header con info del curso -->
			<div class="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
				<div class="text-xs text-gray-500 dark:text-gray-400">Programa</div>
				<div class="text-sm font-semibold text-gray-900 dark:text-white">
					{course.codigo} - {course.nombre_programa}
				</div>
				<div class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Estado: <span class="font-mono">{course.estado_calculado || course.estado}</span>
					{#if esEnEjecucion}
						<span class="ml-2 inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
							EN EJECUCION
						</span>
					{:else}
						<span class="ml-2 inline-flex items-center rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
							HISTORICO / CERRADO
						</span>
					{/if}
				</div>
			</div>

			{#if etapa === 'input'}
				<!-- Etapa 1: ingreso de carnets -->
				<div class="space-y-3">
					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Carnets de estudiantes
						</label>
						<textarea
							bind:value={carnetsText}
							rows="6"
							placeholder="Pega los carnets separados por nueva linea, coma o espacio. Ej:&#10;8099472-1O&#10;4702096&#10;1035489"
							class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						></textarea>
						<p class="mt-1 text-xs text-gray-500">
							{totalCarnets} carnet{totalCarnets === 1 ? '' : 'es'} detectado{totalCarnets === 1 ? '' : 's'}
						</p>
					</div>

					{#if esEnEjecucion}
						<div>
							<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
								Modulo inicial (opcional, para en_ejecucion)
							</label>
							<select
								bind:value={moduloInicialIndex}
								class="block w-full rounded-md border-0 py-1.5 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
							>
								<option value={null}>-- Sin asignar (dejar para configurar despues) --</option>
								{#each modulosDelCurso as modulo, i}
									<option value={i}>
										{i + 1}. {modulo.nombre} (Bs {modulo.costo})
									</option>
								{/each}
							</select>
							<p class="mt-1 text-xs text-gray-500">
								Los modulos ANTERIORES al seleccionado se marcaran como pagados automaticamente.
							</p>
						</div>
					{/if}

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={matriculaPagada}
							class="rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							Marcar matricula como pagada (caso retroactivo/historico)
						</span>
					</label>
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={cerrar}>Cancelar</Button>
					<Button type="button" loading={cargando} disabled={totalCarnets === 0} onclick={resolverCarnets}>
						{#snippet leftIcon()}
							<UsersIcon class="size-4" />
						{/snippet}
						Buscar estudiantes
					</Button>
				</div>
			{:else if etapa === 'preview'}
				<!-- Etapa 2: preview de estudiantes encontrados -->
				<div class="space-y-3">
					<div class="grid grid-cols-3 gap-2 text-center">
						<div class="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
							<div class="text-2xl font-bold text-green-700 dark:text-green-300">{encontradosCount}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Encontrados</div>
						</div>
						<div class="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
							<div class="text-2xl font-bold text-red-700 dark:text-red-300">{noEncontradosCount}</div>
							<div class="text-xs text-red-600 dark:text-red-400">No encontrados</div>
						</div>
						<div class="rounded-md bg-gray-50 p-2 dark:bg-gray-800">
							<div class="text-2xl font-bold text-gray-700 dark:text-gray-300">{totalCarnets}</div>
							<div class="text-xs text-gray-600 dark:text-gray-400">Total</div>
						</div>
					</div>

					<div class="max-h-60 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
							<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
								<tr>
									<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Carnet</th>
									<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
									<th class="px-3 py-2 text-center text-xs font-medium text-gray-500">Estado</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
								{#each estudiantesResueltos as est}
									<tr>
										<td class="px-3 py-2 text-xs font-mono">{est.carnet}</td>
										<td class="px-3 py-2 text-xs">{est.nombre || '-'}</td>
										<td class="px-3 py-2 text-center">
											{#if est.encontrado}
												<span class="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
													OK
												</span>
											{:else}
												<span class="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">
													NO ENCONTRADO
												</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if noEncontradosCount > 0}
						<p class="text-xs text-amber-600 dark:text-amber-400">
							Los carnets no encontrados se omitiran. Verifica que esten escritos correctamente o que
							los estudiantes existan en el sistema.
						</p>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={() => (etapa = 'input')}>Volver</Button>
					<Button
						type="button"
						loading={cargando}
						disabled={encontradosCount === 0}
						onclick={confirmarCarga}
					>
						{#snippet leftIcon()}
							<CheckIcon class="size-4" />
						{/snippet}
						Cargar {encontradosCount} estudiante{encontradosCount === 1 ? '' : 's'}
					</Button>
				</div>
			{:else if etapa === 'result' && resultado}
				<!-- Etapa 3: resultado -->
				<div class="space-y-3">
					<div class="grid grid-cols-3 gap-2 text-center">
						<div class="rounded-md bg-green-50 p-3 dark:bg-green-900/20">
							<div class="text-2xl font-bold text-green-700 dark:text-green-300">{resultado.exitosos}</div>
							<div class="text-xs text-green-600 dark:text-green-400">Inscritos</div>
						</div>
						<div class="rounded-md bg-amber-50 p-3 dark:bg-amber-900/20">
							<div class="text-2xl font-bold text-amber-700 dark:text-amber-300">{resultado.ya_inscritos}</div>
							<div class="text-xs text-amber-600 dark:text-amber-400">Ya inscritos</div>
						</div>
						<div class="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
							<div class="text-2xl font-bold text-red-700 dark:text-red-300">{resultado.fallidos}</div>
							<div class="text-xs text-red-600 dark:text-red-400">Fallidos</div>
						</div>
					</div>

					{#if resultado.fallidos > 0}
						<div class="max-h-40 overflow-y-auto rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800 dark:bg-red-900/20">
							<p class="text-xs font-semibold text-red-800 dark:text-red-200">Errores:</p>
							<ul class="mt-1 space-y-0.5 text-xs text-red-700 dark:text-red-300">
								{#each resultado.detalles.filter((d: any) => !d.success && d.message !== 'Ya esta inscrito en este curso') as d}
									<li>• {d.estudiante_id}: {d.message}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" onclick={cerrar}>Cerrar</Button>
				</div>
			{/if}
		</div>
	{/if}
</Modal>
