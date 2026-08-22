<script lang="ts">
	/**
	 * ReincorporarModal.svelte
	 * ========================
	 * F-REINCORPORACION (Kevin 2026-08-22):
	 * Modal para reincorporar a un estudiante en estado pasivo o suspendido
	 * hacia una nueva edición o versión del programa, arrastrando notas aprobadas
	 * y pagos previos para cobrar únicamente lo que le falta cursar.
	 */
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { courseService, enrollmentService } from '$lib/services';
	import { alert } from '$lib/utils';
	import type { Course, Enrollment, Student } from '$lib/interfaces';
	import { AcademicCapIcon } from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		enrollment: Enrollment | null;
		student?: Student | null;
		onSuccess?: () => void;
	}

	let { isOpen, onClose, enrollment, student, onSuccess }: Props = $props();

	let cursosDisponibles = $state<Course[]>([]);
	let cargandoCursos = $state(false);
	let cursoSeleccionadoId = $state('');
	let moduloInicio = $state(1);
	let observaciones = $state('');
	let procesando = $state(false);

	let cursoSeleccionado = $derived(
		cursosDisponibles.find((c: Course) => (c.id || (c as any)._id) === cursoSeleccionadoId) || null
	);

	let modulosDestino = $derived(cursoSeleccionado?.modulos || []);

	// Cargar cursos al abrir el modal
	$effect(() => {
		if (isOpen) {
			cursoSeleccionadoId = '';
			moduloInicio = 1;
			observaciones = '';
			procesando = false;
			cargarCursos();
		}
	});

	async function cargarCursos() {
		try {
			cargandoCursos = true;
			const res: any = await courseService.getAll(1, 100);
			// Filtrar cursos activos (excluir el curso actual del enrollment)
			const items: Course[] = Array.isArray(res) ? res : res.items || res.data || [];
			const currentCursoId = enrollment?.curso_id ? (typeof enrollment.curso_id === 'string' ? enrollment.curso_id : (enrollment.curso_id as any).id || (enrollment.curso_id as any)._id) : '';
			cursosDisponibles = items.filter((c: Course) => (c.id || (c as any)._id) !== currentCursoId);
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar la lista de programas disponibles');
		} finally {
			cargandoCursos = false;
		}
	}

	async function confirmarReincorporacion() {
		if (!enrollment) return;
		if (!cursoSeleccionadoId) {
			alert('warning', 'Por favor selecciona el programa destino para la reincorporación');
			return;
		}
		if (moduloInicio < 1) {
			alert('warning', 'Selecciona un módulo de inicio válido');
			return;
		}

		try {
			procesando = true;
			const enrollmentId = enrollment.id || (enrollment as any)._id;
			await enrollmentService.reincorporar(enrollmentId, {
				nuevo_curso_id: cursoSeleccionadoId,
				modulo_inicio: moduloInicio,
				observaciones: observaciones.trim() || undefined
			});
			alert('success', '¡Estudiante reincorporado exitosamente al nuevo programa!');
			if (onSuccess) onSuccess();
			onClose();
		} catch (e: any) {
			alert('error', e?.message || 'Error al procesar la reincorporación');
		} finally {
			procesando = false;
		}
	}
</script>

