<script lang="ts">
	import { onMount } from 'svelte';
	import { enrollmentService, studentService, courseService, discountService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import type { Enrollment, Student, Course, Discount } from '$lib/interfaces';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import EnrollmentForm from '$lib/features/enrollments/EnrollmentForm.svelte';
	import { PlusIcon, DotsVerticalIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';
	import { alert, formatDate, formatCurrency } from '$lib/utils';
	
	let enrollments: Enrollment[] = $state([]);
	let studentsMap: Record<string, Student> = $state({});
	let coursesMap: Record<string, Course> = $state({});
	let loading = $state(false);
	let error = $state('');

	// Pagination state
	let page: number = $state(1);
	let limit: number = $state(10);
	let totalItems: number = $state(0);
	let totalPages: number = $state(1);

	// Filter state (reactivo para bind:value sin warnings)
	// ISSUE-P-VISIBILIDAD-DESCUENTO (fix 2026-07-09, reportado por el usuario:
	// "no pude seleccionar los que están con descuento y cuál descuento"):
	// nuevo filtro con_descuento ('all' | 'con' | 'sin').
	let filters = $state({
		q: '',
		estado: 'all',
		curso_id: 'all',
		estudiante_id: 'all',
		con_descuento: 'all'
	});
	let debounceTimer: any;

	// Modal state
	let isFormOpen: boolean = $state(false);
	let selectedEnrollment: Enrollment | null = $state(null);
	let showDeleteModal: boolean = $state(false);
	let enrollmentToDelete: Enrollment | null = $state(null);
	let deleteLoading: boolean = $state(false);

	// ISSUE P: Kardex Académico State
	let isKardexOpen: boolean = $state(false);
	let selectedKardex: Enrollment | null = $state(null);
	// ISSUE-P-COBRANZA-LIBRETA: saldo a favor = excedente pagado sobre el total del
	// programa. Se calcula en cliente (cero cambios de backend) a partir de campos
	// ya expuestos; visible en el kardex para todos los roles (Cobranza incluida).
	function calcSaldoAFavor(e: Enrollment | null): number {
		if (!e) return 0;
		return Math.max(0, Math.round(((e.total_pagado || 0) - (e.total_a_pagar || 0)) * 100) / 100);
	}

	// ISSUE-P-BECA-RESPALDO
	let becaRespaldoUploading: boolean = $state(false);
	let becaRespaldoInputEl: HTMLInputElement | null = $state(null);

	// ISSUE-Q-NOTA-BORRADOR
	let notaValidacionLoading: Record<string, boolean> = $state({});

	// Dropdown state
	let openDropdownId: string | null = $state(null);

	let studentsList: Student[] = $state([]);
	let coursesList: Course[] = $state([]);
	// ISSUE-P-VISIBILIDAD-DESCUENTO (fix 2026-07-09): mapa id->Discount para
	// mostrar el nombre real del descuento aplicado en cada inscripción.
	let discountsMap: Record<string, Discount> = $state({});

	// ISSUE N: Control de Permisos Visuales (RBAC Frontend)
	let currentRole = $derived($userStore.role || $userStore.user?.rol || '');
	let canCreateEnrollment = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canEditEnrollment = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	let canDeleteEnrollment = $derived(currentRole === 'superadmin');
	// ISSUE-R-SOLICITUD-PASIVO: quién puede solicitar/aprobar el pasivo de una inscripción
	let canRequestPassive = $derived(['superadmin', 'admin', 'cpd', 'encargado_curso', 'student'].includes(currentRole));
	let canReactivate = $derived(['superadmin', 'admin', 'cpd'].includes(currentRole));
	// ISSUE-P-BECA-RESPALDO: quién puede subir/reemplazar el respaldo documental de una beca
	let canManageBecaRespaldo = $derived(['cpd', 'admin', 'superadmin'].includes(currentRole));
	// ISSUE-Q-NOTA-BORRADOR: quién puede validar/rechazar el borrador de nota del docente
	let canValidateNotaBorrador = $derived(['cpd', 'admin', 'superadmin'].includes(currentRole));

	// ISSUE-Q-DOCUMENTOS-KYC (2026-07-09): quién puede aprobar/rechazar documentos
	// subidos por el estudiante. Ampliado a Encargado de Curso/Coordinador (el
	// backend restringe a Encargado de Curso solo sus cursos_asignados) para no
	// sobrecargar solo a CPD -- explícitamente pedido por el usuario.
	let canManageRequisitos = $derived(
		['cpd', 'admin', 'superadmin', 'encargado_curso', 'coordinador'].includes(currentRole)
	);

	// ISSUE-R-NOTA-CONDICIONADA-PAGO (2026-07-08, reunión de postgrado
	// contaduría): el estudiante solo puede VER su nota oficial de un módulo
	// si está al día con el pago de ese módulo (mod.estado === 'Pagado').
	// Si debe, ve un aviso de "Falta pagar" en vez de la calificación -- esto
	// es una restricción VISUAL para el estudiante únicamente; el personal
	// (CPD/Admin/Superadmin/Docente) siempre ve la nota real sin restricción,
	// ya que necesitan gestionar el kardex independientemente del pago.
	function puedeVerNotaModulo(mod: any): boolean {
		if (currentRole !== 'student') return true;
		return mod.estado === 'Pagado';
	}
	// ISSUE-M-EXENCION: botón exclusivo de MAE (también admin/superadmin, que ya tienen todo)
	let canManageMatriculaExenta = $derived(['mae', 'admin', 'superadmin'].includes(currentRole));
	let matriculaExentaLoading: boolean = $state(false);

	// Modal de solicitud de pasivo
	let passiveModalOpen: boolean = $state(false);
	let passiveTarget: Enrollment | null = $state(null);
	let passiveMotivo: string = $state('');
	let passiveLoading: boolean = $state(false);

	// ISSUE-P-CONGELADO / AUDITORÍA #6: modal de confirmación con checkbox de
	// tasa pagada (el backend ya no la asume pagada por defecto)
	let congelarModalOpen: boolean = $state(false);
	let congelarTarget: Enrollment | null = $state(null);
	let congelarTasaPagada: boolean = $state(false);
	let congelarLoading: boolean = $state(false);

	onMount(() => {
		if (!$userStore.isAuthenticated) {
			userStore.init();
		}
		loadData();
	});

	async function loadData() {
		loading = true;

		try {
			if (studentsList.length === 0 && currentRole !== 'student') {
				const studentsRes = await studentService.getAll(1, 100); 
				studentsList = studentsRes.data;
				// Construir el mapa local y asignarlo una sola vez (evita assignment_value_stale)
				const sMap: Record<string, Student> = {};
				for (const s of studentsRes.data) sMap[s._id] = s;
				studentsMap = sMap;
			}

			if (coursesList.length === 0) {
				const coursesRes = await courseService.getAll(1, 100);
				coursesList = coursesRes.data;
				const cMap: Record<string, Course> = {};
				for (const c of coursesRes.data) cMap[c._id] = c;
				coursesMap = cMap;
			}

			// ISSUE-P-VISIBILIDAD-DESCUENTO: cargar descuentos una sola vez para
			// resolver el nombre real (no solo el porcentaje) en la tabla.
			if (Object.keys(discountsMap).length === 0 && currentRole !== 'student') {
				try {
					const discountsRes = await discountService.getAll(1, 100);
					const dMap: Record<string, Discount> = {};
					for (const d of discountsRes.data) dMap[d._id] = d;
					discountsMap = dMap;
				} catch (e) {
					console.error('Error cargando descuentos', e);
				}
			}

			let enrollmentsPromise;
			if (currentRole === 'student') {
				enrollmentsPromise = enrollmentService.getByStudentId($userStore.user?._id || '');
			} else {
				const filterParams: any = {};
				if (filters.q) filterParams.q = filters.q;
				if (filters.estado !== 'all') filterParams.estado = filters.estado;
				if (filters.curso_id !== 'all') filterParams.curso_id = filters.curso_id;
				if (filters.estudiante_id !== 'all') filterParams.estudiante_id = filters.estudiante_id;
				if (filters.con_descuento !== 'all') filterParams.con_descuento = filters.con_descuento === 'con';

				enrollmentsPromise = enrollmentService.getAll(page, limit, filterParams);
			}

			const result = await enrollmentsPromise;

			if (currentRole === 'student') {
				enrollments = Array.isArray(result) ? result : (result as any).data; 
			} else {
				const response = result as any; 
				if (response && response.data) {
					enrollments = response.data;
					totalItems = response.meta.totalItems;
					totalPages = response.meta.totalPages;
				} else {
					enrollments = [];
					totalItems = 0;
				}
			}

		} catch (e: any) {
			error = e.message || 'Error al cargar inscripciones';
			alert('error', error);
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadData();
	}

	function handleSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			page = 1;
			loadData();
		}, 300);
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadData();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadData();
	}

	function handleCreate() {
		selectedEnrollment = null;
		isFormOpen = true;
	}

	function handleEdit(enrollment: Enrollment) {
		selectedEnrollment = enrollment;
		isFormOpen = true;
	}

	function handleViewKardex(enrollment: Enrollment) {
		selectedKardex = enrollment;
		isKardexOpen = true;
		openDropdownId = null;
	}

	// Atajo directo desde la Libreta: lleva a /app/payments con la
	// inscripción ya preseleccionada, sin que el estudiante tenga que
	// volver a buscarla/seleccionarla manualmente.
	function goToPagarSaldo() {
		if (!selectedKardex) return;
		goto(`/app/payments?pagar=${selectedKardex._id}`);
	}

	function confirmDelete(enrollment: Enrollment) {
		enrollmentToDelete = enrollment;
		showDeleteModal = true;
		openDropdownId = null;
	}

	async function handleDelete() {
		if (!enrollmentToDelete) return;
		deleteLoading = true;
		
		const idToDelete = enrollmentToDelete._id;
		
		try {
			await enrollmentService.delete(idToDelete);
			alert('success', 'Inscripción eliminada correctamente. Referencias limpiadas.');
			enrollments = enrollments.filter(e => e._id !== idToDelete);
			showDeleteModal = false;
		} catch (e: any) {
			alert('error', e.message || 'Error al eliminar inscripción');
		} finally {
			deleteLoading = false;
			enrollmentToDelete = null;
		}
	}

	function handleFormSuccess() {
		isFormOpen = false;
		loadData();
	}

	// ISSUE-R-SOLICITUD-PASIVO
	function openPassiveModal(enrollment: Enrollment) {
		passiveTarget = enrollment;
		passiveMotivo = '';
		passiveModalOpen = true;
		openDropdownId = null;
	}

	async function confirmPassiveRequest() {
		if (!passiveTarget || passiveMotivo.trim().length < 3) return;
		passiveLoading = true;
		try {
			const { apiKyC } = await import('$lib/config/apiKyC.config');
			await apiKyC.post('/passive-requests/', {
				enrollment_id: passiveTarget._id,
				motivo: passiveMotivo.trim()
			});
			alert('success', 'Solicitud de pasivo enviada. El CPD la revisará.');
			passiveModalOpen = false;
			passiveTarget = null;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar la solicitud de pasivo');
		} finally {
			passiveLoading = false;
		}
	}

	async function handleReactivate(enrollment: Enrollment) {
		openDropdownId = null;
		try {
			// ISSUE-P-CONGELADO: si la suspensión fue por congelamiento o abandono,
			// usar el endpoint específico (marca multa_reincorporacion_pendiente si
			// corresponde). Si fue por 'Solicitar Pasivo' (o sin motivo registrado
			// de inscripciones más antiguas), usar el endpoint original.
			if (enrollment.motivo_suspension === 'congelado' || enrollment.motivo_suspension === 'abandono') {
				await enrollmentService.reactivarDesdeCongeladoOAbandono(enrollment._id);
			} else {
				const { apiKyC } = await import('$lib/config/apiKyC.config');
				await apiKyC.post(`/passive-requests/enrollment/${enrollment._id}/reactivate`, {});
			}
			alert('success', 'Inscripción reactivada correctamente.');
			loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo reactivar la inscripción');
		}
	}

	// ISSUE-P-CONGELADO: congelamiento voluntario de estudios
	function openCongelarModal(enrollment: Enrollment) {
		congelarTarget = enrollment;
		congelarTasaPagada = false;
		congelarModalOpen = true;
		openDropdownId = null;
	}

	async function confirmCongelar() {
		if (!congelarTarget) return;
		congelarLoading = true;
		try {
			await enrollmentService.congelarInscripcion(congelarTarget._id, congelarTasaPagada);
			alert('success', 'Inscripción congelada correctamente.');
			congelarModalOpen = false;
			congelarTarget = null;
			loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo congelar la inscripción');
		} finally {
			congelarLoading = false;
		}
	}

	// ISSUE-M-EXENCION: bypass de matrícula otorgado por MAE (no condona la deuda)
	async function handleGrantExencion(enrollment: Enrollment) {
		openDropdownId = null;
		if (matriculaExentaLoading) return;
		matriculaExentaLoading = true;
		try {
			await enrollmentService.otorgarMatriculaExenta(enrollment._id);
			alert(
				'success',
				'Matrícula Exenta otorgada. El estudiante ya puede cursar; la deuda financiera se mantiene visible para Cobranza.'
			);
			loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo otorgar la Matrícula Exenta');
		} finally {
			matriculaExentaLoading = false;
		}
	}

	async function handleRevokeExencion(enrollment: Enrollment) {
		openDropdownId = null;
		if (matriculaExentaLoading) return;
		matriculaExentaLoading = true;
		try {
			await enrollmentService.revocarMatriculaExenta(enrollment._id);
			alert('success', 'Matrícula Exenta revocada.');
			loadData();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo revocar la Matrícula Exenta');
		} finally {
			matriculaExentaLoading = false;
		}
	}

	// ISSUE-P-BECA-RESPALDO
	function triggerBecaRespaldoUpload() {
		becaRespaldoInputEl?.click();
	}

	async function handleBecaRespaldoFileChange(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !selectedKardex) return;

		becaRespaldoUploading = true;
		try {
			const updated = await enrollmentService.uploadBecaRespaldo(selectedKardex._id, file);
			selectedKardex = { ...selectedKardex, beca_respaldo_url: updated.beca_respaldo_url };
			alert('success', 'Respaldo de beca subido correctamente.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo subir el respaldo de la beca');
		} finally {
			becaRespaldoUploading = false;
			input.value = '';
		}
	}

	// ISSUE-Q-NOTA-BORRADOR
	async function handleValidarNotaBorrador(moduloIndex: number) {
		if (!selectedKardex) return;
		const key = `${selectedKardex._id}-${moduloIndex}`;
		notaValidacionLoading[key] = true;
		try {
			const updated = await enrollmentService.validarNotaModulo(selectedKardex._id, moduloIndex);
			selectedKardex = updated;
			alert('success', 'Nota validada. Ya es oficial.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo validar la nota');
		} finally {
			notaValidacionLoading[key] = false;
		}
	}

	async function handleRechazarNotaBorrador(moduloIndex: number) {
		if (!selectedKardex) return;
		const key = `${selectedKardex._id}-${moduloIndex}`;
		notaValidacionLoading[key] = true;
		try {
			const updated = await enrollmentService.rechazarNotaModulo(selectedKardex._id, moduloIndex);
			selectedKardex = updated;
			alert('success', 'Borrador rechazado. El docente puede volver a subirlo.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo rechazar el borrador');
		} finally {
			notaValidacionLoading[key] = false;
		}
	}

	// ISSUE-Q-DOCUMENTOS-KYC (2026-07-09): el estudiante sube el documento de un
	// requisito de su propia inscripción; CPD/Encargado de Curso lo aprueban o
	// rechazan desde la misma libreta.
	let requisitoUploading: Record<number, boolean> = $state({});
	let requisitoInputEls: Record<number, HTMLInputElement | null> = $state({});
	let requisitoRejectIndex: number | null = $state(null);
	let requisitoRejectMotivo = $state('');
	let requisitoRejectLoading = $state(false);

	function triggerRequisitoUpload(index: number) {
		requisitoInputEls[index]?.click();
	}

	async function handleRequisitoFileChange(event: Event, index: number) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file || !selectedKardex) return;

		requisitoUploading[index] = true;
		try {
			const updatedReq = await enrollmentService.subirRequisito(selectedKardex._id, index, file);
			const nuevosRequisitos = [...(selectedKardex.requisitos || [])];
			nuevosRequisitos[index] = updatedReq;
			selectedKardex = { ...selectedKardex, requisitos: nuevosRequisitos };
			alert('success', 'Documento subido. Queda pendiente de revisión.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo subir el documento');
		} finally {
			requisitoUploading[index] = false;
			input.value = '';
		}
	}

	async function handleAprobarRequisito(index: number) {
		if (!selectedKardex) return;
		requisitoUploading[index] = true;
		try {
			const updatedReq = await enrollmentService.aprobarRequisito(selectedKardex._id, index);
			const nuevosRequisitos = [...(selectedKardex.requisitos || [])];
			nuevosRequisitos[index] = updatedReq;
			selectedKardex = { ...selectedKardex, requisitos: nuevosRequisitos };
			alert('success', 'Documento aprobado.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo aprobar el documento');
		} finally {
			requisitoUploading[index] = false;
		}
	}

	function openRequisitoRejectModal(index: number) {
		requisitoRejectIndex = index;
		requisitoRejectMotivo = '';
	}

	async function confirmRechazarRequisito() {
		if (!selectedKardex || requisitoRejectIndex === null) return;
		if (!requisitoRejectMotivo.trim()) {
			alert('error', 'Debe ingresar un motivo');
			return;
		}
		requisitoRejectLoading = true;
		try {
			const updatedReq = await enrollmentService.rechazarRequisito(
				selectedKardex._id,
				requisitoRejectIndex,
				requisitoRejectMotivo
			);
			const nuevosRequisitos = [...(selectedKardex.requisitos || [])];
			nuevosRequisitos[requisitoRejectIndex] = updatedReq;
			selectedKardex = { ...selectedKardex, requisitos: nuevosRequisitos };
			alert('success', 'Documento rechazado.');
			requisitoRejectIndex = null;
			requisitoRejectMotivo = '';
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo rechazar el documento');
		} finally {
			requisitoRejectLoading = false;
		}
	}

	function toggleDropdown(id: string) {
		if (openDropdownId === id) {
			openDropdownId = null;
		} else {
			openDropdownId = id;
		}
	}

	function getDropdownOptions(enrollment: Enrollment) {
		// ISSUE P: La libreta es visible para TODOS (Estudiantes, Docentes y Administrativos)
		const options: any[] = [
			{
				label: 'Ver Libreta / Notas',
				id: 'kardex',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`,
				action: () => handleViewKardex(enrollment)
			}
		];

		// ISSUE-R-SOLICITUD-PASIVO: solicitar pausa solo sobre inscripciones activas/pendientes
		const estadoActual = (enrollment as any).estado;
		if (canRequestPassive && (estadoActual === 'activo' || estadoActual === 'pendiente_pago')) {
			options.push({
				label: 'Solicitar Pasivo',
				id: 'request-passive',
				icon: `<svg class="size-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => openPassiveModal(enrollment)
			});
		}

		if (canReactivate && estadoActual === 'suspendido') {
			options.push({
				label: 'Reactivar Inscripción',
				id: 'reactivate',
				icon: `<svg class="size-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>`,
				action: () => handleReactivate(enrollment)
			});
		}

		// ISSUE-P-CONGELADO: congelamiento voluntario sobre inscripciones activas/pendientes
		if (canEditEnrollment && (estadoActual === 'activo' || estadoActual === 'pendiente_pago')) {
			options.push({
				label: 'Congelar Inscripción',
				id: 'congelar',
				icon: `<svg class="size-5 text-uagrm-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v8m-4-4h8m6 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
				action: () => openCongelarModal(enrollment)
			});
		}

		// ISSUE-M-EXENCION: solo tiene sentido si la matrícula real NO está pagada.
		// No condona la deuda, solo desbloquea el estado académico.
		if (canManageMatriculaExenta && !enrollment.matricula_pagada) {
			if (!enrollment.matricula_exenta) {
				options.push({
					label: 'Otorgar Matrícula Exenta',
					id: 'grant-exencion',
					icon: `<svg class="size-5 text-uagrm-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15a3 3 0 100-6 3 3 0 000 6z M12 1v6m0 10v6m4.22-15.22l4.24 4.24M1.54 8.46l4.24-4.24M1.54 15.54l4.24 4.24m12.44-4.24l4.24 4.24" /></svg>`,
					action: () => handleGrantExencion(enrollment)
				});
			} else {
				options.push({
					label: 'Revocar Matrícula Exenta',
					id: 'revoke-exencion',
					icon: `<svg class="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>`,
					action: () => handleRevokeExencion(enrollment)
				});
			}
		}

        if (currentRole === 'student') return options;

		if (canEditEnrollment) {
			options.push({
				label: 'Editar',
				id: 'edit',
				icon: `<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`,
				action: () => handleEdit(enrollment)
			});
		}

		if (canDeleteEnrollment) {
			options.push({
				label: 'Eliminar',
				id: 'delete',
				icon: `<svg class="size-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>`,
				action: () => confirmDelete(enrollment),
				divider: true
			});
		}

		return options;
	}

	function getStudentName(id: string) {
		if (currentRole === 'student' && $userStore.user) {
			return $userStore.user.nombre || $userStore.user.username || $userStore.user.email || 'Mi Usuario';
		}
		return studentsMap[id]?.nombre || 'Desconocido';
	}
	
	function getCourseName(id: string) {
		return coursesMap[id]?.nombre_programa || 'Desconocido';
	}

	function getStatusColor(status: string) {
		switch (status) {
			case 'activo': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'pendiente_pago': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
			case 'suspendido': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
			case 'completado': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
			case 'cancelado': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
			default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Inscripciones</Heading>
		{#if canCreateEnrollment}
			<Button onclick={handleCreate}>
				{#snippet leftIcon()}
					<PlusIcon class="size-5" />
				{/snippet}
				Nueva Inscripción
			</Button>
		{/if}
	</div>

	{#if currentRole !== 'student'}
		<!-- Filters -->
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
			<!-- Start Search -->
			<div class="md:col-span-1">
				<label for="search" class="sr-only">Buscar</label>
				<div class="relative">
					<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
						<svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clip-rule="evenodd" />
						</svg>
					</div>
					<input
						type="text"
						id="search"
						bind:value={filters.q}
						class="block w-full rounded-md border-0 py-1.5 pl-10 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
						placeholder="Buscar..."
						oninput={handleSearchInput}
					/>
				</div>
			</div>
			
			<!-- Estado -->
			<div>
				<select
					bind:value={filters.estado}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los estados</option>
					<option value="pendiente_pago">Pendiente Pago</option>
					<option value="activo">Activo</option>
					<option value="suspendido">Suspendido</option>
					<option value="completado">Completado</option>
					<option value="cancelado">Cancelado</option>
				</select>
			</div>

			<!-- Curso -->
			<div>
				<select
					bind:value={filters.curso_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los cursos</option>
					{#each coursesList as course}
						<option value={course._id}>{course.nombre_programa}</option>
					{/each}
				</select>
			</div>

			<!-- Estudiante -->
			<div>
				<select
					bind:value={filters.estudiante_id}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Todos los estudiantes</option>
					{#each studentsList as student}
						<option value={student._id}>{student.nombre}</option>
					{/each}
				</select>
			</div>

			<!-- ISSUE-P-VISIBILIDAD-DESCUENTO (fix 2026-07-09): filtro por si tiene descuento aplicado -->
			<div>
				<select
					bind:value={filters.con_descuento}
					onchange={handleFilterChange}
					class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
				>
					<option value="all">Con o sin descuento</option>
					<option value="con">Solo con descuento</option>
					<option value="sin">Solo sin descuento</option>
				</select>
			</div>
		</div>
	{/if}

	{#if loading}
		<TableSkeleton columns={9} rows={10} />
	{:else if enrollments.length === 0}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
			<p class="text-gray-500 dark:text-gray-400">No hay inscripciones registradas.</p>
		</div>
	{:else}
		<!-- ISSUE-X-COMPACT: Desktop Table consolidada SIN scroll horizontal -->
		<div class="hidden md:block bg-white dark:bg-dark-surface rounded-lg shadow border border-gray-200 dark:border-dark-border">
			<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-dark-border">
				<thead class="bg-gray-50 dark:bg-dark-background rounded-t-lg">
					<tr>
						<th scope="col" class="w-[20%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estudiante</th>
						<th scope="col" class="w-[26%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Programa</th>
						<th scope="col" class="w-[12%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
						<th scope="col" class="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Finanzas</th>
						<th scope="col" class="w-[14%] px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
						<th scope="col" class="w-[6%] relative px-4 py-3"><span class="sr-only">Acciones</span></th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
					{#each enrollments as enrollment (enrollment._id)}
						<tr class="align-top hover:bg-gray-50 dark:hover:bg-dark-background/40 transition-colors">
							<td class="px-4 py-4">
								<div class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2" title={getStudentName(enrollment.estudiante_id)}>
									{getStudentName(enrollment.estudiante_id)}
								</div>
							</td>
							<td class="px-4 py-4">
								<div class="text-sm text-gray-900 dark:text-white line-clamp-2" title={getCourseName(enrollment.curso_id)}>
									{getCourseName(enrollment.curso_id)}
								</div>
							</td>
							<td class="px-4 py-4">
								<div class="text-sm text-gray-600 dark:text-gray-300">{formatDate(enrollment.fecha_inscripcion)}</div>
							</td>
							<td class="px-4 py-4 text-xs space-y-0.5">
								<div class="flex justify-between gap-2"><span class="text-gray-400 dark:text-gray-500">Total</span><span class="font-medium text-gray-700 dark:text-gray-300">{formatCurrency(enrollment.total_a_pagar)}</span></div>
								<div class="flex justify-between gap-2"><span class="text-gray-400 dark:text-gray-500">Pagado</span><span class="font-medium text-green-600 dark:text-green-400">{formatCurrency(enrollment.total_pagado)}</span></div>
								<div class="flex justify-between gap-2"><span class="text-gray-400 dark:text-gray-500">Saldo</span><span class={`font-bold ${enrollment.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>{formatCurrency(enrollment.saldo_pendiente)}</span></div>
								<!-- ISSUE-P-VISIBILIDAD-DESCUENTO (fix 2026-07-09): mostrar nombre y % del descuento aplicado, si hay -->
								{#if enrollment.descuento_estudiante_id || (enrollment.descuento_personalizado ?? 0) > 0}
									<div class="flex justify-between gap-2 pt-0.5 border-t border-gray-100 dark:border-gray-700 mt-1">
										<span class="text-gray-400 dark:text-gray-500">Beca</span>
										<span class="font-semibold text-light-tertiary dark:text-dark-tertiary truncate max-w-[110px]" title={enrollment.descuento_estudiante_id ? discountsMap[enrollment.descuento_estudiante_id]?.nombre : 'Descuento libre'}>
											{enrollment.descuento_estudiante_id ? (discountsMap[enrollment.descuento_estudiante_id]?.nombre ?? '—') : 'Libre'} ({enrollment.descuento_personalizado}%)
										</span>
									</div>
								{/if}
							</td>
							<td class="px-4 py-4">
								<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(enrollment.estado)}`}>
									{enrollment.estado}
								</span>
								{#if enrollment.matricula_exenta}
									<span
										class="mt-1 block w-fit px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-light-warning/15 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning"
										title={`Matrícula Exenta otorgada por ${enrollment.matricula_exenta_otorgada_por ?? 'MAE'}`}
									>
										Matrícula Exenta
									</span>
								{/if}
								{#if enrollment.motivo_suspension === 'congelado'}
									<span class="mt-1 block w-fit px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-uagrm-sky/15 text-uagrm-sky">
										Congelado
									</span>
								{:else if enrollment.motivo_suspension === 'abandono'}
									<span class="mt-1 block w-fit px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error">
										Abandono
									</span>
								{/if}
								{#if enrollment.multa_reincorporacion_pendiente}
									<span
										class="mt-1 block w-fit px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error"
										title="Corresponde cobrar la multa de reincorporación por abandono"
									>
										Multa Pendiente
									</span>
								{/if}
							</td>
							<td class="px-4 py-4 text-right text-sm font-medium relative">
								<button onclick={() => toggleDropdown(enrollment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones de la inscripción">
									<DotsVerticalIcon class="size-5" />
								</button>
								{#if openDropdownId === enrollment._id}
									<div class="absolute right-0 mt-2 w-48 z-10">
										<DropdownMenu 
											options={getDropdownOptions(enrollment)} 
											isOpen={true} 
											width="w-48" 
											class="origin-top-right right-0"
										/>
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if currentRole !== 'student'}
			<Pagination
				currentPage={page}
				{totalPages}
				{totalItems}
				{limit}
				onPageChange={handlePageChange}
				onLimitChange={handleLimitChange}
			/>
		{/if}

		<!-- Mobile Cards -->
		<div class="md:hidden grid grid-cols-1 gap-4">
			{#each enrollments as enrollment (enrollment._id)}
				<Card>
					<div class="flex items-center justify-between mb-4">
						<div>
							<h3 class="text-sm font-medium text-gray-900 dark:text-white">{getStudentName(enrollment.estudiante_id)}</h3>
							<p class="text-xs text-gray-500 dark:text-gray-400">{getCourseName(enrollment.curso_id)}</p>
						</div>
						
						<div class="relative">
							<button onclick={() => toggleDropdown(enrollment._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300">
								<DotsVerticalIcon class="size-5" />
							</button>
							{#if openDropdownId === enrollment._id}
								<div class="absolute right-0 mt-2 w-48 z-10">
									<DropdownMenu 
										options={getDropdownOptions(enrollment)} 
										isOpen={true} 
										width="w-48" 
										class="origin-top-right right-0"
									/>
								</div>
							{/if}
						</div>
					</div>
					<div class="space-y-2 text-sm">
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Fecha:</span>
							<span class="font-medium text-gray-900 dark:text-white">{formatDate(enrollment.fecha_inscripcion)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Total:</span>
							<span class="font-medium text-gray-900 dark:text-white">{formatCurrency(enrollment.total_a_pagar)}</span>
						</div>
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Saldo:</span>
							<span class={`font-medium ${enrollment.saldo_pendiente > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
								{formatCurrency(enrollment.saldo_pendiente)}
							</span>
						</div>
						<!-- ISSUE-P-VISIBILIDAD-DESCUENTO (fix 2026-07-09): mostrar nombre y % del descuento aplicado, si hay -->
						{#if enrollment.descuento_estudiante_id || (enrollment.descuento_personalizado ?? 0) > 0}
							<div class="flex justify-between">
								<span class="text-gray-500 dark:text-gray-400">Beca:</span>
								<span class="font-semibold text-light-tertiary dark:text-dark-tertiary">
									{enrollment.descuento_estudiante_id ? (discountsMap[enrollment.descuento_estudiante_id]?.nombre ?? '—') : 'Libre'} ({enrollment.descuento_personalizado}%)
								</span>
							</div>
						{/if}
						<div class="flex justify-between">
							<span class="text-gray-500 dark:text-gray-400">Estado:</span>
							<span class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(enrollment.estado)}`}>
								{enrollment.estado}
							</span>
						</div>
						{#if enrollment.matricula_exenta}
							<div class="flex justify-between">
								<span class="text-gray-500 dark:text-gray-400">Matrícula:</span>
								<span
									class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-light-warning/15 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning"
									title={`Matrícula Exenta otorgada por ${enrollment.matricula_exenta_otorgada_por ?? 'MAE'}`}
								>
									Exenta
								</span>
							</div>
						{/if}
						{#if enrollment.motivo_suspension === 'congelado' || enrollment.motivo_suspension === 'abandono'}
							<div class="flex justify-between">
								<span class="text-gray-500 dark:text-gray-400">Motivo:</span>
								<span
									class={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${enrollment.motivo_suspension === 'congelado' ? 'bg-uagrm-sky/15 text-uagrm-sky' : 'bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error'}`}
								>
									{enrollment.motivo_suspension === 'congelado' ? 'Congelado' : 'Abandono'}
								</span>
							</div>
						{/if}
						{#if enrollment.multa_reincorporacion_pendiente}
							<div class="flex justify-between">
								<span class="text-gray-500 dark:text-gray-400">Multa:</span>
								<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error">
									Pendiente
								</span>
							</div>
						{/if}
					</div>
				</Card>
			{/each}
		</div>
	{/if}

	<!-- Create/Edit Modal -->
	<Modal
		isOpen={isFormOpen}
		title={selectedEnrollment ? 'Editar Inscripción' : 'Nueva Inscripción'}
		onClose={() => isFormOpen = false}
		maxWidth="sm:max-w-4xl"
	>
		<EnrollmentForm
			enrollment={selectedEnrollment}
			students={studentsList}
			courses={coursesList}
			onSuccess={handleFormSuccess}
			onCancel={() => isFormOpen = false}
		/>
	</Modal>

	<!-- ISSUE P: Modal de Libreta / Kardex -->
	<Modal
		isOpen={isKardexOpen}
		title="Libreta Académica y Financiera"
		onClose={() => isKardexOpen = false}
		maxWidth="sm:max-w-5xl"
	>
		{#if selectedKardex}
			<div class="p-6 space-y-6">
				<!-- Cabecera de la Libreta -->
				<div class="bg-gray-50 dark:bg-dark-background/40 p-5 rounded-2xl border border-gray-200 dark:border-dark-border flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
					<div>
						<p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Programa</p>
						<p class="text-lg font-bold text-slate-900 dark:text-white leading-tight">{getCourseName(selectedKardex.curso_id)}</p>
						{#if currentRole !== 'student'}
							<p class="text-sm text-blue-600 font-semibold mt-1">Estudiante: {getStudentName(selectedKardex.estudiante_id)}</p>
						{/if}
					</div>
					<div class="text-left md:text-right bg-white dark:bg-dark-surface px-6 py-3 rounded-xl shadow-sm border border-gray-100 dark:border-dark-border">
						<p class="text-xs text-slate-500 uppercase tracking-wider font-bold">Promedio General</p>
						<p class={`text-3xl font-black mt-1 ${selectedKardex.nota_final && selectedKardex.nota_final >= 64 ? 'text-green-600' : selectedKardex.nota_final ? 'text-red-600' : 'text-slate-400'}`}>
							{selectedKardex.nota_final !== null && selectedKardex.nota_final !== undefined ? selectedKardex.nota_final : '--'}
						</p>
					</div>
				</div>

				<!-- ISSUE-P-CARGO-MULTIITEM: transparencia de los ítems de cargo adicional/complementario al programa -->
				{#if selectedKardex.cargo_adicional_items && selectedKardex.cargo_adicional_items.length > 0}
					<div class="bg-light-warning/10 dark:bg-dark-warning/10 border border-light-warning/30 dark:border-dark-warning/30 p-4 rounded-xl space-y-2">
						<p class="text-xs text-light-warning dark:text-dark-warning uppercase tracking-wider font-bold">Cargo Adicional Incluido</p>
						{#each selectedKardex.cargo_adicional_items as item}
							<div class="flex items-center justify-between gap-3">
								<p class="text-sm text-slate-700 dark:text-slate-300">{item.nombre}</p>
								<span class="text-sm font-bold text-light-warning dark:text-dark-warning">+{formatCurrency(item.costo)}</span>
							</div>
						{/each}
					</div>
				{/if}

				<!-- ISSUE-P-BECA-RESPALDO: respaldo documental de beca/descuento -->
				{#if selectedKardex.descuento_estudiante_id || (selectedKardex.descuento_personalizado ?? 0) > 0}
					<div class="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
						<div>
							<p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Respaldo de Beca</p>
							{#if selectedKardex.beca_respaldo_url}
								<a href={selectedKardex.beca_respaldo_url} target="_blank" rel="noopener noreferrer" class="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
									Ver documento de respaldo
								</a>
							{:else}
								<span class="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full uppercase tracking-wide bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">
									Respaldo pendiente
								</span>
							{/if}
						</div>
						{#if canManageBecaRespaldo}
							<input
								bind:this={becaRespaldoInputEl}
								type="file"
								accept="application/pdf,image/*"
								class="hidden"
								onchange={handleBecaRespaldoFileChange}
							/>
							<Button size="sm" variant="secondary" onclick={triggerBecaRespaldoUpload} loading={becaRespaldoUploading}>
								{selectedKardex.beca_respaldo_url ? 'Reemplazar Respaldo' : 'Subir Respaldo'}
							</Button>
						{/if}
					</div>
				{/if}

				<!-- ISSUE-Q-DOCUMENTOS-KYC (2026-07-09): documentos requeridos por el
				     curso -- el estudiante los sube desde aquí, CPD/Encargado de Curso
				     los aprueban o rechazan. Solo se muestra si el curso definió al
				     menos un documento requerido (lista no vacía). -->
				{#if selectedKardex.requisitos && selectedKardex.requisitos.length > 0}
					<div class="bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border space-y-3">
						<p class="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Documentos Requeridos</p>
						{#each selectedKardex.requisitos as req, reqIndex}
							<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-gray-100 dark:border-dark-border pt-3 first:border-t-0 first:pt-0">
								<div class="min-w-0">
									<p class="text-sm font-medium text-slate-900 dark:text-white">{req.descripcion}</p>
									<div class="mt-1 flex items-center gap-2">
										{#if req.estado === 'pendiente'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
												Sin subir
											</span>
										{:else if req.estado === 'en_proceso'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
												Pendiente de revisión
											</span>
										{:else if req.estado === 'aprobado'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
												Aprobado
											</span>
										{:else if req.estado === 'rechazado'}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" title={req.motivo_rechazo || ''}>
												Rechazado
											</span>
										{/if}
										{#if req.url}
											<a href={req.url} target="_blank" rel="noopener noreferrer" class="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium">
												Ver documento
											</a>
										{/if}
									</div>
									{#if req.estado === 'rechazado' && req.motivo_rechazo}
										<p class="mt-1 text-xs text-light-error dark:text-dark-error">Motivo: {req.motivo_rechazo}</p>
									{/if}
								</div>
								<div class="flex items-center gap-2 shrink-0">
									<!-- El estudiante sube/reemplaza su propio documento (salvo si ya está aprobado) -->
									{#if (currentRole === 'student' || canManageRequisitos) && req.estado !== 'aprobado'}
										<input
											bind:this={requisitoInputEls[reqIndex]}
											type="file"
											accept="application/pdf,image/*"
											class="hidden"
											onchange={(e) => handleRequisitoFileChange(e, reqIndex)}
										/>
										<Button size="sm" variant="secondary" onclick={() => triggerRequisitoUpload(reqIndex)} loading={requisitoUploading[reqIndex]}>
											{req.url ? 'Reemplazar' : 'Subir Documento'}
										</Button>
									{/if}
									<!-- CPD/Encargado de Curso aprueban o rechazan una vez subido -->
									{#if canManageRequisitos && req.estado === 'en_proceso'}
										<Button size="sm" variant="destructive" onclick={() => openRequisitoRejectModal(reqIndex)} loading={requisitoUploading[reqIndex]}>
											Rechazar
										</Button>
										<Button size="sm" onclick={() => handleAprobarRequisito(reqIndex)} loading={requisitoUploading[reqIndex]}>
											Aprobar
										</Button>
									{:else if canManageRequisitos && req.estado === 'rechazado'}
										<Button size="sm" onclick={() => handleAprobarRequisito(reqIndex)} loading={requisitoUploading[reqIndex]}>
											Aprobar de todos modos
										</Button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Tabla de Módulos (Notas y Pagos) -->
				<div class="overflow-x-auto border border-gray-200 dark:border-dark-border rounded-xl shadow-sm">
					<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
						<thead class="bg-gray-100 dark:bg-dark-background">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Módulo</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/10">Nota Final</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-50/50 dark:bg-blue-900/10">Situación</th>
								<th class="px-4 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Costo (Bs)</th>
								<th class="px-4 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Estado Pago</th>
							</tr>
						</thead>
						<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
							{#if selectedKardex.modulos && selectedKardex.modulos.length > 0}
								{#each selectedKardex.modulos as mod, moduleIndex}
									<tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
										<td class="px-4 py-4 text-sm font-medium text-slate-900 dark:text-white max-w-[200px]" title={mod.nombre}>
											{mod.nombre}
										</td>
										
										<!-- Columna Académica -->
										<td class="px-4 py-4 text-center bg-blue-50/10 dark:bg-blue-900/5">
											{#if puedeVerNotaModulo(mod)}
												<span class={`text-lg font-black ${mod.nota !== null && mod.nota !== undefined && mod.nota >= 64 ? 'text-green-600 dark:text-green-400' : mod.nota !== null && mod.nota !== undefined ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
													{mod.nota !== null && mod.nota !== undefined ? mod.nota : '--'}
												</span>
											{:else}
												<span class="text-xs font-bold text-light-warning dark:text-dark-warning" title="Debes estar al día con el pago de este módulo para ver tu calificación">
													Falta pagar
												</span>
											{/if}
										</td>
										<td class="px-4 py-4 text-center bg-blue-50/10 dark:bg-blue-900/5">
											{#if puedeVerNotaModulo(mod)}
												<span class={`px-3 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-wide ${mod.estado_academico === 'Aprobado' ? 'bg-green-100 text-green-700 border border-green-200' : mod.estado_academico === 'Reprobado' ? 'bg-red-100 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'}`}>
													{mod.estado_academico || 'Cursando'}
												</span>
											{:else}
												<span class="px-3 py-1.5 text-[11px] font-bold rounded-full uppercase tracking-wide bg-light-warning/15 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning">
													Pago Pendiente
												</span>
											{/if}
											<!-- ISSUE-Q-NOTA-BORRADOR: borrador del docente pendiente de validación.
											     El estudiante NUNCA ve el borrador (solo la nota oficial ya validada
											     por CPD) -- confirmado en reunión de postgrado contaduría 2026-07-08:
											     "el gente no ve las notas hasta que el CPD no las aprueba". -->
											{#if mod.estado_validacion_nota === 'pendiente_validacion' && currentRole !== 'student'}
												<div class="mt-2 flex flex-col items-center gap-1">
													<span class="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wide">
														Borrador: {mod.nota_borrador}
													</span>
													{#if canValidateNotaBorrador}
														{@const key = `${selectedKardex._id}-${moduleIndex}`}
														<div class="flex gap-1">
															<button
																type="button"
																onclick={() => handleValidarNotaBorrador(moduleIndex)}
																disabled={notaValidacionLoading[key]}
																class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 disabled:opacity-50"
															>
																Validar
															</button>
															<button
																type="button"
																onclick={() => handleRechazarNotaBorrador(moduleIndex)}
																disabled={notaValidacionLoading[key]}
																class="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 disabled:opacity-50"
															>
																Rechazar
															</button>
														</div>
													{/if}
												</div>
											{/if}
										</td>

										<!-- Columna Financiera -->
										<td class="px-4 py-4 text-right text-sm text-slate-600 dark:text-slate-300">
											<div class="font-bold text-slate-900 dark:text-white">{formatCurrency(mod.costo)}</div>
											<div class="text-xs text-emerald-600 font-medium mt-0.5">Pagado: {formatCurrency(mod.monto_pagado || 0)}</div>
											<!-- ISSUE-P-RECALCULO-NOTA: aviso si este módulo perdió la beca por nota -->
											{#if mod.costo_sin_beca_personal !== null && mod.costo_sin_beca_personal !== undefined && mod.costo === mod.costo_sin_beca_personal}
												<div class="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5 uppercase tracking-wide">
													Beca perdida por nota
												</div>
											{/if}
										</td>
										<td class="px-4 py-4 text-center">
											<span class={`px-2.5 py-1 text-xs font-bold rounded-full ${mod.estado === 'Pagado' ? 'bg-emerald-100 text-emerald-700' : mod.estado === 'Parcial' ? 'bg-yellow-100 text-yellow-700' : 'bg-orange-100 text-orange-700'}`}>
												{mod.estado || 'Pendiente'}
											</span>
										</td>
									</tr>
								{/each}
							{:else}
								<tr>
									<td colspan="5" class="px-4 py-8 text-center text-slate-500">
										No hay módulos registrados en esta inscripción.
									</td>
								</tr>
							{/if}
						</tbody>
					</table>
				</div>

				<!-- Resumen Financiero de la inscripción (visible para todos los roles).
				     El SALDO A FAVOR se calcula en el cliente como max(0, total_pagado -
				     total_a_pagar): refleja un excedente real de pago (ISSUE-P-COBRANZA-LIBRETA,
				     pedido de Cobranza para ver sobrepagos que hoy solo veía el estudiante). -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
					<div class="bg-white dark:bg-dark-surface p-3 rounded-xl border border-gray-200 dark:border-dark-border">
						<p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Total del Programa</p>
						<p class="text-base font-black text-slate-900 dark:text-white mt-0.5">{formatCurrency(selectedKardex.total_a_pagar || 0)}</p>
					</div>
					<div class="bg-white dark:bg-dark-surface p-3 rounded-xl border border-gray-200 dark:border-dark-border">
						<p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Total Pagado</p>
						<p class="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatCurrency(selectedKardex.total_pagado || 0)}</p>
					</div>
					<div class="bg-white dark:bg-dark-surface p-3 rounded-xl border border-gray-200 dark:border-dark-border">
						<p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Saldo Pendiente</p>
						<p class="text-base font-black text-orange-600 dark:text-orange-400 mt-0.5">{formatCurrency(selectedKardex.saldo_pendiente || 0)}</p>
					</div>
					<div class={`p-3 rounded-xl border ${calcSaldoAFavor(selectedKardex) > 0 ? 'bg-uagrm-blue/5 border-uagrm-blue/30 dark:bg-uagrm-blue/10' : 'bg-white dark:bg-dark-surface border-gray-200 dark:border-dark-border'}`}>
						<p class="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold">Saldo a Favor</p>
						<p class={`text-base font-black mt-0.5 ${calcSaldoAFavor(selectedKardex) > 0 ? 'text-uagrm-blue dark:text-blue-300' : 'text-slate-400'}`} title="Excedente pagado por encima del total del programa">
							{formatCurrency(calcSaldoAFavor(selectedKardex))}
						</p>
					</div>
				</div>

				<div class="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
					<!-- Si es estudiante y debe dinero, mostrar atajo rápido al pago -->
					{#if currentRole === 'student' && selectedKardex.saldo_pendiente > 0}
						<Button onclick={() => goToPagarSaldo()} class="bg-blue-600 hover:bg-blue-700 text-white">
							Pagar Saldo Pendiente
						</Button>
					{/if}
					<Button variant="secondary" onclick={() => isKardexOpen = false}>Cerrar Libreta</Button>
				</div>
			</div>
		{/if}
	</Modal>

	<ModalConfirm
		isOpen={showDeleteModal}
		message={`¿Estás seguro de que deseas eliminar esta inscripción? El estudiante y sus pagos registrados se mantendrán en el sistema por motivos de auditoría, pero perderá el acceso y progreso académico de este curso.`}
		onConfirm={handleDelete}
		onCancel={() => {
			showDeleteModal = false;
			enrollmentToDelete = null;
		}}
		loading={deleteLoading}
	/>

	<!-- ISSUE-R-SOLICITUD-PASIVO: Modal de solicitud de pasivo -->
	<Modal
		isOpen={passiveModalOpen}
		title="Solicitar Estado Pasivo"
		onClose={() => { if (!passiveLoading) passiveModalOpen = false; }}
		maxWidth="sm:max-w-lg"
	>
		<div class="p-4 space-y-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Esta inscripción quedará en pausa (sin perder historial ni pagos) una vez que el CPD apruebe
				la solicitud. Indica el motivo.
			</p>
			<textarea
				bind:value={passiveMotivo}
				rows="3"
				class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500"
				placeholder="Ej: Licencia médica, dificultad económica temporal, etc."
			></textarea>
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => passiveModalOpen = false} disabled={passiveLoading}>Cancelar</Button>
				<Button onclick={confirmPassiveRequest} loading={passiveLoading} disabled={passiveMotivo.trim().length < 3}>
					Enviar Solicitud
				</Button>
			</div>
		</div>
	</Modal>

	<!-- ISSUE-Q-DOCUMENTOS-KYC: Modal de motivo de rechazo de un documento -->
	<Modal
		isOpen={requisitoRejectIndex !== null}
		title="Rechazar Documento"
		onClose={() => { if (!requisitoRejectLoading) requisitoRejectIndex = null; }}
		maxWidth="sm:max-w-lg"
	>
		<div class="p-4 space-y-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Indica el motivo del rechazo para que el estudiante sepa qué corregir antes de volver a subirlo.
			</p>
			<textarea
				bind:value={requisitoRejectMotivo}
				rows="3"
				class="w-full rounded-lg border border-light-four dark:border-dark-border bg-white dark:bg-dark-background py-2 px-3 text-sm text-light-black dark:text-dark-white focus:outline-none focus:ring-2 focus:ring-primary-500"
				placeholder="Ej: Documento ilegible, no corresponde al requisito solicitado, etc."
			></textarea>
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => requisitoRejectIndex = null} disabled={requisitoRejectLoading}>Cancelar</Button>
				<Button variant="destructive" onclick={confirmRechazarRequisito} loading={requisitoRejectLoading} disabled={requisitoRejectMotivo.trim().length < 1}>
					Rechazar
				</Button>
			</div>
		</div>
	</Modal>

	<!-- ISSUE-P-CONGELADO / AUDITORÍA #6: confirmación de congelamiento con tasa pagada -->
	<Modal
		isOpen={congelarModalOpen}
		title="Congelar Inscripción"
		onClose={() => { if (!congelarLoading) congelarModalOpen = false; }}
		maxWidth="sm:max-w-lg"
	>
		<div class="p-4 space-y-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				La inscripción quedará suspendida (módulos y pagos se conservan) hasta que se reactive
				manualmente. Corresponde una tasa de congelamiento.
			</p>
			<Checkbox
				id="congelar-tasa-pagada"
				label="Cobranza ya registró el cobro de la tasa de congelamiento"
				bind:checked={congelarTasaPagada}
			/>
			{#if !congelarTasaPagada}
				<p class="text-xs text-light-warning dark:text-dark-warning">
					Si dejas esto sin marcar, la inscripción quedará congelada con la tasa marcada como
					pendiente de cobro.
				</p>
			{/if}
			<div class="flex justify-end gap-3">
				<Button variant="secondary" onclick={() => congelarModalOpen = false} disabled={congelarLoading}>Cancelar</Button>
				<Button onclick={confirmCongelar} loading={congelarLoading}>
					Confirmar Congelamiento
				</Button>
			</div>
		</div>
	</Modal>
</div>
