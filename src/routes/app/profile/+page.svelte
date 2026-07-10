<script lang="ts">
	//profile/+page.svelte
	import { userStore } from '$lib/stores/userStore';
	import { studentService, userService, enrollmentService, courseService } from '$lib/services';
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { alert } from '$lib/utils';
	import { UserIcon, MailIcon, MapPinIcon, PhoneIcon, IdentificationIcon, AcademicCapIcon, PencilIcon, CheckIcon, XMarkIcon, DocumentAddIcon, DownloadIcon } from '$lib/icons/outline';
	import { BriefcaseIcon } from '$lib/icons/solid';
	import { FileUpload, Modal, Button, Select } from '$lib/components/ui';
	import DocumentRow from '$lib/components/ui/documentRow.svelte';
	import FormularioInscripcionModal from '$lib/features/enrollments/FormularioInscripcionModal.svelte';
	import type { Student, UpdateStudentSelfRequest, TituloData } from '$lib/interfaces/student.interface';
	import { authService } from '$lib/services';
	import { ExclamationCircleIcon } from '$lib/icons/solid';

	let loading = $state(false);
	let profileData: any = $state(null);
	let error = $state('');
	let editMode = $state(false);
	let uploadingPhoto = $state(false);
	let uploadingDoc = $state<string | null>(null);

	// ISSUE-A-VERIFICACION: no bloqueante, solo informativo
	let resendingVerification = $state(false);

	// Carga de Título Profesional desde el perfil. A diferencia de CV/Carnet/Afiliación,
	// el título lleva metadata (nombre, número, año, universidad) que el backend exige,
	// por eso se captura en un modal en vez de una subida directa de archivo.
	let showTituloModal = $state(false);
	let uploadingTitulo = $state(false);
	let tituloFile = $state<File | null>(null);
	let tituloForm = $state({ titulo: '', numero_titulo: '', año_expedicion: '', universidad: '' });
	let tituloErrors = $state<Record<string, string>>({});

	function abrirModalTitulo() {
		if (profileData?.titulo?.estado === 'verificado') {
			alert('error', 'No puedes actualizar un título ya verificado');
			return;
		}
		tituloForm = {
			titulo: profileData?.titulo?.titulo || '',
			numero_titulo: profileData?.titulo?.numero_titulo || '',
			año_expedicion: profileData?.titulo?.año_expedicion || '',
			universidad: profileData?.titulo?.universidad || ''
		};
		tituloFile = null;
		tituloErrors = {};
		showTituloModal = true;
	}

	async function submitTitulo() {
		const errs: Record<string, string> = {};
		if (!tituloForm.titulo.trim()) errs.titulo = 'El nombre del título es obligatorio';
		if (!tituloForm.numero_titulo.trim()) errs.numero_titulo = 'El número de título es obligatorio';
		if (!tituloForm.universidad.trim()) errs.universidad = 'La universidad es obligatoria';
		if (!tituloForm.año_expedicion.trim()) errs.año_expedicion = 'El año de expedición es obligatorio';
		if (!tituloFile && !profileData?.titulo?.titulo_url) errs.file = 'Debes adjuntar el documento del título';
		tituloErrors = errs;
		if (Object.keys(errs).length > 0) return;

		const id = $userStore.user?._id;
		if (!id) return;

		// Si no se seleccionó archivo nuevo pero ya existe uno, no hay nada que subir aquí
		// (este modal siempre re-sube; exigimos archivo salvo que ya exista y solo se editen datos,
		// pero el endpoint requiere el archivo, así que pedimos uno si no hay URL previa).
		if (!tituloFile) {
			alert('error', 'Selecciona el archivo del título para actualizar');
			return;
		}

		uploadingTitulo = true;
		try {
			const updated = await studentService.uploadTitulo(id, tituloFile, {
				titulo: tituloForm.titulo.trim(),
				numero_titulo: tituloForm.numero_titulo.trim(),
				año_expedicion: tituloForm.año_expedicion.trim(),
				universidad: tituloForm.universidad.trim()
			});
			profileData = updated;
			showTituloModal = false;
			alert('success', 'Título subido correctamente. Quedará pendiente de verificación por CPD.');
		} catch (e: any) {
			console.error(e);
			alert('error', 'Error al subir el título');
		} finally {
			uploadingTitulo = false;
		}
	}

	// ISSUE-Q-DOCUMENTOS-KYC (2026-07-09): el estudiante sube sus documentos
	// requeridos (definidos por el curso) directamente desde su perfil; al
	// subirlos quedan "en revisión" para que CPD/Encargado de Curso los apruebe.
	let misEnrollments = $state<any[]>([]);
	let coursesMapProfile = $state<Record<string, string>>({});
	// clave: `${enrollmentId}-${index}` -> bool (loading)
	let subiendoReq = $state<Record<string, boolean>>({});
	let reqInputEls = $state<Record<string, HTMLInputElement | null>>({});

	// Formulario de inscripción: modal editable en línea + subida del lleno
	let formularioModalOpen = $state(false);
	let formularioPrograma = $state('');
	let subiendoFormulario = $state<Record<string, boolean>>({});
	let formularioInputEls = $state<Record<string, HTMLInputElement | null>>({});

	function abrirFormularioModal(programa: string) {
		formularioPrograma = programa;
		formularioModalOpen = true;
	}

	function triggerFormularioUpload(enrollmentId: string) {
		formularioInputEls[enrollmentId]?.click();
	}

	async function handleFormularioUpload(event: Event, enrollmentId: string) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		subiendoFormulario[enrollmentId] = true;
		try {
			const actualizado = await enrollmentService.uploadFormularioInscripcion(enrollmentId, file);
			misEnrollments = misEnrollments.map((e) => (e._id === enrollmentId ? { ...e, ...actualizado } : e));
			alert('success', 'Formulario de inscripción subido correctamente.');
		} catch (e: any) {
			console.error(e);
			alert('error', e?.message || 'No se pudo subir el formulario.');
		} finally {
			subiendoFormulario[enrollmentId] = false;
			if (input) input.value = '';
		}
	}

	async function cargarDocumentosEstudiante(studentId: string) {
		try {
			const [enr, cursos] = await Promise.all([
				enrollmentService.getByStudentId(studentId),
				courseService.getAll(1, 100).catch(() => ({ data: [] }))
			]);
			misEnrollments = Array.isArray(enr) ? enr : ((enr as any).data ?? []);
			const mapa: Record<string, string> = {};
			for (const c of (cursos.data ?? [])) mapa[c._id] = c.nombre_programa;
			coursesMapProfile = mapa;
		} catch (e) {
			console.error('Error cargando documentos del estudiante', e);
		}
	}

	function triggerReqUpload(enrollmentId: string, index: number) {
		reqInputEls[`${enrollmentId}-${index}`]?.click();
	}

	async function handleReqUpload(event: Event, enrollmentId: string, index: number) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		const key = `${enrollmentId}-${index}`;
		subiendoReq[key] = true;
		try {
			const updatedReq = await enrollmentService.subirRequisito(enrollmentId, index, file);
			// Actualizar el requisito en la inscripción local sin recargar todo
			misEnrollments = misEnrollments.map((e) => {
				if (e._id !== enrollmentId) return e;
				const nuevos = [...(e.requisitos || [])];
				nuevos[index] = updatedReq;
				return { ...e, requisitos: nuevos };
			});
			alert('success', 'Documento subido. Quedó pendiente de revisión por CPD.');
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo subir el documento');
		} finally {
			subiendoReq[key] = false;
			input.value = '';
		}
	}

	// Datos editables
	let editData = $state<UpdateStudentSelfRequest>({
		celular: '',
		domicilio: ''
	});

	// Snapshot editable del perfil actual (incluye datos oficiales UAGRM que el
	// estudiante ahora puede completar/editar él mismo — reunión 2026-07-09).
	function buildEditData(): UpdateStudentSelfRequest {
		return {
			celular: profileData?.celular || '',
			domicilio: profileData?.domicilio || '',
			telefono: profileData?.telefono || '',
			sexo: profileData?.sexo || '',
			estado_civil: profileData?.estado_civil || '',
			tipo_sangre: profileData?.tipo_sangre || '',
			pais: profileData?.pais || '',
			departamento: profileData?.departamento || '',
			provincia: profileData?.provincia || '',
			nacionalidad: profileData?.nacionalidad || '',
			modalidad_ingreso: profileData?.modalidad_ingreso || '',
			periodo: profileData?.periodo || '',
			titulo_bachiller: profileData?.titulo_bachiller || ''
		};
	}

	$effect(() => {
		if ($userStore.isAuthenticated && $userStore.user?._id && !profileData && !loading) {
			loadProfile();
		} else if ($userStore.loading) {
			// Wait for store to load
		} else if (!$userStore.loading && !$userStore.isAuthenticated) {
			error = 'No valid session found';
			loading = false;
		}
	});

	async function loadProfile() {
		const id = $userStore.user?._id;
		const role = $userStore.role;

		if (loading) return;
		if (profileData && profileData._id === id) return;

		if (!id || !role) {
			if (!$userStore.loading) {
				error = 'No valid session found';
			}
			return;
		}

		if (['admin', 'superadmin', 'secretary'].includes(role)) {
			profileData = $userStore.user;
			loading = false;
			return;
		}
		
		loading = true;
		error = '';
		try {
			if ((role as string) === 'student') {
				profileData = await studentService.getById(id);
				// Inicializar datos editables
				editData = buildEditData();
				// ISSUE-Q-DOCUMENTOS-KYC: cargar sus inscripciones para mostrar documentos requeridos
				await cargarDocumentosEstudiante(id);
			} else {
				profileData = $userStore.user; 
			}
		} catch (e: any) {
			console.error(e);
			error = e.message || 'Error al cargar perfil';
		} finally {
			loading = false;
		}
	}

	// ISSUE-A-VERIFICACION: reenvío manual desde el perfil. No bloqueante --
	// si falla o el usuario nunca lo hace, el sistema sigue funcionando igual.
	async function handleResendVerification() {
		if (resendingVerification) return;
		resendingVerification = true;
		try {
			const res = await authService.resendVerification();
			alert(res.enviado === false ? 'warning' : 'success', res.message);
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar el correo de verificación');
		} finally {
			resendingVerification = false;
		}
	}

	function startEdit() {
		editMode = true;
		editData = buildEditData();
	}

	function cancelEdit() {
		editMode = false;
		editData = buildEditData();
	}

	// Edición independiente de los Datos Oficiales UAGRM por el propio estudiante.
	let editOficial = $state(false);
	function startEditOficial() {
		editOficial = true;
		editData = buildEditData();
	}
	function cancelEditOficial() {
		editOficial = false;
		editData = buildEditData();
	}

	async function saveChanges() {
		if (!$userStore.user?._id) return;
		
		loading = true;
		try {
			const updated = await studentService.updateSelf(editData);
			profileData = updated;
			editMode = false;
			editOficial = false;
			alert('success', 'Datos actualizados correctamente');
		} catch (e: any) {
			console.error(e);
			alert('error', e.message || 'Error al actualizar datos');
		} finally {
			loading = false;
		}
	}

	async function handlePhotoUpload(file: File | null) {
		if (!file || !$userStore.user?._id) return;
		
		uploadingPhoto = true;
		try {
			const updated = await studentService.uploadPhoto($userStore.user._id, file);
			profileData = updated;
			alert('success', 'Foto actualizada correctamente');
		} catch (e: any) {
			console.error(e);
			alert('error', 'Error al actualizar foto');
		} finally {
			uploadingPhoto = false;
		}
	}

	async function handleDocumentUpload(type: 'ci' | 'cv' | 'afiliacion' | 'titulo', file: File | null) {
		if (!file || !$userStore.user?._id) return;
		
		// Validar que el título no esté verificado si se intenta subir
		if (type === 'titulo' && profileData.titulo?.estado === 'verificado') {
			alert('error', 'No puedes actualizar un título ya verificado');
			return;
		}

		uploadingDoc = type;
		try {
			const id = $userStore.user._id;
			let updated: Student;
			
			if (type === 'ci') {
				updated = await studentService.uploadCarnet(id, file);
			} else if (type === 'cv') {
				updated = await studentService.uploadCV(id, file);
			} else if (type === 'afiliacion') {
				updated = await studentService.uploadAfiliacion(id, file);
			} else if (type === 'titulo') {
				const titleData: TituloData = profileData.titulo || { 
					titulo: '', 
					numero_titulo: '', 
					año_expedicion: '', 
					universidad: '' 
				};
				updated = await studentService.uploadTitulo(id, file, titleData);
			} else {
				return;
			}
			
			profileData = updated;
			alert('success', 'Documento subido correctamente');
		} catch (e: any) {
			console.error(e);
			alert('error', 'Error al subir documento');
		} finally {
			uploadingDoc = null;
		}
	}

	function getDocumentStatus(url: string | null | undefined): 'success' | 'warning' {
		return url ? 'success' : 'warning';
	}
