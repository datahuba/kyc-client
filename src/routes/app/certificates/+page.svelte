<script lang="ts">
	/**
	 * /app/certificates — Vista dual de Certificados
	 *
	 * F-CERTIFICADOS (2026-07-29): la sección "Certificados" es visible para
	 * todos los roles (Kevin: "es para estudiantes y admin").
	 *
	 * - Estudiante (Student): vista de emisión.
	 *   - Selector de programa (auto si =1, dropdown si >1).
	 *   - Card del programa seleccionado con secciones Notas y No Deudor.
	 *   - Historial de certificados emitidos por el estudiante.
	 *
	 * - Staff (User con rol en STAFF_ROLES): vista de auditoría.
	 *   - Lista paginada de todos los certificados emitidos con filtros
	 *     (estudiante, programa, tipo, año, folio).
	 *   - Botón de reimprimir PDF en cada fila.
	 *   - Sin emisión directa (pueden usar el flujo normal con enrollment_id).
	 *
	 * Reglas de UI:
	 * - Svelte 5 runes ($state, $derived, $effect).
	 * - Validación reactiva con $derived.
	 * - try/catch en todas las llamadas async.
	 * - toasts con alert() de $lib/utils.
	 * - Mobile-first responsive (tabla desktop / cards móvil).
	 * - Tokens UAGRM (no colores hardcodeados).
	 */

	import { onMount } from 'svelte';
	import {
		enrollmentService,
		courseService,
		certificateService
	} from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type { Certificate, Enrollment, Course, Student, CertificateRequest } from '$lib/interfaces';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import {
		IdentificationIcon,
		FileTextIcon,
		DownloadIcon,
		CircleCheckIcon,
		SearchIcon
	} from '$lib/icons/outline';

	// ========================================================================
	// HELPERS de identidad
	// ========================================================================

	function getUserId(): string {
		const u: any = $userStore?.user;
		if (!u) return '';
		return String(u._id || u.id || '');
	}

	function getUserRole(): string {
		const u: any = $userStore?.user;
		if (!u) return '';
		return String(u.role || u.rol || '');
	}

	function isStaff(): boolean {
		const role = getUserRole();
		return ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(role);
	}

	function isStudent(): boolean {
		const role = getUserRole();
		const u: any = $userStore?.user;
		const userType = u?.user_type || '';
		return userType === 'student' || role === 'student';
	}

	// ========================================================================
	// STATE COMPARTIDO
	// ========================================================================

	let issuedCertificates: Certificate[] = $state([]);
	let loading = $state(true);
	let downloadingId = $state<string | null>(null);

	// ========================================================================
	// STATE: VISTA ESTUDIANTE
	// ========================================================================

	let enrollments: Enrollment[] = $state([]);
	let coursesMap: Record<string, Course> = $state({});
	let emittingNotas = $state<Record<string, boolean>>({});
	let emittingNoDeudor = $state<Record<string, boolean>>({});
	let hastaModuloNSelections = $state<Record<string, number>>({});
	let selectedEnrollmentId = $state<string>('');
	// F-CERT-APROBACION (2026-07-30): solicitudes de certificado del estudiante
	let myRequests: CertificateRequest[] = $state([]);
	let cancellingRequestId = $state<string | null>(null);
	// F-CERT-NO-DEUDOR-COBRO (2026-08-17): id de la solicitud cuyo comprobante
	// se está subiendo, para deshabilitar solo ese input y no todos.
	let subiendoComprobanteId = $state<string | null>(null);

	$effect(() => {
		if (enrollments.length > 0 && !selectedEnrollmentId) {
			selectedEnrollmentId = String(enrollments[0]._id || enrollments[0].id || '');
		}
	});

	// ========================================================================
	// STATE: VISTA STAFF
	// ========================================================================

	let staffFilterStudent = $state('');
	let staffFilterCourse = $state('');
	let staffFilterTipo = $state<'todos' | 'notas' | 'no_deudor'>('todos');
	let staffFilterAnio = $state<number | null>(null);
	let staffFilterFolio = $state('');
	let staffStudents: Student[] = $state([]);
	let staffCourses: Course[] = $state([]);
	let staffCertTotal = $state(0);
	let staffCertPage = $state(1);
	const staffPerPage = 20;

	// ========================================================================
	// DERIVADOS: VISTA ESTUDIANTE
	// ========================================================================

	// F-CERT-SIEMPRE (2026-07-30): el certificado de Notas y el de No Deudor
	// deben poderse sacar SIEMPRE (reunión con Sandra Zabala). La validación
	// se hace en el backend (single source of truth). El frontend SOLO
	// muestra el botón "Descargar Notas" si la inscripción tiene al menos
	// un módulo asociado. Si el backend rechaza, mostramos el error.

	function notasCursando(e: Enrollment): string[] {
		if (!e.modulos) return [];
		return e.modulos
			.filter((m: any) => m.estado_academico === 'Cursando')
			.map((m: any) => m.nombre);
	}

	function isNotasElegible(e: Enrollment): { ok: boolean; motivo: string | null } {
		// F-CERT-SIEMPRE: solo validamos que tenga módulos. NO exigimos
		// que estén finalizados ni pagados. La emisión siempre es libre.
		if (!e.modulos || e.modulos.length === 0) {
			return { ok: false, motivo: 'Esta inscripción no tiene módulos asociados.' };
		}
		return { ok: true, motivo: null };
	}

	function isNotasYaEmitido(e: Enrollment): Certificate | null {
		const eid = e._id || e.id;
		if (!eid) return null;
		return (
			issuedCertificates.find((c) => c.tipo === 'notas' && c.enrollment_id === eid) || null
		);
	}

	// F-CERT-APROBACION (2026-07-30): helpers para saber si hay una solicitud
	// ACTIVA (pendiente o en_revision) para este enrollment y tipo.
	function getSolicitudActiva(
		e: Enrollment,
		tipo: 'notas' | 'no_deudor',
		hastaN?: number
	): CertificateRequest | null {
		const eid = e._id || e.id;
		if (!eid) return null;
		return (
			myRequests.find((r) => {
				if (r.enrollment_id !== eid) return false;
				if (r.tipo !== tipo) return false;
				if (r.estado !== 'pendiente' && r.estado !== 'en_revision') return false;
				if (tipo === 'no_deudor' && hastaN !== undefined) {
					if ((r.hasta_modulo_n ?? 0) !== hastaN) return false;
				}
				return true;
			}) || null
		);
	}

	function isNotasSolicitudActiva(e: Enrollment): CertificateRequest | null {
		return getSolicitudActiva(e, 'notas');
	}

	function isNoDeudorSolicitudActiva(e: Enrollment, hastaN: number): CertificateRequest | null {
		return getSolicitudActiva(e, 'no_deudor', hastaN);
	}

	function estadoBadgeClass(estado: string): string {
		switch (estado) {
			case 'pendiente':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
			case 'en_revision':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
			case 'aprobada':
				return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
			case 'rechazada':
				return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
			case 'cancelada':
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	}

	function estadoLabel(estado: string): string {
		switch (estado) {
			case 'pendiente': return 'Pendiente de revisión';
			case 'en_revision': return 'En revisión';
			case 'aprobada': return 'Aprobada';
			case 'rechazada': return 'Rechazada';
			case 'cancelada': return 'Cancelada';
			default: return estado;
		}
	}

	/**
	 * F-CERT-SIEMPRE-UX (2026-07-30): si el estudiante ya emitió un cert
	 * No Deudor para este enrollment y mismo `hasta_modulo_n`, mostramos
	 * el botón "Descargar" en vez de "Emitir" para evitar el 409.
	 */
	function isNoDeudorYaEmitido(e: Enrollment, hastaN: number): Certificate | null {
		const eid = e._id || e.id;
		if (!eid) return null;
		return (
			issuedCertificates.find(
				(c) =>
					c.tipo === 'no_deudor' &&
					c.enrollment_id === eid &&
					(c.hasta_modulo_n ?? 0) === hastaN
			) || null
		);
	}

	function getModuloEstadoPago(e: Enrollment, hastaN: number): { ok: boolean; moduloPendiente: string | null } {
		// F-CERT-SIEMPRE: ya no exigimos que los módulos anteriores estén
		// pagados para emitir el cert No Deudor. Solo validamos que N esté
		// en rango válido. El backend hace la validación final.
		if (!e.modulos) return { ok: true, moduloPendiente: null };
		if (hastaN < 1 || hastaN > e.modulos.length) {
			return { ok: false, moduloPendiente: `Módulo ${hastaN} (fuera de rango)` };
		}
		return { ok: true, moduloPendiente: null };
	}

	function ultimoModuloPagado(e: Enrollment): number {
		if (!e.modulos) return 0;
		let n = 0;
		for (let i = 0; i < e.modulos.length; i++) {
			const m: any = e.modulos[i];
			if (m.estado === 'Pagado') n = i + 1;
			else break;
		}
		return n;
	}

	/**
	 * F-CERTIFICADOS-UX (2026-07-29): resumen visual del progreso por módulo.
	 * Devuelve un objeto con la info visual para el badge de cada módulo.
	 * - Pagado: verde con check
	 * - Parcial: amarillo con info
	 * - Pendiente: gris con círculo
	 */
	function getModuloBadgeInfo(m: any): { color: string; label: string; icon: string } {
		if (m.estado === 'Pagado') {
			return { color: 'bg-light-success/10 text-light-success dark:bg-dark-success/20 dark:text-dark-success', label: 'Pagado', icon: '✓' };
		}
		if (m.estado === 'Parcial') {
			return { color: 'bg-light-warning/10 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning', label: 'Parcial', icon: '◐' };
		}
		return { color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', label: 'Pendiente', icon: '○' };
	}

	function getNoDeudorElegibilidad(e: Enrollment, hastaN: number): { ok: boolean; motivo: string | null } {
		const total = e.modulos?.length ?? 0;
		if (total === 0) {
			return { ok: false, motivo: 'Esta inscripción no tiene módulos asociados.' };
		}
		if (hastaN < 1 || hastaN > total) {
			return { ok: false, motivo: `Selecciona un módulo entre 1 y ${total}.` };
		}
		const { ok, moduloPendiente } = getModuloEstadoPago(e, hastaN);
		if (!ok) {
			return {
				ok: false,
				motivo: `El módulo «${moduloPendiente}» aún no está pagado. Cancélalo para habilitar el certificado hasta ese punto.`
			};
		}
		return { ok: true, motivo: null };
	}

	function certificadosDeEnrollment(e: Enrollment): Certificate[] {
		const eid = e._id || e.id;
		if (!eid) return [];
		return issuedCertificates.filter((c) => c.enrollment_id === eid);
	}

	function getCourse(e: Enrollment): Course | null {
		const cid = e.curso_id;
		if (!cid) return null;
		return coursesMap[cid] || null;
	}

	function getSelectedEnrollment(): Enrollment | null {
		if (enrollments.length === 0) return null;
		const found = enrollments.find(
			(e) => String(e._id || e.id || '') === selectedEnrollmentId
		);
		return found || enrollments[0];
	}

	// ========================================================================
	// DATA FETCHING: VISTA ESTUDIANTE
	// ========================================================================

	async function cargarDatosEstudiante() {
		const userId = getUserId();
		if (!userId) {
			loading = false;
			return;
		}

		loading = true;
		try {
			const [enrollmentsData, certsData, requestsData] = await Promise.all([
				enrollmentService.getByStudentId(userId),
				certificateService.listMy().catch((err) => {
					console.warn('No se pudieron cargar certificados:', err);
					return [];
				}),
				// F-CERT-APROBACION (2026-07-30): cargar también las solicitudes
				// para saber si hay alguna pendiente y mostrar el estado correcto
				certificateService.listMyRequests().catch((err) => {
					console.warn('No se pudieron cargar solicitudes de cert:', err);
					return [];
				})
			]);

			enrollments = enrollmentsData || [];
			issuedCertificates = certsData;
			myRequests = requestsData;

			const cursoIds = Array.from(
				new Set(enrollments.map((e) => e.curso_id).filter(Boolean))
			);
			if (cursoIds.length > 0) {
				try {
					// FIX: backend /courses/ limita per_page a 100 (422 si se pasa
					// más). Paginamos en bucle para no perder cursos.
					const map: Record<string, Course> = {};
					let page = 1;
					let hasMore = true;
					while (hasMore) {
						const resp: any = await courseService.getAll(page, 100);
						const data: any[] = (resp as any).data || resp || [];
						for (const c of data) {
							if (c && c._id) map[c._id] = c;
						}
						const totalPages = (resp as any).meta?.totalPages ?? (resp as any).total_pages ?? 1;
						hasMore = page < totalPages;
						page += 1;
						if (page > 20) break; // safety: máximo 2000 cursos
					}
					coursesMap = map;
				} catch (err) {
					console.warn('No se pudieron cargar cursos:', err);
				}
			}
		} catch (err: any) {
			console.error('Error cargando datos:', err);
			alert('error', err?.message || 'No se pudieron cargar tus inscripciones.');
		} finally {
			loading = false;
		}
	}

	// ========================================================================
	// DATA FETCHING: VISTA STAFF
	// ========================================================================

	async function cargarDatosStaff() {
		loading = true;
		try {
			// FIX: backend limita per_page a 100 para /courses/ (422 si se pasa
			// más). Paginamos en bucle para traer todos los cursos y estudiantes.
			const [allStudents, allCourses] = await Promise.all([
				fetchAllStudents(),
				fetchAllCourses()
			]);
			staffStudents = allStudents;
			staffCourses = allCourses;
		} catch (err: any) {
			console.error('Error cargando datos staff:', err);
			alert('error', err?.message || 'No se pudieron cargar los datos.');
		} finally {
			loading = false;
		}
	}

	async function fetchAllCourses(): Promise<Course[]> {
		const all: Course[] = [];
		let page = 1;
		let hasMore = true;
		while (hasMore) {
			try {
				const resp: any = await courseService.getAll(page, 100);
				const data: any[] = (resp as any).data || resp || [];
				all.push(...data);
				const totalPages = (resp as any).meta?.totalPages ?? (resp as any).total_pages ?? 1;
				hasMore = page < totalPages;
				page += 1;
				if (page > 20) break; // safety: máximo 2000 cursos
			} catch (err) {
				console.warn('No se pudieron cargar cursos:', err);
				break;
			}
		}
		return all;
	}

	async function fetchAllStudents(): Promise<any[]> {
		const all: any[] = [];
		let page = 1;
		let hasMore = true;
		while (hasMore) {
			try {
				const resp: any = await studentService.getAll(page, 100);
				const data: any[] = (resp as any).data || resp || [];
				all.push(...data);
				const totalPages = (resp as any).meta?.totalPages ?? (resp as any).total_pages ?? 1;
				hasMore = page < totalPages;
				page += 1;
				if (page > 50) break; // safety: máximo 5000 estudiantes
			} catch (err) {
				console.warn('No se pudieron cargar estudiantes:', err);
				break;
			}
		}
		return all;
	}

	async function cargarCertificadosStaff() {
		try {
			const params: any = { page: staffCertPage, per_page: staffPerPage };
			if (staffFilterStudent) params.student_id = staffFilterStudent;
			if (staffFilterCourse) params.course_id = staffFilterCourse;
			if (staffFilterTipo !== 'todos') params.tipo = staffFilterTipo;
			if (staffFilterAnio) params.anio = staffFilterAnio;
			if (staffFilterFolio) params.folio = staffFilterFolio;

			const resp = await certificateService.listAdmin(params);
			issuedCertificates = resp.items;
			staffCertTotal = resp.total;
		} catch (err: any) {
			console.error('Error cargando certificados:', err);
			alert('error', err?.message || 'No se pudieron cargar los certificados.');
		}
	}

	// ========================================================================
	// ACCIONES: solicitar certificados (vista estudiante)
	// F-CERT-APROBACION (2026-07-30): el estudiante ya no emite directo,
	// crea una solicitud que el encargado del programa debe aprobar.
	// ========================================================================

	async function solicitarNotas(e: Enrollment) {
		const eid = e._id || e.id;
		if (!eid) return;
		const elegible = isNotasElegible(e);
		if (!elegible.ok) {
			alert('warning', elegible.motivo || 'No cumples los requisitos.');
			return;
		}
		emittingNotas = { ...emittingNotas, [eid]: true };
		try {
			const req = await certificateService.createRequest({
				tipo: 'notas',
				enrollment_id: eid,
				motivo: 'Solicitud de Certificado de Notas desde el portal del estudiante.'
			});
			myRequests = [req, ...myRequests];
			alert(
				'success',
				'Solicitud creada. El encargado del programa la revisará y aprobará. ' +
				'Te avisaremos cuando esté lista para descargar.'
			);
		} catch (err: any) {
			console.error('Error creando solicitud de notas:', err);
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo crear la solicitud.';
			alert('error', detail);
		} finally {
			emittingNotas = { ...emittingNotas, [eid]: false };
		}
	}

	async function solicitarNoDeudor(e: Enrollment) {
		const eid = e._id || e.id;
		if (!eid) return;
		const hastaN = hastaModuloNSelections[eid] || 1;
		const elegible = getNoDeudorElegibilidad(e, hastaN);
		if (!elegible.ok) {
			alert('warning', elegible.motivo || 'No cumples los requisitos.');
			return;
		}
		emittingNoDeudor = { ...emittingNoDeudor, [eid]: true };
		try {
			const req = await certificateService.createRequest({
				tipo: 'no_deudor',
				enrollment_id: eid,
				hasta_modulo_n: hastaN,
				motivo: `Solicitud de Certificado de No Deudor hasta Módulo ${hastaN}.`
			});
			myRequests = [req, ...myRequests];
			// F-CERT-NO-DEUDOR-COBRO (2026-08-17): el arancel y el paso de la
			// firma física se avisan ACÁ, al crear la solicitud, y no cuando el
			// estudiante intente descargar. Enterarse del costo recién al final
			// es la forma más segura de que vuelva a preguntar por qué no puede
			// bajar su certificado.
			const arancel = req.monto ? ` Tiene un costo de Bs ${req.monto}.` : '';
			alert(
				'success',
				`Solicitud creada.${arancel} Cuando la aprueben, el coordinador tiene que hacer ` +
				'firmar la copia física antes de habilitarte la descarga. Te avisamos cuando esté lista.'
			);
		} catch (err: any) {
			console.error('Error creando solicitud de no deudor:', err);
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo crear la solicitud.';
			alert('error', detail);
		} finally {
			emittingNoDeudor = { ...emittingNoDeudor, [eid]: false };
		}
	}

	/**
	 * Adjunta el comprobante de pago del arancel a una solicitud de No Deudor.
	 *
	 * F-CERT-NO-DEUDOR-COBRO (2026-08-17). Se permite reemplazarlo mientras la
	 * solicitud siga abierta: si subió el archivo equivocado tiene que poder
	 * corregirlo sin cancelar y volver a empezar.
	 */
	async function subirComprobante(req: CertificateRequest, ev: Event) {
		const input = ev.target as HTMLInputElement;
		const archivo = input.files?.[0];
		if (!archivo) return;

		// 10 MB: más que eso suele ser una foto sin comprimir y la subida
		// falla sin decir por qué.
		if (archivo.size > 10 * 1024 * 1024) {
			alert('error', 'El comprobante no puede pasar los 10 MB.');
			input.value = '';
			return;
		}

		subiendoComprobanteId = req.id;
		try {
			const updated = await certificateService.uploadComprobante(req.id, archivo);
			myRequests = myRequests.map((r) => (r.id === updated.id ? updated : r));
			alert('success', 'Comprobante enviado.');
		} catch (err: any) {
			console.error('Error subiendo comprobante:', err);
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo subir el comprobante.';
			alert('error', detail);
		} finally {
			subiendoComprobanteId = null;
			input.value = '';
		}
	}

	async function cancelarMiSolicitud(req: CertificateRequest) {
		if (!confirm('¿Cancelar esta solicitud? Una vez cancelada, puedes crear una nueva.')) return;
		cancellingRequestId = req.id;
		try {
			const updated = await certificateService.cancelMyRequest(req.id);
			myRequests = myRequests.map((r) => (r.id === updated.id ? updated : r));
			alert('success', 'Solicitud cancelada.');
		} catch (err: any) {
			console.error('Error cancelando solicitud:', err);
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo cancelar la solicitud.';
			alert('error', detail);
		} finally {
			cancellingRequestId = null;
		}
	}

	async function descargarPdf(cert: Certificate) {
		downloadingId = cert.id;
		try {
			const blob = await certificateService.downloadPdf(cert.id);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = cert.pdf_filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err: any) {
			console.error('Error descargando PDF:', err);
			const detail = err?.response?.data?.detail || err?.message || 'No se pudo descargar el PDF.';
			alert('error', detail);
		} finally {
			downloadingId = null;
		}
	}

	// ========================================================================
	// HELPERS de UI
	// ========================================================================

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		try {
			const s = iso.includes('T') ? iso : iso.replace(' ', 'T');
			const clean = s.replace(/(\.\d+)?$/, '').replace(/([+-]\d{2}:?\d{2}|Z)$/, 'Z');
			const d = new Date(clean);
			return d.toLocaleDateString('es-BO', {
				day: '2-digit', month: '2-digit', year: 'numeric'
			});
		} catch {
			return iso;
		}
	}

	function getStudentName(cert: Certificate): string {
		// El backend actualmente no devuelve el nombre del estudiante en la lista
		// (solo student_id). En el futuro se puede popular. Por ahora, mostramos
		// el nombre si está disponible o un placeholder.
		return cert.estudiante_nombre || '—';
	}

	function getCourseName(cert: Certificate): string {
		return cert.programa_nombre || '—';
	}

	// ========================================================================
	// LIFECYCLE
	// ========================================================================

	// Necesitamos el studentService para la vista staff
	import { studentService } from '$lib/services';

	onMount(() => {
		if (isStaff()) {
			cargarDatosStaff().then(() => cargarCertificadosStaff());
		} else {
			cargarDatosEstudiante();
		}
	});

	// Recargar certificados cuando cambian los filtros
	$effect(() => {
		// Dependencias reactivas explícitas
		void staffFilterStudent;
		void staffFilterCourse;
		void staffFilterTipo;
		void staffFilterAnio;
		void staffFilterFolio;
		void staffCertPage;
		if (isStaff() && !loading) {
			cargarCertificadosStaff();
		}
	});

	function aplicarFiltros() {
		staffCertPage = 1;
		cargarCertificadosStaff();
	}

	function limpiarFiltros() {
		staffFilterStudent = '';
		staffFilterCourse = '';
		staffFilterTipo = 'todos';
		staffFilterAnio = null;
		staffFilterFolio = '';
		staffCertPage = 1;
		cargarCertificadosStaff();
	}

	const aniosDisponibles = (() => {
		const current = new Date().getFullYear();
		const arr: number[] = [];
		for (let y = current; y >= current - 5; y--) arr.push(y);
		return arr;
	})();
</script>

<svelte:head>
	<title>Certificados · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
		<!-- Header -->
		<header class="mb-6">
			<Heading level="h1" weight="bold" color="primary">
				{#snippet children()}
					<h1 class="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-300">
						{isStaff() ? 'Certificados emitidos' : 'Tus Certificados'}
					</h1>
					<p class="text-sm text-light-four dark:text-dark-four mt-1">
						{isStaff()
							? 'Vista de auditoría: reimprime o verifica cualquier certificado emitido por la Unidad de Postgrado.'
							: 'Descarga constancias oficiales emitidas por la Unidad de Postgrado.'}
					</p>
				{/snippet}
			</Heading>
		</header>

		<!-- Loading -->
		{#if loading}
			<div class="space-y-4">
				<Skeleton variant="block" lines={3} />
				<Skeleton variant="block" lines={3} />
			</div>

		<!-- ====================================================== -->
		<!-- VISTA STAFF: Auditoría de certificados emitidos           -->
		<!-- ====================================================== -->
		{:else if isStaff()}
			<!-- Filtros -->
			<Card variant="bordered">
				{#snippet header()}
					<div class="flex items-center gap-2">
						<SearchIcon class="w-5 h-5 text-uagrm-blue dark:text-dark-tertiary" />
						<h3 class="text-base font-semibold text-light-black dark:text-dark-white">
							Filtros de búsqueda
						</h3>
					</div>
				{/snippet}

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					<div>
						<label for="f-student" class="block text-sm font-medium text-light-black dark:text-dark-white mb-1">
							Estudiante
						</label>
						<select
							id="f-student"
							bind:value={staffFilterStudent}
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
						>
							<option value="">— Todos —</option>
							{#each staffStudents as s (s._id)}
								<option value={s._id}>{s.nombre} {s.registro ? `(Reg: ${s.registro})` : ''}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="f-course" class="block text-sm font-medium text-light-black dark:text-dark-white mb-1">
							Programa
						</label>
						<select
							id="f-course"
							bind:value={staffFilterCourse}
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
						>
							<option value="">— Todos —</option>
							{#each staffCourses as c (c._id)}
								<option value={c._id}>{c.nombre_programa}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="f-tipo" class="block text-sm font-medium text-light-black dark:text-dark-white mb-1">
							Tipo
						</label>
						<select
							id="f-tipo"
							bind:value={staffFilterTipo}
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
						>
							<option value="todos">— Todos —</option>
							<option value="notas">Certificado de Notas</option>
							<option value="no_deudor">Certificado de No Deudor</option>
						</select>
					</div>

					<div>
						<label for="f-anio" class="block text-sm font-medium text-light-black dark:text-dark-white mb-1">
							Año
						</label>
						<select
							id="f-anio"
							bind:value={staffFilterAnio}
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
						>
							<option value={null}>— Todos —</option>
							{#each aniosDisponibles as y}
								<option value={y}>{y}</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="f-folio" class="block text-sm font-medium text-light-black dark:text-dark-white mb-1">
							Folio (ej: 042)
						</label>
						<input
							id="f-folio"
							type="text"
							bind:value={staffFilterFolio}
							placeholder="042"
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
						/>
					</div>
				</div>

				<div class="mt-4 flex gap-2">
					<Button variant="primary" size="sm" onclick={aplicarFiltros}>
						<SearchIcon class="w-4 h-4 mr-1.5" />
						Buscar
					</Button>
					<Button variant="ghost" size="sm" onclick={limpiarFiltros}>
						Limpiar
					</Button>
				</div>
			</Card>

			<!-- Tabla de resultados -->
			<section class="mt-6">
				<div class="flex items-center justify-between mb-3">
					<p class="text-sm text-light-four dark:text-dark-four">
						{staffCertTotal} certificado{staffCertTotal === 1 ? '' : 's'} encontrado{staffCertTotal === 1 ? '' : 's'}.
					</p>
				</div>

				{#if issuedCertificates.length === 0}
					<EmptyState
						variant="bordered"
						size="md"
						icon="search"
						title="Sin resultados"
						description="No hay certificados que coincidan con los filtros aplicados."
					/>
				{:else}
					<!-- Desktop: tabla -->
					<div class="hidden sm:block rounded-lg border border-gray-200 dark:border-dark-border overflow-hidden">
						<table class="w-full text-sm">
							<thead class="bg-primary-50 dark:bg-primary-900/30 text-light-four dark:text-dark-four">
								<tr>
									<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Folio</th>
									<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Tipo</th>
									<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Estudiante</th>
									<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Programa</th>
									<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Emitido</th>
									<th class="px-3 py-2 text-right font-medium uppercase tracking-wider text-xs">Acción</th>
								</tr>
							</thead>
							<tbody>
								{#each issuedCertificates as cert (cert.id)}
									<tr class="border-t border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-background">
										<td class="px-3 py-2 font-mono font-semibold text-primary-700 dark:text-primary-300">
											{cert.folio}
										</td>
										<td class="px-3 py-2">
											<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {cert.tipo === 'notas' ? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200' : 'bg-uagrm-sky/10 text-uagrm-blue dark:bg-dark-tertiary/10 dark:text-dark-tertiary'}">
												{cert.tipo === 'notas' ? 'Notas' : 'No Deudor'}{#if cert.hasta_modulo_n} · M{cert.hasta_modulo_n}{/if}
											</span>
										</td>
										<td class="px-3 py-2 text-light-black dark:text-dark-white">
											{getStudentName(cert)}
											<p class="text-xs text-light-four dark:text-dark-four">
												Reg: {cert.estudiante_registro || '—'}
											</p>
										</td>
										<td class="px-3 py-2 text-light-black dark:text-dark-white max-w-xs truncate" title={getCourseName(cert)}>
											{getCourseName(cert)}
										</td>
										<td class="px-3 py-2 text-light-four dark:text-dark-four">
											{formatDate(cert.emitido_en)}
										</td>
										<td class="px-3 py-2 text-right">
											<Button
												variant="ghost"
												size="sm"
												loading={downloadingId === cert.id}
												onclick={() => descargarPdf(cert)}
												ariaLabel="Re-imprimir {cert.folio}"
											>
												<DownloadIcon class="w-4 h-4" />
											</Button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Móvil: cards -->
					<div class="sm:hidden space-y-3">
						{#each issuedCertificates as cert (cert.id)}
							<Card variant="bordered">
								<div class="flex items-start justify-between gap-3">
									<div class="min-w-0 flex-1">
										<p class="font-mono text-sm font-semibold text-primary-700 dark:text-primary-300">
											{cert.folio}
										</p>
										<p class="text-xs mt-1 text-light-four dark:text-dark-four">
											{cert.tipo === 'notas' ? 'Certificado de Notas' : `No Deudor · M${cert.hasta_modulo_n ?? ''}`}
										</p>
										<p class="text-sm mt-1 text-light-black dark:text-dark-white truncate">
											{getStudentName(cert)}
										</p>
										<p class="text-xs mt-1 text-light-four dark:text-dark-four truncate" title={getCourseName(cert)}>
											{getCourseName(cert)}
										</p>
										<p class="text-xs mt-1 text-light-four dark:text-dark-four">
											{formatDate(cert.emitido_en)}
										</p>
									</div>
									<Button
										variant="ghost"
										size="sm"
										loading={downloadingId === cert.id}
										onclick={() => descargarPdf(cert)}
										ariaLabel="Re-imprimir {cert.folio}"
									>
										<DownloadIcon class="w-4 h-4" />
									</Button>
								</div>
							</Card>
						{/each}
					</div>

					<!-- Paginación simple -->
					{#if staffCertTotal > staffPerPage}
						<div class="mt-4 flex items-center justify-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={staffCertPage <= 1}
								onclick={() => { staffCertPage = Math.max(1, staffCertPage - 1); cargarCertificadosStaff(); }}
							>
								« Anterior
							</Button>
							<span class="text-sm text-light-four dark:text-dark-four">
								Página {staffCertPage} de {Math.ceil(staffCertTotal / staffPerPage)}
							</span>
							<Button
								variant="ghost"
								size="sm"
								disabled={staffCertPage >= Math.ceil(staffCertTotal / staffPerPage)}
								onclick={() => { staffCertPage++; cargarCertificadosStaff(); }}
							>
								Siguiente »
							</Button>
						</div>
					{/if}
				{/if}
			</section>

		<!-- ====================================================== -->
		<!-- VISTA ESTUDIANTE: emisión de certificados                -->
		<!-- ====================================================== -->
		{:else if enrollments.length === 0}
			<EmptyState
				variant="bordered"
				size="lg"
				icon="inbox"
				title="No tienes inscripciones activas"
				description="Cuando te inscribas a un diplomado o programa, aquí podrás solicitar tus certificados de Notas y de No Deudor."
			/>

		{:else}
			<div class="space-y-6">
				{#if enrollments.length > 1}
					<div class="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4">
						<label
							for="programa-selector"
							class="block mb-2 text-sm font-medium text-light-black dark:text-dark-white"
						>
							Selecciona el programa
						</label>
						<select
							id="programa-selector"
							class="w-full rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
							value={selectedEnrollmentId}
							onchange={(ev) => {
								selectedEnrollmentId = (ev.currentTarget as HTMLSelectElement).value;
							}}
						>
							{#each enrollments as e (e._id || e.id || '')}
								{@const c = getCourse(e)}
								<option value={String(e._id || e.id || '')}>
									{c?.nombre_programa || 'Programa'} {c?.codigo ? `(${c.codigo})` : ''}
								</option>
							{/each}
						</select>
					</div>
				{/if}

				{#if getSelectedEnrollment()}
					{@const enrollment = getSelectedEnrollment()!}
					{@const eid = String(enrollment._id || enrollment.id || '')}
					{@const course = getCourse(enrollment)}
					{@const notasYaEmitido = isNotasYaEmitido(enrollment)}
					{@const totalModulos = enrollment.modulos?.length ?? 0}
					{@const ultPagado = ultimoModuloPagado(enrollment)}
					{@const hastaN = hastaModuloNSelections[eid] || Math.min(ultPagado || 1, Math.max(totalModulos, 1))}
					{@const elegibleNoDeudor = getNoDeudorElegibilidad(enrollment, hastaN)}
					{@const noDeudorYaEmitido = isNoDeudorYaEmitido(enrollment, hastaN)}

					<Card variant="bordered">
						{#snippet header()}
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<h3 class="text-lg font-bold text-light-black dark:text-dark-white truncate">
										{course?.nombre_programa || 'Programa'}
									</h3>
									<p class="text-sm text-light-four dark:text-dark-four mt-1">
										{course?.codigo ? `Código: ${course.codigo}` : ''}
										{#if totalModulos > 0}· {totalModulos} módulo{totalModulos === 1 ? '' : 's'}{/if}
										{#if (enrollment.saldo_pendiente ?? 0) > 0.01}
											· <span class="text-light-error dark:text-dark-error font-medium">Saldo pendiente: Bs {enrollment.saldo_pendiente.toFixed(2)}</span>
										{:else if totalModulos > 0}
											· <span class="text-light-success dark:text-dark-success font-medium">Pagado completo</span>
										{/if}
									</p>
								</div>
							</div>
						{/snippet}

						<!-- F-CERTIFICADOS-UX: Resumen visual del progreso del programa -->
						{#if totalModulos > 0}
							<section class="mb-5">
								<div class="flex items-center justify-between gap-2 mb-2">
									<p class="text-xs font-semibold uppercase tracking-wider text-light-four dark:text-dark-four">
										Progreso de pago
									</p>
									<p class="text-xs font-bold text-primary-700 dark:text-primary-300 tabular-nums">
										{ultPagado} / {totalModulos} módulos
									</p>
								</div>
								<!-- Barra de progreso -->
								<div class="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-3">
									<div
										class="h-full rounded-full transition-all duration-500 {ultPagado === totalModulos
											? 'bg-light-success dark:bg-dark-success'
											: 'bg-primary-600 dark:bg-primary-500'}"
										style="width: {Math.min(100, (ultPagado / totalModulos) * 100)}%"
									></div>
								</div>
								<!-- Mini-lista de módulos con badges -->
								<div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
									{#each enrollment.modulos as m, i (i)}
										{@const badge = getModuloBadgeInfo(m)}
										<div class="flex items-center justify-between gap-2 text-xs rounded-md border border-gray-200 dark:border-dark-border bg-light-primary dark:bg-dark-background px-2.5 py-1.5">
											<div class="flex items-center gap-2 min-w-0">
												<span class="font-mono font-bold text-light-four dark:text-dark-four shrink-0 w-6">M{i + 1}</span>
												<span class="truncate text-light-black dark:text-dark-white" title={m.nombre}>
													{m.nombre || `Módulo ${i + 1}`}
												</span>
											</div>
											<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-medium {badge.color} shrink-0">
												<span aria-hidden="true">{badge.icon}</span>
												<span>{badge.label}</span>
											</span>
										</div>
									{/each}
								</div>
							</section>
						{/if}

						<!-- SECCIÓN 1: Certificado de Notas -->
						<section class="mb-6">
							<div class="flex items-center gap-2 mb-3">
								<FileTextIcon class="w-5 h-5 text-primary-600 dark:text-primary-400" />
								<h4 class="text-base font-semibold text-light-black dark:text-dark-white">Certificado de Notas</h4>
							</div>

							{#if notasYaEmitido}
								<div class="rounded-lg border border-light-success/40 bg-light-success/5 dark:border-dark-success/40 dark:bg-dark-success/5 p-4">
									<div class="flex items-start gap-3">
										<CircleCheckIcon class="w-6 h-6 text-light-success dark:text-dark-success shrink-0 mt-0.5" />
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-light-black dark:text-dark-white">Ya emitido · Folio {notasYaEmitido.folio}</p>
											<p class="text-xs text-light-four dark:text-dark-four mt-0.5">{formatDate(notasYaEmitido.emitido_en)}</p>
										</div>
										<Button variant="primary" size="sm" loading={downloadingId === notasYaEmitido.id} onclick={() => descargarPdf(notasYaEmitido)} ariaLabel="Re-descargar Certificado de Notas {notasYaEmitido.folio}">
											<DownloadIcon class="w-4 h-4 mr-1.5" />Descargar
										</Button>
									</div>
								</div>
							{:else if isNotasSolicitudActiva(enrollment)}
								{@const solNotas = isNotasSolicitudActiva(enrollment)}
								<div class="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 p-4">
									<div class="flex items-start gap-3">
										<div class="flex-1 min-w-0">
											<div class="flex items-center gap-2 mb-1">
												<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {estadoBadgeClass(solNotas!.estado)}">
													{estadoLabel(solNotas!.estado)}
												</span>
											</div>
											<p class="text-sm text-light-black dark:text-dark-white">
												Solicitud creada el {formatDate(solNotas!.created_at)}.
											</p>
											<p class="text-xs text-light-four dark:text-dark-four mt-1">
												El encargado del programa debe aprobarla antes de que puedas descargar el PDF.
											</p>
											{#if solNotas!.estado === 'rechazada' && solNotas!.motivo_rechazo}
												<p class="text-xs text-red-700 dark:text-red-300 mt-2">
													<strong>Motivo del rechazo:</strong> {solNotas!.motivo_rechazo}
												</p>
											{/if}
										</div>
										{#if solNotas!.estado === 'pendiente' || solNotas!.estado === 'en_revision'}
											<Button variant="ghost" size="sm" loading={cancellingRequestId === solNotas!.id} onclick={() => cancelarMiSolicitud(solNotas!)} ariaLabel="Cancelar solicitud">
												Cancelar
											</Button>
										{/if}
									</div>
								</div>
							{:else}
								<!-- F-CERT-APROBACION (2026-07-30): el estudiante crea una
								     solicitud en vez de descargar directo. El encargado
								     del programa la aprueba y recien queda disponible. -->
								<div class="rounded-lg border border-light-info/40 bg-light-info/5 dark:border-dark-info/40 dark:bg-dark-info/5 p-4">
									<p class="text-sm text-light-black dark:text-dark-white mb-3">Solicita tu Certificado de Notas. El encargado del programa lo revisará y aprobará; una vez aprobado, podrás descargar el PDF.</p>
									<Button variant="primary" size="md" loading={emittingNotas[eid]} onclick={() => solicitarNotas(enrollment)} ariaLabel="Solicitar Certificado de Notas">
										<FileTextIcon class="w-4 h-4 mr-2" />Solicitar Certificado de Notas
									</Button>
								</div>
							{/if}
						</section>

						<!-- SECCIÓN 2: Certificado de No Deudor -->
						<section>
							<div class="flex items-center gap-2 mb-3">
								<IdentificationIcon class="w-5 h-5 text-uagrm-blue dark:text-dark-tertiary" />
								<h4 class="text-base font-semibold text-light-black dark:text-dark-white">Certificado de No Deudor</h4>
							</div>

							<div class="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4">
								<p class="text-sm text-light-black dark:text-dark-white mb-3">Puedes solicitar este certificado en cualquier momento, indicando hasta qué módulo ya has cancelado.</p>

								{#if totalModulos === 0}
									<p class="text-sm text-light-four dark:text-dark-four italic">Esta inscripción no tiene módulos asociados.</p>
								{:else}
									<!-- Hint visual: hasta dónde podés llegar ahora -->
									<div class="mb-3 flex items-center gap-2 text-xs">
										<span class="inline-flex items-center gap-1.5 rounded-md bg-light-success/10 dark:bg-dark-success/20 text-light-success dark:text-dark-success px-2 py-1 font-medium">
											<span aria-hidden="true">✓</span>
											<span>Hasta Módulo {ultPagado} disponible{ultPagado === 1 ? '' : 's'}</span>
										</span>
										{#if ultPagado < totalModulos}
											<span class="text-light-four dark:text-dark-four">
												· Pagá los siguientes para ampliar el alcance
											</span>
										{/if}
									</div>

									<label for="modulo-n-{eid}" class="block mb-2 text-sm font-medium text-light-black dark:text-dark-white">¿Hasta qué módulo?</label>
									<div class="flex flex-col sm:flex-row sm:items-center gap-3">
										<select
											id="modulo-n-{eid}"
											class="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm min-w-[8rem] focus:ring-2 focus:ring-primary-500 focus:border-transparent"
											value={hastaN}
											onchange={(ev) => {
												const v = parseInt((ev.currentTarget as HTMLSelectElement).value, 10);
												hastaModuloNSelections = { ...hastaModuloNSelections, [eid]: v };
											}}
										>
											{#each Array.from({ length: totalModulos }, (_, i) => i + 1) as n}
												{@const isPagado = n <= ultPagado}
												<option value={n}>
													Módulo {n}{isPagado ? ' ✓' : ''}
												</option>
											{/each}
										</select>
										{#if noDeudorYaEmitido}
											<Button variant="primary" size="md" loading={downloadingId === noDeudorYaEmitido.id} onclick={() => descargarPdf(noDeudorYaEmitido)} ariaLabel="Descargar Certificado de No Deudor folio {noDeudorYaEmitido.folio}">
												<DownloadIcon class="w-4 h-4 mr-2" />Descargar No Deudor (Folio {noDeudorYaEmitido.folio})
											</Button>
										{:else if isNoDeudorSolicitudActiva(enrollment, hastaN)}
											{@const solND = isNoDeudorSolicitudActiva(enrollment, hastaN)}
											<div class="flex flex-col gap-1.5">
												<span class="inline-flex items-center self-start rounded-full px-2.5 py-0.5 text-xs font-medium {estadoBadgeClass(solND!.estado)}">
													{estadoLabel(solND!.estado)}
												</span>
												{#if solND!.estado === 'rechazada' && solND!.motivo_rechazo}
													<p class="text-xs text-red-700 dark:text-red-300">
														<strong>Rechazado:</strong> {solND!.motivo_rechazo}
													</p>
												{:else if solND!.estado === 'aprobada' && !solND!.firma_fisica_confirmada}
													<!-- F-CERT-NO-DEUDOR-COBRO (2026-08-17): aprobado NO
													     es descargable todavía. Si acá dijera solo
													     "aprobado", el estudiante buscaría un botón de
													     descarga que no existe y creería que está roto. -->
													<p class="text-xs text-amber-700 dark:text-amber-400">
														Aprobado. Falta que el coordinador haga firmar la copia
														física; ahí se te habilita la descarga.
													</p>
												{:else}
													<p class="text-xs text-light-four dark:text-dark-four">
														El coordinador debe aprobarlo.
													</p>
												{/if}

												<!-- Arancel y comprobante -->
												{#if solND!.monto}
													<p class="text-xs text-light-four dark:text-dark-four">
														Arancel: <strong>Bs {solND!.monto}</strong>
													</p>
												{/if}
												{#if solND!.comprobante_url}
													<a
														href={solND!.comprobante_url}
														target="_blank"
														rel="noopener noreferrer"
														class="self-start text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
													>
														Ver comprobante enviado
													</a>
												{/if}
												{#if solND!.estado === 'pendiente' || solND!.estado === 'en_revision'}
													<label class="self-start text-xs text-light-four dark:text-dark-four">
														<span class="block mb-1">
															{solND!.comprobante_url ? 'Reemplazar comprobante' : 'Adjuntar comprobante de pago'}
														</span>
														<input
															type="file"
															accept="image/*,application/pdf"
															disabled={subiendoComprobanteId === solND!.id}
															onchange={(ev) => subirComprobante(solND!, ev)}
															class="block text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary-50 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-primary-700 dark:file:bg-primary-900/40 dark:file:text-primary-300"
														/>
													</label>
												{/if}
											</div>
										{:else}
											<Button variant="primary" size="md" disabled={!elegibleNoDeudor.ok} loading={emittingNoDeudor[eid]} onclick={() => solicitarNoDeudor(enrollment)} ariaLabel="Solicitar Certificado de No Deudor hasta Módulo {hastaN}">
												<FileTextIcon class="w-4 h-4 mr-2" />Solicitar No Deudor
											</Button>
										{/if}
									</div>
									{#if !elegibleNoDeudor.ok}
										<p class="text-xs text-light-error dark:text-dark-error mt-2">{elegibleNoDeudor.motivo}</p>
									{:else if ultPagado >= hastaN}
										<p class="text-xs text-light-success dark:text-dark-success mt-2">✓ Los módulos 1 a {hastaN} están pagados. Puedes emitir este certificado.</p>
									{/if}
								{/if}
							</div>
						</section>
					</Card>
				{/if}
			</div>
		{/if}
	</div>
</div>
