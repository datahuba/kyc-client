<script lang="ts">
	/**
	 * F-MODULOS-MODAL (2026-07-31)
	 * ============================
	 * Modal centralizado de gestión de módulos por inscripción.
	 *
	 * Kevin: "debe hacer todo lo que tenemos del kardex con botones ya no se
	 * usara el otro todo lo debe hacer ahora este modal nuevo todo lo que
	 * era iniciar y cerrar modulos todo lo debe hacer este modal nuevo".
	 *
	 * Este modal REEMPLAZA los botones "Iniciar"/"Revertir" que estaban en el
	 * kardex (lineas 1278-1312 de /app/enrollments/+page.svelte). Ahora todo
	 * el ciclo de vida de un módulo vive aquí:
	 *   Pendiente -> En curso (iniciado_en) -> Finalizado (finalizado_en)
	 *
	 * Acciones disponibles para admin/superadmin/encargado_curso:
	 *  - Iniciar módulo
	 *  - Deshacer inicio
	 *  - Finalizar módulo (solo si está iniciado)
	 *  - Deshacer finalización
	 *
	 * También muestra info del módulo: nombre, costo, monto pagado, nota
	 * (si tiene), fechas de inicio/fin.
	 */
	import Modal from './modal.svelte';
	import Button from './button.svelte';
	import { cuentasPorCobrarService } from '$lib/services';
	import { alert, formatCurrency, formatDate } from '$lib/utils';
	import { CheckIcon, XIcon, ExclamationIcon, ClipboardIcon } from '$lib/icons/outline';
	// F-2026-08-11-ASISTENCIA: modal para gestionar asistencia por sesiones
	import AsistenciaModal from './AsistenciaModal.svelte';

	interface Props {
		isOpen: boolean;
		enrollment: any | null; // tipo completo esta en enrollment.interface.ts
		onClose: () => void;
		onUpdated?: (enrollment: any) => void;
	}

	let { isOpen, enrollment, onClose, onUpdated }: Props = $props();

	let loading = $state<Record<string, boolean>>({});
	let refreshing = $state(false);

	// F-2026-08-11-MODULOS-EC: input de asistencia_porcentaje por módulo
	// (0-100). Se muestra solo cuando se puede cerrar el módulo. Si < 80,
	// el backend fuerza Reprobado al cerrar.
	let asistenciaInputs = $state<Record<number, string>>({});

	// F-2026-08-11-ASISTENCIA: estado del modal de asistencia por sesiones
	let asistenciaModalOpen = $state(false);
	let asistenciaModuloIndex = $state(0);
	let asistenciaModuloNombre = $state('');

	function openAsistenciaModal(index: number) {
		asistenciaModuloIndex = index;
		asistenciaModuloNombre = enrollment?.modulos?.[index]?.nombre || `Módulo ${index + 1}`;
		asistenciaModalOpen = true;
	}

	function closeAsistenciaModal() {
		asistenciaModalOpen = false;
	}

	// Estudiantes para el modal de asistencia: en este contexto cada
	// enrollment = 1 estudiante, pero la UI del modal admite varios.
	const estudiantesAsistencia = $derived.by(() => {
		if (!enrollment) return [];
		return [
			{
				_id: String(enrollment.estudiante_id),
				nombre: enrollment.estudiante_nombre || 'Estudiante',
				registro: enrollment.estudiante_registro || undefined
			}
		];
	});

	function getModuloKey(index: number, action: string): string {
		return `${index}-${action}`;
	}

	async function withLoading(key: string, fn: () => Promise<any>) {
		loading = { ...loading, [key]: true };
		try {
			return await fn();
		} finally {
			loading = { ...loading, [key]: false };
		}
	}

	async function handleIniciar(index: number) {
		if (!enrollment) return;
		const updated = await withLoading(getModuloKey(index, 'iniciar'), () =>
			cuentasPorCobrarService.iniciarModulo(String(enrollment._id), index)
		);
		enrollment = updated;
		onUpdated?.(updated);
		alert('success', 'Módulo marcado como "en curso".');
	}

	async function handleDeshacerInicio(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Revertir el inicio de este módulo? Volverá a "no iniciado".')) return;
		const updated = await withLoading(getModuloKey(index, 'deshacer-inicio'), () =>
			cuentasPorCobrarService.deshacerInicioModulo(String(enrollment._id), index)
		);
		enrollment = updated;
		onUpdated?.(updated);
		alert('success', 'Inicio del módulo revertido.');
	}

	async function handleFinalizar(index: number) {
		if (!enrollment) return;
		// F-2026-08-11-MODULOS-EC: parsear asistencia opcional (0-100)
		const rawAsist = (asistenciaInputs[index] ?? '').toString().trim();
		let asistenciaNum: number | null = null;
		if (rawAsist !== '') {
			const n = Number(rawAsist);
			if (Number.isNaN(n) || n < 0 || n > 100) {
				alert('error', 'La asistencia debe ser un número entre 0 y 100.');
				return;
			}
			asistenciaNum = n;
			if (n < 80) {
				const ok = confirm(
					`Asistencia ${n}% (< 80%). El sistema forzará el módulo como "Reprobado" ` +
						`por regla de aprobación mínima. ¿Continuar?`
				);
				if (!ok) return;
			}
		}
		if (!confirm('¿Cerrar este módulo? Marcará el módulo como "finalizado" y ya no contará como activo.')) return;
		const updated = await withLoading(getModuloKey(index, 'finalizar'), () =>
			cuentasPorCobrarService.finalizarModulo(
				String(enrollment._id),
				index,
				asistenciaNum
			)
		);
		enrollment = updated;
		onUpdated?.(updated);
		alert('success', 'Módulo finalizado.');
	}

	async function handleDeshacerFinalizacion(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Revertir la finalización? El módulo volverá a estar "en curso".')) return;
		const updated = await withLoading(getModuloKey(index, 'deshacer-fin'), () =>
			cuentasPorCobrarService.deshacerFinalizacionModulo(String(enrollment._id), index)
		);
		enrollment = updated;
		onUpdated?.(updated);
		alert('success', 'Finalización revertida.');
	}

	async function handleRefresh() {
		if (!enrollment) return;
		refreshing = true;
		try {
			const { enrollmentService } = await import('$lib/services');
			const fresh = await enrollmentService.getById(String(enrollment._id));
			enrollment = fresh;
			onUpdated?.(fresh);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo refrescar');
		} finally {
			refreshing = false;
		}
	}

	function getEstado(modulo: any): { label: string; color: string } {
		if (modulo.finalizado_en) {
			return { label: '✓ Finalizado', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
		}
		if (modulo.iniciado_en) {
			return { label: '◐ En curso', color: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' };
		}
		return { label: '○ No iniciado', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' };
	}
</script>

<Modal
	{isOpen}
	title="Gestión de Módulos"
	maxWidth="sm:max-w-3xl"
	onClose={onClose}
>
	{#if enrollment}
		<div class="p-6 space-y-4">
			<!-- Encabezado con info del programa/estudiante -->
			<div class="bg-gray-50 dark:bg-dark-background/40 p-4 rounded-xl border border-gray-200 dark:border-dark-border">
				<p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Inscripción</p>
				<p class="text-base font-bold text-slate-900 dark:text-white">
					{enrollment.curso_nombre || `Curso ${enrollment.curso_id}`}
				</p>
				<p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
					{enrollment.estudiante_nombre || `Estudiante ${enrollment.estudiante_id}`}
				</p>
			</div>

			<!-- Botón refrescar -->
			<div class="flex justify-end">
				<Button size="sm" variant="secondary" onclick={handleRefresh} loading={refreshing}>
					Refrescar
				</Button>
			</div>

			<!-- Lista de módulos -->
			{#if enrollment.modulos && enrollment.modulos.length > 0}
				<div class="space-y-3">
					{#each enrollment.modulos as modulo, index}
						{@const estado = getEstado(modulo)}
						{@const canIniciar = !modulo.iniciado_en && !modulo.finalizado_en}
						{@const canDeshacerInicio = !!modulo.iniciado_en && !modulo.finalizado_en}
						{@const canFinalizar = !!modulo.iniciado_en && !modulo.finalizado_en}
						{@const canDeshacerFin = !!modulo.finalizado_en}

						<div class="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border space-y-3">
							<!-- Header: nombre + estado + costo -->
							<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p class="text-sm font-bold text-slate-900 dark:text-white" title={modulo.nombre}>
										<span class="text-gray-400 dark:text-gray-500">#{index + 1}</span> · {modulo.nombre}
									</p>
									<div class="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
										<span class={`px-2 py-0.5 font-bold rounded-full ${estado.color}`}>
											{estado.label}
										</span>
										{#if modulo.iniciado_en}
											<span class="text-gray-500 dark:text-gray-400" title="Fecha de inicio">
												Inicio: {formatDate(modulo.iniciado_en)}
											</span>
										{/if}
										{#if modulo.finalizado_en}
											<span class="text-blue-600 dark:text-blue-400" title="Fecha de finalización">
												Cierre: {formatDate(modulo.finalizado_en)}
											</span>
										{/if}
										{#if modulo.asistencia_porcentaje !== null && modulo.asistencia_porcentaje !== undefined}
											<span
												class={`px-2 py-0.5 font-bold rounded-full ${modulo.asistencia_porcentaje < 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}
												title="F-2026-08-11-MODULOS-EC: regla 80% asistencia"
											>
												Asist: {modulo.asistencia_porcentaje}%
											</span>
										{/if}
									</div>
								</div>
								<div class="text-right text-sm">
									<p class="text-xs text-gray-500">Costo</p>
									<p class="font-bold text-slate-900 dark:text-white">{formatCurrency(modulo.costo)}</p>
									<p class="text-xs text-emerald-600 font-medium">Pagado: {formatCurrency(modulo.monto_pagado || 0)}</p>
								</div>
							</div>

							<!-- Acciones -->
							<div class="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
								{#if canIniciar}
									<Button
										size="sm"
										onclick={() => handleIniciar(index)}
										loading={loading[getModuloKey(index, 'iniciar')]}
									>
										{#snippet leftIcon()}
											<CheckIcon class="size-4" />
										{/snippet}
										Iniciar
									</Button>
								{/if}

								{#if canDeshacerInicio}
									<Button
										size="sm"
										variant="secondary"
										onclick={() => handleDeshacerInicio(index)}
										loading={loading[getModuloKey(index, 'deshacer-inicio')]}
									>
										{#snippet leftIcon()}
											<XIcon class="size-4" />
										{/snippet}
										Revertir inicio
									</Button>
									<!-- F-2026-08-11-MODULOS-EC: input de asistencia opcional al cerrar módulo.
									     Si < 80%, el backend fuerza Reprobado. Si >= 80% o vacío, no afecta la nota. -->
									<div class="flex items-center gap-1.5">
										<label for={`asist-${index}`} class="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
											Asistencia %:
										</label>
										<input
											id={`asist-${index}`}
											type="number"
											min="0"
											max="100"
											step="1"
											bind:value={asistenciaInputs[index]}
											placeholder="0-100"
											class="w-20 rounded-lg border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface py-1.5 px-2 text-sm text-gray-900 dark:text-white outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
										/>
									</div>
									<Button
										size="sm"
										onclick={() => handleFinalizar(index)}
										loading={loading[getModuloKey(index, 'finalizar')]}
									>
										Cerrar módulo
									</Button>
								{/if}

								{#if canDeshacerFin}
									<Button
										size="sm"
										variant="secondary"
										onclick={() => handleDeshacerFinalizacion(index)}
										loading={loading[getModuloKey(index, 'deshacer-fin')]}
									>
										{#snippet leftIcon()}
											<ExclamationIcon class="size-4" />
										{/snippet}
										Revertir cierre
									</Button>
								{/if}

								{#if !canIniciar && !canDeshacerInicio && !canDeshacerFin}
									<span class="text-xs text-gray-500 dark:text-gray-400 italic">
										Sin acciones disponibles
									</span>
								{/if}

								<!-- F-2026-08-11-ASISTENCIA: boton para abrir el modal de
								     sesiones y registrar asistencia por clase. Disponible
								     para cualquier estado del modulo. -->
								<Button
									size="sm"
									variant="secondary"
									onclick={() => openAsistenciaModal(index)}
								>
									{#snippet leftIcon()}
										<ClipboardIcon class="size-4" />
									{/snippet}
									Asistencia
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					Esta inscripción no tiene módulos registrados.
				</div>
			{/if}

			<!-- Footer: cerrar -->
			<div class="flex justify-end pt-4 border-t border-gray-200 dark:border-dark-border">
				<Button variant="secondary" onclick={onClose}>
					Cerrar
				</Button>
			</div>
		</div>
	{/if}
</Modal>

<!-- F-2026-08-11-ASISTENCIA: modal para gestionar la asistencia del modulo seleccionado -->
{#if enrollment}
	<AsistenciaModal
		isOpen={asistenciaModalOpen}
		enrollmentId={String(enrollment._id)}
		estudiantes={estudiantesAsistencia}
		moduloIndex={asistenciaModuloIndex}
		moduloNombre={`#${asistenciaModuloIndex + 1} · ${asistenciaModuloNombre}`}
		onClose={closeAsistenciaModal}
	/>
{/if}
