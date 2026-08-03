<script lang="ts">
	/**
	 * GestionModulosModal (F-MODAL-GESTION-MODULOS, 2026-08-03)
	 * =========================================================
	 * Modal CENTRALIZADO de gestión de módulos por inscripción.
	 *
	 * REEMPLAZA al antiguo `ModulosModal.svelte` (que estaba solo en el
	 * Kardex). Este nuevo modal:
	 *   - Muestra el ciclo de vida completo de cada módulo del programa
	 *   - Calcula el siguiente paso lógico (qué se puede hacer ahora)
	 *   - Bloquea acciones que no corresponden al flujo académico
	 *   - Muestra info financiera por módulo (costo, pagado, saldo)
	 *   - Muestra info de auditoría (quién/cuándo inició/cerró)
	 *
	 * Acciones disponibles (admin/superadmin/encargado_curso del curso):
	 *   - Iniciar módulo
	 *   - Revertir inicio
	 *   - Finalizar módulo (cerrar)
	 *   - Revertir cierre
	 *
	 * Estado visual de cada módulo:
	 *   ○ Pendiente  (no iniciado)
	 *   ◐ En curso   (iniciado_en != null, finalizado_en == null)
	 *   ✓ Finalizado (finalizado_en != null)
	 *   ⛔ Bloqueado (módulo N requiere N-1 finalizado)
	 *
	 * Accesible desde:
	 *   - Kardex del estudiante (/app/enrollments)
	 *   - Lista de Inscritos
	 *   - Reporte de Cuentas por Cobrar
	 *   - Ficha del estudiante (/app/students)
	 */
	import Modal from './modal.svelte';
	import Button from './button.svelte';
	import { cuentasPorCobrarService } from '$lib/services';
	import { alert, formatCurrency, formatDate } from '$lib/utils';
	import {
		CheckIcon,
		XIcon,
		ExclamationIcon,
		ClipboardIcon,
		RefreshIcon
	} from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		enrollment: any | null;
		onClose: () => void;
		onUpdated?: (enrollment: any) => void;
	}

	let { isOpen, enrollment, onClose, onUpdated }: Props = $props();

	let loading = $state<Record<string, boolean>>({});
	let refreshing = $state(false);

	function key(index: number, action: string): string {
		return `${index}-${action}`;
	}

	async function withLoading(k: string, fn: () => Promise<any>) {
		loading = { ...loading, [k]: true };
		try {
			return await fn();
		} finally {
			loading = { ...loading, [k]: false };
		}
	}

	// ========================================================================
	// ACCIONES
	// ========================================================================

	async function handleIniciar(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Marcar este módulo como "en curso"? Esta acción quedará registrada en la auditoría.')) return;
		try {
			const updated = await withLoading(key(index, 'iniciar'), () =>
				cuentasPorCobrarService.iniciarModulo(String(enrollment._id), index)
			);
			enrollment = updated;
			onUpdated?.(updated);
			alert('success', 'Módulo marcado como "en curso".');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo iniciar el módulo');
		}
	}

	async function handleDeshacerInicio(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Revertir el inicio de este módulo? Volverá a "no iniciado". Quedará registrado en la auditoría.')) return;
		try {
			const updated = await withLoading(key(index, 'deshacer-inicio'), () =>
				cuentasPorCobrarService.deshacerInicioModulo(String(enrollment._id), index)
			);
			enrollment = updated;
			onUpdated?.(updated);
			alert('success', 'Inicio del módulo revertido.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo revertir el inicio');
		}
	}

	async function handleFinalizar(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Cerrar este módulo? Marcará el módulo como "finalizado" y ya no contará como activo. Quedará registrado en la auditoría.')) return;
		try {
			const updated = await withLoading(key(index, 'finalizar'), () =>
				cuentasPorCobrarService.finalizarModulo(String(enrollment._id), index)
			);
			enrollment = updated;
			onUpdated?.(updated);
			alert('success', 'Módulo finalizado.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo finalizar el módulo');
		}
	}

	async function handleDeshacerFinalizacion(index: number) {
		if (!enrollment) return;
		if (!confirm('¿Revertir la finalización? El módulo volverá a estar "en curso". Quedará registrado en la auditoría.')) return;
		try {
			const updated = await withLoading(key(index, 'deshacer-fin'), () =>
				cuentasPorCobrarService.deshacerFinalizacionModulo(String(enrollment._id), index)
			);
			enrollment = updated;
			onUpdated?.(updated);
			alert('success', 'Finalización revertida.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo revertir la finalización');
		}
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

	// ========================================================================
	// LÓGICA DE ESTADO Y VISUALIZACIÓN
	// ========================================================================

	type Estado = 'pendiente' | 'en_curso' | 'finalizado' | 'bloqueado';

	function getEstado(modulo: any, index: number, todosLosModulos: any[]): Estado {
		if (modulo.finalizado_en) return 'finalizado';
		if (modulo.iniciado_en) return 'en_curso';
		// Está bloqueado si el módulo anterior no está finalizado
		if (index > 0) {
			const anterior = todosLosModulos[index - 1];
			if (anterior && !anterior.finalizado_en) return 'bloqueado';
		}
		return 'pendiente';
	}

	const estadoVisual: Record<Estado, { label: string; icon: string; color: string; bg: string }> = {
		finalizado: {
			label: 'Finalizado',
			icon: '✓',
			color: 'text-blue-700 dark:text-blue-300',
			bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
		},
		en_curso: {
			label: 'En curso',
			icon: '◐',
			color: 'text-amber-700 dark:text-amber-300',
			bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
		},
		pendiente: {
			label: 'Pendiente',
			icon: '○',
			color: 'text-gray-600 dark:text-gray-400',
			bg: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700'
		},
		bloqueado: {
			label: 'Bloqueado',
			icon: '🔒',
			color: 'text-red-700 dark:text-red-300',
			bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
		}
	};

	function puedeIniciar(modulo: any, index: number, todosLosModulos: any[]): boolean {
		// Solo si está pendiente y no bloqueado
		if (modulo.iniciado_en || modulo.finalizado_en) return false;
		if (index === 0) return true;
		const anterior = todosLosModulos[index - 1];
		return anterior && !!anterior.finalizado_en;
	}

	function puedeRevertirInicio(modulo: any): boolean {
		return !!modulo.iniciado_en && !modulo.finalizado_en;
	}

	function puedeFinalizar(modulo: any): boolean {
		return !!modulo.iniciado_en && !modulo.finalizado_en;
	}

	function puedeRevertirCierre(modulo: any): boolean {
		return !!modulo.finalizado_en;
	}

	function getResumenFinanciero(): { totalCosto: number; totalPagado: number; totalSaldo: number } {
		if (!enrollment?.modulos) return { totalCosto: 0, totalPagado: 0, totalSaldo: 0 };
		let totalCosto = 0;
		let totalPagado = 0;
		for (const m of enrollment.modulos) {
			totalCosto += m.costo || 0;
			totalPagado += m.monto_pagado || 0;
		}
		return {
			totalCosto,
			totalPagado,
			totalSaldo: Math.max(0, totalCosto - totalPagado)
		};
	}

	function getResumenAcademico(): {
		modulosFinalizados: number;
		modulosEnCurso: number;
		modulosPendientes: number;
		modulosBloqueados: number;
		progreso: number;
	} {
		if (!enrollment?.modulos) {
			return { modulosFinalizados: 0, modulosEnCurso: 0, modulosPendientes: 0, modulosBloqueados: 0, progreso: 0 };
		}
		let finalizados = 0;
		let enCurso = 0;
		let pendientes = 0;
		let bloqueados = 0;
		for (let i = 0; i < enrollment.modulos.length; i++) {
			const e = getEstado(enrollment.modulos[i], i, enrollment.modulos);
			if (e === 'finalizado') finalizados++;
			else if (e === 'en_curso') enCurso++;
			else if (e === 'bloqueado') bloqueados++;
			else pendientes++;
		}
		const total = enrollment.modulos.length;
		const progreso = total > 0 ? Math.round((finalizados / total) * 100) : 0;
		return { modulosFinalizados: finalizados, modulosEnCurso: enCurso, modulosPendientes: pendientes, modulosBloqueados: bloqueados, progreso };
	}

	// Resúmenes reactivos (Svelte 5 runes)
	const resumenFinanciero = $derived(getResumenFinanciero());
	const resumenAcademico = $derived(getResumenAcademico());
</script>

<Modal
	{isOpen}
	title="Gestión de Módulos"
	maxWidth="sm:max-w-4xl"
	onClose={onClose}
>
	{#if enrollment}
		<div class="p-6 space-y-5">
			<!-- ============ ENCABEZADO: INFO DE LA INSCRIPCIÓN ============ -->
			<div class="bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10 p-4 rounded-xl border border-primary-200 dark:border-primary-800">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0 flex-1">
						<p class="text-xs text-primary-700 dark:text-primary-300 uppercase tracking-wider font-bold mb-1">Inscripción</p>
						<p class="text-base font-bold text-slate-900 dark:text-white">
							{enrollment.curso_nombre || `Curso ${enrollment.curso_id}`}
						</p>
						<p class="text-sm text-slate-600 dark:text-slate-300 mt-1">
							{enrollment.estudiante_nombre || `Estudiante ${enrollment.estudiante_id}`}
						</p>
					</div>
					<Button size="sm" variant="secondary" onclick={handleRefresh} loading={refreshing}>
						{#snippet leftIcon()}<RefreshIcon class="size-4" />{/snippet}
						Refrescar
					</Button>
				</div>
			</div>

			<!-- ============ RESUMEN RÁPIDO: PROGRESO + FINANZAS ============ -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
				<!-- Progreso académico -->
				<div class="bg-white dark:bg-dark-surface p-3 rounded-lg border border-gray-200 dark:border-dark-border">
					<p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Progreso</p>
					<p class="text-2xl font-bold text-primary-600 dark:text-primary-400">{resumenAcademico.progreso}%</p>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
						{resumenAcademico.modulosFinalizados}/{enrollment.modulos.length} finalizados
					</p>
				</div>
				<!-- Módulos en curso -->
				<div class="bg-white dark:bg-dark-surface p-3 rounded-lg border border-gray-200 dark:border-dark-border">
					<p class="text-xs text-gray-500 dark:text-gray-400 font-medium">En curso</p>
					<p class="text-2xl font-bold text-amber-600 dark:text-amber-400">{resumenAcademico.modulosEnCurso}</p>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">módulos activos</p>
				</div>
				<!-- Pagado -->
				<div class="bg-white dark:bg-dark-surface p-3 rounded-lg border border-gray-200 dark:border-dark-border">
					<p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Pagado</p>
					<p class="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(resumenFinanciero.totalPagado)}</p>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">de {formatCurrency(resumenFinanciero.totalCosto)}</p>
				</div>
				<!-- Saldo pendiente -->
				<div class="bg-white dark:bg-dark-surface p-3 rounded-lg border border-gray-200 dark:border-dark-border">
					<p class="text-xs text-gray-500 dark:text-gray-400 font-medium">Saldo</p>
					<p class="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(resumenFinanciero.totalSaldo)}</p>
					<p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">por pagar</p>
				</div>
			</div>

			<!-- ============ LISTA DE MÓDULOS ============ -->
			{#if enrollment.modulos && enrollment.modulos.length > 0}
				<div class="space-y-3">
					<h3 class="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Módulos del programa</h3>
					{#each enrollment.modulos as modulo, index}
						{@const estado = getEstado(modulo, index, enrollment.modulos)}
						{@const visual = estadoVisual[estado]}
						{@const canIniciar = puedeIniciar(modulo, index, enrollment.modulos)}
						{@const canRevertirInicio = puedeRevertirInicio(modulo)}
						{@const canFinalizar = puedeFinalizar(modulo)}
						{@const canRevertirCierre = puedeRevertirCierre(modulo)}
						{@const saldoModulo = Math.max(0, (modulo.costo || 0) - (modulo.monto_pagado || 0))}

						<div class={`p-4 rounded-xl border-2 ${visual.bg}`}>
							<!-- Header: nombre + estado + costo -->
							<div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2 mb-1">
										<span class={`text-xl ${visual.color}`}>{visual.icon}</span>
										<p class="text-sm font-bold text-slate-900 dark:text-white" title={modulo.nombre}>
											<span class="text-gray-400 dark:text-gray-500">#{index + 1}</span> · {modulo.nombre}
										</p>
									</div>
									<!-- Estado y fechas -->
									<div class="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
										<span class={`px-2 py-0.5 font-bold rounded-full ${visual.color} bg-white dark:bg-dark-surface border border-current/20`}>
											{visual.label}
										</span>
										{#if modulo.iniciado_en}
											<span class="text-gray-600 dark:text-gray-400">
												<ClipboardIcon class="size-3 inline" /> Inicio: {formatDate(modulo.iniciado_en)}
											</span>
										{/if}
										{#if modulo.finalizado_en}
											<span class="text-blue-600 dark:text-blue-400">
												<CheckIcon class="size-3 inline" /> Cierre: {formatDate(modulo.finalizado_en)}
											</span>
										{/if}
									</div>
								</div>
								<!-- Costo -->
								<div class="text-right text-sm shrink-0">
									<p class="text-xs text-gray-500">Costo</p>
									<p class="font-bold text-slate-900 dark:text-white">{formatCurrency(modulo.costo)}</p>
									{#if modulo.monto_pagado > 0}
										<p class="text-xs text-emerald-600 font-medium">Pagado: {formatCurrency(modulo.monto_pagado)}</p>
									{/if}
									{#if saldoModulo > 0 && estado !== 'finalizado'}
										<p class="text-xs text-red-600 font-medium">Saldo: {formatCurrency(saldoModulo)}</p>
									{/if}
								</div>
							</div>

							<!-- Mensaje de bloqueo si aplica -->
							{#if estado === 'bloqueado'}
								<div class="mt-3 p-2 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
									🔒 Este módulo requiere que el módulo anterior esté <strong>finalizado</strong>. Inicia y cierra el módulo #{index} primero.
								</div>
							{/if}

							<!-- Acciones -->
							<div class="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-current/10">
								{#if canIniciar}
									<Button
										size="sm"
										onclick={() => handleIniciar(index)}
										loading={loading[key(index, 'iniciar')]}
									>
										{#snippet leftIcon()}<CheckIcon class="size-4" />{/snippet}
										Iniciar módulo
									</Button>
								{/if}

								{#if canRevertirInicio}
									<Button
										size="sm"
										variant="secondary"
										onclick={() => handleDeshacerInicio(index)}
										loading={loading[key(index, 'deshacer-inicio')]}
									>
										{#snippet leftIcon()}<XIcon class="size-4" />{/snippet}
										Revertir inicio
									</Button>
									<Button
										size="sm"
										onclick={() => handleFinalizar(index)}
										loading={loading[key(index, 'finalizar')]}
									>
										{#snippet leftIcon()}<CheckIcon class="size-4" />{/snippet}
										Cerrar módulo
									</Button>
								{/if}

								{#if canRevertirCierre}
									<Button
										size="sm"
										variant="secondary"
										onclick={() => handleDeshacerFinalizacion(index)}
										loading={loading[key(index, 'deshacer-fin')]}
									>
										{#snippet leftIcon()}<ExclamationIcon class="size-4" />{/snippet}
										Revertir cierre
									</Button>
								{/if}

								{#if !canIniciar && !canRevertirInicio && !canRevertirCierre}
									<span class="text-xs text-gray-500 dark:text-gray-400 italic">
										{#if estado === 'finalizado'}
											Módulo cerrado.
										{:else}
											Sin acciones disponibles.
										{/if}
									</span>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="text-center py-8 text-gray-500 dark:text-gray-400">
					Esta inscripción no tiene módulos registrados.
				</div>
			{/if}

			<!-- Footer -->
			<div class="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-dark-border">
				<p class="text-xs text-gray-500 dark:text-gray-400">
					💡 Las acciones quedan registradas con fecha y usuario para auditoría.
				</p>
				<Button variant="secondary" onclick={onClose}>
					Cerrar
				</Button>
			</div>
		</div>
	{/if}
</Modal>