</script>

{#if ($userStore.role as string) === 'student'}
	<div class="space-y-6 pb-8">
		<div class="flex items-center justify-between">
			<Heading level="h1">Mi Perfil</Heading>
		</div>

		{#if loading && !profileData}
			<div class="animate-pulse space-y-6">
				<div class="h-48 w-full bg-gray-200 dark:bg-dark-surface rounded-xl"></div>
				<div class="grid gap-6 lg:grid-cols-3">
					<div class="lg:col-span-2 h-96 bg-gray-200 dark:bg-dark-surface rounded-lg"></div>
					<div class="h-96 bg-gray-200 dark:bg-dark-surface rounded-lg"></div>
				</div>
			</div>
		{:else if error}
			<Card>
				<div class="p-6 text-center">
					<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-light-error/10 dark:bg-dark-error/10 mb-4">
						<XMarkIcon class="h-6 w-6 text-light-error dark:text-dark-error" />
					</div>
					<p class="text-gray-900 dark:text-dark-white font-medium mb-1">Error al cargar perfil</p>
					<p class="text-sm text-gray-500 dark:text-gray-400">{error}</p>
				</div>
			</Card>
		{:else if profileData}
			<!-- Hero Section con Avatar y Estado -->
			<div class="relative rounded-xl overflow-hidden bg-gradient-to-br from-light-secondary via-light-tertiary to-light-secondary_d dark:from-dark-secondary dark:via-dark-tertiary dark:to-dark-secondary_d shadow-lg">
				<div class="absolute inset-0 bg-black/10"></div>
				<div class="relative px-6 py-8 sm:px-8 sm:py-12">
					<div class="flex flex-col sm:flex-row items-center sm:items-end gap-6">
						<!-- Avatar -->
						<div class="relative group">
							<div class="relative h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-2xl border-4 border-white dark:border-dark-surface shadow-xl bg-white dark:bg-dark-surface">
								{#if uploadingPhoto}
									<div class="absolute inset-0 flex items-center justify-center bg-black/50">
										<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
									</div>
								{:else if profileData.foto_url}
									<img 
										src={profileData.foto_url} 
										alt="Avatar" 
										class="h-full w-full object-cover"
									/>
								{:else}
									<div class="h-full w-full flex items-center justify-center text-gray-400">
										<UserIcon class="h-16 w-16" />
									</div>
								{/if}
							</div>
							<!-- Upload Photo Button -->
							<div class="absolute -bottom-2 -right-2 z-10">
								<FileUpload 
									accept="image/*" 
									onFileSelect={handlePhotoUpload}
									label=""
									disabled={uploadingPhoto}
								>
									<button 
										class="p-2 bg-white dark:bg-dark-surface rounded-full shadow-lg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface_hover transition-colors"
										title="Cambiar foto"
										type="button"
									>
										<PencilIcon class="h-4 w-4 text-gray-700 dark:text-dark-white" />
									</button>
								</FileUpload>
							</div>
						</div>

						<!-- Info -->
						<div class="flex-1 text-center sm:text-left">
							<h2 class="text-2xl sm:text-3xl font-bold text-white mb-2">{profileData.nombre}</h2>
							<div class="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-white/90">
								<div class="flex items-center gap-1.5 text-sm">
									<IdentificationIcon class="h-4 w-4" />
									<span>Registro: {profileData.registro}</span>
								</div>
								<span class="hidden sm:inline">•</span>
								<div class="flex items-center gap-1.5 text-sm">
									<span class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
										profileData.activo 
											? 'bg-light-success/20 text-white border border-white/20' 
											: 'bg-light-error/20 text-white border border-white/20'
									}`}>
										{profileData.activo ? 'Activo' : 'Inactivo'}
									</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="grid gap-6 lg:grid-cols-3">
				<!-- Columna Principal -->
				<div class="lg:col-span-2 space-y-6">
					<!-- Información Personal -->
					<Card>
						{#snippet header()}
							<div class="flex items-center justify-between">
								<Heading level="h4" class="text-lg font-semibold">Información Personal</Heading>
								{#if !editMode}
									<button 
										onclick={startEdit}
										class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-light-secondary dark:text-dark-secondary hover:bg-light-primary dark:hover:bg-dark-surface rounded-lg transition-colors"
									>
										<PencilIcon class="h-4 w-4" />
										<span>Editar</span>
									</button>
								{/if}
							</div>
						{/snippet}
						
						<div class="space-y-6">
							<div class="grid gap-6 sm:grid-cols-2">
								<Input label="Nombre Completo" value={profileData.nombre} disabled />
								<div>
									<Input label="Email" value={profileData.email} disabled icon={MailIcon} />
									<!-- ISSUE-A-VERIFICACION: aviso no bloqueante, solo informativo -->
									{#if profileData.email && !profileData.email_verificado}
										<p class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-light-warning dark:text-dark-warning">
											<ExclamationCircleIcon class="size-3.5 shrink-0" />
											Correo sin verificar.
											<button
												type="button"
												onclick={handleResendVerification}
												disabled={resendingVerification}
												class="font-semibold underline hover:no-underline disabled:opacity-50"
											>
												{resendingVerification ? 'Enviando...' : 'Reenviar enlace'}
											</button>
										</p>
									{:else if profileData.email && profileData.email_verificado}
										<p class="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-light-success dark:text-dark-success">
											<CheckIcon class="size-3.5 shrink-0" />
											Correo verificado
										</p>
									{/if}
								</div>
								<Input label="Carnet" value={profileData.carnet} disabled icon={IdentificationIcon} />
								<Input label="Extensión" value={profileData.extension} disabled />
								<Input 
									label="Fecha de Nacimiento" 
									value={new Date(profileData.fecha_nacimiento).toLocaleDateString('es-BO', { 
										year: 'numeric', 
										month: 'long', 
										day: 'numeric' 
									})} 
									disabled 
								/>
							</div>

							<div class="border-t border-gray-200 dark:border-dark-border pt-6">
								<p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Información de Contacto (Editable)</p>
								<div class="grid gap-6 sm:grid-cols-2">
									<Input 
										label="Celular" 
										bind:value={editData.celular}
										disabled={!editMode}
										icon={PhoneIcon}
									/>
									<Input 
										label="Domicilio" 
										bind:value={editData.domicilio}
										disabled={!editMode}
										icon={MapPinIcon}
										class="sm:col-span-2"
									/>
								</div>
							</div>

							{#if editMode}
								<div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-border">
									<button 
										onclick={cancelEdit}
										class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg transition-colors"
										disabled={loading}
									>
										Cancelar
									</button>
									<button 
										onclick={saveChanges}
										class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors disabled:opacity-50"
										disabled={loading}
									>
										{#if loading}
											<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
										{:else}
											<CheckIcon class="h-4 w-4" />
										{/if}
										<span>Guardar Cambios</span>
									</button>
								</div>
							{/if}
						</div>
					</Card>

					<!-- Datos Oficiales UAGRM -->
					<Card>
						{#snippet header()}
							<div class="flex items-center justify-between w-full">
								<Heading level="h4" class="text-lg font-semibold">Datos Oficiales (UAGRM)</Heading>
								{#if !editOficial}
									<button
										onclick={startEditOficial}
										class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-light-secondary dark:text-dark-secondary hover:bg-light-primary dark:hover:bg-dark-surface rounded-lg transition-colors"
									>
										<PencilIcon class="h-4 w-4" />
										<span>Editar</span>
									</button>
								{/if}
							</div>
						{/snippet}

						{#if editOficial}
							<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
								Completa tus datos oficiales. Esta información será revisada por la unidad de posgrado.
							</p>
							<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								<Select label="Sexo" bind:value={editData.sexo}>
									<option value="">— Seleccione —</option>
									<option value="masculino">Masculino</option>
									<option value="femenino">Femenino</option>
								</Select>
								<Select label="Estado Civil" bind:value={editData.estado_civil}>
									<option value="">— Seleccione —</option>
									<option value="soltero">Soltero(a)</option>
									<option value="casado">Casado(a)</option>
									<option value="divorciado">Divorciado(a)</option>
									<option value="viudo">Viudo(a)</option>
									<option value="otro">Otro</option>
								</Select>
								<Select label="Tipo de Sangre" bind:value={editData.tipo_sangre}>
									<option value="">— Seleccione —</option>
									<option value="A+">A+</option>
									<option value="A-">A-</option>
									<option value="B+">B+</option>
									<option value="B-">B-</option>
									<option value="AB+">AB+</option>
									<option value="AB-">AB-</option>
									<option value="O+">O+</option>
									<option value="O-">O-</option>
								</Select>
								<Input label="Teléfono" bind:value={editData.telefono} icon={PhoneIcon} inputmode="numeric" pattern="[0-9]*" placeholder="Solo números" />
								<Input label="Nacionalidad" bind:value={editData.nacionalidad} />
								<Input label="País" bind:value={editData.pais} />
								<Input label="Departamento" bind:value={editData.departamento} />
								<Input label="Provincia" bind:value={editData.provincia} />
								<Input label="Modalidad de Ingreso" bind:value={editData.modalidad_ingreso} />
								<Input label="Periodo" bind:value={editData.periodo} />
								<Input label="Título de Bachiller" bind:value={editData.titulo_bachiller} />
							</div>
							<div class="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-gray-200 dark:border-dark-border">
								<button
									onclick={cancelEditOficial}
									class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-surface rounded-lg transition-colors"
									disabled={loading}
								>
									Cancelar
								</button>
								<button
									onclick={saveChanges}
									class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors disabled:opacity-50"
									disabled={loading}
								>
									{#if loading}
										<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
									{:else}
										<CheckIcon class="h-4 w-4" />
									{/if}
									<span>Guardar Cambios</span>
								</button>
							</div>
						{:else}
							<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
								<Input label="Sexo" value={profileData.sexo || '—'} disabled />
								<Input label="Estado Civil" value={profileData.estado_civil || '—'} disabled />
								<Input label="Tipo de Sangre" value={profileData.tipo_sangre || '—'} disabled />
								<Input label="Teléfono" value={profileData.telefono || '—'} disabled icon={PhoneIcon} />
								<Input label="Nacionalidad" value={profileData.nacionalidad || '—'} disabled />
								<Input label="País" value={profileData.pais || '—'} disabled />
								<Input label="Departamento" value={profileData.departamento || '—'} disabled />
								<Input label="Provincia" value={profileData.provincia || '—'} disabled />
								<Input label="Modalidad de Ingreso" value={profileData.modalidad_ingreso || '—'} disabled />
								<Input label="Periodo" value={profileData.periodo || '—'} disabled />
								<Input label="Título de Bachiller" value={profileData.titulo_bachiller || '—'} disabled />
							</div>
						{/if}
					</Card>

					<!-- ISSUE-Q-DOCUMENTOS-GENERAL (2026-07-09): documentos generales del
					     estudiante (CV, Carnet, Afiliación). Opcionales, iguales para
					     TODOS los perfiles de estudiante, independientes del curso. -->
					<Card>
						{#snippet header()}
							<Heading level="h4" class="text-lg font-semibold">Mis Documentos</Heading>
						{/snippet}

						<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
							Sube tus documentos personales (opcional). Formatos permitidos: PDF o imagen.
						</p>

						<div class="space-y-3">
							{#each [{ tipo: 'cv', label: 'Curriculum Vitae (CV)', url: profileData.cv_url }, { tipo: 'ci', label: 'Carnet de Identidad', url: profileData.ci_url }, { tipo: 'afiliacion', label: 'Certificado de Afiliación (Colegio o convenios)', url: profileData.afiliacion_url }] as doc}
								<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-dark-border pb-3 last:border-b-0 last:pb-0">
									<div class="min-w-0">
										<p class="text-sm font-medium text-gray-900 dark:text-white">{doc.label}</p>
										<div class="mt-1 flex items-center gap-2">
											{#if doc.url}
												<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-success/15 text-light-success dark:bg-dark-success/20 dark:text-dark-success">Cargado</span>
												<a href={doc.url} target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-light-secondary dark:text-dark-secondary hover:underline">Ver documento</a>
											{:else}
												<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Sin subir</span>
											{/if}
										</div>
									</div>
									<div class="shrink-0">
										<FileUpload
											accept="application/pdf,image/*"
											onFileSelect={(f) => handleDocumentUpload(doc.tipo as 'ci' | 'cv' | 'afiliacion', f)}
											label=""
											preview={false}
											disabled={uploadingDoc === doc.tipo}
										>
											<button
												type="button"
												class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors disabled:opacity-50"
												disabled={uploadingDoc === doc.tipo}
											>
												{#if uploadingDoc === doc.tipo}
													<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
												{:else}
													<DocumentAddIcon class="h-4 w-4" />
												{/if}
												<span>{doc.url ? 'Reemplazar' : 'Subir'}</span>
											</button>
										</FileUpload>
									</div>
								</div>
							{/each}

							<!-- Título Profesional: lleva metadata, se sube desde un modal -->
							<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-dark-border pb-3 last:border-b-0 last:pb-0">
								<div class="min-w-0">
									<p class="text-sm font-medium text-gray-900 dark:text-white">Título Profesional</p>
									<div class="mt-1 flex flex-wrap items-center gap-2">
										{#if profileData.titulo?.titulo_url}
											{#if profileData.titulo.estado === 'verificado'}
												<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-success/15 text-light-success dark:bg-dark-success/20 dark:text-dark-success">Verificado</span>
											{:else if profileData.titulo.estado === 'rechazado'}
												<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error">Rechazado</span>
											{:else}
												<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-warning/15 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning">En verificación</span>
											{/if}
											<a href={profileData.titulo.titulo_url} target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-light-secondary dark:text-dark-secondary hover:underline">Ver documento</a>
										{:else}
											<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Sin subir</span>
										{/if}
									</div>
									{#if profileData.titulo?.estado === 'rechazado' && profileData.titulo?.motivo_rechazo}
										<p class="mt-1 text-xs text-light-error dark:text-dark-error">Motivo: {profileData.titulo.motivo_rechazo}</p>
									{/if}
								</div>
								{#if profileData.titulo?.estado !== 'verificado'}
									<div class="shrink-0">
										<button
											type="button"
											onclick={abrirModalTitulo}
											class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors"
										>
											<DocumentAddIcon class="h-4 w-4" />
											<span>{profileData.titulo?.titulo_url ? 'Reemplazar' : 'Subir'}</span>
										</button>
									</div>
								{/if}
							</div>
						</div>
					</Card>

					<!-- ISSUE-Q-DOCUMENTOS-KYC: Documentos requeridos por cada curso inscrito.
					     El estudiante los sube desde aquí; quedan "en revisión" hasta que
					     CPD/Encargado de Curso los apruebe o rechace. -->
					{#each misEnrollments.filter((e) => (e.requisitos?.length ?? 0) > 0) as enr (enr._id)}
						<Card>
							{#snippet header()}
								<Heading level="h4" class="text-lg font-semibold">
									Documentos Requeridos — {coursesMapProfile[enr.curso_id] || 'Curso'}
								</Heading>
							{/snippet}

							<div class="space-y-3">
								{#each enr.requisitos as req, reqIndex}
									<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-dark-border pb-3 last:border-b-0 last:pb-0">
										<div class="min-w-0">
											<p class="text-sm font-medium text-gray-900 dark:text-white">{req.descripcion}</p>
											<div class="mt-1 flex flex-wrap items-center gap-2">
												{#if req.estado === 'pendiente'}
													<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Sin subir</span>
												{:else if req.estado === 'en_proceso'}
													<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-warning/15 text-light-warning dark:bg-dark-warning/20 dark:text-dark-warning">En revisión</span>
												{:else if req.estado === 'aprobado'}
													<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-success/15 text-light-success dark:bg-dark-success/20 dark:text-dark-success">Aprobado</span>
												{:else if req.estado === 'rechazado'}
													<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-error/15 text-light-error dark:bg-dark-error/20 dark:text-dark-error">Rechazado</span>
												{/if}
												{#if req.url}
													<a href={req.url} target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-light-secondary dark:text-dark-secondary hover:underline">Ver documento</a>
												{/if}
											</div>
											{#if req.estado === 'rechazado' && req.motivo_rechazo}
												<p class="mt-1 text-xs text-light-error dark:text-dark-error">Motivo: {req.motivo_rechazo}</p>
											{/if}
										</div>
										{#if req.estado !== 'aprobado'}
											<div class="shrink-0">
												<input
													bind:this={reqInputEls[`${enr._id}-${reqIndex}`]}
													type="file"
													accept="application/pdf,image/*"
													class="hidden"
													onchange={(e) => handleReqUpload(e, enr._id, reqIndex)}
												/>
												<button
													type="button"
													onclick={() => triggerReqUpload(enr._id, reqIndex)}
													disabled={subiendoReq[`${enr._id}-${reqIndex}`]}
													class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors disabled:opacity-50"
												>
													{#if subiendoReq[`${enr._id}-${reqIndex}`]}
														<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
													{:else}
														<DocumentAddIcon class="h-4 w-4" />
													{/if}
													<span>{req.url ? 'Reemplazar' : 'Subir'}</span>
												</button>
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</Card>
					{/each}

					<!-- Formulario de Inscripción oficial (por programa) -->
					{#each misEnrollments as enr (enr._id + '-form')}
						<Card>
							{#snippet header()}
								<Heading level="h4" class="text-lg font-semibold">
									Formulario de Inscripción — {coursesMapProfile[enr.curso_id] || 'Curso'}
								</Heading>
							{/snippet}

							<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
								Descarga el formulario oficial, llénalo y súbelo. También puedes llenarlo en línea y
								guardarlo como PDF. Formatos para subir: PDF o imagen.
							</p>

							<div class="flex flex-wrap items-center gap-2 mb-3">
								{#if enr.formulario_inscripcion_url}
									<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-light-success/15 text-light-success dark:bg-dark-success/20 dark:text-dark-success">Cargado</span>
									<a href={enr.formulario_inscripcion_url} target="_blank" rel="noopener noreferrer" class="text-xs font-medium text-light-secondary dark:text-dark-secondary hover:underline">Ver documento</a>
								{:else}
									<span class="inline-block px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">Sin subir</span>
								{/if}
							</div>

							<div class="flex flex-wrap gap-2">
								<a
									href="/formularios/formulario-inscripcion.docx"
									download
									class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-light-secondary dark:text-dark-secondary border border-light-secondary/40 dark:border-dark-secondary/40 hover:bg-light-primary dark:hover:bg-dark-surface rounded-lg transition-colors"
								>
									<DownloadIcon class="h-4 w-4" />
									<span>Descargar plantilla</span>
								</a>
								<button
									type="button"
									onclick={() => abrirFormularioModal(coursesMapProfile[enr.curso_id] || '')}
									class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-light-secondary dark:text-dark-secondary border border-light-secondary/40 dark:border-dark-secondary/40 hover:bg-light-primary dark:hover:bg-dark-surface rounded-lg transition-colors"
								>
									<PencilIcon class="h-4 w-4" />
									<span>Llenar en línea</span>
								</button>
								<input
									bind:this={formularioInputEls[enr._id]}
									type="file"
									accept="application/pdf,image/*"
									class="hidden"
									onchange={(e) => handleFormularioUpload(e, enr._id)}
								/>
								<button
									type="button"
									onclick={() => triggerFormularioUpload(enr._id)}
									disabled={subiendoFormulario[enr._id]}
									class="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-light-secondary dark:bg-dark-secondary hover:bg-light-secondary_d dark:hover:bg-dark-secondary_d rounded-lg transition-colors disabled:opacity-50"
								>
									{#if subiendoFormulario[enr._id]}
										<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
									{:else}
										<DocumentAddIcon class="h-4 w-4" />
									{/if}
									<span>{enr.formulario_inscripcion_url ? 'Reemplazar' : 'Subir formulario'}</span>
								</button>
							</div>
						</Card>
					{/each}

					<!-- Información Académica -->
					{#if profileData.titulo}
						<Card>
							{#snippet header()}
								<Heading level="h4" class="text-lg font-semibold">Título Profesional</Heading>
							{/snippet}
							
							<div class="space-y-4">
								<div class="grid gap-6 sm:grid-cols-2">
									<Input label="Título" value={profileData.titulo.titulo} disabled icon={AcademicCapIcon} />
									<Input label="Número de Título" value={profileData.titulo.numero_titulo} disabled />
									<Input label="Universidad" value={profileData.titulo.universidad} disabled class="sm:col-span-2" />
									<Input label="Año de Expedición" value={profileData.titulo.año_expedicion} disabled />
								</div>

								<div class="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-dark-border">
									<div>
										<p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de Verificación</p>
										<span class={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
											profileData.titulo.estado === 'verificado' 
												? 'bg-light-success/10 text-light-success dark:bg-dark-success/10 dark:text-dark-success' :
											profileData.titulo.estado === 'rechazado' 
												? 'bg-light-error/10 text-light-error dark:bg-dark-error/10 dark:text-dark-error' :
												'bg-light-warning/10 text-light-warning dark:bg-dark-warning/10 dark:text-dark-warning'
										}`}>
											{profileData.titulo.estado === 'verificado' ? '✓ Verificado' :
											 profileData.titulo.estado === 'rechazado' ? '✗ Rechazado' :
											 '⏳ Pendiente'}
										</span>
									</div>
									{#if profileData.titulo.titulo_url}
										<a 
											href={profileData.titulo.titulo_url} 
											target="_blank"
											class="text-sm font-medium text-light-secondary dark:text-dark-secondary hover:underline"
										>
											Ver Documento →
										</a>
									{/if}
								</div>
							</div>
						</Card>
					{/if}
				</div>

				<!-- Sidebar -->
				<div class="space-y-6">				
					<!-- Información del Sistema -->
					<Card>
						{#snippet header()}
							<Heading level="h4" class="text-lg font-semibold">Información del Sistema</Heading>
						{/snippet}
						
						<div class="space-y-3 text-sm">
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400 mb-1">ID de Usuario</p>
								<p class="font-mono text-xs text-gray-700 dark:text-gray-300 break-all bg-gray-50 dark:bg-dark-surface p-2 rounded">{profileData._id}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha de Registro</p>
								<p class="text-gray-700 dark:text-gray-300">{new Date(profileData.created_at).toLocaleDateString('es-BO', { 
									year: 'numeric', 
									month: 'long', 
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}</p>
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Última Actualización</p>
								<p class="text-gray-700 dark:text-gray-300">{new Date(profileData.updated_at).toLocaleDateString('es-BO', { 
									year: 'numeric', 
									month: 'long', 
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}</p>
							</div>
						</div>
					</Card>
				</div>
			</div>
		{/if}
	</div>

	<!-- Modal de carga de Título Profesional -->
	<Modal isOpen={showTituloModal} title="Subir Título Profesional" onClose={() => (showTituloModal = false)} maxWidth="sm:max-w-lg">
		<div class="space-y-4">
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Completa los datos de tu título y adjunta el documento (PDF o imagen). Quedará
				pendiente de verificación por CPD.
			</p>

			<Input label="Nombre del Título *" bind:value={tituloForm.titulo} error={tituloErrors.titulo} placeholder="Ej. Licenciatura en Contaduría Pública" />
			<div class="grid gap-4 sm:grid-cols-2">
				<Input label="Número de Título *" bind:value={tituloForm.numero_titulo} error={tituloErrors.numero_titulo} />
				<Input label="Año de Expedición *" bind:value={tituloForm.año_expedicion} error={tituloErrors.año_expedicion} placeholder="Ej. 2020" />
			</div>
			<Input label="Universidad *" bind:value={tituloForm.universidad} error={tituloErrors.universidad} />

			<div>
				<p class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Documento del Título *</p>
				<FileUpload
					accept="application/pdf,image/*"
					onFileSelect={(f) => (tituloFile = f)}
					label=""
					preview={false}
				/>
				{#if tituloFile}
					<p class="mt-1 text-xs text-light-success dark:text-dark-success">Archivo seleccionado: {tituloFile.name}</p>
				{/if}
				{#if tituloErrors.file}
					<p class="mt-1 text-xs text-light-error dark:text-dark-error">{tituloErrors.file}</p>
				{/if}
			</div>

			<div class="flex justify-end gap-3 pt-2">
				<Button variant="secondary" onclick={() => (showTituloModal = false)} disabled={uploadingTitulo}>Cancelar</Button>
				<Button onclick={submitTitulo} disabled={uploadingTitulo}>
					{uploadingTitulo ? 'Subiendo...' : 'Subir Título'}
				</Button>
			</div>
		</div>
	</Modal>

	<!-- Modal editable del Formulario de Inscripción -->
	<FormularioInscripcionModal
		isOpen={formularioModalOpen}
		programa={formularioPrograma}
		student={profileData}
		onClose={() => (formularioModalOpen = false)}
	/>
{:else}
<div>
	data de admin profile proceso
</div>
{/if}