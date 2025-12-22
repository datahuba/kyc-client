<script lang="ts">
	//profile/+page.svelte
	import { userStore } from '$lib/stores/userStore';
	import { studentService, userService } from '$lib/services';
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { alert } from '$lib/utils';
	import { UserIcon, MailIcon, MapPinIcon, PhoneIcon, IdentificationIcon, AcademicCapIcon, PencilIcon, CheckIcon, XMarkIcon, DocumentAddIcon } from '$lib/icons/outline';
	import { BriefcaseIcon } from '$lib/icons/solid';
	import { FileUpload } from '$lib/components/ui';
	import DocumentRow from '$lib/components/ui/documentRow.svelte';
	import type { Student, UpdateStudentSelfRequest, TituloData } from '$lib/interfaces/student.interface';

	let loading = $state(false);
	let profileData: any = $state(null);
	let error = $state('');
	let editMode = $state(false);
	let uploadingPhoto = $state(false);
	let uploadingDoc = $state<string | null>(null);

	// Datos editables
	let editData = $state<UpdateStudentSelfRequest>({
		celular: '',
		domicilio: ''
	});

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
			if (role === 'student') {
				profileData = await studentService.getById(id);
				// Inicializar datos editables
				editData = {
					celular: profileData.celular || '',
					domicilio: profileData.domicilio || ''
				};
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

	function startEdit() {
		editMode = true;
		editData = {
			celular: profileData.celular || '',
			domicilio: profileData.domicilio || ''
		};
	}

	function cancelEdit() {
		editMode = false;
		editData = {
			celular: profileData.celular || '',
			domicilio: profileData.domicilio || ''
		};
	}

	async function saveChanges() {
		if (!$userStore.user?._id) return;
		
		loading = true;
		try {
			const updated = await studentService.updateSelf(editData);
			profileData = updated;
			editMode = false;
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

{#if $userStore.role === 'student'}
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
								<Input label="Email" value={profileData.email} disabled icon={MailIcon} />
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
								<Input label="Tipo de Estudiante" value={profileData.es_estudiante_interno === 'interno' ? 'Interno' : 'Externo'} disabled />
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
{:else}
<div>
	data de admin profile proceso
</div>
{/if}