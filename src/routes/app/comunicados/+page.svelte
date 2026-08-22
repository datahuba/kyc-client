<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { comunicadosService, type ComunicadoListItem, type ComunicadoResponse, type Adjunto } from '$lib/services/comunicados.service';
	import { courseService } from '$lib/services/course.service';
	import { BellIcon, ExclamationIcon, MailIcon, TrashIcon, PencilIcon, PlusIcon, EyeIcon, XIcon } from '$lib/icons/outline';
	import ExclamationCircleSolid from '$lib/icons/solid/exclamationCircleIcon.svelte';
	import { alert } from '$lib/utils';
	import { goto } from '$app/navigation';

	// =============================================================
	// US-003 (2026-08-03): Gestión de Comunicados
	// Roles permitidos: superadmin, encargado_curso, cobranza
	// =============================================================

	let currentRole = $derived($userStore.role || '');

	let comunicados = $state<ComunicadoListItem[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let soloMios = $state(false);
	let creando = $state(false);
	let editando = $state<ComunicadoResponse | null>(null);

	// Estado del formulario
	let formTitulo = $state('');
	let formContenido = $state('');
	let formCursosIds = $state<string[]>([]);
	let formImportancia = $state<'normal' | 'urgente'>('normal');
	let formExpiraEn = $state('');
	let formEnviarEmail = $state(false);
	let formAdjuntos = $state<Adjunto[]>([]);
	let guardando = $state(false);
	let uploading = $state(false);

	// Confirmación de eliminar (modal inline)
	let confirmarEliminar = $state<ComunicadoListItem | null>(null);

	// Catálogo de cursos para el select
	let cursos = $state<any[]>([]);

	// Previsualización y Plantillas UAGRM
	let previsualizarEmail = $state(false);

	const plantillasInstitucionales = [
		{
			id: 'pago',
			label: '💳 Recordatorio de Pago',
			titulo: 'Recordatorio Importante de Pago de Cuota / Matrícula',
			contenido: 'Estimados estudiantes:\n\nSe les recuerda que la fecha límite para la regularización de pagos del presente módulo se encuentra próxima a vencer.\n\nPor favor, ingresen a la plataforma en la sección "Mis Pagos" para consultar su estado de cuenta o subir su comprobante de depósito/transferencia bancaria.'
		},
		{
			id: 'inicio',
			label: '📅 Inicio de Módulo',
			titulo: 'Inicio del Próximo Módulo y Horarios de Clases',
			contenido: 'Estimados posgraduantes:\n\nLes damos una cordial bienvenida al inicio de este nuevo módulo académico.\n\nLas sesiones sincrónicas se desarrollarán en los días y horarios fijados en el Aula Virtual. Se recomienda revisar el material didáctico y la guía del docente.'
		},
		{
			id: 'evaluacion',
			label: '📝 Evaluaciones y Cierre',
			titulo: 'Cierre de Módulo y Entrega de Evaluaciones',
			contenido: 'Estimados estudiantes:\n\nLes informamos que la fecha límite para la entrega de trabajos finales y actividades evaluativas del módulo en curso concluye este fin de semana.\n\nLes solicitamos verificar la subida correcta de sus entregables en el Aula Virtual.'
		}
	];

	function aplicarPlantilla(p: typeof plantillasInstitucionales[0]) {
		formTitulo = p.titulo;
		formContenido = p.contenido;
	}

	// Adjuntos pendientes (subir después de publicar, o subo al crear?)
	// Por simplicidad: el contenido del comunicado se guarda primero con
	// adjuntos vacíos, y los adjuntos se suben a Cloudinary por separado
	// (en esta versión no implementamos upload de adjuntos en la UI para
	// no extender el alcance; el campo existe en backend y se acepta
	// via API directa para integraciones futuras).

	// =============================================================
	// Lifecycle
	// =============================================================

	onMount(async () => {
		if (!['superadmin', 'encargado_curso', 'cobranza'].includes(currentRole)) {
			alert('error', 'No tiene permiso para acceder a Comunicados.');
			goto('/app/dashboard');
			return;
		}
		await cargar();
		await cargarCursos();
	});

	async function cargar() {
		loading = true;
		try {
			const res = await comunicadosService.listar(0, 50, soloMios);
			comunicados = res.items;
			total = res.total;
		} catch (e: any) {
			alert('error', e?.response?.data?.detail || 'Error al cargar comunicados.');
		} finally {
			loading = false;
		}
	}

	async function cargarCursos() {
		try {
			const res = await courseService.getAll(1, 100);
			cursos = res.data ?? [];
		} catch (e) {
			console.error('Error cargando cursos:', e);
		}
	}

	// =============================================================
	// Acciones
	// =============================================================

	function nuevoComunicado() {
		editando = null;
		formTitulo = '';
		formContenido = '';
		formCursosIds = [];
		formImportancia = 'normal';
		formExpiraEn = '';
		formEnviarEmail = false;
		formAdjuntos = [];
		creando = true;
	}

	function editarComunicado(c: ComunicadoListItem) {
		cargandoParaEditar(c.id);
	}

	async function cargandoParaEditar(id: string) {
		try {
			const c = await comunicadosService.obtener(id);
			editando = c;
			formTitulo = c.titulo;
			formContenido = c.contenido;
			formCursosIds = c.cursos_ids;
			formImportancia = c.importancia;
			formExpiraEn = c.expira_en ? c.expira_en.slice(0, 16) : '';
			formEnviarEmail = false; // no reenviar al editar
			formAdjuntos = c.adjuntos;
			creando = true;
		} catch (e: any) {
			alert('error', e?.response?.data?.detail || 'Error al cargar el comunicado.');
		}
	}

	function cancelarForm() {
		creando = false;
		editando = null;
	}

	async function guardar() {
		if (!formTitulo.trim() || !formContenido.trim()) {
			alert('warning', 'Título y contenido son obligatorios.');
			return;
		}
		guardando = true;
		try {
			const payload = {
				titulo: formTitulo.trim(),
				contenido: formContenido,
				cursos_ids: formCursosIds,
				importancia: formImportancia,
				expira_en: formExpiraEn ? new Date(formExpiraEn).toISOString() : null,
				adjuntos: formAdjuntos,
			};
			if (editando) {
				await comunicadosService.editar(editando.id, payload);
				alert('success', 'Comunicado actualizado.');
			} else {
				await comunicadosService.crear({
					...payload,
					enviar_email: formEnviarEmail,
				});
				if (formEnviarEmail) {
					alert('success', 'Comunicado creado y email encolado para envío.');
				} else {
					alert('success', 'Comunicado creado.');
				}
			}
			creando = false;
			editando = null;
			await cargar();
		} catch (e: any) {
			alert('error', e?.response?.data?.detail || 'Error al guardar.');
		} finally {
			guardando = false;
		}
	}

	async function eliminar(c: ComunicadoListItem) {
		confirmarEliminar = c;
	}

	async function confirmarEliminacion() {
		if (!confirmarEliminar) return;
		const c = confirmarEliminar;
		confirmarEliminar = null;
		try {
			await comunicadosService.eliminar(c.id);
			alert('success', 'Comunicado eliminado.');
			await cargar();
		} catch (e: any) {
			alert('error', e?.response?.data?.detail || 'Error al eliminar.');
		}
	}

	function toggleCurso(id: string) {
		if (formCursosIds.includes(id)) {
			formCursosIds = formCursosIds.filter(x => x !== id);
		} else {
			formCursosIds = [...formCursosIds, id];
		}
	}

	function formatFecha(iso: string): string {
		try {
			return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
		} catch {
			return iso;
		}
	}
</script>


<svelte:head>
	<title>Comunicados · KYC DataHub</title>
</svelte:head>
<div class="space-y-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
		<div>
			<h1 class="text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
				<BellIcon class="size-7 text-primary-600" />
				Comunicados
			</h1>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Anuncios oficiales que los estudiantes ven al iniciar sesión.
			</p>
		</div>
		<div class="flex items-center gap-3">
			<label class="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
				<input type="checkbox" bind:checked={soloMios} onchange={cargar} class="rounded" />
				Solo míos
			</label>
			<button
				type="button"
				onclick={nuevoComunicado}
				class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
			>
				<PlusIcon class="size-4" />
				Nuevo Comunicado
			</button>
		</div>
	</div>

	<!-- Listado -->
	{#if loading}
		<div class="flex items-center justify-center h-32">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
		</div>
	{:else if comunicados.length === 0}
		<div class="bg-white dark:bg-gray-800 rounded-xl p-12 text-center border-2 border-dashed border-gray-200 dark:border-gray-700">
			<BellIcon class="size-12 mx-auto text-gray-300 dark:text-gray-600" />
			<p class="mt-3 text-sm text-gray-500 dark:text-gray-400">
				Aún no hay comunicados. Cree el primero con el botón superior.
			</p>
		</div>
	{:else}
		<div class="grid gap-3">
			{#each comunicados as c (c.id)}
				<article class="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
					<div class="flex items-start gap-3">
						<div class="shrink-0 mt-0.5">
							{#if c.importancia === 'urgente'}
								<ExclamationCircleSolid class="size-5 text-red-500" />
							{:else}
								<BellIcon class="size-5 text-primary-500" />
							{/if}
						</div>
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2 flex-wrap">
								<h3 class="text-base font-bold text-gray-900 dark:text-white truncate">{c.titulo}</h3>
								{#if c.importancia === 'urgente'}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
										URGENTE
									</span>
								{/if}
								{#if c.email_enviado}
									<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
										<MailIcon class="size-3" />
										Email enviado
									</span>
								{/if}
							</div>
							<p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
								Por <strong>{c.autor_nombre}</strong> ({c.autor_rol}) · {formatFecha(c.created_at)}
							</p>
							<div class="mt-2 flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
								<span>
									{c.cursos_count === 0 ? 'Todos los cursos' : `${c.cursos_count} curso${c.cursos_count === 1 ? '' : 's'}`}
								</span>
								<span class="inline-flex items-center gap-1">
									<EyeIcon class="size-3" />
									{c.total_vistos} visto{c.total_vistos === 1 ? '' : 's'}
								</span>
							</div>
						</div>
						<div class="shrink-0 flex items-center gap-1">
							<button
								type="button"
								onclick={() => editarComunicado(c)}
								class="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Editar"
							>
								<PencilIcon class="size-4" />
							</button>
							<button
								type="button"
								onclick={() => eliminar(c)}
								class="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
								title="Eliminar"
							>
								<TrashIcon class="size-4" />
							</button>
						</div>
					</div>
				</article>
			{/each}
		</div>
	{/if}
</div>

<!-- Modal de crear/editar -->
{#if creando}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col my-8">
			<header class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between shrink-0">
				<h2 class="text-lg font-bold text-gray-900 dark:text-white">
					{editando ? 'Editar comunicado' : 'Nuevo comunicado'}
				</h2>
				<button
					type="button"
					onclick={cancelarForm}
					class="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				>
					<XIcon class="size-5" />
				</button>
			</header>
			<div class="p-6 space-y-4 overflow-y-auto flex-1">
				<!-- Plantillas Institucionales Rápidas -->
				<div>
					<span class="block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
						⚡ Plantillas Rápidas UAGRM
					</span>
					<div class="flex flex-wrap gap-2">
						{#each plantillasInstitucionales as p}
							<button
								type="button"
								onclick={() => aplicarPlantilla(p)}
								class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-950/40 dark:hover:text-primary-300 border border-gray-200 dark:border-gray-600 transition-colors"
							>
								{p.label}
							</button>
						{/each}
					</div>
				</div>

				<!-- Título -->
				<div>
					<div class="flex justify-between items-center mb-1.5">
						<label for="titulo" class="block text-sm font-semibold text-gray-700 dark:text-gray-300">
							Título <span class="text-red-500">*</span>
						</label>
						<button
							type="button"
							onclick={() => previsualizarEmail = !previsualizarEmail}
							class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
						>
							<EyeIcon class="size-3.5" />
							{previsualizarEmail ? 'Ocultar Vista Previa' : 'Previsualizar Correo UAGRM'}
						</button>
					</div>
					<input
						id="titulo"
						type="text"
						bind:value={formTitulo}
						maxlength="200"
						placeholder="Ej: Cambio de horario del Módulo 1"
						class="w-full px-3.5 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
					/>
				</div>

				<!-- Previsualización en Vivo de Plantilla Institucional -->
				{#if previsualizarEmail}
					<div class="rounded-xl border-2 border-primary-200 dark:border-primary-900/60 bg-gray-50 dark:bg-gray-950/40 p-4 transition-all">
						<span class="block text-[10px] font-bold uppercase tracking-widest text-primary-600 dark:text-primary-400 mb-2">
							👁️ Vista Previa del Correo Institucional
						</span>
						<div class="max-w-md mx-auto rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-900 shadow-sm text-xs text-gray-800 dark:text-gray-200">
							<div class="bg-[#8a1f2f] text-white p-3.5 text-center">
								<p class="font-bold text-sm">Escuela de Posgrado · UAGRM</p>
								<p class="text-[11px] text-[#f3d2d7]">Contaduría Pública</p>
							</div>
							<div class="p-4 space-y-3">
								<h4 class="text-sm font-bold text-[#8a1f2f] dark:text-red-400">{formTitulo || 'Asunto del Comunicado'}</h4>
								<p class="text-gray-600 dark:text-gray-400">Hola <strong>Lic. Estudiante de Posgrado</strong>,</p>
								<div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border-l-4 border-[#8a1f2f] whitespace-pre-line text-[11px] leading-relaxed">
									{formContenido || 'Aquí se mostrará el cuerpo del mensaje redactado...'}
								</div>
								<div class="text-center pt-2">
									<span class="inline-block bg-[#8a1f2f] text-white font-bold px-4 py-2 rounded-lg text-xs">
										Ingresar al Portal
									</span>
								</div>
								<p class="text-[10px] text-gray-400 text-center pt-2">
									Unidad de Postgrado · UAGRM
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Contenido -->
				<div>
					<label for="contenido" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
						Contenido <span class="text-red-500">*</span>
					</label>
					<textarea
						id="contenido"
						bind:value={formContenido}
						rows="6"
						placeholder="Escriba el anuncio. Use líneas en blanco para separar párrafos."
						class="w-full px-3.5 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all resize-y"
					></textarea>
				</div>

				<!-- Importancia -->
				<div>
					<label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Importancia</label>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => formImportancia = 'normal'}
							class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all {formImportancia === 'normal' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}"
						>
							Normal
						</button>
						<button
							type="button"
							onclick={() => formImportancia = 'urgente'}
							class="flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-all {formImportancia === 'urgente' ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200'}"
						>
							Urgente
						</button>
					</div>
				</div>

				<!-- Cursos destinatarios -->
				<div>
					<label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
						Destinatarios
					</label>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
						Si no selecciona ninguno, el comunicado va dirigido a todos los estudiantes activos.
					</p>
					<div class="border-2 border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1">
						{#if cursos.length === 0}
							<p class="text-xs text-gray-400 p-2">Cargando cursos...</p>
						{:else}
							{#each cursos as curso (curso._id)}
								<label class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded cursor-pointer text-sm">
									<input
										type="checkbox"
										checked={formCursosIds.includes(curso._id)}
										onchange={() => toggleCurso(curso._id)}
										class="rounded"
									/>
									<span class="text-gray-700 dark:text-gray-300">{curso.nombre_programa}</span>
									<span class="text-xs text-gray-400">({curso.codigo})</span>
								</label>
							{/each}
						{/if}
					</div>
					{#if formCursosIds.length === 0}
						<p class="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
							⚠ Sin selección = todos los estudiantes (solo superadmin)
						</p>
					{/if}
				</div>

				<!-- Expiración -->
				<div>
					<label for="expira" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
						Fecha de expiración (opcional)
					</label>
					<input
						id="expira"
						type="datetime-local"
						bind:value={formExpiraEn}
						class="w-full px-3.5 py-2.5 rounded-lg border-2 border-gray-200 dark:border-gray-700 dark:bg-gray-900 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all"
					/>
					<p class="text-[11px] text-gray-500 mt-1">
						Después de esta fecha el comunicado deja de mostrarse.
					</p>
				</div>

				<!-- Enviar email (solo al crear) -->
				{#if !editando}
					<label class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg cursor-pointer">
						<input
							type="checkbox"
							bind:checked={formEnviarEmail}
							class="rounded mt-0.5"
						/>
						<div>
							<p class="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1">
								<MailIcon class="size-4" />
								Enviar también por email
							</p>
							<p class="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
								Se enviará a todos los destinatarios (audiencia seleccionada). Puede demorar unos segundos.
							</p>
						</div>
					</label>
				{/if}
			</div>
			<footer class="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 shrink-0">
				<button
					type="button"
					onclick={cancelarForm}
					class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={guardar}
					disabled={guardando}
					class="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-50 transition-colors inline-flex items-center gap-2"
				>
					{#if guardando}
						<div class="size-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
					{/if}
					{editando ? 'Guardar cambios' : 'Crear comunicado'}
				</button>
			</footer>
		</div>
	</div>
{/if}

<!-- Modal de confirmación para eliminar -->
{#if confirmarEliminar}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
			<div class="flex items-start gap-3">
				<div class="shrink-0 size-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
					<ExclamationIcon class="size-5 text-red-600 dark:text-red-400" />
				</div>
				<div class="flex-1 min-w-0">
					<h3 class="text-base font-bold text-gray-900 dark:text-white">¿Eliminar comunicado?</h3>
					<p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
						"<strong>{confirmarEliminar.titulo}</strong>" se eliminará y los estudiantes ya no lo verán. Esta acción no se puede deshacer.
					</p>
				</div>
			</div>
			<div class="mt-5 flex items-center justify-end gap-2">
				<button
					type="button"
					onclick={() => confirmarEliminar = null}
					class="px-4 py-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
				>
					Cancelar
				</button>
				<button
					type="button"
					onclick={confirmarEliminacion}
					class="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
				>
					Eliminar
				</button>
			</div>
		</div>
	</div>
{/if}
