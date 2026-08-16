<script lang="ts">
	// F-US-006-3TIPOS-3B (2026-08-04): modal para que el admin/encargado
	// agregue 1 estudiante a un programa en_ejecucion (lo incorpora a un
	// modulo futuro). Caso de uso: el estudiante se acerco a la oficina
	// de posgrado y se quiere unir tarde al programa.
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { studentService } from '$lib/services';
	import { apiKyC } from '$lib/config';
	import { alert } from '$lib/utils';
	import type { Course, Student } from '$lib/interfaces';
	import { UsersIcon, CheckIcon } from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		course: Course | null;
		onSuccess?: () => void;
	}

	let { isOpen, onClose, course, onSuccess }: Props = $props();

	let busqueda = $state('');
	let resultados = $state<Student[]>([]);
	let estudianteSeleccionado = $state<Student | null>(null);
	let moduloInicialIndex = $state<number | null>(null);
	let matriculaPagada = $state(false);
	let cargando = $state(false);
	let buscando = $state(false);
	let etapa = $state<'buscar' | 'modulo' | 'result'>('buscar');
	let resultado = $state<{ success: boolean; message: string; enrollment_id?: string } | null>(null);

	// Reset al abrir/cerrar
	$effect(() => {
		if (!isOpen) {
			busqueda = '';
			resultados = [];
			estudianteSeleccionado = null;
			moduloInicialIndex = null;
			matriculaPagada = false;
			etapa = 'buscar';
			resultado = null;
		}
	});

	// Calcular fase de cada modulo segun fecha_inicio/fecha_fin
	type FaseModulo = 'pasado' | 'actual' | 'futuro' | 'sin_fecha';
	function faseModulo(modulo: any): FaseModulo {
		if (!modulo.fecha_inicio || !modulo.fecha_fin) return 'sin_fecha';
		const hoy = new Date();
		hoy.setHours(0, 0, 0, 0);
		const inicio = new Date(modulo.fecha_inicio);
		const fin = new Date(modulo.fecha_fin);
		if (fin < hoy) return 'pasado';
		if (inicio > hoy) return 'futuro';
		return 'actual';
	}

	let modulosDelCurso = $derived((course as any)?.modulos || []);
	let hoy = $derived(new Date());

	async function buscarEstudiantes() {
		if (busqueda.trim().length < 2) {
			alert('error', 'Escribe al menos 2 caracteres para buscar');
			return;
		}
		buscando = true;
		try {
			const resp = await studentService.getAll(1, 10, { q: busqueda });
			resultados = resp.data;
			if (resultados.length === 0) {
				alert('warning', 'No se encontraron estudiantes con esa busqueda');
			}
		} catch (e: any) {
			alert('error', e?.message || 'Error al buscar estudiantes');
		} finally {
			buscando = false;
		}
	}

	function seleccionarEstudiante(s: Student) {
		estudianteSeleccionado = s;
		etapa = 'modulo';
	}

	function confirmar() {
		if (!course) return;
		if (!estudianteSeleccionado) {
			alert('error', 'Selecciona un estudiante');
			return;
		}
		if (moduloInicialIndex === null) {
			alert('error', 'Selecciona el modulo donde se incorpora');
			return;
		}

		cargando = true;
		(async () => {
			try {
				const payload = {
					estudiantes: [
						{
							estudiante_id: estudianteSeleccionado!._id,
							modulo_inicial_index: moduloInicialIndex!,
							matricula_pagada: matriculaPagada,
						},
					],
				};
				const resp = await apiKyC.post<any>(`/courses/${course!._id}/initial-enrollments`, payload);
				const detalle = resp.resultados?.[0];
				if (detalle?.success) {
					resultado = {
						success: true,
						message: 'Estudiante incorporado al programa',
						enrollment_id: detalle.enrollment_id,
					};
					alert('success', 'Estudiante incorporado correctamente');
					if (onSuccess) onSuccess();
				} else if (detalle?.message === 'Ya esta inscrito en este curso') {
					resultado = {
						success: false,
						message: 'Este estudiante ya esta inscrito en el programa',
					};
				} else {
					resultado = {
						success: false,
						message: detalle?.message || 'Error desconocido',
					};
				}
				etapa = 'result';
			} catch (e: any) {
				alert('error', e?.message || 'Error al agregar estudiante');
			} finally {
				cargando = false;
			}
		})();
	}

	function cerrar() {
		onClose();
	}

	function badgeFase(fase: FaseModulo): { texto: string; clase: string } {
		const map = {
			pasado: { texto: 'PASADO', clase: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
			actual: { texto: 'EN CURSO', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' },
			futuro: { texto: 'FUTURO', clase: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
			sin_fecha: { texto: 'SIN FECHA', clase: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
		};
		return map[fase];
	}
</script>

<Modal {isOpen} onClose={cerrar} title="Agregar Estudiante al Programa" maxWidth="sm:max-w-2xl">
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
					Estado: <span class="font-mono">{course.estado_calculado}</span>
				</div>
			</div>

			{#if etapa === 'buscar'}
				<!-- Etapa 1: buscar estudiante -->
				<div class="space-y-3">
					<div>
						<label for="buscar-estudiante" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Buscar estudiante (por nombre, CI o email)
						</label>
						<Input
							id="buscar-estudiante"
							bind:value={busqueda}
							placeholder="Ej: Juan Perez, 8099472, juan@email.com"
						/>
					</div>

					<div class="flex justify-end">
						<Button type="button" loading={buscando} disabled={busqueda.length < 2} onclick={buscarEstudiantes}>
							Buscar
						</Button>
					</div>

					{#if resultados.length > 0}
						<div class="max-h-60 overflow-y-auto rounded-md border border-gray-200 dark:border-gray-700">
							<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
									<tr>
										<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Carnet</th>
										<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Nombre</th>
										<th class="px-3 py-2 text-left text-xs font-medium text-gray-500">Email</th>
										<th class="px-3 py-2 text-center text-xs font-medium text-gray-500">Acción</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
									{#each resultados as s}
										<tr>
											<td class="px-3 py-2 text-xs font-mono">{s.carnet}</td>
											<td class="px-3 py-2 text-xs">{s.nombre}</td>
											<td class="px-3 py-2 text-xs text-gray-500">{s.email || '-'}</td>
											<td class="px-3 py-2 text-center">
												<Button type="button" size="sm" variant="secondary" onclick={() => seleccionarEstudiante(s)}>
													Seleccionar
												</Button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={cerrar}>Cancelar</Button>
				</div>
			{:else if etapa === 'modulo' && estudianteSeleccionado}
				<!-- Etapa 2: seleccionar modulo -->
				<div class="space-y-3">
					<div class="rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
						<div class="text-xs text-emerald-700 dark:text-emerald-300">Estudiante seleccionado</div>
						<div class="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
							{estudianteSeleccionado.nombre} (CI: {estudianteSeleccionado.carnet})
						</div>
					</div>

					<div>
						<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
							Selecciona el modulo donde se incorpora
						</label>
						<p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
							Los modulos anteriores al seleccionado se marcaran como pagados automaticamente
							(asumimos que ya los curso). Solo se puede incorporar a un modulo FUTURO o EN CURSO.
						</p>

						<div class="max-h-60 space-y-1 overflow-y-auto rounded-md border border-gray-200 p-2 dark:border-gray-700">
							{#each modulosDelCurso as modulo, i}
								{@const fase = faseModulo(modulo)}
								{@const badge = badgeFase(fase)}
								{@const seleccionable = fase === 'futuro' || fase === 'actual'}
								<label class="flex items-center gap-3 rounded p-2 hover:bg-gray-50 dark:hover:bg-gray-800 {seleccionable ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'}">
									<input
										type="radio"
										name="modulo-inicial"
										value={i}
										disabled={!seleccionable}
										bind:group={moduloInicialIndex}
										class="text-primary-600 focus:ring-primary-600"
									/>
									<div class="flex-1">
										<div class="text-sm font-medium text-gray-900 dark:text-white">
											{i + 1}. {modulo.nombre}
										</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">
											Costo: Bs {modulo.costo || 0} |
											{#if modulo.fecha_inicio && modulo.fecha_fin}
												{new Date(modulo.fecha_inicio).toLocaleDateString('es-BO')} → {new Date(modulo.fecha_fin).toLocaleDateString('es-BO')}
											{:else}
												Sin fechas
											{/if}
										</div>
									</div>
									<span class="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold {badge.clase}">
										{badge.texto}
									</span>
								</label>
							{/each}
						</div>
					</div>

					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={matriculaPagada}
							class="rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700"
						/>
						<span class="text-sm text-gray-700 dark:text-gray-300">
							Ya pago la matricula
						</span>
					</label>
				</div>

				<div class="flex justify-end gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
					<Button type="button" variant="secondary" onclick={() => (etapa = 'buscar')}>Volver</Button>
					<Button
						type="button"
						loading={cargando}
						disabled={moduloInicialIndex === null}
						onclick={confirmar}
					>
						{#snippet leftIcon()}
							<CheckIcon class="size-4" />
						{/snippet}
						Agregar al programa
					</Button>
				</div>
			{:else if etapa === 'result' && resultado}
				<!-- Etapa 3: resultado -->
				<div class="space-y-3">
					{#if resultado.success}
						<div class="rounded-md border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-900/20">
							<div class="text-2xl">✅</div>
							<div class="mt-1 text-sm font-semibold text-green-800 dark:text-green-200">
								{resultado.message}
							</div>
						</div>
					{:else}
						<div class="rounded-md border border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-900/20">
							<div class="text-2xl">⚠️</div>
							<div class="mt-1 text-sm font-semibold text-amber-800 dark:text-amber-200">
								{resultado.message}
							</div>
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
