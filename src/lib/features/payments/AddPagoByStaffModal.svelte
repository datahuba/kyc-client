<script lang="ts">
	/**
	 * F-COBRANZA-017 (2026-07-22): Modal para que COBRANZA registre un
	 * pago COMPLETO en nombre de un estudiante.
	 *
	 * Caso de uso: el estudiante no pudo subir su comprobante desde su
	 * perfil (problemas técnicos, falta de acceso, etc.). Cobranza recibe
	 * el voucher por WhatsApp / correo / presencial y lo carga al sistema.
	 *
	 * Decisión Joel 2026-07-22 22:25:
	 * - Botón vive en la parte SUPERIOR DERECHA de /app/payments, al lado
	 *   del botón "Excel" (no en menú de 3 puntos).
	 * - Roles permitidos: superadmin, admin, cobranza (validado en backend).
	 * - Pago nace APROBADO (mismo flujo que F-COBRANZA-004 cuando el
	 *   estudiante sube comprobante desde su perfil). verificado_por
	 *   = "STAFF:<username>" para distinguir en auditoría.
	 * - Glosa: si el campo "concepto" queda vacío, el backend calcula la
	 *   glosa detallada por módulo (F-COBRANZA-015).
	 *
	 * Backend: POST /api/v1/payments/by-staff
	 */
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { paymentService, studentService, courseService, enrollmentService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type { Student, Enrollment, Course } from '$lib/interfaces';
	import { ExclamationCircleIcon } from '$lib/icons/solid';

	interface Props {
		isOpen: boolean;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { isOpen, onSuccess, onCancel }: Props = $props();

	// --- ESTADO ---
	let students: Student[] = $state([]);
	let enrollments: Enrollment[] = $state([]);
	let coursesList: Course[] = $state([]);
	let loadingStudents = $state(false);
	let loadingEnrollments = $state(false);
	let saving = $state(false);
	let studentSearch = $state('');

	let selectedStudentId = $state('');
	let selectedEnrollmentId = $state('');
	let concepto = $state(''); // vacío → backend calcula glosa detallada
	let montoComprobante = $state<number | null>(null);
	let metodoPago = $state('Transferencia');
	let banco = $state('');
	let remitente = $state('');
	let numeroTransaccion = $state('');
	let fechaComprobante = $state(new Date().toISOString().split('T')[0]);
	let cuentaDestino = $state('');
	let file: File | null = $state(null);

	const metodosDisponibles = ['Transferencia', 'Depósito', 'Caja'];
	const bancosDisponibles = [
		'Banco Unión', 'Banco Nacional de Bolivia (BNB)', 'Banco Mercantil Santa Cruz',
		'Banco BISA', 'Banco Ganadero', 'Banco Económico', 'Banco de Crédito de Bolivia (BCP)',
		'Banco FIE', 'Banco Sol', 'Banco Fortaleza', 'Banco Prodem', 'Banco PYME Ecofuturo',
	];
	const cooperativasDisponibles = [
		'Cooperativa Jesús Nazareno', 'Cooperativa Fátima', 'Cooperativa La Merced',
		'Cooperativa San Martín de Porres', 'Cooperativa Catedral', 'Cooperativa San Antonio',
		'Cooperativa Comarapa', 'Cooperativa El Chorolque', 'Cooperativa Magisterio Rural',
		'Cooperativa Progreso',
	];

	$effect(() => {
		if (!isOpen) {
			// Reset on close
			selectedStudentId = '';
			selectedEnrollmentId = '';
			concepto = '';
			montoComprobante = null;
			metodoPago = 'Transferencia';
			banco = '';
			remitente = '';
			numeroTransaccion = '';
			fechaComprobante = new Date().toISOString().split('T')[0];
			file = null;
			enrollments = [];
		}
	});

	$effect(() => {
		if (!isOpen) return;
		if (students.length === 0 && !loadingStudents) {
			loadStudentsAndCourses();
		}
	});

	async function loadStudentsAndCourses() {
		loadingStudents = true;
		try {
			const [studentsRes, coursesRes] = await Promise.all([
				studentService.getAll(1, 500),
				courseService.getAll(1, 100),
			]);
			students = studentsRes?.data || [];
			coursesList = coursesRes?.data || [];
		} catch (e) {
			console.error('Error al cargar estudiantes/cursos:', e);
			alert('error', 'No se pudieron cargar los estudiantes. Intenta de nuevo.');
		} finally {
			loadingStudents = false;
		}
	}

	$effect(() => {
		if (!selectedStudentId) {
			enrollments = [];
			selectedEnrollmentId = '';
			return;
		}
		loadEnrollmentsForStudent(selectedStudentId);
	});

	async function loadEnrollmentsForStudent(studentId: string) {
		loadingEnrollments = true;
		try {
			enrollments = await enrollmentService.getByStudentId(studentId);
			selectedEnrollmentId = '';
		} catch (e) {
			console.error('Error al cargar inscripciones del estudiante:', e);
			alert('error', 'No se pudieron cargar las inscripciones del estudiante.');
		} finally {
			loadingEnrollments = false;
		}
	}

	let filteredStudents = $derived.by(() => {
		const q = studentSearch.trim().toLowerCase();
		if (!q) return students;
		return students.filter((s: any) => {
			const nombre = (s.nombre || '').toLowerCase();
			const registro = (s.registro || '').toLowerCase();
			const email = (s.email || '').toLowerCase();
			return nombre.includes(q) || registro.includes(q) || email.includes(q);
		});
	});

	let selectedEnrollment = $derived(
		enrollments.find((e) => e._id === selectedEnrollmentId) || null
	);

	let requiereBancoYVoucher = $derived(metodoPago !== 'Caja');

	$effect(() => {
		if (!selectedEnrollment) {
			concepto = '';
			montoComprobante = null;
			return;
		}
		const enr: any = selectedEnrollment;
		// Auto-sugerir concepto según si la matrícula está pagada
		if (!enr.matricula_pagada) {
			concepto = 'Matrícula';
		} else {
			concepto = 'Módulo';
		}
		// Auto-sugerir monto: saldo pendiente
		if (montoComprobante === null) {
			montoComprobante = Math.round((enr.saldo_pendiente || 0) * 100) / 100;
		}
	});

	async function handleSubmit() {
		if (saving) return;

		if (!selectedStudentId) {
			alert('error', 'Selecciona un estudiante.');
			return;
		}
		if (!selectedEnrollmentId) {
			alert('error', 'Selecciona una inscripción.');
			return;
		}
		if (montoComprobante === null || montoComprobante <= 0) {
			alert('error', 'El monto debe ser mayor a 0.');
			return;
		}
		if (!metodoPago) {
			alert('error', 'Selecciona un método de pago.');
			return;
		}
		if (requiereBancoYVoucher) {
			if (!file) {
				alert('error', 'Debes adjuntar el comprobante (voucher) del pago.');
				return;
			}
			if (!banco) {
				alert('error', 'Selecciona el banco o cooperativa de origen.');
				return;
			}
			if (!remitente) {
				alert('error', 'Ingresa el nombre del remitente del pago.');
				return;
			}
			if (!fechaComprobante) {
				alert('error', 'Ingresa la fecha del voucher.');
				return;
			}
			if (!numeroTransaccion) {
				alert('error', 'Ingresa el número de transacción o referencia del voucher.');
				return;
			}
			const regexSoloNumeros = /^[0-9]+$/;
			if (!regexSoloNumeros.test(numeroTransaccion)) {
				alert('error', 'El número de transacción solo debe contener números.');
				return;
			}
		}

		saving = true;
		try {
			const payload: any = {
				estudiante_id: selectedStudentId,
				inscripcion_id: selectedEnrollmentId,
				metodo_pago: metodoPago,
				monto_comprobante: montoComprobante,
				cantidad_pago: montoComprobante,
				concepto: concepto || '',
			};

			if (requiereBancoYVoucher) {
				payload.numero_transaccion = numeroTransaccion;
				payload.banco = banco;
				payload.remitente = remitente;
				payload.fecha_comprobante = fechaComprobante;
				payload.cuenta_destino = cuentaDestino || undefined;
				payload.file = file;
			} else {
				payload.numero_transaccion = `CAJA-${Date.now()}`;
				payload.banco = 'Caja UAGRM';
				payload.remitente = $userStore.user?.nombre || 'Caja Física';
				payload.fecha_comprobante = new Date().toISOString().split('T')[0];
				payload.cuenta_destino = 'Caja Central';
			}

			await paymentService.createByStaff(payload);
			const studentName = students.find((s: any) => s._id === selectedStudentId)?.nombre || 'estudiante';
			alert('success', `Pago de ${studentName} registrado y aprobado correctamente.`);
			onSuccess();
		} catch (e: any) {
			console.error('Error al registrar pago por staff:', e);
			alert('error', e?.response?.data?.detail || e?.message || 'Error al registrar el pago.');
		} finally {
			saving = false;
		}
	}
</script>

<Modal {isOpen} title="Registrar Pago en nombre del Estudiante" onClose={onCancel} maxWidth="sm:max-w-2xl">
	<div class="space-y-5 p-4 max-h-[75vh] overflow-y-auto">
		<!-- Info: solo cobranza/admin/superadmin -->
		<div class="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-3">
			<p class="text-xs text-blue-700 dark:text-blue-300">
				<i class="fa-solid fa-info-circle mr-1"></i>
				Estás registrando un pago en nombre del estudiante. El pago quedará aprobado automáticamente.
			</p>
		</div>

		<!-- Selector de estudiante (con búsqueda) -->
		<div>
			<label for="student_search" class="block mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">
				Buscar Estudiante
			</label>
			<Input
				id="student_search"
				bind:value={studentSearch}
				placeholder="Nombre, registro, email o carnet..."
			/>
		</div>

		<Select label="Estudiante" id="student_select" bind:value={selectedStudentId} required disabled={loadingStudents}>
			<option value="">— Selecciona un estudiante —</option>
			{#each filteredStudents as s}
				<option value={s._id}>
					{s.nombre || '(sin nombre)'} {s.registro ? `· Reg: ${s.registro}` : ''} {s.email ? `· ${s.email}` : ''}
				</option>
			{/each}
		</Select>

		<!-- Inscripciones del estudiante seleccionado -->
		{#if selectedStudentId}
			<Select label="Inscripción" id="enrollment_select" bind:value={selectedEnrollmentId} required disabled={loadingEnrollments || enrollments.length === 0}>
				<option value="">— Selecciona una inscripción —</option>
				{#each enrollments as e}
					{@const curso = coursesList.find((c) => c._id === e.curso_id)}
					<option value={e._id}>
						{curso?.codigo || 'Curso'} — Saldo: Bs {(e.saldo_pendiente || 0).toFixed(2)}
					</option>
				{/each}
			</Select>
		{/if}

		<!-- Detalle del pago (read-only info + editable) -->
		{#if selectedEnrollment}
			<div class="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-3 space-y-1 text-sm">
				<p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Estado de la inscripción</p>
				<p>
					<span class="text-gray-500">Matrícula pagada:</span>
					<span class="font-medium">{selectedEnrollment.matricula_pagada ? 'Sí' : 'No'}</span>
				</p>
				<p>
					<span class="text-gray-500">Saldo pendiente:</span>
					<span class="font-bold text-primary-600">Bs {(selectedEnrollment.saldo_pendiente || 0).toFixed(2)}</span>
				</p>
			</div>
		{/if}

		<!-- Concepto + Método -->
		<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
			<Input
				label="Concepto (opcional)"
				id="concepto"
				bind:value={concepto}
				placeholder="Vacío = glosa detallada (Pago Módulo 1)"
			/>
			<Select label="Método de Pago" id="metodoPago" bind:value={metodoPago}>
				{#each metodosDisponibles as m}
					<option value={m}>{m}</option>
				{/each}
			</Select>
		</div>

		<!-- Monto -->
		<Input
			label="Monto Pagado (Bs)"
			id="montoComprobante"
			type="number"
			step="0.01"
			min="1"
			bind:value={montoComprobante}
			required
		/>

		{#if requiereBancoYVoucher}
			<!-- Datos del voucher -->
			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input
					label="Nombre del Remitente"
					id="remitente"
					bind:value={remitente}
					required
					placeholder="Como figura en el voucher"
				/>
				<Select label="Banco / Cooperativa" id="banco" bind:value={banco} required>
					<option value="">— Selecciona —</option>
					<optgroup label="Bancos">
						{#each bancosDisponibles as b}
							<option value={b}>{b}</option>
						{/each}
					</optgroup>
					<optgroup label="Cooperativas">
						{#each cooperativasDisponibles as c}
							<option value={c}>{c}</option>
						{/each}
					</optgroup>
				</Select>
			</div>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
				<Input
					label="Nº de Transacción"
					id="numeroTransaccion"
					bind:value={numeroTransaccion}
					required
					placeholder="Solo números"
				/>
				<Input
					label="Fecha del Comprobante"
					id="fechaComprobante"
					type="date"
					bind:value={fechaComprobante}
					required
				/>
			</div>

			<div>
				<FileUpload
					id="comprobante_file"
					label="Comprobante (imagen o PDF)"
					accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
					{file}
					onFileSelect={(f) => (file = f)}
					loading={saving}
				/>
			</div>
		{:else}
			<div class="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/20 p-3">
				<p class="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1">
					<ExclamationCircleIcon class="size-3.5 shrink-0 mt-0.5" />
					<span>Pago en Caja Física. No requiere comprobante digital. Se registrará como APROBADO con Nº de transacción autogenerado.</span>
				</p>
			</div>
		{/if}
	</div>

	<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
		<Button variant="secondary" onclick={onCancel} disabled={saving}>Cancelar</Button>
		<Button onclick={handleSubmit} loading={saving} disabled={!selectedStudentId || !selectedEnrollmentId || !montoComprobante}>
			Registrar y Aprobar Pago
		</Button>
	</div>
</Modal>
