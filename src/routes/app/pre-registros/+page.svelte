<script lang="ts">
	import { onMount } from 'svelte';
	import {
		listForms,
		createForm,
		updateForm,
		closeForm,
		reopenForm,
		deleteForm,
		listSubmissions,
		approveSubmission,
		rejectSubmission,
		getCounters
	} from '$lib/services/pre-registration.service';
	import { courseService } from '$lib/services/course.service';
	import { userStore } from '$lib/stores/userStore';
	import { STAFF_EC_FORMS } from '$lib/auth/roles'; // F-2026-08-11-EC-AUTOSERVICIO
	import { alert } from '$lib/utils';
	import Heading from '$lib/components/ui/heading.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { Pagination } from '$lib/components/ui';
	import { exportToExcel } from '$lib/utils/excelExport';
	import {
		PlusIcon,
		ClipboardIcon,
		XIcon,
		UsersIcon,
		PencilIcon,
		CheckIcon,
		CopyIcon,
		DownloadIcon,
		ExclamationIcon,
		CircleCheckIcon
	} from '$lib/icons/outline';
	import { ShieldIcon } from '$lib/icons/solid';

	// SVG inline para reloj (no hay ClockIcon exportado)
	const ClockSvg = `<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
	import type { PreRegistrationForm, PreRegistration } from '$lib/services/pre-registration.service';

	// Permisos
	let currentRole = $derived($userStore.role || '');
	let isSuperAdmin = $derived(currentRole === 'superadmin');
	let isAdmin = $derived(['superadmin', 'admin', 'cpd', 'encargado_curso', 'coordinador'].includes(currentRole));
	// Para tabs: super admin puede ver todo. CPD/encargado solo ven lo suyo.
	// F-2026-08-11-EC-AUTOSERVICIO: encargado_curso y coordinador (educacion
	// continua) ahora pueden crear/editar/cerrar/reabrir/eliminar formularios.
	let canCreate = $derived(STAFF_EC_FORMS.includes(currentRole));

	type Tab = 'forms' | 'submissions';
	let activeTab: Tab = $state('forms');
	let loading = $state(false);
	let copyingLink = $state<string | null>(null);

	// Forms
	let forms: PreRegistrationForm[] = $state([]);
	let formsPage = $state(1);
	let formsTotal = $state(0);
	let formsTotalPages = $state(1);
	let formsPerPage = 20;

	// Submissions
	let submissions: PreRegistration[] = $state([]);
	let subsPage = $state(1);
	let subsTotal = $state(0);
	let subsTotalPages = $state(1);
	let subsPerPage = 20;
	let subsEstadoFilter = $state<'' | 'pendiente' | 'aprobado' | 'rechazado'>('');
	let subsFormFilter = $state('');

	// Counters
	let counters = $state({ forms_total: 0, forms_activos: 0, submissions_pendientes: 0 });

	// Modal: crear/editar form
	let showFormModal = $state(false);
	let formModalSaving = $state(false);
	let editingForm: PreRegistrationForm | null = $state(null);
	let formData = $state({
		nombre: '',
		slug: '',
		descripcion: '',
		programa_id: '',
		fecha_inicio: '',
		fecha_fin: ''
	});
	let formErrors = $state<Record<string, string>>({});

	// Programs para el select
	let courses: any[] = $state([]);

	// Modal: rechazar submission
	let showRejectModal = $state(false);
	let rejectingSubmission: PreRegistration | null = $state(null);
	let rejectMotivo = $state('');
	let rejectSaving = $state(false);

	// Modal: confirmar delete form
	let showDeleteFormModal = $state(false);
	let formToDelete: PreRegistrationForm | null = $state(null);
	let deleteSaving = $state(false);

	// F-2026-08-11-CAMPOS-EC-MODALIDAD-VIEW (Kevin 22:37): modal de detalle
	// de submission para que el encargado pueda ver TODOS los datos (incluida
	// la carta firmada y la resolucion, que son links a Cloudinary).
	let showDetailModal = $state(false);
	let detailSubmission: PreRegistration | null = $state(null);

	// ISSUE-AUDIT-PRE-REGISTROS: fix race condition. El +page.svelte se monta
	// ANTES de que el +layout.svelte termine de llamar a userStore.init(),
	// entonces `isAdmin` es false (initial state del store) y redirigimos
	// incorrectamente. Usamos un flag `storeReady` para esperar a que init
	// haya terminado antes de evaluar el rol.
	let storeReady = $state(false);

	onMount(async () => {
		// Asegurar que el store esté hidratado antes de evaluar isAdmin
		if (!$userStore.isAuthenticated) {
			userStore.init();
		}
		storeReady = true;
	});

	$effect(() => {
		if (storeReady && !isAdmin) {
			goto('/app/dashboard');
			return;
		}
		if (storeReady && isAdmin) {
			loadCourses();
			Promise.all([loadForms(), loadCounters()]);
			if (activeTab === 'submissions') {
				loadSubmissions();
			}
		}
	});

	import { goto } from '$app/navigation';

	async function loadCourses() {
		try {
			const res = await courseService.getAll(1, 100);
			courses = res.data || [];
		} catch (e) {
			console.error('Error cargando cursos', e);
		}
	}

	async function loadForms() {
		loading = true;
		try {
			const res = await listForms(formsPage, formsPerPage);
			forms = res.data;
			formsTotal = res.meta.totalItems;
			formsTotalPages = res.meta.totalPages;
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar formularios');
		} finally {
			loading = false;
		}
	}

	async function loadSubmissions() {
		loading = true;
		try {
			const res = await listSubmissions({
				page: subsPage,
				perPage: subsPerPage,
				estado: subsEstadoFilter || undefined,
				formId: subsFormFilter || undefined
			});
			submissions = res.data;
			subsTotal = res.meta.totalItems;
			subsTotalPages = res.meta.totalPages;
		} catch (e: any) {
			alert('error', e?.message || 'Error al cargar pre-inscripciones');
		} finally {
			loading = false;
		}
	}

	async function loadCounters() {
		try {
			counters = await getCounters();
		} catch (e) {
			console.error('Error cargando counters', e);
		}
	}

	function switchTab(tab: Tab) {
		activeTab = tab;
		if (tab === 'forms' && forms.length === 0 && !loading) {
			loadForms();
		} else if (tab === 'submissions' && submissions.length === 0 && !loading) {
			loadSubmissions();
		}
	}

	// ============== Forms CRUD ==============

	function openCreateFormModal() {
		editingForm = null;
		formData = {
			nombre: '',
			slug: '',
			descripcion: '',
			programa_id: '',
			fecha_inicio: new Date().toISOString().slice(0, 10),
			fecha_fin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
		};
		formErrors = {};
		showFormModal = true;
	}

	function openEditFormModal(form: PreRegistrationForm) {
		editingForm = form;
		formData = {
			nombre: form.nombre,
			slug: form.slug,
			descripcion: form.descripcion || '',
			programa_id: form.programa_id || '',
			fecha_inicio: form.fecha_inicio?.slice(0, 10) || '',
			fecha_fin: form.fecha_fin?.slice(0, 10) || ''
		};
		formErrors = {};
		showFormModal = true;
	}

	function autoSlugFromName() {
		if (editingForm) return; // no auto-sobrescribir al editar
		if (formData.slug) return; // ya tiene slug manual
		formData.slug = formData.nombre
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 60);
	}

	function validateForm(): boolean {
		const errors: Record<string, string> = {};
		if (!formData.nombre.trim() || formData.nombre.trim().length < 3) {
			errors.nombre = 'El nombre debe tener al menos 3 caracteres.';
		}
		if (!formData.slug.trim()) {
			errors.slug = 'El slug es obligatorio (ej: diplomado-tributacion-2026).';
		} else if (!/^[a-z0-9][a-z0-9-]{2,119}$/.test(formData.slug)) {
			errors.slug = 'Solo minúsculas, números y guiones. Mínimo 3 caracteres.';
		}
		if (!formData.fecha_inicio) errors.fecha_inicio = 'La fecha de inicio es obligatoria.';
		if (!formData.fecha_fin) errors.fecha_fin = 'La fecha de fin es obligatoria.';
		if (formData.fecha_inicio && formData.fecha_fin && formData.fecha_fin <= formData.fecha_inicio) {
			errors.fecha_fin = 'La fecha de fin debe ser posterior a la de inicio.';
		}
		formErrors = errors;
		return Object.keys(errors).length === 0;
	}

	async function saveForm() {
		if (!validateForm()) return;
		formModalSaving = true;
		try {
			const payload = {
				nombre: formData.nombre.trim(),
				slug: formData.slug.trim(),
				descripcion: formData.descripcion.trim() || undefined,
				programa_id: formData.programa_id || null,
				fecha_inicio: new Date(formData.fecha_inicio).toISOString(),
				fecha_fin: new Date(formData.fecha_fin + 'T23:59:59').toISOString()
			};
			if (editingForm) {
				await updateForm(editingForm._id, payload);
				alert('success', 'Formulario actualizado.');
			} else {
				await createForm(payload);
				alert('success', 'Formulario creado.');
			}
			showFormModal = false;
			await Promise.all([loadForms(), loadCounters()]);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo guardar el formulario.');
		} finally {
			formModalSaving = false;
		}
	}

	async function handleCloseForm(form: PreRegistrationForm) {
		try {
			await closeForm(form._id);
			alert('success', 'Formulario cerrado.');
			await loadForms();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cerrar el formulario.');
		}
	}

	async function handleReopenForm(form: PreRegistrationForm) {
		try {
			await reopenForm(form._id);
			alert('success', 'Formulario reabierto.');
			await loadForms();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo reabrir el formulario.');
		}
	}

	function openDeleteFormModal(form: PreRegistrationForm) {
		formToDelete = form;
		showDeleteFormModal = true;
	}

	async function confirmDeleteForm() {
		if (!formToDelete) return;
		deleteSaving = true;
		try {
			await deleteForm(formToDelete._id);
			alert('success', 'Formulario eliminado.');
			showDeleteFormModal = false;
			formToDelete = null;
			await Promise.all([loadForms(), loadCounters()]);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo eliminar.');
		} finally {
			deleteSaving = false;
		}
	}

	async function copyPublicLink(form: PreRegistrationForm) {
		const url = `${window.location.origin}/pre-registro/${form.slug}`;
		try {
			await navigator.clipboard.writeText(url);
			copyingLink = form._id;
			setTimeout(() => (copyingLink = null), 1500);
		} catch {
			// Fallback si el navegador no soporta clipboard API
			prompt('Copiá este link:', url);
		}
	}

	function exportSubmissionsXLSX() {
		if (submissions.length === 0) {
			alert('warning', 'No hay pre-inscripciones para exportar.');
			return;
		}
		const headers = ['Formulario', 'Nombre', 'Email', 'CI', 'Celular', 'Fecha Nacimiento', 'Sexo', 'Estado', 'Fecha de envío', 'Mensaje'];
		const formNameById = new Map(forms.map(f => [f._id, f.nombre]));
		const escapeCSV = (v: any) => {
			if (v == null) return '';
			const s = String(v);
			if (s.includes(',') || s.includes('"') || s.includes('\n')) {
				return '"' + s.replace(/"/g, '""') + '"';
			}
			return s;
		};
		const rows = submissions.map(s => {
			const d = s.data || {};
			return [
				escapeCSV(s.form_nombre || formNameById.get(s.form_id) || s.form_id || ''),
				escapeCSV(d.nombre),
				escapeCSV(d.email),
				escapeCSV(d.carnet + (d.extension ? ' ' + d.extension : '')),
				escapeCSV(d.celular),
				escapeCSV(d.fecha_nacimiento || ''),
				escapeCSV(d.sexo || ''),
				escapeCSV(s.estado),
				escapeCSV(s.created_at ? new Date(s.created_at).toLocaleString('es-BO') : ''),
				escapeCSV(d.mensaje || '')
			].join(',');
		});
		// F-XXX (2026-07-29): XLSX en vez de CSV.
		const columnDefs = [
			{ header: 'Formulario', key: 'formulario', width: 28 },
			{ header: 'Nombre', key: 'nombre', width: 30 },
			{ header: 'Email', key: 'email', width: 28 },
			{ header: 'CI', key: 'ci', width: 18 },
			{ header: 'Celular', key: 'celular', width: 14 },
			{ header: 'Fecha de nacimiento', key: 'fecha_nac', width: 16 },
			{ header: 'Sexo', key: 'sexo', width: 10 },
			{ header: 'Estado', key: 'estado', width: 14 },
			{ header: 'Fecha de envío', key: 'created_at', width: 22 },
			{ header: 'Mensaje', key: 'mensaje', width: 32 },
		];
		const rowsForExcel = submissions.map((s: any) => {
			const d = s.data || {};
			return {
				formulario: s.form_nombre || formNameById.get(s.form_id) || s.form_id || '',
				nombre: d.nombre || '',
				email: d.email || '',
				ci: d.carnet + (d.extension ? ' ' + d.extension : ''),
				celular: d.celular || '',
				fecha_nac: d.fecha_nacimiento || '',
				sexo: d.sexo || '',
				estado: s.estado,
				created_at: s.created_at ? new Date(s.created_at).toLocaleString('es-BO') : '',
				mensaje: d.mensaje || '',
			};
		});
		exportToExcel(rowsForExcel, columnDefs, 'pre-inscripciones');
		alert('success', `${submissions.length} pre-inscripciones exportadas.`);
	}

	// ============== Submissions ==============

	async function handleApproveSubmission(sub: PreRegistration) {
		try {
			const student = await approveSubmission(sub._id);
			alert('success', `Pre-inscripción aprobada. Estudiante "${student.nombre}" creado.`);
			await Promise.all([loadSubmissions(), loadForms(), loadCounters()]);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar.');
		}
	}

	function openRejectSubmission(sub: PreRegistration) {
		rejectingSubmission = sub;
		rejectMotivo = '';
		showRejectModal = true;
	}

	async function confirmRejectSubmission() {
		if (!rejectingSubmission || rejectMotivo.trim().length < 3) return;
		rejectSaving = true;
		try {
			await rejectSubmission(rejectingSubmission._id, rejectMotivo.trim());
			alert('success', 'Pre-inscripción rechazada.');
			showRejectModal = false;
			rejectingSubmission = null;
			await Promise.all([loadSubmissions(), loadForms(), loadCounters()]);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo rechazar.');
		} finally {
			rejectSaving = false;
		}
	}

	function fmtDate(iso: string): string {
		if (!iso) return '';
		let c = iso.trim().replace(' ', 'T');
		if (c.includes('.')) c = c.split('.')[0];
		if (!c.endsWith('Z') && !c.includes('+')) c += 'Z';
		const d = new Date(c);
		return isNaN(d.getTime()) ? iso : d.toLocaleString('es-BO');
	}

	function formStatusBadge(estado: string) {
		return estado === 'activo'
			? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
			: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
	}

	function submissionStatusBadge(estado: string) {
		if (estado === 'pendiente') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
		if (estado === 'aprobado') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
		return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
	}

	function estadoBadgeFor(estado: string) {
		return submissionStatusBadge(estado);
	}

	// F-2026-08-11-CAMPOS-EC-MODALIDAD-VIEW (Kevin 22:37): abre el modal de
	// detalle de una submission para que el encargado pueda ver la carta
	// firmada (link a Cloudinary) y la resolucion (si subio el estudiante).
	function openDetailModal(sub: PreRegistration) {
		detailSubmission = sub;
		showDetailModal = true;
	}

	// Helper: detecta si una URL Cloudinary es una imagen (jpg/png) o un PDF
	// para mostrar el icono correcto en el modal de detalle.
	function isCloudinaryImage(url: string | null | undefined): boolean {
		if (!url) return false;
		return /\.(jpg|jpeg|png|webp)(\?|$|#)/i.test(url);
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Pre-inscripciones</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Formularios públicos para que visitantes llenen sus datos. Al aprobar, se crea el estudiante y se le envía un email con sus credenciales.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				type="button"
				onclick={exportSubmissionsXLSX}
				disabled={submissions.length === 0}
				class="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 active:scale-95 disabled:opacity-50 dark:border-dark-border dark:bg-dark-surface dark:text-gray-300 dark:hover:bg-dark-border/50"
				title="Exportar pre-inscripciones a Excel"
			>
				<DownloadIcon class="size-4" />
				Exportar Excel
			</button>
			{#if canCreate}
				<Button onclick={openCreateFormModal}>
					{#snippet leftIcon()}<PlusIcon class="size-5" />{/snippet}
					Nuevo Formulario
				</Button>
			{/if}
		</div>
	</div>

	<!-- Stats dashboard -->
	<div class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
		<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-dark-border dark:bg-dark-surface">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Formularios totales</p>
					<p class="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">{counters.forms_total}</p>
				</div>
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
					<ClipboardIcon class="size-6" />
				</div>
			</div>
			<p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
				{counters.forms_activos} activos · {counters.forms_total - counters.forms_activos} cerrados
			</p>
		</div>

		<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-dark-border dark:bg-dark-surface">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Pendientes de revisión</p>
					<p class="mt-1 text-3xl font-extrabold {counters.submissions_pendientes > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-900 dark:text-white'}">
						{counters.submissions_pendientes}
					</p>
				</div>
				<div class="flex h-12 w-12 items-center justify-center rounded-xl {counters.submissions_pendientes > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-gray-50 text-gray-400 dark:bg-dark-border dark:text-gray-500'}">
					<ExclamationIcon class="size-6" />
				</div>
			</div>
			<p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
				{counters.submissions_pendientes === 0 ? '¡Todo al día!' : 'Requieren tu atención'}
			</p>
		</div>

		<div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-dark-border dark:bg-dark-surface">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Formularios activos</p>
					<p class="mt-1 text-3xl font-extrabold text-gray-900 dark:text-white">
						{counters.forms_total > 0 ? Math.round((counters.forms_activos / counters.forms_total) * 100) : 0}<span class="text-lg">%</span>
					</p>
				</div>
				<div class="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
					<CircleCheckIcon class="size-6" />
				</div>
			</div>
			<p class="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
				{counters.forms_activos} de {counters.forms_total} abiertos ahora
			</p>
		</div>
	</div>

	<!-- Tabs: Formularios | Pre-inscripciones -->
	<div class="flex border-b border-gray-200 dark:border-dark-border">
		<button
			type="button"
			onclick={() => switchTab('forms')}
			class={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'forms' ? 'border-primary-600 text-primary-700 dark:text-dark-tertiary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
		>
			<span class="inline-flex items-center gap-2">
				<ClipboardIcon class="size-4" />
				Formularios
				<span class="ml-1 inline-flex items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/40 px-2 text-xs font-bold text-primary-700 dark:text-dark-tertiary">
					{counters.forms_total}
				</span>
			</span>
		</button>
		<button
			type="button"
			onclick={() => switchTab('submissions')}
			class={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'submissions' ? 'border-primary-600 text-primary-700 dark:text-dark-tertiary' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
		>
			<span class="inline-flex items-center gap-2">
				<UsersIcon class="size-4" />
				Pre-inscripciones
				{#if counters.submissions_pendientes > 0}
					<span class="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 text-xs font-bold text-amber-800 dark:text-amber-400">
						{counters.submissions_pendientes} pendientes
					</span>
				{/if}
			</span>
		</button>
	</div>

	<!-- ========== TAB: Formularios ========== -->
	{#if activeTab === 'forms'}
		{#if loading && forms.length === 0}
			<TableSkeleton columns={5} rows={6} />
		{:else if forms.length === 0}
			<EmptyState
				icon="enrollment"
				title="No hay formularios de pre-inscripción"
				description="Creá un formulario para que visitantes externos se registren con un link público. Al aprobarlos, se crea el estudiante y se le envía un email con su contraseña inicial."
				ctaLabel={canCreate ? 'Crear primer formulario' : undefined}
				onCta={canCreate ? openCreateFormModal : undefined}
			/>
		{:else}
			<!-- Desktop: tabla -->
			<div class="hidden md:block bg-white dark:bg-dark-surface rounded-lg shadow border border-gray-200 dark:border-dark-border overflow-hidden">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
					<thead class="bg-gray-50 dark:bg-dark-background">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nombre</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Programa</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Vigencia</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Respuestas</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
						{#each forms as form (form._id)}
							<tr>
								<td class="px-4 py-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{form.nombre}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
										<code class="text-[10px]">/pre-registro/{form.slug}</code>
									</p>
								</td>
								<td class="px-4 py-3 text-sm">
									{#if form.programa_nombre}
										<div class="text-gray-900 dark:text-white">{form.programa_nombre}</div>
										<div class="text-xs text-gray-500 dark:text-gray-400">{form.programa_codigo}</div>
									{:else}
										<span class="text-xs italic text-gray-500 dark:text-gray-400">General (CPD)</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
									<div>Desde: <span class="font-medium">{fmtDate(form.fecha_inicio)}</span></div>
									<div>Hasta: <span class="font-medium">{fmtDate(form.fecha_fin)}</span></div>
								</td>
								<td class="px-4 py-3 text-sm">
									<div class="text-gray-900 dark:text-white">
										<span class="font-bold">{form.submissions_total ?? 0}</span> total
									</div>
									{#if (form.submissions_pendientes ?? 0) > 0}
										<div class="text-xs text-amber-600 dark:text-amber-400 font-medium">
											{form.submissions_pendientes} pendientes
										</div>
									{/if}
								</td>
								<td class="px-4 py-3">
									<span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${formStatusBadge(form.estado)}`}>
										{form.estado}
									</span>
								</td>
								<td class="px-4 py-3 text-right">
									<div class="flex items-center justify-end gap-1">
										<button
											type="button"
											onclick={() => copyPublicLink(form)}
											class="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-dark-tertiary"
											title="Copiar link público"
											aria-label="Copiar link público"
										>
											{#if copyingLink === form._id}
												<CheckIcon class="size-4 text-green-600" />
											{:else}
												<CopyIcon class="size-4" />
											{/if}
										</button>
										{#if canCreate}
											<button
												type="button"
												onclick={() => openEditFormModal(form)}
												class="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-dark-tertiary"
												title="Editar"
												aria-label="Editar formulario"
											>
												<PencilIcon class="size-4" />
											</button>
											{#if form.estado === 'activo'}
												<button
													type="button"
													onclick={() => handleCloseForm(form)}
													class="p-1.5 text-gray-500 hover:text-amber-600"
													title="Cerrar"
													aria-label="Cerrar formulario"
												>
													<XIcon class="size-4" />
												</button>
											{:else}
												<button
													type="button"
													onclick={() => handleReopenForm(form)}
													class="p-1.5 text-gray-500 hover:text-green-600"
													title="Reabrir"
													aria-label="Reabrir formulario"
												>
													<CheckIcon class="size-4" />
												</button>
											{/if}
											<button
												type="button"
												onclick={() => openDeleteFormModal(form)}
												class="p-1.5 text-gray-500 hover:text-red-600"
												title="Eliminar"
												aria-label="Eliminar formulario"
											>
												<XIcon class="size-4" />
											</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile: cards -->
			<div class="md:hidden space-y-3">
				{#each forms as form (form._id)}
					<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-gray-900 dark:text-white">{form.nombre}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
									{form.programa_nombre || 'General (CPD)'}
								</p>
							</div>
							<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${formStatusBadge(form.estado)}`}>
								{form.estado}
							</span>
						</div>
						<div class="mt-2 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
							<span class="inline-flex items-center gap-1">
								<UsersIcon class="size-3.5" /> {form.submissions_total ?? 0} total
							</span>
							{#if (form.submissions_pendientes ?? 0) > 0}
								<span class="inline-flex items-center gap-1 text-amber-600 font-medium">
									{@html ClockSvg} {form.submissions_pendientes} pendientes
								</span>
							{/if}
						</div>
						{#if canCreate}
							<div class="mt-3 flex items-center gap-1 border-t border-gray-100 dark:border-dark-border pt-3">
								<button type="button" onclick={() => copyPublicLink(form)} class="flex-1 text-xs font-medium text-primary-600 dark:text-dark-tertiary py-1.5">
									<CopyIcon class="size-3.5 inline" /> Copiar link
								</button>
								<button type="button" onclick={() => openEditFormModal(form)} class="flex-1 text-xs font-medium text-gray-700 dark:text-gray-300 py-1.5">
									<PencilIcon class="size-3.5 inline" /> Editar
								</button>
								{#if form.estado === 'activo'}
									<button type="button" onclick={() => handleCloseForm(form)} class="flex-1 text-xs font-medium text-amber-600 py-1.5">
										Cerrar
									</button>
								{:else}
									<button type="button" onclick={() => handleReopenForm(form)} class="flex-1 text-xs font-medium text-green-600 py-1.5">
										Reabrir
									</button>
								{/if}
								<button type="button" onclick={() => openDeleteFormModal(form)} class="text-xs font-medium text-red-600 px-2 py-1.5">
									Eliminar
								</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<Pagination
				currentPage={formsPage}
				totalPages={formsTotalPages}
				totalItems={formsTotal}
				limit={formsPerPage}
				onPageChange={(p) => { formsPage = p; loadForms(); }}
				onLimitChange={(l) => { formsPerPage = l; formsPage = 1; loadForms(); }}
			/>
		{/if}
	{/if}

	<!-- ========== TAB: Submissions ========== -->
	{#if activeTab === 'submissions'}
		<div class="flex flex-col sm:flex-row gap-3">
			<select
				bind:value={subsEstadoFilter}
				onchange={() => { subsPage = 1; loadSubmissions(); }}
				class="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-2 text-sm"
			>
				<option value="">Todos los estados</option>
				<option value="pendiente">Pendientes</option>
				<option value="aprobado">Aprobados</option>
				<option value="rechazado">Rechazados</option>
			</select>
			<select
				bind:value={subsFormFilter}
				onchange={() => { subsPage = 1; loadSubmissions(); }}
				class="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface px-3 py-2 text-sm"
			>
				<option value="">Todos los formularios</option>
				{#each forms as f (f._id)}
					<option value={f._id}>{f.nombre}</option>
				{/each}
			</select>
		</div>

		{#if loading && submissions.length === 0}
			<TableSkeleton columns={5} rows={6} />
		{:else if submissions.length === 0}
			<EmptyState
				icon="enrollment"
				title="No hay pre-inscripciones"
				description="Cuando un visitante complete un formulario público, aparecerá acá para que lo apruebes o rechaces."
			/>
		{:else}
			<div class="hidden md:block bg-white dark:bg-dark-surface rounded-lg shadow border border-gray-200 dark:border-dark-border overflow-hidden">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
					<thead class="bg-gray-50 dark:bg-dark-background">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Carnet</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Formulario</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">EC</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Docs</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
							<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
						{#each submissions as sub (sub._id)}
							<tr>
								<td class="px-4 py-3">
									<p class="text-sm font-medium text-gray-900 dark:text-white">{sub.data.nombre}</p>
									<p class="text-xs text-gray-500 dark:text-gray-400">{sub.data.email}</p>
								</td>
								<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
									{sub.data.carnet}
									{#if sub.data.extension}<span class="text-gray-400">-{sub.data.extension}</span>{/if}
									<div class="text-xs text-gray-500 dark:text-gray-400">{sub.data.celular}</div>
								</td>
								<td class="px-4 py-3 text-sm">
									<div class="text-gray-900 dark:text-white">{sub.form_nombre || '—'}</div>
									{#if sub.programa_nombre}
										<div class="text-xs text-gray-500 dark:text-gray-400">{sub.programa_nombre}</div>
									{/if}
								</td>
								<td class="px-4 py-3 text-xs">
									<!-- F-2026-08-11-CAMPOS-EC-MODALIDAD-VIEW: badges de procedencia/modalidad -->
									<div class="flex flex-wrap gap-1">
										{#if sub.data.procedencia}
											<span class="inline-flex items-center rounded bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 dark:text-indigo-300" title="Procedencia: {sub.data.procedencia}">
												{sub.data.procedencia}
											</span>
										{/if}
										{#if sub.data.modalidad}
											<span class="inline-flex items-center rounded bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300" title="Modalidad: {sub.data.modalidad}">
												{sub.data.modalidad}
											</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3 text-xs">
									<!-- F-2026-08-11-CAMPOS-EC-MODALIDAD-VIEW: badges carta/resol + Ver detalle -->
									<div class="flex flex-wrap gap-1">
										{#if sub.data.carta_firmada_url}
											<a href={sub.data.carta_firmada_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50" title="Ver carta firmada">
												<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
												Carta
											</a>
										{/if}
										{#if sub.data.resolucion_url}
											<a href={sub.data.resolucion_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" title="Ver resolucion de beca/descuento">
												<svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
												Beca
											</a>
										{/if}
										<button type="button" onclick={() => openDetailModal(sub)} class="inline-flex items-center gap-1 rounded bg-gray-100 dark:bg-dark-border px-1.5 py-0.5 text-[10px] font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-border/70" title="Ver todos los datos">
											Ver detalle
										</button>
									</div>
								</td>
								<td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
									{fmtDate(sub.created_at)}
								</td>
								<td class="px-4 py-3">
									<span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadgeFor(sub.estado)}`}>
										{sub.estado}
									</span>
									{#if sub.estado === 'rechazado' && sub.motivo_rechazo}
										<p class="text-[10px] text-red-600 dark:text-red-400 mt-1 line-clamp-2" title={sub.motivo_rechazo}>
											{sub.motivo_rechazo}
										</p>
									{/if}
								</td>
								<td class="px-4 py-3 text-right">
									{#if sub.estado === 'pendiente'}
										<div class="flex items-center justify-end gap-1">
											<Button size="xs" variant="destructive" onclick={() => openRejectSubmission(sub)}>Rechazar</Button>
											<Button size="xs" onclick={() => handleApproveSubmission(sub)}>Aprobar</Button>
										</div>
									{:else}
										<span class="text-xs text-gray-400">
											{sub.revisado_por ? `por ${sub.revisado_por}` : ''}
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Mobile: cards -->
			<div class="md:hidden space-y-3">
				{#each submissions as sub (sub._id)}
					<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-gray-900 dark:text-white truncate">{sub.data.nombre}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 truncate">{sub.data.email} · {sub.data.celular}</p>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">CI {sub.data.carnet}{#if sub.data.extension}-{sub.data.extension}{/if}</p>
							</div>
							<span class={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadgeFor(sub.estado)}`}>
								{sub.estado}
							</span>
						</div>
						<p class="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
							{sub.form_nombre || 'Formulario'} · {fmtDate(sub.created_at)}
						</p>
						{#if sub.estado === 'pendiente'}
							<div class="mt-3 flex items-center gap-2 border-t border-gray-100 dark:border-dark-border pt-3">
								<Button size="sm" variant="destructive" fullWidth onclick={() => openRejectSubmission(sub)}>Rechazar</Button>
								<Button size="sm" fullWidth onclick={() => handleApproveSubmission(sub)}>Aprobar</Button>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<Pagination
				currentPage={subsPage}
				totalPages={subsTotalPages}
				totalItems={subsTotal}
				limit={subsPerPage}
				onPageChange={(p) => { subsPage = p; loadSubmissions(); }}
				onLimitChange={(l) => { subsPerPage = l; subsPage = 1; loadSubmissions(); }}
			/>
		{/if}
	{/if}
</div>

<!-- Modal: crear/editar formulario -->
<Modal
	isOpen={showFormModal}
	title={editingForm ? 'Editar Formulario' : 'Nuevo Formulario de Pre-inscripción'}
	onClose={() => { if (!formModalSaving) showFormModal = false; }}
	maxWidth="sm:max-w-2xl"
>
	<div class="p-4 space-y-4">
		<div>
			<label for="form-nombre" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
				Nombre interno *
			</label>
			<input
				id="form-nombre"
				type="text"
				bind:value={formData.nombre}
				oninput={autoSlugFromName}
				class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm"
				placeholder="Ej: Admisión Diplomado Tributación 2026"
			/>
			{#if formErrors.nombre}<p class="mt-1 text-xs text-red-600">{formErrors.nombre}</p>{/if}
		</div>

		<div>
			<label for="form-slug" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
				Slug (link público) *
			</label>
			<div class="flex items-center gap-2">
				<span class="text-xs text-gray-500 dark:text-gray-400 font-mono whitespace-nowrap">/pre-registro/</span>
				<input
					id="form-slug"
					type="text"
					bind:value={formData.slug}
					class="flex-1 rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm font-mono"
					placeholder="diplomado-tributacion-2026"
				/>
			</div>
			{#if formErrors.slug}<p class="mt-1 text-xs text-red-600">{formErrors.slug}</p>{/if}
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				Solo letras minúsculas, números y guiones. El visitante accede con este link.
			</p>
		</div>

		<div>
			<label for="form-programa" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
				Programa asociado
			</label>
			<select
				id="form-programa"
				bind:value={formData.programa_id}
				class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm"
			>
				<option value="">— General (lo ve CPD) —</option>
				{#each courses as course (course._id)}
					<option value={course._id}>{course.codigo} — {course.nombre_programa}</option>
				{/each}
			</select>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				Si elegís un programa, el formulario será delegado al Encargado de Curso correspondiente. Si es General, lo ve CPD.
			</p>
		</div>

		<div>
			<label for="form-desc" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
				Descripción (visible para el visitante)
			</label>
			<textarea
				id="form-desc"
				bind:value={formData.descripcion}
				rows="3"
				class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm"
				placeholder="Ej: Completa el formulario para inscribirte al Diplomado en Tributación. Plazo hasta el 23 de julio."
			></textarea>
		</div>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<div>
				<label for="form-inicio" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
					Fecha de inicio *
				</label>
				<input
					id="form-inicio"
					type="date"
					bind:value={formData.fecha_inicio}
					class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm"
				/>
				{#if formErrors.fecha_inicio}<p class="mt-1 text-xs text-red-600">{formErrors.fecha_inicio}</p>{/if}
			</div>
			<div>
				<label for="form-fin" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
					Fecha de cierre *
				</label>
				<input
					id="form-fin"
					type="date"
					bind:value={formData.fecha_fin}
					class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm"
				/>
				{#if formErrors.fecha_fin}<p class="mt-1 text-xs text-red-600">{formErrors.fecha_fin}</p>{/if}
			</div>
		</div>

		<div class="flex justify-end gap-3 pt-2 border-t border-gray-100 dark:border-dark-border">
			<Button variant="secondary" onclick={() => (showFormModal = false)} disabled={formModalSaving}>
				Cancelar
			</Button>
			<Button onclick={saveForm} loading={formModalSaving}>
				{editingForm ? 'Guardar cambios' : 'Crear formulario'}
			</Button>
		</div>
	</div>
</Modal>

<!-- Modal: rechazar submission -->
<Modal
	isOpen={showRejectModal}
	title="Rechazar Pre-inscripción"
	onClose={() => { if (!rejectSaving) showRejectModal = false; }}
	maxWidth="sm:max-w-lg"
>
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Indica el motivo del rechazo de la pre-inscripción de
			<span class="font-semibold text-gray-900 dark:text-white">{rejectingSubmission?.data.nombre}</span>
			(CI {rejectingSubmission?.data.carnet}).
		</p>
		<textarea
			bind:value={rejectMotivo}
			rows="3"
			placeholder="Ej: Datos incompletos o incorrectos..."
			class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-surface py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
		></textarea>
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => (showRejectModal = false)} disabled={rejectSaving}>Cancelar</Button>
			<Button variant="destructive" onclick={confirmRejectSubmission} loading={rejectSaving} disabled={rejectMotivo.trim().length < 3}>
				Rechazar
			</Button>
		</div>
	</div>
</Modal>

<!-- Modal: confirmar delete form -->
<ModalConfirm
	isOpen={showDeleteFormModal}
	message={formToDelete
		? `¿Eliminar el formulario "${formToDelete.nombre}"? Si tiene respuestas, no se podrá eliminar.`
		: '¿Eliminar este formulario?'}
	onConfirm={confirmDeleteForm}
	onCancel={() => { showDeleteFormModal = false; formToDelete = null; }}
	loading={deleteSaving}
/>

<!-- F-2026-08-11-CAMPOS-EC-MODALIDAD-VIEW (Kevin 22:37): modal de detalle
     con TODOS los datos de la submission (identidad, contacto, EC, docs).
     El encargado abre esto para confirmar antes de aprobar: ve la carta
     firmada, la resolucion, procedencia, modalidad, etc. -->
{#if detailSubmission}
	{@const d = detailSubmission.data || {}}
	<Modal
		isOpen={showDetailModal}
		title={`Detalle: ${d.nombre || 'Pre-inscripción'}`}
		onClose={() => { showDetailModal = false; detailSubmission = null; }}
	>
		<div class="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
			<!-- Estado + Formulario -->
			<div class="flex flex-wrap items-center gap-2">
				<span class={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wider ${estadoBadgeFor(detailSubmission.estado)}`}>
					{detailSubmission.estado}
				</span>
				{#if detailSubmission.form_nombre}
					<span class="text-xs text-gray-500 dark:text-gray-400">
						Formulario: <strong>{detailSubmission.form_nombre}</strong>
					</span>
				{/if}
				{#if detailSubmission.programa_nombre}
					<span class="text-xs text-gray-500 dark:text-gray-400">
						Programa: <strong>{detailSubmission.programa_nombre}</strong>
					</span>
				{/if}
				<span class="text-xs text-gray-500 dark:text-gray-400">
					Enviado: {fmtDate(detailSubmission.created_at)}
				</span>
			</div>

			<!-- Identidad -->
			<div class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4">
				<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Identidad</h3>
				<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Nombre</dt><dd class="font-semibold text-right text-gray-900 dark:text-white">{d.nombre || '—'}</dd></div>
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Email</dt><dd class="font-mono text-xs text-right text-gray-900 dark:text-white break-all">{d.email || '—'}</dd></div>
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">CI</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.carnet}{d.extension ? ` · ${d.extension}` : ''}</dd></div>
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Celular</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.celular || '—'}</dd></div>
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Nacimiento</dt><dd class="text-right text-gray-900 dark:text-white">{d.fecha_nacimiento || '—'}</dd></div>
					<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Sexo</dt><dd class="text-right text-gray-900 dark:text-white capitalize">{d.sexo || '—'}</dd></div>
					<div class="flex justify-between gap-2 sm:col-span-2"><dt class="text-gray-500 dark:text-gray-400">Domicilio</dt><dd class="text-right text-gray-900 dark:text-white max-w-[60%]">{d.domicilio || '—'}</dd></div>
				</dl>
			</div>

			<!-- Datos EC (solo si hay al menos uno) -->
			{#if d.procedencia || d.modalidad || d.carta_firmada_url || d.resolucion_url || d.registro_universitario || d.avance_academico_codigo || d.formulario_descuento_numero || d.carrera_codigo || d.descuento_porcentaje}
				<div class="rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-900/10 p-4">
					<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Datos de educación continua</h3>
					<dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Procedencia</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.procedencia || '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Modalidad</dt><dd class="text-right text-gray-900 dark:text-white capitalize">{d.modalidad || '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Registro Univ.</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.registro_universitario || '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Avance académico</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.avance_academico_codigo ?? '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Nº Form. Descuento</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.formulario_descuento_numero ?? '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Carrera</dt><dd class="font-mono text-right text-gray-900 dark:text-white">{d.carrera_codigo || '—'}</dd></div>
						<div class="flex justify-between gap-2"><dt class="text-gray-500 dark:text-gray-400">Descuento</dt><dd class="text-right text-gray-900 dark:text-white">{d.descuento_porcentaje != null ? `${(d.descuento_porcentaje * 100).toFixed(0)}%` : '—'}</dd></div>
					</dl>
				</div>
			{/if}

			<!-- Documentos (carta firmada + resolucion) -->
			<div class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4">
				<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Documentos</h3>
				<dl class="space-y-2 text-sm">
					<div class="flex items-center justify-between gap-3">
						<dt class="text-gray-500 dark:text-gray-400 shrink-0">Carta firmada</dt>
						<dd class="text-right">
							{#if d.carta_firmada_url}
								{#if isCloudinaryImage(d.carta_firmada_url)}
									<a href={d.carta_firmada_url} target="_blank" rel="noopener noreferrer" class="inline-block">
										<img src={d.carta_firmada_url} alt="Carta firmada" class="max-h-32 max-w-[200px] rounded border border-gray-200 dark:border-dark-border hover:opacity-80" />
									</a>
								{:else}
									<a href={d.carta_firmada_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-200">
										<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
										Abrir PDF
									</a>
								{/if}
							{:else}
								<span class="text-xs text-gray-400">No adjuntó carta firmada</span>
							{/if}
						</dd>
					</div>
					<div class="flex items-center justify-between gap-3">
						<dt class="text-gray-500 dark:text-gray-400 shrink-0">Resolución de beca / descuento</dt>
						<dd class="text-right">
							{#if d.resolucion_url}
								{#if isCloudinaryImage(d.resolucion_url)}
									<a href={d.resolucion_url} target="_blank" rel="noopener noreferrer" class="inline-block">
										<img src={d.resolucion_url} alt="Resolución de beca / descuento" class="max-h-32 max-w-[200px] rounded border border-gray-200 dark:border-dark-border hover:opacity-80" />
									</a>
								{:else}
									<a href={d.resolucion_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 rounded bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200">
										<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
										Abrir PDF
									</a>
								{/if}
							{:else}
								<span class="text-xs text-gray-400">No adjuntó resolución de beca (opcional)</span>
							{/if}
						</dd>
					</div>
				</dl>
			</div>

			<!-- Mensaje del estudiante -->
			{#if d.mensaje}
				<div class="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4">
					<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Mensaje</h3>
					<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{d.mensaje}</p>
				</div>
			{/if}

			<!-- Motivo de rechazo si fue rechazado -->
			{#if detailSubmission.estado === 'rechazado' && detailSubmission.motivo_rechazo}
				<div class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 p-4">
					<h3 class="mb-2 text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">Motivo de rechazo</h3>
					<p class="text-sm text-red-700 dark:text-red-300">{detailSubmission.motivo_rechazo}</p>
				</div>
			{/if}

			<!-- Acciones del modal (aprobar/rechazar si pendiente) -->
			{#if detailSubmission.estado === 'pendiente'}
				<div class="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-dark-border pt-4">
					<Button variant="destructive" onclick={() => {
						const sub = detailSubmission;
						if (sub) { showDetailModal = false; openRejectSubmission(sub); }
					}}>
						Rechazar
					</Button>
					<Button onclick={() => {
						const sub = detailSubmission;
						if (sub) { showDetailModal = false; handleApproveSubmission(sub); }
					}}>
						Aprobar
					</Button>
				</div>
			{/if}
		</div>
	</Modal>
{/if}
