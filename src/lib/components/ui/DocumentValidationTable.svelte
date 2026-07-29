<script lang="ts">
	/**
	 * F-089 (2026-07-29): Tabla de validación de documentos (estudiantes × requisitos).
	 *
	 * Pedido de Lic. Sandra Zabala en reunión 2026-07-29: "hacerte una tablita
	 * aquí, así como tenemos en la cobranza de todos los requisitos. Ya uno, dos,
	 * tres, ta, ta ta y que te salga. Un check de..."
	 *
	 * Layout: estudiantes como filas, requisitos/documentos como columnas, con
	 * check visual (✓ verde = aprobado, ✗ rojo = rechazado, ⏳ amarillo =
	 * pendiente, — gris = no_aplica). Toggle "solo pendientes" para enfocarse
	 * en lo que falta. Click en una celda abre el detalle del documento.
	 *
	 * Este componente REEMPLAZA al DocumentValidationModal.svelte (946 líneas)
	 * para esta vista específica, pero conserva las acciones de aprobar/rechazar
	 * que se mantienen en el modal original.
	 *
	 * Permisos: superadmin, admin, cpd, encargado_curso, coordinador.
	 */
	import { onMount, tick } from 'svelte';
	import { slide, fade } from 'svelte/transition';
	import { XIcon, CircleCheckIcon, StopwatchIcon, CheckIcon, XMarkIcon, EyeIcon, FileTextIcon, UsersIcon, RefreshIcon, DownloadIcon, ExclamationCircleIcon } from '$lib/icons/outline';
	import Button from '$lib/components/ui/button.svelte';
	import { enrollmentService, studentService, courseService } from '$lib/services';
	import type { Enrollment, Student } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import { formatDate } from '$lib/utils/formatters';

	interface Props {
		isOpen?: boolean;
		onClose: () => void;
	}

	let { isOpen = false, onClose }: Props = $props();

	// Estado UI
	let loading = $state(true);
	let onlyPending = $state(true);
	let searchTerm = $state('');
	let error = $state('');

	// Datos
	let students = $state<Student[]>([]);
	let enrollments = $state<Enrollment[]>([]);
	let coursesMap = $state<Record<string, { nombre: string; codigo: string }>>({});
	let studentsMap = $state<Record<string, Student>>({});

	// Acciones inline
	let actionLoading = $state<string | null>(null);  // "tipo|studentId|reqKey"
	let rejectingKey = $state<string | null>(null);
	let motivoRechazo = $state('');

	// Detalle modal
	let showDocModal = $state(false);
	let docModalTitle = $state('');
	let docModalUrl = $state('');
	let docModalEstado = $state('');
	let docModalMotivo = $state('');

	// Lista única de requisitos tipificados (las COLUMNAS de la tabla)
	// Sandra quiere ver: CV | Carnet | Afiliación | Título | Formulario | Req 1 | Req 2 | ...
	const COLUMNAS_PERSONALES = [
		{ key: 'cv', label: 'CV', emoji: '📄' },
		{ key: 'carnet', label: 'Carnet', emoji: '🪪' },
		{ key: 'afiliacion', label: 'Afiliación', emoji: '📜' },
		{ key: 'titulo', label: 'Título', emoji: '🎓' },
		{ key: 'formulario', label: 'Form. Inscripción', emoji: '📋' },
	] as const;

	// Estados: 4 valores (uno por celda)
	type EstadoDoc = 'aprobado' | 'pendiente' | 'rechazado' | 'no_aplica' | 'no_subido';

	function getEstadoDoc(estado: string | undefined | null): EstadoDoc {
		const e = (estado || '').toLowerCase();
		if (e === 'aprobado' || e === 'verificado') return 'aprobado';
		if (e === 'rechazado') return 'rechazado';
		if (e === 'en_proceso' || e === 'pendiente') return 'pendiente';
		return 'no_subido';
	}

	function getEstadoClass(estado: EstadoDoc): string {
		switch (estado) {
			case 'aprobado':
				return 'bg-green-100 text-green-800 border-green-300';
			case 'rechazado':
				return 'bg-red-100 text-red-800 border-red-300';
			case 'pendiente':
				return 'bg-amber-100 text-amber-800 border-amber-300';
			default:
				return 'bg-gray-50 text-gray-400 border-gray-200';
		}
	}

	function getEstadoIcon(estado: EstadoDoc): string {
		switch (estado) {
			case 'aprobado':
				return '✓';
			case 'rechazado':
				return '✗';
			case 'pendiente':
				return '⏳';
			default:
				return '—';
		}
	}

	function getEstadoLabel(estado: EstadoDoc): string {
		switch (estado) {
			case 'aprobado':
				return 'Aprobado';
			case 'rechazado':
				return 'Rechazado';
			case 'pendiente':
				return 'Pendiente';
			case 'no_subido':
				return 'No subido';
			default:
				return '—';
		}
	}

	// Estructura: cada estudiante tiene una fila con el estado de cada celda
	interface EstudianteFila {
		estudiante: Student;
		enrollment: Enrollment | null;
		celdas: Record<string, EstadoDoc>;  // key = columna
		pendientes: number;  // cuántos pendientes tiene
		tieneRechazados: boolean;
	}

	// Columnas dinámicas: las 5 personales + los requisitos de TODOS los cursos
	// (union). Para mantener el ancho manejable, mostramos hasta 8 requisitos
	// y agrupamos el resto como "+N".
	let todasColumnas = $derived.by<Array<{ key: string; label: string; emoji?: string }>>(() => {
		const reqKeysSet = new Set<string>();
		for (const e of enrollments) {
			for (let i = 0; i < (e.requisitos || []).length; i++) {
				reqKeysSet.add(`req:${i}:${e.requisitos[i].descripcion}`);
			}
		}
		const reqList = Array.from(reqKeysSet)
			.map((k) => {
				const [_, idxStr, desc] = k.split(':');
				return { key: `req:${idxStr}`, label: `Req ${parseInt(idxStr) + 1}: ${desc}`, emoji: '📝' };
			})
			.sort((a, b) => a.key.localeCompare(b.key));
		return [...COLUMNAS_PERSONALES.map((c) => ({ ...c })), ...reqList];
	});

	// Filas: estudiantes que tienen al menos 1 enrollment activo
	let filas = $derived.by<EstudianteFila[]>(() => {
		const resultado: EstudianteFila[] = [];
		for (const est of students) {
			const enrList = enrollments.filter((e) => e.estudiante_id === est._id);
			if (enrList.length === 0) continue;
			// Tomar el primer enrollment activo (o el primero de la lista)
			const enr = enrList.find((e) => e.estado === 'activo') || enrList[0];

			const celdas: Record<string, EstadoDoc> = {};
			// Personales
			celdas['cv'] = getEstadoDoc(est.cv_estado);
			celdas['carnet'] = getEstadoDoc(est.carnet_estado);
			celdas['afiliacion'] = getEstadoDoc(est.afiliacion_estado);
			celdas['titulo'] = getEstadoDoc(est.titulo?.estado);
			celdas['formulario'] = enr.formulario_inscripcion_url && enr.formulario_inscripcion_url.length > 0
				? getEstadoDoc('aprobado')
				: getEstadoDoc('no_subido');
			// Requisitos (1 celda por índice, todos los cursos comparten el mismo índice)
			for (let i = 0; i < (enr.requisitos || []).length; i++) {
				const req = enr.requisitos[i];
				celdas[`req:${i}`] = getEstadoDoc(req.estado);
			}

			const pendientes = Object.values(celdas).filter((c) => c === 'pendiente' || c === 'no_subido').length;
			const tieneRechazados = Object.values(celdas).some((c) => c === 'rechazado');

			resultado.push({ estudiante: est, enrollment: enr, celdas, pendientes, tieneRechazados });
		}
		// Ordenar por nombre
		resultado.sort((a, b) => (a.estudiante.nombre || '').localeCompare(b.estudiante.nombre || ''));
		return resultado;
	});

	let filasFiltradas = $derived.by<EstudianteFila[]>(() => {
		let lista = filas;
		if (onlyPending) {
			lista = lista.filter((f) => f.pendientes > 0 || f.tieneRechazados);
		}
		const term = searchTerm.trim().toLowerCase();
		if (term) {
			lista = lista.filter(
				(f) =>
					(f.estudiante.nombre || '').toLowerCase().includes(term) ||
					(f.estudiante.carnet || '').toLowerCase().includes(term) ||
					(f.estudiante.registro || '').toLowerCase().includes(term) ||
					(f.estudiante.email || '').toLowerCase().includes(term)
			);
		}
		return lista;
	});

	let resumen = $derived.by(() => {
		const total = filas.length;
		const completos = filas.filter((f) => f.pendientes === 0 && !f.tieneRechazados).length;
		const conPendientes = filas.filter((f) => f.pendientes > 0).length;
		const conRechazados = filas.filter((f) => f.tieneRechazados).length;
		return { total, completos, conPendientes, conRechazados };
	});

	async function loadData() {
		loading = true;
		error = '';
		try {
			const [resEnr, resStu, resCourses] = await Promise.all([
				enrollmentService.getAll(1, 500).catch(() => ({ data: [] as Enrollment[] })),
				studentService.getAll(1, 500).catch(() => ({ data: [] as Student[] })),
				courseService.getAll(1, 100).catch(() => ({ data: [] as any[] })),
			]);
			students = resStu.data || [];
			enrollments = resEnr.data || [];
			const sm: Record<string, Student> = {};
			for (const s of students) sm[s._id] = s;
			studentsMap = sm;
			const cm: Record<string, { nombre: string; codigo: string }> = {};
			for (const c of (resCourses.data || [])) cm[c._id] = { nombre: c.nombre_programa || '', codigo: c.codigo || '' };
			coursesMap = cm;
		} catch (e: any) {
			error = `Error al cargar datos: ${e?.message || e}`;
		} finally {
			loading = false;
		}
	}

	function openDocModal(title: string, url: string, estado: string, motivo: string) {
		docModalTitle = title;
		docModalUrl = url;
		docModalEstado = estado;
		docModalMotivo = motivo;
		showDocModal = true;
	}

	function clickCeldaPersonnal(est: Student, col: string) {
		const tUrl = (est as any)[`${col}_url`] || (col === 'titulo' ? est.titulo?.titulo_url : '');
		const estado = col === 'titulo' ? est.titulo?.estado : (est as any)[`${col}_estado`];
		const motivo = col === 'titulo' ? (est.titulo as any)?.motivo_rechazo : (est as any)[`${col}_motivo_rechazo`];
		if (!tUrl) {
			alert('info', `${est.nombre} aún no subió ${col.toUpperCase()}.`);
			return;
		}
		openDocModal(`${col.toUpperCase()} de ${est.nombre}`, tUrl, estado || 'pendiente', motivo || '');
	}

	function clickCeldaRequisito(est: Student, enr: Enrollment, idx: number) {
		const req = enr.requisitos?.[idx];
		if (!req) return;
		if (!req.url) {
			alert('info', `${est.nombre} aún no subió el requisito "${req.descripcion}".`);
			return;
		}
		openDocModal(
			`Requisito "${req.descripcion}" de ${est.nombre}`,
			req.url,
			req.estado || 'pendiente',
			req.motivo_rechazo || ''
		);
	}

	// ========================================================================
	// Acciones de aprobación / rechazo (inline)
	// ========================================================================
	async function aprobarCelda(est: Student, col: string) {
		const key = `${col}|${est._id}`;
		actionLoading = key;
		try {
			if (col === 'cv' || col === 'carnet' || col === 'afiliacion') {
				await studentService.verifyDocument(est._id, col);
			} else if (col === 'titulo') {
				const t = est.titulo;
				await studentService.verifyTitulo(est._id, {
					titulo: t?.titulo || '',
					numero_titulo: t?.numero_titulo || '',
					año_expedicion: t?.año_expedicion || '',
					universidad: t?.universidad || ''
				});
			} else {
				alert('info', 'La aprobación de requisitos por inscripción se hace en la sección de Detalle de Inscripción.');
				return;
			}
			alert('success', `${col.toUpperCase()} aprobado para ${est.nombre}.`);
			await loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar el documento.');
		} finally {
			actionLoading = null;
		}
	}

	function iniciarRechazo(est: Student, col: string) {
		rejectingKey = `${col}|${est._id}`;
		motivoRechazo = '';
	}

	async function confirmarRechazo(est: Student, col: string) {
		if (!motivoRechazo.trim()) {
			alert('error', 'Debes escribir un motivo de rechazo.');
			return;
		}
		const key = `${col}|${est._id}`;
		actionLoading = key;
		try {
			if (col === 'cv' || col === 'carnet' || col === 'afiliacion') {
				await studentService.rejectDocument(est._id, col, motivoRechazo.trim());
			} else if (col === 'titulo') {
				await studentService.rejectTitulo(est._id, motivoRechazo.trim());
			} else {
				alert('info', 'El rechazo de requisitos por inscripción se hace en el detalle.');
				return;
			}
			alert('success', `${col.toUpperCase()} rechazado.`);
			rejectingKey = null;
			motivoRechazo = '';
			await loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo rechazar el documento.');
		} finally {
			actionLoading = null;
		}
	}

	function cancelarRechazo() {
		rejectingKey = null;
		motivoRechazo = '';
	}

	function exportCSV() {
		// Construir CSV: nombre | ci | cada columna con label de estado
		const cols = todasColumnas;
		const header = ['#', 'Estudiante', 'CI', 'Email', 'Programa', ...cols.map((c) => c.label), 'Pendientes'];
		const lines: string[] = [header.map(csvCell).join(',')];
		filasFiltradas.forEach((f, i) => {
			const row = [
				String(i + 1),
				f.estudiante.nombre || '',
				`${f.estudiante.carnet || ''}${f.estudiante.complemento_carnet ? '-' + f.estudiante.complemento_carnet : ''}`,
				f.estudiante.email || '',
				f.enrollment ? coursesMap[f.enrollment.curso_id]?.codigo || '' : '',
				...cols.map((c) => getEstadoLabel(f.celdas[c.key] || 'no_subido')),
				String(f.pendientes),
			];
			lines.push(row.map(csvCell).join(','));
		});
		const csv = lines.join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `validacion_documentos_${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	function csvCell(v: string): string {
		const s = String(v || '').replace(/"/g, '""');
		return /[",\n]/.test(s) ? `"${s}"` : s;
	}

	$effect(() => {
		if (isOpen) {
			loadData();
		}
	});
</script>

{#if isOpen}
	<!-- Overlay -->
	<button
		type="button"
		class="fixed inset-0 z-[60] bg-gray-900/80 backdrop-blur-sm"
		onclick={onClose}
		aria-label="Cerrar"
		transition:fade={{ duration: 200 }}
	></button>

	<!-- Modal principal -->
	<div class="fixed inset-y-0 right-0 z-[70] w-full md:w-[90vw] lg:w-[85vw] max-w-7xl bg-white dark:bg-gray-900 shadow-2xl flex flex-col" transition:slide={{ duration: 250, axis: 'x' }}>
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
					<FileTextIcon class="size-6 text-amber-700 dark:text-amber-400" />
				</div>
				<div>
					<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Validación de Documentos</h2>
					<p class="text-xs text-gray-500">Vista de tabla: estudiantes × documentos requeridos</p>
				</div>
			</div>
			<button
				type="button"
				onclick={onClose}
				class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
				aria-label="Cerrar"
			>
				<XIcon class="size-5" />
			</button>
		</div>

		<!-- Controles -->
		<div class="flex flex-col md:flex-row gap-3 md:items-center p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
			<div class="flex-1 min-w-0">
				<input
					type="text"
					bind:value={searchTerm}
					placeholder="Buscar por nombre, CI, registro, email..."
					class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500 outline-none"
				/>
			</div>

			<label class="inline-flex items-center gap-2 cursor-pointer select-none">
				<input type="checkbox" bind:checked={onlyPending} class="size-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
				<span class="text-sm font-medium text-gray-700 dark:text-gray-300">Solo pendientes</span>
			</label>

			<button
				type="button"
				onclick={loadData}
				disabled={loading}
				class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
				title="Recargar"
			>
				<RefreshIcon class="size-4" />
			</button>

			<button
				type="button"
				onclick={exportCSV}
				disabled={filasFiltradas.length === 0}
				class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
			>
				<DownloadIcon class="size-4" />
				CSV
			</button>
		</div>

		<!-- Resumen KPI -->
		{#if !loading && filas.length > 0}
			<div class="grid grid-cols-2 md:grid-cols-4 gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
				<div class="text-center">
					<p class="text-2xl font-extrabold text-gray-900 dark:text-gray-100">{resumen.total}</p>
					<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Total</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-extrabold text-green-600">{resumen.completos}</p>
					<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Completos</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-extrabold text-amber-600">{resumen.conPendientes}</p>
					<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Con pendientes</p>
				</div>
				<div class="text-center">
					<p class="text-2xl font-extrabold text-red-600">{resumen.conRechazados}</p>
					<p class="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Con rechazados</p>
				</div>
			</div>
		{/if}

		<!-- Tabla con scroll -->
		<div class="flex-1 overflow-auto p-4">
			{#if loading}
				<div class="py-12 text-center text-gray-500">
					<div class="inline-block size-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
					<p class="text-sm">Cargando documentos...</p>
				</div>
			{:else if error}
				<div class="py-12 text-center text-red-600 text-sm">
					<ExclamationCircleIcon class="size-10 mx-auto mb-2" />
					{error}
				</div>
			{:else if filas.length === 0}
				<div class="py-12 text-center text-gray-500 text-sm">
					<UsersIcon class="size-12 mx-auto mb-3 text-gray-300" />
					No hay estudiantes inscritos para mostrar.
				</div>
			{:else if filasFiltradas.length === 0}
				<div class="py-12 text-center text-gray-500 text-sm">
					🎉 No hay estudiantes con documentos pendientes.
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-xs border-collapse min-w-[800px]">
						<thead>
							<tr class="bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-100">
								<th class="text-left p-2 font-bold sticky left-0 bg-primary-50 dark:bg-primary-900/30 z-10 min-w-[200px]">Estudiante</th>
								<th class="text-left p-2 font-bold min-w-[110px]">CI</th>
								{#each todasColumnas as col (col.key)}
									<th class="text-center p-2 font-bold min-w-[90px]" title={col.label}>
										{col.emoji ?? ''} {col.label.replace(/^Req \d+: /, '').slice(0, 14)}{col.label.length > 14 ? '…' : ''}
									</th>
								{/each}
								<th class="text-center p-2 font-bold min-w-[80px]">Pendientes</th>
							</tr>
						</thead>
						<tbody>
							{#each filasFiltradas as fila (fila.estudiante._id)}
								<tr class="border-t border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50">
									<td class="p-2 sticky left-0 bg-white dark:bg-gray-900 z-10">
										<div class="font-semibold text-gray-900 dark:text-gray-100 truncate max-w-[200px]" title={fila.estudiante.nombre}>
											{fila.estudiante.nombre || 'Sin nombre'}
										</div>
										<div class="text-[10px] text-gray-500">
											{fila.estudiante.registro}
											{#if fila.enrollment && coursesMap[fila.enrollment.curso_id]}
												· <span class="font-mono">{coursesMap[fila.enrollment.curso_id].codigo}</span>
											{/if}
										</div>
									</td>
									<td class="p-2 text-gray-700 dark:text-gray-300 font-mono text-[11px]">
										{fila.estudiante.carnet || ''}{fila.estudiante.complemento_carnet ? '-' + fila.estudiante.complemento_carnet : ''}
									</td>
									{#each todasColumnas as col (col.key)}
										{@const estado = fila.celdas[col.key] || 'no_subido'}
										<td class="p-1 text-center">
											<div class="relative group">
												<button
													type="button"
													onclick={() => {
														if (col.key.startsWith('req:')) {
															const idx = parseInt(col.key.split(':')[1] || '0');
															if (fila.enrollment) clickCeldaRequisito(fila.estudiante, fila.enrollment, idx);
														} else {
															clickCeldaPersonnal(fila.estudiante, col.key);
														}
													}}
													class={`w-full inline-flex items-center justify-center gap-1 rounded border px-1.5 py-1 text-[11px] ${getEstadoClass(estado)} hover:shadow-sm transition-shadow`}
													title={`${getEstadoLabel(estado)} — click para ver detalle`}
												>
													<span class="text-base leading-none">{getEstadoIcon(estado)}</span>
												</button>
												{#if rejectingKey === `${col.key}|${fila.estudiante._id}`}
													<div class="absolute z-20 top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-2" transition:slide={{ duration: 150 }}>
														<textarea
															bind:value={motivoRechazo}
															placeholder="Motivo de rechazo..."
															class="w-full text-xs border border-gray-300 dark:border-gray-600 rounded p-1.5 bg-white dark:bg-gray-900"
															rows="2"
														></textarea>
														<div class="flex gap-1 mt-1.5">
															<button
																type="button"
																onclick={() => confirmarRechazo(fila.estudiante, col.key)}
																disabled={actionLoading === `${col.key}|${fila.estudiante._id}`}
																class="flex-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold rounded px-2 py-1 disabled:opacity-50"
															>
																Rechazar
															</button>
															<button
																type="button"
																onclick={cancelarRechazo}
																class="flex-1 border border-gray-300 dark:border-gray-600 text-[11px] font-semibold rounded px-2 py-1"
															>
																Cancelar
															</button>
														</div>
													</div>
												{:else if !col.key.startsWith('req:') && estado !== 'no_subido' && estado !== 'aprobado'}
													<div class="absolute z-20 top-full left-0 mt-1 hidden group-hover:flex bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl overflow-hidden">
														<button
															type="button"
															onclick={() => aprobarCelda(fila.estudiante, col.key)}
															disabled={actionLoading === `${col.key}|${fila.estudiante._id}`}
															class="bg-green-600 hover:bg-green-700 text-white text-[11px] font-semibold px-2 py-1 disabled:opacity-50"
															title="Aprobar"
														>
															<CheckIcon class="size-3.5" />
														</button>
														<button
															type="button"
															onclick={() => iniciarRechazo(fila.estudiante, col.key)}
															class="bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold px-2 py-1"
															title="Rechazar"
														>
															<XMarkIcon class="size-3.5" />
														</button>
													</div>
												{/if}
											</div>
										</td>
									{/each}
									<td class="p-2 text-center">
										{#if fila.pendientes > 0}
											<span class="inline-block rounded-full bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 text-[11px] font-bold">
												{fila.pendientes}
											</span>
										{:else if fila.tieneRechazados}
											<span class="inline-block rounded-full bg-red-100 text-red-800 border border-red-300 px-2 py-0.5 text-[11px] font-bold">
												!
											</span>
										{:else}
											<span class="text-green-600 text-base">✓</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>

		<!-- Footer con leyenda -->
		<div class="border-t border-gray-200 dark:border-gray-700 px-4 py-2.5 flex items-center gap-3 text-[10px] text-gray-500 shrink-0">
			<span class="font-bold uppercase tracking-wider">Leyenda:</span>
			<span class="inline-flex items-center gap-1">
				<span class="size-3 rounded bg-green-100 border border-green-300"></span> ✓ Aprobado
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="size-3 rounded bg-amber-100 border border-amber-300"></span> ⏳ Pendiente
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="size-3 rounded bg-red-100 border border-red-300"></span> ✗ Rechazado
			</span>
			<span class="inline-flex items-center gap-1">
				<span class="size-3 rounded bg-gray-50 border border-gray-200"></span> — No subido
			</span>
		</div>
	</div>

	<!-- Modal de detalle del documento -->
	{#if showDocModal}
		<button
			type="button"
			class="fixed inset-0 z-[80] bg-gray-900/60 backdrop-blur-sm"
			onclick={() => (showDocModal = false)}
			aria-label="Cerrar detalle"
		></button>
		<div class="fixed inset-0 z-[90] flex items-center justify-center p-4" transition:fade={{ duration: 150 }}>
			<div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col" transition:slide={{ duration: 200 }}>
				<div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
					<h3 class="font-bold text-gray-900 dark:text-gray-100">{docModalTitle}</h3>
					<button type="button" onclick={() => (showDocModal = false)} class="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
						<XIcon class="size-5" />
					</button>
				</div>
				<div class="p-4 overflow-auto flex-1">
					<div class="flex items-center gap-2 mb-3">
						<span class="text-xs font-bold uppercase text-gray-500">Estado:</span>
						<span class={`text-xs font-bold rounded-full px-2.5 py-0.5 ${
							docModalEstado === 'aprobado' || docModalEstado === 'verificado' ? 'bg-green-100 text-green-800' :
							docModalEstado === 'rechazado' ? 'bg-red-100 text-red-800' :
							'bg-amber-100 text-amber-800'
						}`}>
							{docModalEstado || 'pendiente'}
						</span>
					</div>
					{#if docModalMotivo}
						<div class="mb-3 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-800">
							<span class="font-bold">Motivo rechazo:</span> {docModalMotivo}
						</div>
					{/if}
					{#if docModalUrl}
						{#if /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i.test(docModalUrl)}
							<img src={docModalUrl} alt="documento" class="max-w-full max-h-[60vh] mx-auto rounded border" />
						{:else if /\.pdf(\?|$)/i.test(docModalUrl)}
							<iframe src={docModalUrl} class="w-full h-[60vh] rounded border" title="Documento PDF"></iframe>
						{:else}
							<div class="text-center py-6">
								<a href={docModalUrl} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 text-primary-600 hover:underline text-sm">
									<EyeIcon class="size-4" />
									Abrir documento en nueva pestaña
								</a>
							</div>
						{/if}
					{:else}
						<p class="text-center text-sm text-gray-500 py-6">No hay URL para mostrar.</p>
					{/if}
				</div>
			</div>
		</div>
	{/if}
{/if}
