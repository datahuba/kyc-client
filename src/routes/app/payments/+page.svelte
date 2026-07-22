<script lang="ts">
	import { onMount } from 'svelte';
	import { page as appPage } from '$app/stores';
	import { paymentService, studentService, courseService } from '$lib/services';
	import type { Payment, Student, Course } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import PaymentForm from '$lib/features/payments/PaymentForm.svelte';
	import AddPagoByStaffModal from '$lib/features/payments/AddPagoByStaffModal.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import SearchInput from '$lib/components/ui/searchInput.svelte';
	import { Pagination } from '$lib/components/ui';
	import UploadComprobanteModal from '$lib/features/payments/UploadComprobanteModal.svelte';
	import { 
		PlusIcon, 
		DotsVerticalIcon, 
		CheckIcon, 
		XIcon, 
		RefreshIcon,
		DownloadIcon,
		UploadIcon
	} from '$lib/icons/outline';
	import { alert, formatDate, formatCurrency } from '$lib/utils';
	import Select from '$lib/components/ui/select.svelte';
	

	let payments: Payment[] = $state([]);
	let loading = $state(true);
	
	// Pagination
	let page = $state(1);
	let limit = $state(10);
	let totalItems = $state(0);
	let totalPages = $state(1);

	// Filters
	let filters = $state({
		q: '',
		estado: '',
		curso_id: '',
		estudiante_id: '',
		tipo_concepto: ''
	});
	let debounceTimer: any;

	let studentsList: Student[] = $state([]);
	let coursesList: Course[] = $state([]);

	// ISSUE-P-SEGMENTACION: si el usuario (Cobranza/Encargado de Curso) tiene
	// cursos_asignados no vacío, el selector de curso del filtro solo debe
	// mostrar esos cursos (el backend ya rechaza/filtra el resto, esto es
	// solo para no ofrecer una opción que de todos modos será vacía/403).
	let cursosAsignadosUsuario = $derived($userStore.user?.cursos_asignados ?? []);
	let coursesListFiltrada = $derived(
		cursosAsignadosUsuario.length > 0
			? coursesList.filter((c) => cursosAsignadosUsuario.includes(c._id))
			: coursesList
	);

	// State Modals
	let isCreateModalOpen = $state(false);
	// F-COBRANZA-017: modal para que cobranza registre pagos en nombre del estudiante
	let isAddByStaffModalOpen = $state(false);
	let preselectedEnrollmentId: string | undefined = $state(undefined);
	let isApproveModalOpen = $state(false);
	let isRejectModalOpen = $state(false);
	let isRevertModalOpen = $state(false); // ISSUE-P-CANALES: Modal de anulación
	let isDeleteModalOpen = $state(false); // Borrado definitivo (solo superadmin)
	let isUploadComprobanteOpen = $state(false); // F-COBRANZA-011: cobranza sube comprobante del estudiante
	
	let paymentToAction: Payment | null = $state(null);
	let actionLoading = $state(false);
	let rejectReason = $state('');
	let revertReason = $state('');

	// Dropdown
	let openDropdownId: string | null = $state(null);
	let selectedPayment: Payment | null = $state(null);

	// Computed
	let isAdmin = $derived($userStore.role === 'admin' || $userStore.role === 'superadmin');
	let isStudent = $derived(($userStore.role as string) === 'student');
	let isCPD = $derived($userStore.role === 'cpd');
	let isCobranza = $derived($userStore.role === 'cobranza');
	let isStaff = $derived(['admin', 'superadmin', 'cpd', 'cobranza', 'mae'].includes($userStore.role || ''));
	let coursesMap = $derived(
		coursesList.reduce((acc, c) => ({ ...acc, [c._id]: c }), {} as Record<string, typeof coursesList[0]>)
	);

	async function loadPayments() {
		loading = true;
		try {
			if (isStaff && studentsList.length === 0) {
				const studentsRes = await studentService.getAll(1, 100);
				studentsList = studentsRes.data;
			}
			if (coursesList.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				coursesList = coursesRes.data;
			}

			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.estado) filterParams.estado = filters.estado;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;
			if (filters.estudiante_id) filterParams.estudiante_id = filters.estudiante_id;
			if (filters.tipo_concepto) filterParams.tipo_concepto = filters.tipo_concepto;

			const result = await paymentService.getAll(page, limit, filterParams); 
			
			const response = result as any;
			if (response && Array.isArray(response)) {
				payments = response;
				totalItems = response.length;
				totalPages = 1;
			} else if (response && response.data) {
				payments = response.data;
				totalItems = response.meta.totalItems;
				totalPages = response.meta.totalPages;
			} else {
				payments = [];
				totalItems = 0;
			}

		} catch (error: any) {
			console.error(error);
			alert('error', error.message || 'Error al cargar pagos');
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadPayments();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadPayments();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadPayments();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadPayments();
	}

	onMount(async () => {
		const results = await Promise.all([
			courseService.getAll(1, 100),
			isStaff ? studentService.getAll(1, 100) : Promise.resolve(null)
		]);
		coursesList = results[0].data;
		if (results[1]) studentsList = (results[1] as any).data;

		const cursoIdParam = $appPage.url.searchParams.get('curso_id');
		if (cursoIdParam) {
			filters.curso_id = cursoIdParam;
		}

		// Atajo directo desde "Ver Libreta -> Pagar Saldo Pendiente": abre el
		// modal de registro de pago con esa inscripción ya preseleccionada,
		// sin que el estudiante tenga que buscarla/seleccionarla de nuevo.
		const pagarEnrollmentId = $appPage.url.searchParams.get('pagar');
		if (pagarEnrollmentId && isStudent) {
			preselectedEnrollmentId = pagarEnrollmentId;
			isCreateModalOpen = true;
		}

		loadPayments();
	});

	function toggleDropdown(id: string) {
		openDropdownId = openDropdownId === id ? null : id;
	}

	// Actions
	function handleApproveClick(payment: Payment) {
		paymentToAction = payment;
		isApproveModalOpen = true;
		openDropdownId = null;
	}

	function handleRejectClick(payment: Payment) {
		paymentToAction = payment;
		rejectReason = '';
		isRejectModalOpen = true;
		openDropdownId = null;
	}

	function handleRevertClick(payment: Payment) {
		paymentToAction = payment;
		revertReason = '';
		isRevertModalOpen = true;
		openDropdownId = null;
	}

	async function confirmApprove() {
		if (!paymentToAction) return;
		actionLoading = true;
		
		const idToApprove = paymentToAction._id;
		
		try {
			await paymentService.approve(idToApprove);
			alert('success', 'Pago aprobado y Algoritmo de Prorrateo ejecutado correctamente.');
			isApproveModalOpen = false;
			payments = payments.map(p => p._id === idToApprove ? { ...p, estado_pago: 'aprobado' } : p);
		} catch (error: any) {
			alert('error', error.message || 'Error al aprobar pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
		}
	}

	async function confirmReject() {
		if (!paymentToAction) return;
		if (!rejectReason.trim()) {
			alert('error', 'Debe ingresar un motivo');
			return;
		}
		actionLoading = true;
		
		const idToReject = paymentToAction._id;
		const reason = rejectReason;
		
		try {
			await paymentService.reject(idToReject, reason);
			alert('success', 'Pago rechazado correctamente');
			isRejectModalOpen = false;
			payments = payments.map(p => p._id === idToReject ? { ...p, estado_pago: 'rechazado' } : p);
		} catch (error: any) {
			alert('error', error.message || 'Error al rechazar pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
			rejectReason = '';
		}
	}

	async function confirmRevert() {
		if (!paymentToAction) return;
		if (!revertReason.trim() || revertReason.length < 10) {
			alert('error', 'Debe ingresar un motivo legal válido de al menos 10 caracteres.');
			return;
		}
		actionLoading = true;
		
		const idToRevert = paymentToAction._id;
		const reason = revertReason;
		
		try {
			await paymentService.revert(idToRevert, reason);
			alert('success', 'Pago Anulado con éxito. La deuda del estudiante ha sido restaurada en cascada.');
			isRevertModalOpen = false;
			payments = payments.map(p => p._id === idToRevert ? { ...p, estado_pago: 'anulado' } : p);
		} catch (error: any) {
			alert('error', error.message || 'Error al anular pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
			revertReason = '';
		}
	}

	function handleDeleteClick(payment: Payment) {
		paymentToAction = payment;
		isDeleteModalOpen = true;
		openDropdownId = null;
	}

	async function confirmDelete() {
		if (!paymentToAction) return;
		actionLoading = true;

		const idToDelete = paymentToAction._id;

		try {
			await paymentService.delete(idToDelete);
			alert('success', 'Pago eliminado definitivamente. El saldo de la inscripción fue recalculado.');
			isDeleteModalOpen = false;
			payments = payments.filter(p => p._id !== idToDelete);
		} catch (error: any) {
			alert('error', error.message || 'Error al eliminar el pago');
		} finally {
			actionLoading = false;
			paymentToAction = null;
		}
	}

	function handleViewDetails(payment: Payment) {
		selectedPayment = payment;
		openDropdownId = null;
	}

	function canDelete(): boolean {
		// Borrado destructivo/financiero: exclusivo de superadmin (mismo criterio
		// que eliminar usuarios o cursos). Sirve para limpiar pagos de prueba/erróneos.
		return $userStore.role === 'superadmin';
	}

	// ISS-004: detección de filtros activos y limpieza para el empty state.
	// Reactividad pura: si cambia cualquier filtro, esto se recalcula solo.
	let hasActiveFilters = $derived(
		!!(filters.q || filters.estado || filters.curso_id || filters.estudiante_id || filters.tipo_concepto)
	);

	function clearFilters() {
		filters = { q: '', estado: '', curso_id: '', estudiante_id: '', tipo_concepto: '' };
		page = 1;
		loadPayments();
	}

	function canApproveReject(payment: Payment): boolean {
		if (payment.estado_pago !== 'pendiente') return false;
		
		const role = $userStore.role;
		if (role === 'admin' || role === 'superadmin') return true;
		
		const concept = (payment.concepto || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
		const isMatricula = concept.includes('matricula');
		
		if (role === 'cpd') return isMatricula;
		if (role === 'cobranza') return true; // Cobranza ahora puede validar tanto matrícula como colegiaturas
		return false;
	}

	function canRevert(payment: Payment): boolean {
		// ISSUE-P-CANALES: Solo personal financiero puede revertir pagos ya aprobados
		if (payment.estado_pago !== 'aprobado') return false;
		const role = $userStore.role;
		return role === 'admin' || role === 'superadmin' || role === 'cobranza';
	}

	// F-COBRANZA-011 (2026-07-21): cobranza puede subir el comprobante del
	// estudiante en nombre de él, cuando el estudiante no pudo hacerlo, O
	// reemplazar un comprobante existente si es ilegible o está mal.
	// - Roles: superadmin, admin, cobranza (el backend rechaza otros roles).
	// - Estado: aparece SIEMPRE para los roles autorizados, sin importar si
	//   ya tiene comprobante. El modal muestra el actual + opción de subir
	//   uno nuevo (reemplazo). Antes solo aparecía si NO tenía, lo que
	//   confundió a Joel que no encontraba el botón.
	// - Decisión Joel 20:30: SOLO cobranza puede hacerlo, no encargado_curso.
	function canUploadComprobante(payment: Payment): boolean {
		const role = $userStore.role;
		if (role !== 'superadmin' && role !== 'admin' && role !== 'cobranza') return false;
		return true;
	}

	function handleUploadComprobanteClick(payment: Payment) {
		paymentToAction = payment;
		isUploadComprobanteOpen = true;
		openDropdownId = null;
	}

	function getDropdownOptions(payment: Payment) {
		const options = [];

		options.push({
			label: 'Ver Detalles',
			id: 'view',
			icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>`,
			action: () => handleViewDetails(payment)
		});

		// F-COBRANZA-011: cobranza puede subir comprobante del estudiante
		// cuando este no pudo hacerlo por sí mismo, O reemplazar el existente
		// si es ilegible o está mal. Siempre visible para cobranza/admin/superadmin.
		if (canUploadComprobante(payment)) {
			const label = payment.comprobante_url
				? 'Reemplazar comprobante'
				: 'Subir comprobante';
			options.push({
				label,
				id: 'upload',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>`,
				action: () => handleUploadComprobanteClick(payment)
			});
		}

		if (canApproveReject(payment)) {
			options.push(
				{
					label: 'Aprobar Pago',
					id: 'approve',
					icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
					action: () => handleApproveClick(payment)
				},
				{
					label: 'Rechazar Pago',
					id: 'reject',
					icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
					action: () => handleRejectClick(payment)
				}
			);
		}

		if (canRevert(payment)) {
			options.push(
				{
					label: 'Anular Pago',
					id: 'revert',
					icon: `<svg class="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
					action: () => handleRevertClick(payment)
				}
			)
		}

		if (canDelete()) {
			options.push(
				{
					label: 'Eliminar Pago',
					id: 'delete',
					icon: `<svg class="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
					action: () => handleDeleteClick(payment)
				}
			)
		}

		return options;
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'pendiente': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'aprobado': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
			case 'rechazado': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
			case 'anulado': return 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900'; // ISSUE-P-CANALES
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}

	function getConceptBadgeColor(concept: string) {
		const normalized = (concept || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
		if (normalized.includes('matricula')) {
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50';
		}
		if (normalized.includes('modulo') || normalized.includes('cuota')) {
			return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border border-purple-200 dark:border-purple-800/50';
		}
		return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
	}


	let excelLoading = $state(false);

	async function downloadExcel() {
		// F-COBRANZA-016 (2026-07-21): exporta la lista de pagos a XLSX (reemplaza
		// al CSV). Joel pidió: "se mejoren todas las exportaciones y sean tablas".
		excelLoading = true;
		try {
			const filterParams: any = {};
			if (filters.q) filterParams.q = filters.q;
			if (filters.estado) filterParams.estado = filters.estado;
			if (filters.curso_id) filterParams.curso_id = filters.curso_id;
			if (filters.estudiante_id) filterParams.estudiante_id = filters.estudiante_id;
			if (filters.tipo_concepto) filterParams.tipo_concepto = filters.tipo_concepto;

			await paymentService.downloadPaymentsExcel(filterParams);
		} catch (error) {
			console.error('Error al exportar Excel:', error);
			alert('error', 'Error al generar el archivo');
		} finally {
			excelLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
		<div>
			<Heading level="h1">Gestión de Pagos</Heading>
			<p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
				{#if isStaff}Administre los pagos recibidos{:else}Historial de sus pagos realizados{/if}
			</p>
			<!-- ISSUE-P-SEGMENTACION: aviso visible de por qué solo se ven ciertos cursos -->
			{#if isCobranza && cursosAsignadosUsuario.length > 0}
				<p class="mt-1 text-xs font-medium text-uagrm-sky">
					Vista segmentada: solo se muestran pagos de los {cursosAsignadosUsuario.length} curso(s) asignado(s) a tu cuenta.
				</p>
			{/if}
		</div>
		
		<div class="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
			<Button variant="secondary" onclick={loadPayments} loading={loading} aria-label="Recargar lista de pagos" class="flex-1 sm:flex-none justify-center">
				{#snippet leftIcon()} <RefreshIcon class="size-5" /> {/snippet}
				<span class="sm:hidden">Recargar</span>
			</Button>
			<Button variant="secondary" onclick={downloadExcel} loading={excelLoading} aria-label="Descargar listado de pagos en Excel" class="flex-1 sm:flex-none justify-center">
				{#snippet leftIcon()} <DownloadIcon class="size-5" /> {/snippet}
				<span class="whitespace-nowrap">Excel</span>
			</Button>
			{#if isStudent}
				<Button onclick={() => isCreateModalOpen = true} loading={loading} class="flex-1 sm:flex-none justify-center">
					{#snippet leftIcon()} <PlusIcon class="size-5" /> {/snippet}
					<span class="whitespace-nowrap">Registrar Pago</span>
				</Button>
			{/if}
			<!-- F-COBRANZA-017 (2026-07-22): cobranza/admin/superadmin registran
			     pagos en nombre del estudiante cuando este no pudo subirlos. -->
			{#if isStaff}
				<Button onclick={() => isAddByStaffModalOpen = true} class="flex-1 sm:flex-none justify-center">
					{#snippet leftIcon()} <PlusIcon class="size-5" /> {/snippet}
					<span class="whitespace-nowrap">Añadir Pago</span>
				</Button>
			{/if}
		</div>
	</div>

	<!-- Filters -->
	<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
		<div class="md:col-span-1">
			<label for="search" class="sr-only">Buscar</label>
			<SearchInput
				bind:value={filters.q}
				placeholder="Buscar recibo o nombre..."
				onInput={() => handleSearchInput()}
			/>
		</div>

		<div>
			<select
				bind:value={filters.tipo_concepto}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="">Todos los conceptos</option>
				<option value="matricula">Matrícula</option>
				<option value="colegiatura">Colegiatura / Módulos</option>
			</select>
		</div>
		
		<div>
			<select
				bind:value={filters.estado}
				onchange={handleFilterChange}
				class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
			>
				<option value="">Todos los estados</option>
				<option value="pendiente">Pendiente</option>
				<option value="aprobado">Aprobado</option>
				<option value="rechazado">Rechazado</option>
				<option value="anulado">Anulado</option>
			</select>
		</div>

		{#if isStaff}
			<div class="flex flex-col gap-1">
				<div class="relative">
					<select
						bind:value={filters.curso_id}
						onchange={handleFilterChange}
						class="block w-full rounded-md border-0 py-1.5 pr-8 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6
							{filters.curso_id
								? 'ring-2 ring-inset ring-primary-500 bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-500'
								: 'ring-1 ring-inset ring-gray-300 dark:bg-gray-700 dark:text-white dark:ring-gray-600'}"
					>
						<option value="">Todos los cursos</option>
						{#each coursesListFiltrada as course (course._id)}
							<option value={course._id}>{course.nombre_programa}</option>
						{/each}
						</select>
					{#if filters.curso_id}
						<button
							type="button"
							onclick={() => { filters.curso_id = ''; page = 1; handleFilterChange(); }}
							class="absolute right-7 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors z-10"
							title="Quitar filtro de curso"
						>
							<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
						</button>
					{/if}
				</div>
			</div>

			<div>
				<select
					bind:value={filters.estudiante_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="">Todos los estudiantes</option>
					{#each studentsList as student (student._id)}
						<option value={student._id}>{student.nombre}</option>
					{/each}
				</select>
			</div>
		{/if}
	</div>



	{#if loading && payments.length === 0}
		<TableSkeleton columns={11} rows={10} />
	{:else}
		<!-- ISSUE-X-COMPACT: Tabla consolidada SIN scroll horizontal (desktop) -->
		<div class="hidden lg:block border border-gray-200 dark:border-dark-border rounded-lg shadow-sm">
			<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-dark-border">
				<thead class="bg-gray-50 dark:bg-dark-background rounded-t-lg">
					<tr>
						<th scope="col" class="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transacción</th>
						<th scope="col" class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Concepto</th>
						<th scope="col" class="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Curso</th>
						<th scope="col" class="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remitente</th>
						<th scope="col" class="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto / Fecha</th>
						<th scope="col" class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
						<th scope="col" class="w-[6%] relative px-4 py-3"><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
					{#each payments as payment (payment._id)}
						<tr class="align-top hover:bg-gray-50 dark:hover:bg-dark-background/40 transition-colors">
							<!-- Transacción + método + banco -->
							<td class="px-4 py-4 text-sm">
								<div class="font-mono text-xs font-medium text-gray-700 dark:text-gray-300 truncate" title={payment.numero_transaccion}>
									{payment.numero_transaccion?.startsWith('CAJA-') ? 'Físico / ' + payment.numero_transaccion : payment.numero_transaccion}
								</div>
								<div class="flex items-center gap-1.5 mt-1 min-w-0">
									<span class={`shrink-0 px-1.5 py-0.5 inline-flex text-[10px] font-bold rounded ${payment.metodo_pago === 'Caja' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
										{payment.metodo_pago || 'Transferencia'}
									</span>
									<span class="text-[10px] text-gray-400 dark:text-gray-500 truncate">{payment.banco || 'Caja UAGRM'}</span>
								</div>
							</td>
							<!-- Concepto (Matrícula / Colegiatura / Módulos) -->
							<td class="px-4 py-4 text-sm">
								<span class={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${payment.concepto?.toLowerCase().includes('matrícula') || payment.concepto?.toLowerCase().includes('matricula') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
									{payment.concepto || 'Matrícula'}
								</span>
							</td>
							<!-- Curso -->
							<td class="px-4 py-4 text-sm">
								{#if coursesMap[payment.curso_id]}
									<button
										type="button"
										onclick={() => { filters.curso_id = payment.curso_id; page = 1; handleFilterChange(); }}
										class="text-left group w-full"
										title="Filtrar por este curso"
									>
										<span class="block text-gray-900 dark:text-white font-medium group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-tight line-clamp-2">{coursesMap[payment.curso_id].nombre_programa}</span>
										<span class="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">{coursesMap[payment.curso_id].codigo}</span>
									</button>
								{:else}
									<span class="text-gray-400 dark:text-gray-500 text-xs">—</span>
								{/if}
							</td>
							<!-- Remitente -->
							<td class="px-4 py-4 text-sm text-gray-900 dark:text-white truncate" title={payment.remitente || 'No disponible'}>
								{payment.remitente || 'No disponible'}
							</td>
							<!-- Monto + fecha -->
							<td class="px-4 py-4 text-sm">
								<div class="font-bold text-green-600 dark:text-green-400">{payment.monto_comprobante ? formatCurrency(payment.monto_comprobante) : '0.00'}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(payment.fecha_comprobante || '---')}</div>
							</td>
							<!-- Estado -->
							<td class="px-4 py-4 text-sm">
								<div class="flex flex-col items-start gap-1">
									<span class={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${getStatusColor(payment.estado_pago)}`}>
										{payment.estado_pago}
									</span>
									<!-- ISSUE-P-REVERSION -->
									{#if payment.en_ventana_reversion}
										<span
											class="px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold uppercase tracking-wide rounded-full whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
											title="Este pago por transferencia puede ser revertido por el banco hasta 48h después de su aprobación. Verifícalo contra el extracto bancario antes de darlo por definitivo."
										>
											En observación 48h
										</span>
									{/if}
								</div>
							</td>
							<!-- Acciones -->
							<td class="px-4 py-4 text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(payment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del pago">
									<DotsVerticalIcon class="size-5" />
								</button>
								{#if openDropdownId === payment._id}
									<div class="absolute right-0 mt-2 w-48 z-10">
										<DropdownMenu options={getDropdownOptions(payment)} isOpen={true} width="w-48" class="origin-top-right right-0" />
									</div>
								{/if}
							</td>
						</tr>
					{/each}
					{#if payments.length === 0}
						<tr>
							<td colspan="6" class="px-6 py-0">
								<EmptyState
									icon="payment"
									variant="simple"
									size="md"
									title="No se encontraron pagos"
									description={hasActiveFilters
										? 'No hay resultados con los filtros aplicados. Probá limpiarlos para ver todos los pagos.'
										: isStudent
											? 'Cuando registres un pago desde esta misma vista, aparecerá aquí para que puedas hacer seguimiento.'
											: 'Aún no se registraron pagos en el sistema.'}
									ctaLabel={hasActiveFilters ? 'Limpiar filtros' : undefined}
									onCta={hasActiveFilters ? clearFilters : undefined}
								/>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>

		<!-- ISSUE-X-COMPACT: Tarjetas para móvil y tablet -->
		<div class="lg:hidden space-y-3">
			{#each payments as payment (payment._id)}
				<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							{#if coursesMap[payment.curso_id]}
								<button type="button" onclick={() => { filters.curso_id = payment.curso_id; page = 1; handleFilterChange(); }} class="text-left">
									<span class="block text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">{coursesMap[payment.curso_id].nombre_programa}</span>
								</button>
							{/if}
							<span class="block font-mono text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate" title={payment.numero_transaccion}>
								{payment.numero_transaccion?.startsWith('CAJA-') ? 'Físico / ' + payment.numero_transaccion : payment.numero_transaccion}
							</span>
							<div class="flex items-center gap-1.5 mt-1">
								<span class={`px-1.5 py-0.5 inline-flex text-[10px] font-bold rounded ${payment.concepto?.toLowerCase().includes('matrícula') || payment.concepto?.toLowerCase().includes('matricula') ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'}`}>
									{payment.concepto || 'Matrícula'}
								</span>
							</div>
						</div>
						<div class="relative shrink-0">
							<button onclick={() => toggleDropdown(payment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del pago">
								<DotsVerticalIcon class="size-5" />
							</button>
							{#if openDropdownId === payment._id}
								<div class="absolute right-0 mt-2 w-48 z-10">
									<DropdownMenu options={getDropdownOptions(payment)} isOpen={true} width="w-48" class="origin-top-right right-0" />
								</div>
							{/if}
						</div>
					</div>

					<div class="mt-3 flex items-center justify-between">
						<span class="text-base font-bold text-green-600 dark:text-green-400">{payment.monto_comprobante ? formatCurrency(payment.monto_comprobante) : '0.00'}</span>
						<div class="flex items-center gap-1 shrink-0">
							<span class={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full whitespace-nowrap ${getStatusColor(payment.estado_pago)}`}>{payment.estado_pago}</span>
							<!-- ISSUE-P-REVERSION -->
							{#if payment.en_ventana_reversion}
								<span
									class="px-2 py-0.5 inline-flex text-[10px] leading-4 font-bold uppercase tracking-wide rounded-full whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
									title="Este pago por transferencia puede ser revertido por el banco hasta 48h después de su aprobación."
								>
									48h
								</span>
							{/if}
						</div>
					</div>

					<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
						<span class={`px-1.5 py-0.5 inline-flex font-bold rounded ${payment.metodo_pago === 'Caja' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>{payment.metodo_pago || 'Transferencia'}</span>
						<span class="truncate">{payment.remitente || 'No disponible'}</span>
						<span>·</span>
						<span class="shrink-0">{formatDate(payment.fecha_comprobante || '---')}</span>
					</div>
				</div>
			{/each}
			{#if payments.length === 0}
				<EmptyState
					icon="payment"
					variant="bordered"
					size="md"
					title="No se encontraron pagos"
					description={hasActiveFilters
						? 'No hay resultados con los filtros aplicados. Probá limpiarlos para ver todos los pagos.'
						: isStudent
							? 'Cuando registres un pago desde esta misma vista, aparecerá aquí para que puedas hacer seguimiento.'
							: 'Aún no se registraron pagos en el sistema.'}
					ctaLabel={hasActiveFilters ? 'Limpiar filtros' : undefined}
					onCta={hasActiveFilters ? clearFilters : undefined}
				/>
			{/if}
		</div>

		<Pagination
			currentPage={page}
			{totalPages}
			{totalItems}
			{limit}
			onPageChange={handlePageChange}
			onLimitChange={handleLimitChange}
		/>
	{/if}

	<!-- Create Payment Modal -->
	<Modal
		isOpen={isCreateModalOpen}
		title="Registrar Nuevo Pago"
		onClose={() => { isCreateModalOpen = false; preselectedEnrollmentId = undefined; }}
		maxWidth="sm:max-w-xl"
	>
		<PaymentForm
			{preselectedEnrollmentId}
			onSuccess={() => {
				isCreateModalOpen = false;
				preselectedEnrollmentId = undefined;
				loadPayments();
			}}
			onCancel={() => { isCreateModalOpen = false; preselectedEnrollmentId = undefined; }}
		/>
	</Modal>

	<!-- F-COBRANZA-017 (2026-07-22): modal para que cobranza/admin/superadmin
	     registre un pago COMPLETO en nombre de un estudiante. El pago
	     nace APROBADO y verificado_por="STAFF:<username>". -->
	<AddPagoByStaffModal
		isOpen={isAddByStaffModalOpen}
		onSuccess={() => {
			isAddByStaffModalOpen = false;
			loadPayments();
		}}
		onCancel={() => { isAddByStaffModalOpen = false; }}
	/>

	<!-- Approve Confirmation Modal -->
	<ModalConfirm
		isOpen={isApproveModalOpen}
		message={`¿Confirma que desea APROBAR este pago de ${formatCurrency(paymentToAction?.cantidad_pago || 0)}?`}
		onConfirm={confirmApprove}
		onCancel={() => isApproveModalOpen = false}
		loading={actionLoading}
	/>

	<!-- Reject Input Modal -->
	<Modal
		isOpen={isRejectModalOpen}
		title="Rechazar Pago"
		onClose={() => isRejectModalOpen = false}
		maxWidth="sm:max-w-lg"
	>
		<div class="space-y-4 p-4">
			<p class="text-sm text-gray-500">
				Ingrese el motivo del rechazo para informar al estudiante.
			</p>
			<div>
				<label for="rejectReason" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Motivo</label>
				<textarea
					id="rejectReason"
					bind:value={rejectReason}
					rows="3"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					placeholder="Ej: Comprobante ilegible, monto incorrecto..."
				></textarea>
			</div>
			<div class="flex justify-end gap-3 mt-4">
				<Button variant="secondary" onclick={() => isRejectModalOpen = false} disabled={actionLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmReject} loading={actionLoading}>Rechazar</Button>
			</div>
		</div>
	</Modal>

	<!-- Revert/Anular Modal (ISSUE-P-CANALES) -->
	<Modal
		isOpen={isRevertModalOpen}
		title="Anular Pago (Rollback Financiero)"
		onClose={() => isRevertModalOpen = false}
		maxWidth="sm:max-w-lg"
	>
		<div class="space-y-4 p-4">
			<div class="bg-red-50 border-l-4 border-red-500 p-3 rounded-md">
				<p class="text-xs text-red-700 font-medium">
					⚠️ ADVERTENCIA: Esta acción anulará el pago en la libreta del estudiante y <strong>restaurará sus deudas de forma automática</strong>. Use esto solo para cheques sin fondos, transferencias revertidas o errores graves.
				</p>
			</div>
			<div>
				<label for="revertReason" class="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">Justificación Legal de la Anulación</label>
				<textarea
					id="revertReason"
					bind:value={revertReason}
					rows="3"
					class="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
					placeholder="Ej: Transferencia internacional bloqueada por el banco emisor. Se restaura deuda."
				></textarea>
				<p class="text-[10px] text-gray-500 mt-1">Mínimo 10 caracteres requeridos para auditoría.</p>
			</div>
			<div class="flex justify-end gap-3 mt-4">
				<Button variant="secondary" onclick={() => isRevertModalOpen = false} disabled={actionLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmRevert} loading={actionLoading} disabled={revertReason.length < 10}>Anular y Restaurar Deuda</Button>
			</div>
		</div>
	</Modal>

	<!-- Delete Payment Modal (Borrado definitivo, solo superadmin) -->
	<ModalConfirm
		isOpen={isDeleteModalOpen}
		message={`¿ELIMINAR DEFINITIVAMENTE este pago de ${formatCurrency(paymentToAction?.cantidad_pago || 0)} por "${paymentToAction?.concepto || 'sin concepto'}"? Esta acción NO se puede deshacer: el registro se borra por completo de la base de datos y el saldo de la inscripción se recalcula automáticamente. Úsalo solo para pagos de prueba o erróneos.`}
		loading={actionLoading}
		onConfirm={confirmDelete}
		onCancel={() => { isDeleteModalOpen = false; paymentToAction = null; }}
	/>

	<!-- View Payment Details Modal -->
	<Modal
		isOpen={!!selectedPayment}
		title="Detalles del Pago"
		onClose={() => selectedPayment = null}
		maxWidth="sm:max-w-2xl"
	>
		{#if selectedPayment}
			<div class="space-y-6 p-4">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label for="estdianteID" class="block text-xs font-medium text-gray-900 uppercase">Estudiante ID</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="estudianteID">{selectedPayment.estudiante_id}</p>
					</div>
					<div>
						<label for="remitente" class="block text-xs font-medium text-gray-900 uppercase">Remitente</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="remitente">{selectedPayment.remitente || 'No disponible'}</p>
					</div>
					
					<div>
						<label for="metodo_pago" class="block text-xs font-medium text-gray-900 uppercase">Método de Pago</label>
						<span class={`mt-1 px-2.5 py-0.5 inline-flex text-xs font-bold rounded-md ${selectedPayment.metodo_pago === 'Caja' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
							{selectedPayment.metodo_pago || 'Transferencia'}
						</span>
					</div>

					<div>
						<label for="banco" class="block text-xs font-medium text-gray-900 uppercase">Banco</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="banco">
							{selectedPayment.banco || 'Caja Física UAGRM'}
						</p>
					</div>

					<div>
						<label for="montoComprobante" class="block text-xs font-bold text-gray-900 uppercase">Monto Real Depositado</label>
						<p class="text-lg font-black text-green-600 dark:text-green-400 mt-1" id="montoComprobante">
							{selectedPayment.monto_comprobante ? formatCurrency(selectedPayment.monto_comprobante) : '---'}
						</p>
					</div>
					
					<div>
						<label for="fechaComprobante" class="block text-xs font-medium text-gray-900 uppercase">Fecha Comprobante</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="fechaComprobante">
							{selectedPayment.fecha_comprobante ? formatDate(selectedPayment.fecha_comprobante) : '---'}
						</p>
					</div>
					
					<div>
						<label for="cuentaDestino" class="block text-xs font-medium text-gray-900 uppercase">Cuenta Destino</label>
						<p class="text-sm font-medium text-gray-500 dark:text-white mt-1" id="cuentaDestino">
							{selectedPayment.cuenta_destino || '---'}
						</p>
					</div>
					<div>
						<label for="detailsConcepto" class="block text-xs font-medium text-gray-900 uppercase">Concepto Prorrateo</label>
						<span id="detailsConcepto" class={`mt-1 px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${getConceptBadgeColor(selectedPayment.concepto)}`}>
							{selectedPayment.concepto || 'No especificado'}
						</span>
					</div>
					
					<div>
						<label for="numeroTransaccion" class="block text-xs font-medium text-gray-900 uppercase">Nº Transacción</label>
						<p class="text-sm font-mono text-gray-500 dark:text-white mt-1" id="numeroTransaccion">{selectedPayment.numero_transaccion || 'S/N'}</p>
					</div>
					<div>
						<label for="estado" class="block text-xs font-medium text-gray-900 uppercase">Estado General</label>
						<span class={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedPayment.estado_pago)}`}>
							{selectedPayment.estado_pago}
						</span>
					</div>
				</div>

				<div class="border-t border-gray-200 dark:border-gray-700 pt-4">
					<label for="comprobante" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Comprobante</label>
					{#if selectedPayment.comprobante_url}
						<!-- F-COBRANZA-012 (2026-07-21): botón de descarga prominentemente.
						     Funciona para cualquier tipo de comprobante (imagen o PDF).
						     El atributo `download` fuerza la descarga en vez de abrir nueva pestaña. -->
						<div class="flex justify-end mb-2">
							<a
								href={selectedPayment.comprobante_url}
								download
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-sm font-medium rounded-lg transition-all"
							>
								<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
								</svg>
								Descargar comprobante
							</a>
						</div>
						<div class="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-50 dark:bg-gray-900 flex justify-center items-center min-h-[200px]">
							<!-- F-COBRANZA-019 fix (2026-07-22): pantalla blanca al ver PDF.
							     Cloudinary sirve los PDFs subidos a /raw/upload/ con
							     Content-Disposition: attachment + Content-Type: application/octet-stream.
							     Eso FUERZA al browser a descargar el archivo en vez de renderizarlo
							     inline en el iframe, mostrando pantalla blanca.
							     Solución: agregamos ?fl_attachment=false a la URL de Cloudinary
							     para forzar Content-Disposition: inline. Eso permite que el PDF
							     se renderice inline en el iframe nativo del browser. Si el
							     Content-Type sigue siendo octet-stream, usamos <object type="application/pdf">
							     que fuerza al browser a usar el plugin PDF nativo. -->
							{#if selectedPayment.comprobante_url.toLowerCase().match(/\.(jpeg|jpg|gif|png|webp)$/) || selectedPayment.comprobante_url.includes('/image/upload/')}
								<img
									src={selectedPayment.comprobante_url}
									alt="Comprobante"
									class="max-w-full max-h-[500px] object-contain"
								/>
							{:else if selectedPayment.comprobante_url.toLowerCase().endsWith('.pdf') || selectedPayment.comprobante_url.includes('/raw/upload/')}
								<!-- PDF: Cloudinary sirve con Content-Disposition: attachment
								     que fuerza descarga en vez de renderizar inline. Probamos
								     primero con Google Docs Viewer como proxy (siempre renderiza
								     inline). Si falla, fallback al iframe directo + botón
								     "Descargar comprobante" arriba. -->
								{@const viewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(selectedPayment.comprobante_url)}&embedded=true`}
								<iframe
									src={viewerUrl}
									title="Comprobante PDF"
									class="w-full h-[500px] border-0 bg-white"
								></iframe>
								<p class="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
									Si el PDF no carga arriba, usa el botón "Descargar comprobante" de arriba.
								</p>
							{:else}
								<div class="text-center p-6">
									<p class="text-sm text-gray-500 mb-2">El comprobante es un documento (PDF u otro).</p>
									<Button variant="outline" onclick={() => window.open(selectedPayment?.comprobante_url, '_blank')}>
										Abrir en nueva pestaña
									</Button>
								</div>
							{/if}
						</div>
					{:else}
						<div class="bg-orange-50 border border-orange-200 p-8 rounded-lg text-center">
							<svg class="size-10 text-orange-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
							</svg>
							<p class="text-orange-800 font-bold">Pago Presencial en Caja</p>
							<p class="text-sm text-orange-600 mt-1">Este pago no requiere comprobante digital adjunto.</p>
						</div>
					{/if}
				</div>

				<!-- ISSUE-Q-MODAL-PAGO-ACCIONES: botones de Aprobar/Rechazar directamente
				     en el modal de detalles/comprobante, para no tener que cerrarlo y
				     buscarlos en el menú de tres puntos de la tabla. Reutiliza
				     canApproveReject/handleApproveClick/handleRejectClick tal cual
				     (mismo criterio de autorización por rol y concepto de pago). -->
				<div class="flex justify-end gap-3">
					<Button variant="secondary" onclick={() => selectedPayment = null}>Cerrar</Button>
					{#if canApproveReject(selectedPayment)}
						<Button
							variant="destructive"
							onclick={() => { const p = selectedPayment; selectedPayment = null; if (p) handleRejectClick(p); }}
						>
							{#snippet leftIcon()}
								<XIcon class="size-5" />
							{/snippet}
							Rechazar
						</Button>
						<Button
							onclick={() => { const p = selectedPayment; selectedPayment = null; if (p) handleApproveClick(p); }}
						>
							{#snippet leftIcon()}
								<CheckIcon class="size-5" />
							{/snippet}
							Aprobar
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</Modal>

	<!-- F-COBRANZA-011 (2026-07-21): modal para que COBRANZA suba el comprobante
	     de pago en nombre del estudiante. Solo visible para superadmin/admin/cobranza,
	     y solo si el pago todavía no tiene comprobante_url. -->
	<UploadComprobanteModal
		isOpen={isUploadComprobanteOpen}
		payment={paymentToAction}
		onSuccess={(updated) => {
			isUploadComprobanteOpen = false;
			paymentToAction = null;
			// Actualizar el pago en la lista local
			payments = payments.map(p => p._id === updated._id ? { ...p, ...updated } : p);
			loadPayments();
		}}
		onCancel={() => {
			isUploadComprobanteOpen = false;
			paymentToAction = null;
		}}
	/>
</div>
