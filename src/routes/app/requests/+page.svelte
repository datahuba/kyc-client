<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { tramiteService } from '$lib/services';
	import { alert } from '$lib/utils';
	import {
		ARCHIVO_LABELS,
		ARCHIVOS_REQUERIDOS,
		ESTADO_TRAMITE_COLORS,
		ESTADO_TRAMITE_LABELS,
		TIPO_TRAMITE_DESCRIPCION,
		TIPO_TRAMITE_ICON,
		TIPO_TRAMITE_LABELS,
		type EstadoTramite,
		type TipoTramite,
		type TramiteSolicitud
	} from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { DocumentAddIcon, FileTextIcon } from '$lib/icons/outline';

	// ----- State -----
	let activeTab = $state<TipoTramite>('convalidacion');
	let loading = $state(true);
	let saving = $state(false);
	let misSolicitudes = $state<TramiteSolicitud[]>([]);

	// Form fields
	let nombreCompleto = $state('');
	let ci = $state('');
	let email = $state('');
	let telefono = $state('');
	let motivo = $state('');
	let programaRelacionado = $state('');
	let montoPagoBs = $state<number | null>(null);

	// Cloudinary uploads (URLs ya subidas, no subimos archivos en este form)
	const archivosSubidos = $state<Record<string, { url: string; nombre_archivo?: string; mime_type?: string } | null>>({
		carta: null,
		certificado_nota: null,
		comprobante_pago: null
	});

	// Staff: lista global + acciones
	let isStaff = $state(false);
	let staffList = $state<TramiteSolicitud[]>([]);
	let staffLoading = $state(false);
	let staffFiltroEstado = $state<EstadoTramite | ''>('');

	// Modales staff
	let rejectOpen = $state(false);
	let rejectTarget = $state<TramiteSolicitud | null>(null);
	let rejectMotivo = $state('');
	let rejectLoading = $state(false);

	let detailOpen = $state(false);
	let detailTarget = $state<TramiteSolicitud | null>(null);

	// ----- Lifecycle -----
	onMount(async () => {
		// Detectar si es staff
		const role = (typeof window !== 'undefined' && localStorage.getItem('user_role')) || '';
		isStaff = ['admin', 'superadmin', 'cpd', 'mae', 'cobranza', 'coordinador', 'encargado_curso'].includes(
			role
		);

		await Promise.all([loadMisSolicitudes(), isStaff ? loadStaffList() : Promise.resolve()]);
	});

	async function loadMisSolicitudes() {
		loading = true;
		try {
			misSolicitudes = await tramiteService.listarMis();
		} catch (e: any) {
			console.warn('Error cargando mis solicitudes:', e);
		} finally {
			loading = false;
		}
	}

	async function loadStaffList() {
		staffLoading = true;
		try {
			const opts: { page: number; per_page: number; estado?: EstadoTramite } = {
				page: 1,
				per_page: 50
			};
			if (staffFiltroEstado) opts.estado = staffFiltroEstado;
			const r = await tramiteService.listarTodas(opts);
			staffList = r.items;
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar la lista staff');
		} finally {
			staffLoading = false;
		}
	}

	// ----- Form helpers -----
	function resetForm() {
		nombreCompleto = '';
		ci = '';
		email = '';
		telefono = '';
		motivo = '';
		programaRelacionado = '';
		montoPagoBs = null;
		archivosSubidos.carta = null;
		archivosSubidos.certificado_nota = null;
		archivosSubidos.comprobante_pago = null;
	}

	function isFormValid(): boolean {
		if (nombreCompleto.trim().length < 3) return false;
		if (motivo.trim().length < 10) return false;
		const reqs = ARCHIVOS_REQUERIDOS[activeTab];
		for (const r of reqs) {
			if (!archivosSubidos[r]?.url) return false;
		}
		return true;
	}

	// Simular upload (en producción: subir a Cloudinary, guardar URL).
	// Para esta versión del front, el campo URL se completa manualmente
	// (pegando la URL de Cloudinary que el estudiante subió aparte).
	function setArchivoUrl(campo: string, url: string) {
		archivosSubidos[campo] = {
			url,
			nombre_archivo: url.split('/').pop()?.split('?')[0] || 'archivo'
		};
	}

	function clearArchivo(campo: string) {
		archivosSubidos[campo] = null;
	}

	async function enviar() {
		if (!isFormValid()) {
			alert('warning', 'Completa todos los campos obligatorios antes de enviar.');
			return;
		}
		saving = true;
		try {
			const archivos = (['carta', 'certificado_nota', 'comprobante_pago'] as const)
				.filter((k) => archivosSubidos[k]?.url)
				.map((k) => ({
					nombre_campo: k,
					url: archivosSubidos[k]!.url,
					nombre_archivo: archivosSubidos[k]!.nombre_archivo,
					mime_type: archivosSubidos[k]!.mime_type
				}));

			const payload = {
				tipo: activeTab,
				nombre_completo: nombreCompleto.trim(),
				ci: ci.trim() || null,
				email: email.trim() || null,
				telefono: telefono.trim() || null,
				motivo: motivo.trim(),
				programa_relacionado: programaRelacionado.trim() || null,
				monto_pago_bs: montoPagoBs,
				archivos
			};
			const nueva = await tramiteService.crear(payload);
			alert('success', `Solicitud #${nueva.id.slice(-6)} creada correctamente.`);
			resetForm();
			await loadMisSolicitudes();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo crear la solicitud');
		} finally {
			saving = false;
		}
	}

	async function cancelar(s: TramiteSolicitud) {
		if (!confirm('¿Cancelar esta solicitud? No se puede deshacer.')) return;
		try {
			await tramiteService.cancelar(s.id);
			alert('success', 'Solicitud cancelada.');
			await loadMisSolicitudes();
		} catch (e: any) {
			alert('error', e?.message || 'Error al cancelar');
		}
	}

	// ----- Staff actions -----
	async function marcarRevision(s: TramiteSolicitud) {
		try {
			await tramiteService.marcarEnRevision(s.id);
			alert('success', 'Marcada en revisión');
			await loadStaffList();
		} catch (e: any) {
			alert('error', e?.message || 'Error');
		}
	}

	async function aprobar(s: TramiteSolicitud) {
		if (!confirm('¿Aprobar esta solicitud?')) return;
		try {
			await tramiteService.aprobar(s.id);
			alert('success', 'Solicitud aprobada.');
			await loadStaffList();
		} catch (e: any) {
			alert('error', e?.message || 'Error');
		}
	}

	function abrirRechazo(s: TramiteSolicitud) {
		rejectTarget = s;
		rejectMotivo = '';
		rejectOpen = true;
	}

	async function confirmarRechazo() {
		if (!rejectTarget || rejectMotivo.trim().length < 3) {
			alert('warning', 'Indica un motivo de al menos 3 caracteres.');
			return;
		}
		rejectLoading = true;
		try {
			await tramiteService.rechazar(rejectTarget.id, rejectMotivo.trim());
			alert('success', 'Solicitud rechazada.');
			rejectOpen = false;
			rejectTarget = null;
			await loadStaffList();
		} catch (e: any) {
			alert('error', e?.message || 'Error al rechazar');
		} finally {
			rejectLoading = false;
		}
	}

	function verDetalle(s: TramiteSolicitud) {
		detailTarget = s;
		detailOpen = true;
	}

	// ----- UI helpers -----
	function fmtDate(s: string | null | undefined): string {
		if (!s) return '—';
		let c = s.trim().replace(' ', 'T');
		if (c.includes('.')) c = c.split('.')[0];
		if (!c.endsWith('Z') && !c.includes('+')) c += 'Z';
		const d = new Date(c);
		if (isNaN(d.getTime())) return s;
		return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function filterPorTipo(items: TramiteSolicitud[], tipo: TipoTramite): TramiteSolicitud[] {
		return items.filter((s) => s.tipo === tipo);
	}

	$effect(() => {
		// Re-cargar lista staff cuando cambia el filtro
		if (isStaff) loadStaffList();
	});

	const TABS: TipoTramite[] = ['convalidacion', 'tutoria', 'readmision', 'titulacion'];
</script>


<svelte:head>
	<title>Solicitudes · KYC DataHub</title>
</svelte:head>
<div class="space-y-6">
	<Heading level="h1">
		<span class="flex items-center gap-2">
			<FileTextIcon class="w-6 h-6" />Solicitudes de Trámite
		</span>
	</Heading>
	<p class="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
		Crea solicitudes formales de <strong>Convalidación</strong>, <strong>Tutoría</strong>,
		<strong>Readmisión</strong> o <strong>Titulación</strong>. El staff las revisa y aprueba
		o rechaza. Verás el estado de cada solicitud en la lista inferior.
	</p>

	{#if isStaff}
		<!-- STAFF VIEW: tabs de navegación + lista global -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="border-b border-gray-200 dark:border-gray-700 px-4 pt-3">
				<div class="flex gap-1 flex-wrap">
					{#each TABS as t}
						<button
							class="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors {activeTab === t
								? 'border-primary-500 text-primary-700 dark:text-primary-300'
								: 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900'}"
							onclick={() => (activeTab = t)}
						>
							{TIPO_TRAMITE_ICON[t]} {TIPO_TRAMITE_LABELS[t]}
						</button>
					{/each}
				</div>
			</div>

			<div class="p-4">
				<!-- Filtros -->
				<div class="flex gap-2 mb-4 flex-wrap">
					<button
						class="px-3 py-1.5 text-xs rounded-md border {staffFiltroEstado === ''
							? 'bg-primary-600 text-white border-primary-600'
							: 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300'}"
						onclick={() => (staffFiltroEstado = '')}
					>
						Todas
					</button>
					{#each ['pendiente', 'en_revision', 'aprobada', 'rechazada'] as e}
						<button
							class="px-3 py-1.5 text-xs rounded-md border {staffFiltroEstado === e
								? 'bg-primary-600 text-white border-primary-600'
								: 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300'}"
							onclick={() => (staffFiltroEstado = e as EstadoTramite)}
						>
							{ESTADO_TRAMITE_LABELS[e as EstadoTramite]}
						</button>
					{/each}
				</div>

				{#if staffLoading}
					<p class="text-sm text-gray-500">Cargando...</p>
				{:else if staffList.length === 0}
					<p class="text-sm text-gray-500">No hay solicitudes que mostrar.</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="text-xs uppercase text-gray-600 dark:text-gray-300 border-b">
								<tr>
									<th class="text-left py-2 px-2">Tipo</th>
									<th class="text-left py-2 px-2">Estudiante</th>
									<th class="text-left py-2 px-2">C.I.</th>
									<th class="text-left py-2 px-2">Estado</th>
									<th class="text-left py-2 px-2">Creada</th>
									<th class="text-right py-2 px-2">Acciones</th>
								</tr>
							</thead>
							<tbody>
								{#each staffList as s (s.id)}
									<tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30">
										<td class="py-2 px-2">{TIPO_TRAMITE_ICON[s.tipo]} {TIPO_TRAMITE_LABELS[s.tipo]}</td>
										<td class="py-2 px-2">{s.nombre_completo}</td>
										<td class="py-2 px-2">{s.ci ?? '—'}</td>
										<td class="py-2 px-2">
											<span class="px-2 py-0.5 text-xs rounded-full {ESTADO_TRAMITE_COLORS[s.estado]}">
												{ESTADO_TRAMITE_LABELS[s.estado]}
											</span>
										</td>
										<td class="py-2 px-2 text-xs">{fmtDate(s.created_at)}</td>
										<td class="py-2 px-2 text-right">
											<button
												class="text-xs text-blue-600 dark:text-blue-400 hover:underline mr-2"
												onclick={() => verDetalle(s)}
											>
												Ver
											</button>
											{#if s.estado === 'pendiente'}
												<button
													class="text-xs text-blue-600 dark:text-blue-400 hover:underline mr-2"
													onclick={() => marcarRevision(s)}
												>
													En revisión
												</button>
												<button
													class="text-xs text-green-600 dark:text-green-400 hover:underline mr-2"
													onclick={() => aprobar(s)}
												>
													Aprobar
												</button>
												<button
													class="text-xs text-red-600 dark:text-red-400 hover:underline"
													onclick={() => abrirRechazo(s)}
												>
													Rechazar
												</button>
											{:else if s.estado === 'en_revision'}
												<button
													class="text-xs text-green-600 dark:text-green-400 hover:underline mr-2"
													onclick={() => aprobar(s)}
												>
													Aprobar
												</button>
												<button
													class="text-xs text-red-600 dark:text-red-400 hover:underline"
													onclick={() => abrirRechazo(s)}
												>
													Rechazar
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		</div>
	{:else}
		<!-- STUDENT VIEW: tabs para crear + lista de mis solicitudes -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow">
			<div class="border-b border-gray-200 dark:border-gray-700 px-4 pt-3">
				<div class="flex gap-1 flex-wrap">
					{#each TABS as t}
						<button
							class="px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors {activeTab === t
								? 'border-primary-500 text-primary-700 dark:text-primary-300'
								: 'border-transparent text-gray-600 dark:text-gray-300 hover:text-gray-900'}"
							onclick={() => (activeTab = t)}
						>
							{TIPO_TRAMITE_ICON[t]} {TIPO_TRAMITE_LABELS[t]}
						</button>
					{/each}
				</div>
			</div>

			<div class="p-6 space-y-4">
				<p class="text-sm text-gray-700 dark:text-gray-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
					{TIPO_TRAMITE_DESCRIPCION[activeTab]}
				</p>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Nombre completo *</span>
						<input
							type="text"
							bind:value={nombreCompleto}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="Apellido Nombre"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">C.I.</span>
						<input
							type="text"
							bind:value={ci}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="1234567"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Email</span>
						<input
							type="email"
							bind:value={email}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="tu@email.com"
						/>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Teléfono</span>
						<input
							type="tel"
							bind:value={telefono}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="591 7XXXXXXX"
						/>
					</label>
					<label class="block sm:col-span-2">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Programa relacionado</span>
						<input
							type="text"
							bind:value={programaRelacionado}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="Diplomado en IA 2026"
						/>
					</label>
					<label class="block sm:col-span-2">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Motivo / Detalle *</span>
						<textarea
							bind:value={motivo}
							rows="4"
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="Explica brevemente tu solicitud"
						></textarea>
					</label>
					<label class="block">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-200">Monto pagado (Bs.)</span>
						<input
							type="number"
							step="0.01"
							bind:value={montoPagoBs}
							class="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700"
							placeholder="0.00"
						/>
					</label>
				</div>

				<!-- Archivos adjuntos (URLs de Cloudinary) -->
				<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
					<h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Archivos adjuntos</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400 mb-3">
						Sube los archivos a Cloudinary y pega la URL pública acá. (Si no tenés acceso directo,
						podés pedirlos a Sandra/Rocío y te los comparten.)
					</p>
					<div class="space-y-2">
						{#each ARCHIVOS_REQUERIDOS[activeTab] as campo}
							<div class="flex items-center gap-2">
								<span class="text-sm text-gray-700 dark:text-gray-300 w-48">
									{ARCHIVO_LABELS[campo]} *
								</span>
								<input
									type="url"
									value={archivosSubidos[campo]?.url ?? ''}
									oninput={(e) => setArchivoUrl(campo, (e.target as HTMLInputElement).value)}
									class="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
									placeholder="https://res.cloudinary.com/.../archivo.pdf"
								/>
								{#if archivosSubidos[campo]?.url}
									<button
										type="button"
										class="text-xs text-red-600 hover:underline"
										onclick={() => clearArchivo(campo)}
									>
										Quitar
									</button>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<div class="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
					<Button variant="secondary" onclick={resetForm}>Limpiar</Button>
					<Button variant="primary" loading={saving} disabled={!isFormValid()} onclick={enviar}>
						<DocumentAddIcon class="w-4 h-4 mr-2" />Enviar solicitud
					</Button>
				</div>
			</div>
		</div>

		<!-- Lista de mis solicitudes -->
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 sm:p-6">
			<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Mis solicitudes</h2>
			{#if loading}
				<p class="text-sm text-gray-500">Cargando...</p>
			{:else if misSolicitudes.length === 0}
				<p class="text-sm text-gray-500">Aún no creaste ninguna solicitud.</p>
			{:else}
				<ul class="space-y-2">
					{#each misSolicitudes as s (s.id)}
						<li
							class="border border-gray-200 dark:border-gray-700 rounded-md p-3 flex flex-wrap items-center gap-3"
						>
							<span class="text-2xl">{TIPO_TRAMITE_ICON[s.tipo]}</span>
							<div class="flex-1 min-w-0">
								<div class="font-medium text-gray-900 dark:text-white">
									{TIPO_TRAMITE_LABELS[s.tipo]}
								</div>
								<div class="text-xs text-gray-500">
									Creada {fmtDate(s.created_at)}
									{#if s.motivo_rechazo}
										— <span class="text-red-600 dark:text-red-400">Motivo rechazo: {s.motivo_rechazo}</span>
									{/if}
								</div>
							</div>
							<span class="px-2 py-0.5 text-xs rounded-full {ESTADO_TRAMITE_COLORS[s.estado]}">
								{ESTADO_TRAMITE_LABELS[s.estado]}
							</span>
							<button
								class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
								onclick={() => verDetalle(s)}
							>
								Ver
							</button>
							{#if s.estado === 'pendiente' || s.estado === 'en_revision'}
								<button
									class="text-xs text-red-600 dark:text-red-400 hover:underline"
									onclick={() => cancelar(s)}
								>
									Cancelar
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<!-- Modal: rechazo -->
{#if rejectOpen && rejectTarget}
	<div
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Rechazar solicitud</h3>
			<p class="text-sm text-gray-600 dark:text-gray-300">
				{TIPO_TRAMITE_LABELS[rejectTarget.tipo]} de {rejectTarget.nombre_completo}
			</p>
			<textarea
				bind:value={rejectMotivo}
				rows="3"
				class="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 text-sm"
				placeholder="Motivo del rechazo (mín. 3 caracteres)"
			></textarea>
			<div class="flex gap-2 justify-end">
				<Button variant="secondary" onclick={() => (rejectOpen = false)}>Cancelar</Button>
				<Button variant="destructive" loading={rejectLoading} disabled={rejectMotivo.trim().length < 3} onclick={confirmarRechazo}>
					Rechazar
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Modal: detalle -->
{#if detailOpen && detailTarget}
	{@const s = detailTarget}
	<div
		class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4 my-8">
			<div class="flex items-start justify-between gap-2">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">
					{TIPO_TRAMITE_ICON[s.tipo]} {TIPO_TRAMITE_LABELS[s.tipo]}
				</h3>
				<button class="text-gray-500 hover:text-gray-700" onclick={() => (detailOpen = false)}>
					✕
				</button>
			</div>

			<div class="grid grid-cols-2 gap-3 text-sm">
				<div><span class="text-gray-500">Estado:</span>
					<span class="ml-1 px-2 py-0.5 text-xs rounded-full {ESTADO_TRAMITE_COLORS[s.estado]}">
						{ESTADO_TRAMITE_LABELS[s.estado]}
					</span>
				</div>
				<div><span class="text-gray-500">Creada:</span> {fmtDate(s.created_at)}</div>
				<div><span class="text-gray-500">Solicitante:</span> {s.nombre_completo}</div>
				<div><span class="text-gray-500">C.I.:</span> {s.ci ?? '—'}</div>
				{#if s.email}<div><span class="text-gray-500">Email:</span> {s.email}</div>{/if}
				{#if s.telefono}<div><span class="text-gray-500">Tel:</span> {s.telefono}</div>{/if}
				{#if s.programa_relacionado}<div class="col-span-2"><span class="text-gray-500">Programa:</span> {s.programa_relacionado}</div>{/if}
				{#if s.monto_pago_bs != null}<div><span class="text-gray-500">Pago:</span> Bs {s.monto_pago_bs.toFixed(2)}</div>{/if}
				{#if s.fecha_revision}<div><span class="text-gray-500">Revisada:</span> {fmtDate(s.fecha_revision)}</div>{/if}
				{#if s.revisado_por}<div><span class="text-gray-500">Por:</span> {s.revisado_por}</div>{/if}
			</div>

			<div>
				<h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">Motivo</h4>
				<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap bg-gray-50 dark:bg-gray-700/50 rounded p-2">
					{s.motivo}
				</p>
			</div>

			{#if s.motivo_rechazo}
				<div>
					<h4 class="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">Motivo del rechazo</h4>
					<p class="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 rounded p-2">
						{s.motivo_rechazo}
					</p>
				</div>
			{/if}

			{#if s.archivos.length > 0}
				<div>
					<h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-1">Archivos</h4>
					<ul class="space-y-1">
						{#each s.archivos as a}
							<li class="text-sm">
								<a
									href={a.url}
									target="_blank"
									rel="noopener"
									class="text-blue-600 dark:text-blue-400 hover:underline"
								>
									{ARCHIVO_LABELS[a.nombre_campo] ?? a.nombre_campo} →
								</a>
								<span class="text-xs text-gray-500 ml-2">
									{a.nombre_archivo ?? ''}
								</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}

			<div class="flex justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
				<Button variant="secondary" onclick={() => (detailOpen = false)}>Cerrar</Button>
			</div>
		</div>
	</div>
{/if}
