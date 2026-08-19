<script lang="ts">
	/**
	 * F-2026-08-11-ASISTENCIA: modal para gestionar la asistencia de un
	 * modulo especifico de un enrollment. Permite:
	 *  - Crear/listar/eliminar sesiones de clase
	 *  - Seleccionar una sesion y registrar asistencia en bulk
	 *  - Ver el % de asistencia calculado de cada estudiante
	 *  - Cumple la regla del 80% asistencia (educacion continua UAGRM)
	 */
	import Modal from './modal.svelte';
	import Button from './button.svelte';
	import {
		asistenciaService,
		type Sesion,
		type EstadoAsistencia,
		ESTADOS_ASISTENCIA
	} from '$lib/services/asistencia.service';
	import { alert } from '$lib/utils';
	import { CheckIcon, XIcon, PlusIcon, TrashIcon } from '$lib/icons/outline';
	import { onMount } from 'svelte';

	interface Props {
		isOpen: boolean;
		enrollmentId: string;
		estudiantes: { _id: string; nombre: string; registro?: string }[];
		moduloIndex: number;
		moduloNombre: string;
		onClose: () => void;
	}

	let { isOpen, enrollmentId, estudiantes, moduloIndex, moduloNombre, onClose }: Props =
		$props();

	// Estado
	let loading = $state(false);
	let sesiones = $state<Sesion[]>([]);
	let sesionSeleccionada = $state<Sesion | null>(null);
	let nuevaFecha = $state('');
	let nuevoTema = $state('');
	let registros = $state<Record<string, EstadoAsistencia>>({});
	let porcentajes = $state<
		Record<string, { porcentaje: number; cumple_regla_80: boolean; total_sesiones: number }>
	>({});

	onMount(() => {
		// Default a la fecha de hoy en formato YYYY-MM-DDTHH:MM
		const now = new Date();
		const tz = now.getTimezoneOffset() * 60000;
		nuevaFecha = new Date(now.getTime() - tz).toISOString().slice(0, 16);
	});

	$effect(() => {
		if (isOpen) {
			cargarSesiones();
		}
	});

	async function cargarSesiones() {
		loading = true;
		try {
			sesiones = await asistenciaService.listarSesiones(enrollmentId, moduloIndex);
			// Si hay sesiones y no hay ninguna seleccionada, seleccionar la primera
			if (sesiones.length > 0 && !sesionSeleccionada) {
				await seleccionarSesion(sesiones[0]);
			}
			// Cargar % de asistencia de cada estudiante
			await cargarPorcentajes();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudieron cargar las sesiones');
		} finally {
			loading = false;
		}
	}

	async function cargarPorcentajes() {
		const newPorc: typeof porcentajes = {};
		for (const est of estudiantes) {
			try {
				const p = await asistenciaService.getPorcentajeAsistencia(
					enrollmentId,
					moduloIndex,
					est._id
				);
				newPorc[est._id] = {
					porcentaje: p.porcentaje,
					cumple_regla_80: p.cumple_regla_80,
					total_sesiones: p.total_sesiones
				};
			} catch (e) {
				// silencioso
			}
		}
		porcentajes = newPorc;
	}

	async function crearSesion() {
		if (!nuevaFecha) {
			alert('error', 'Indica la fecha y hora de la sesion.');
			return;
		}
		loading = true;
		try {
			const sesion = await asistenciaService.crearSesion({
				enrollment_id: enrollmentId,
				modulo_index: moduloIndex,
				fecha: new Date(nuevaFecha).toISOString(),
				tema: nuevoTema || undefined
			});
			alert('success', 'Sesion creada. Registra la asistencia abajo.');
			nuevoTema = '';
			await cargarSesiones();
			await seleccionarSesion(sesion);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo crear la sesion');
		} finally {
			loading = false;
		}
	}

	async function seleccionarSesion(s: Sesion) {
		sesionSeleccionada = s;
		registros = {};
		try {
			const detalle = await asistenciaService.getSesion(s._id);
			// Pre-cargar los registros existentes en el formulario
			for (const r of detalle.registros) {
				registros[r.estudiante_id] = r.estado;
			}
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar el detalle');
		}
	}

	async function guardarAsistencia() {
		if (!sesionSeleccionada) {
			alert('error', 'Selecciona una sesion primero.');
			return;
		}
		const items = Object.entries(registros)
			.filter(([_, estado]) => estado != null)
			.map(([estudiante_id, estado]) => ({ estudiante_id, estado }));
		if (items.length === 0) {
			alert('error', 'Marca al menos un estudiante.');
			return;
		}
		loading = true;
		try {
			await asistenciaService.registrarAsistenciaBulk(sesionSeleccionada._id, items);
			alert('success', `Asistencia guardada para ${items.length} estudiantes.`);
			await cargarPorcentajes();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo guardar la asistencia');
		} finally {
			loading = false;
		}
	}

	async function eliminarSesion(s: Sesion) {
		if (
			!confirm(
				`¿Eliminar la sesion del ${new Date(s.fecha).toLocaleString('es-BO')}? Se borraran TODOS los registros de asistencia asociados.`
			)
		)
			return;
		loading = true;
		try {
			await asistenciaService.eliminarSesion(s._id);
			alert('success', 'Sesion eliminada.');
			if (sesionSeleccionada?._id === s._id) {
				sesionSeleccionada = null;
				registros = {};
			}
			await cargarSesiones();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo eliminar la sesion');
		} finally {
			loading = false;
		}
	}

	function formatFecha(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString('es-BO', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<Modal {isOpen} title="Asistencia — {moduloNombre}" maxWidth="sm:max-w-4xl" {onClose}>
	<div class="p-6 space-y-5">
		<!-- Resumen del modulo y % por estudiante -->
		<div class="rounded-xl border border-primary-200 bg-primary-50/50 p-3 dark:border-primary-900/50 dark:bg-primary-900/10">
			<p class="text-xs font-bold uppercase tracking-wide text-primary-700 dark:text-dark-tertiary mb-2">
				% Asistencia por estudiante (regla 80%)
			</p>
			{#if Object.keys(porcentajes).length === 0}
				<p class="text-xs text-gray-500 dark:text-gray-400">
					Crea al menos una sesion para ver los porcentajes.
				</p>
			{:else}
				<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
					{#each estudiantes as est (est._id)}
						{@const p = porcentajes[est._id]}
						{#if p}
							<div
								class={`flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold ${
									p.cumple_regla_80
										? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
										: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
								}`}
							>
								<span class="truncate" title={est.nombre}>{est.nombre}</span>
								<span>{p.porcentaje}%</span>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>

		<!-- Crear nueva sesion -->
		<div class="rounded-xl border border-gray-200 dark:border-dark-border p-3 space-y-2">
			<p class="text-sm font-bold text-gray-700 dark:text-gray-300">+ Nueva sesion</p>
			<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
				<input
					type="datetime-local"
					bind:value={nuevaFecha}
					class="rounded-lg border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1.5 text-sm"
				/>
				<input
					type="text"
					bind:value={nuevoTema}
					placeholder="Tema (opcional)"
					class="rounded-lg border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1.5 text-sm sm:col-span-2"
				/>
			</div>
			<Button size="sm" onclick={crearSesion} loading={loading}>
				{#snippet leftIcon()}
					<PlusIcon class="size-4" />
				{/snippet}
				Crear sesion
			</Button>
		</div>

		<!-- Lista de sesiones -->
		<div>
			<p class="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
				Sesiones registradas ({sesiones.length})
			</p>
			{#if loading && sesiones.length === 0}
				<p class="text-xs text-gray-500">Cargando...</p>
			{:else if sesiones.length === 0}
				<p class="text-xs text-gray-500 dark:text-gray-400 italic">
					Aun no hay sesiones. Crea la primera arriba.
				</p>
			{:else}
				<div class="space-y-1 max-h-40 overflow-y-auto">
					{#each sesiones as s (s._id)}
						{@const isSelected = sesionSeleccionada?._id === s._id}
						<div
							class={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface/60'}`}
						>
							<button
								type="button"
								onclick={() => seleccionarSesion(s)}
								class="flex-1 text-left text-xs"
							>
								<p class="font-semibold text-gray-900 dark:text-white">
									{formatFecha(s.fecha)}
								</p>
								{#if s.tema}
									<p class="text-gray-500 dark:text-gray-400 truncate">{s.tema}</p>
								{/if}
							</button>
							<button
								type="button"
								onclick={() => eliminarSesion(s)}
								class="text-red-500 hover:text-red-700 p-1"
								title="Eliminar sesion"
							>
								<TrashIcon class="size-4" />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Registrar asistencia de la sesion seleccionada -->
		{#if sesionSeleccionada}
			<div class="rounded-xl border border-gray-200 dark:border-dark-border p-3 space-y-2">
				<p class="text-sm font-bold text-gray-700 dark:text-gray-300">
					Asistencia para: {formatFecha(sesionSeleccionada.fecha)}
				</p>
				<div class="space-y-1.5 max-h-80 overflow-y-auto">
					{#each estudiantes as est (est._id)}
						<div class="flex items-center justify-between gap-2 py-1">
							<div class="flex-1 min-w-0">
								<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">
									{est.nombre}
								</p>
								{#if est.registro}
									<p class="text-[10px] text-gray-500">Reg: {est.registro}</p>
								{/if}
							</div>
							<select
								bind:value={registros[est._id]}
								class="rounded-lg border-2 border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-2 py-1 text-xs"
							>
								<option value={undefined}>— Sin marcar —</option>
								{#each ESTADOS_ASISTENCIA as estado}
									<option value={estado}>{estado}</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
				<Button size="sm" onclick={guardarAsistencia} loading={loading}>
					{#snippet leftIcon()}
						<CheckIcon class="size-4" />
					{/snippet}
					Guardar asistencia
				</Button>
			</div>
		{/if}

		<!-- Footer -->
		<div class="flex justify-end pt-3 border-t border-gray-200 dark:border-dark-border">
			<Button variant="secondary" onclick={onClose}>Cerrar</Button>
		</div>
	</div>
</Modal>