<Modal {isOpen} {onClose} title="Reincorporar Estudiante a Nueva Edición" maxWidth="sm:max-w-2xl">
	<div class="space-y-5 p-1">
		<!-- Resumen del Estudiante y Programa Actual -->
		<div class="rounded-xl border border-gray-200 bg-gray-50/80 p-4 dark:border-gray-700 dark:bg-gray-800/60">
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-300">
					<AcademicCapIcon class="size-5" />
				</div>
				<div class="min-w-0 flex-1">
					<h4 class="truncate text-sm font-bold text-gray-900 dark:text-white">
						{student?.nombre || 'Estudiante'}
					</h4>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{student?.registro ? `Reg: ${student.registro} · ` : ''}{student?.carnet ? `CI: ${student.carnet}` : ''}
					</p>
				</div>
				<div class="text-right">
					<span class="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
						{enrollment?.estado || 'Suspendido'}
					</span>
				</div>
			</div>
		</div>

		<!-- Paso 1: Seleccionar Programa Destino -->
		<div>
			<label for="nuevo-curso-select" class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
				1. Programa Destino (Nueva Versión / Edición) *
			</label>
			{#if cargandoCursos}
				<div class="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 text-xs text-gray-500 dark:border-gray-700">
					<div class="size-3.5 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
					Cargando programas disponibles...
				</div>
			{:else}
				<select
					id="nuevo-curso-select"
					bind:value={cursoSeleccionadoId}
					class="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					<option value="">-- Selecciona el programa de reingreso --</option>
					{#each cursosDisponibles as c}
						<option value={c.id || (c as any)._id}>
							{(c as any).nombre_curso || (c as any).nombre || 'Curso'} ({c.codigo || 'S/C'}) · {c.modulos?.length || 0} Módulos
						</option>
					{/each}
				</select>
			{/if}
		</div>

		<!-- Paso 2: Seleccionar Módulo Inicial y Previsualizar Convalidación -->
		{#if cursoSeleccionado}
			<div>
				<label for="modulo-inicio-select" class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
					2. Módulo desde donde se reincorpora *
				</label>
				<select
					id="modulo-inicio-select"
					bind:value={moduloInicio}
					class="w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
				>
					{#each modulosDestino as m, idx}
						<option value={idx + 1}>
							Módulo {idx + 1}: {m.nombre}
						</option>
					{/each}
				</select>
			</div>

			<!-- Desglose de Módulos: Convalidados vs Por Cursar -->
			<div class="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
				<h5 class="mb-3 text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
					Desglose del Plan de Reincorporación
				</h5>
				<div class="space-y-2">
					{#each modulosDestino as m, idx}
						{@const num = idx + 1}
						{@const esConvalidado = num < moduloInicio}
						<div class="flex items-center justify-between rounded-lg border p-2.5 text-xs transition-colors {esConvalidado ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20' : 'border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20'}">
							<div class="flex items-center gap-2.5">
								<span class="flex size-6 items-center justify-center rounded-full font-bold {esConvalidado ? 'bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200'}">
									{num}
								</span>
								<div>
									<p class="font-medium text-gray-900 dark:text-white">{m.nombre}</p>
									<p class="text-[11px] {esConvalidado ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'}">
										{esConvalidado ? '✅ Convalidado (Arrastra nota previa y pago)' : '⏳ Por cursar en esta edición'}
									</p>
								</div>
							</div>
							<div class="text-right">
								<span class="font-bold text-gray-900 dark:text-white">
									Bs. {m.costo || 0}
								</span>
								<p class="text-[10px] {esConvalidado ? 'text-emerald-600' : 'text-gray-500'}">
									{esConvalidado ? 'Cubierto' : 'A pagar'}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Observaciones Opcionales -->
		<div>
			<label for="observaciones-input" class="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
				Observaciones Administrativas (Opcional)
			</label>
			<textarea
				id="observaciones-input"
				bind:value={observaciones}
				rows="2"
				placeholder="Ej: Traspaso autorizado por Coordinación Académica según solicitud..."
				class="w-full rounded-lg border border-gray-300 p-2.5 text-xs text-gray-900 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
			></textarea>
		</div>

		<!-- Botones de Acción -->
		<div class="flex justify-end gap-3 pt-2">
			<Button variant="secondary" onclick={onClose} disabled={procesando}>
				Cancelar
			</Button>
			<Button
				variant="primary"
				onclick={confirmarReincorporacion}
				disabled={procesando || !cursoSeleccionadoId}
				loading={procesando}
			>
				Confirmar Reincorporación
			</Button>
		</div>
	</div>
</Modal>
