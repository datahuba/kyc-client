<script lang="ts">
	import { onMount } from 'svelte';
	import { userStore } from '$lib/stores/userStore';
	import { studentService, userService } from '$lib/services';
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import { alert } from '$lib/utils';
	import { UserIcon, MailIcon, MapPinIcon, PhoneIcon, IdentificationIcon, AcademicCapIcon } from '$lib/icons/outline';
	import { BriefcaseIcon } from '$lib/icons/solid';
	import { FileUpload } from '$lib/components/ui';

	let loading = $state(false);
	let profileData: any = $state(null);
	let error = $state('');

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

		// Prevent double loading
		if (loading) return;

		// If we already have profile data and it matches the current user, don't reload unless necessary
		if (profileData && profileData._id === id) return;

		if (!id || !role) {
			if (!$userStore.loading) {
				error = 'No valid session found';
			}
			return;
		}

		// Optimization: For admin/staff roles, the userStore already has the necessary data.
		// We skip the API call entirely for instant loading.
		if (['admin', 'superadmin', 'secretary'].includes(role)) {
			profileData = $userStore.user;
			loading = false;
			return;
		}
		
		// For students, we need to fetch the full student profile (grades, docs, etc.)
		loading = true;
		error = '';
		try {
			if (role === 'student') {
				profileData = await studentService.getById(id);
			} else {
				// Fallback; should ideally use userStore as well
				profileData = $userStore.user; 
			}
		} catch (e: any) {
			console.error(e);
			error = e.message || 'Error al cargar perfil';
		} finally {
			loading = false;
		}
	}

	async function handleDocumentUpload(type: 'ci' | 'cv' | 'afiliacion' | 'titulo', file: File | null) {
		if (!file || !$userStore.user?._id) return;
		
		loading = true;
		try {
			const id = $userStore.user._id;
			if (type === 'ci') {
				await studentService.uploadCarnet(id, file);
			} else if (type === 'cv') {
				await studentService.uploadCV(id, file);
			} else if (type === 'afiliacion') {
				await studentService.uploadAfiliacion(id, file);
			} else if (type === 'titulo') {
				// Fallback or use existing metadata if available
				const titleData = profileData.titulo || { titulo: '', numero_titulo: '', año_expedicion: '', universidad: '' };
				await studentService.uploadTitulo(id, file, titleData);
			}
			alert('success', 'Documento subido correctamente');
			await loadProfile();
		} catch (e: any) {
			console.error(e);
			alert('error', 'Error al subir documento');
		} finally {
			loading = false;
		}
	}

</script>

<div class="space-y-6">
	<Heading level="h1">Mi Perfil</Heading>

	{#if loading}
		<div class="animate-pulse space-y-6">
			<div class="h-48 w-full bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
			<div class="grid gap-6 md:grid-cols-3">
				<div class="md:col-span-2 h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
				<div class="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
			</div>
		</div>
	{:else if error}
		<div class="p-4 bg-red-50 text-red-700 rounded-lg">
			{error}
		</div>
	{:else if profileData}
		<!-- Cover and Avatar Section (Student Only for now as User has no photo) -->
		{#if $userStore.role === 'student'}
			<div class="relative mb-16 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
				<div class="h-32 w-full bg-gradient-to-r from-primary-500 to-light-secondary"></div>
				<div class="absolute bottom-0 left-8 translate-y-1/2 transform">
					<div class="relative h-24 w-24 overflow-hidden rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-700 flex items-center justify-center text-gray-400">
						{#if profileData.foto_url}
							<img 
								src={profileData.foto_url} 
								alt="Avatar" 
								class="h-full w-full object-cover"
							/>
						{:else}
							<UserIcon class="size-12" />
						{/if}
					</div>
				</div>
				<div class="flex justify-end p-4 pt-2">
					<div class="text-sm text-gray-500">
						{#if profileData.activo}
							<span class="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
								Activo
							</span>
						{:else}
							<span class="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
								Inactivo
							</span>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<div class="grid gap-6 md:grid-cols-3">
			<!-- Main Info Column -->
			<div class="md:col-span-2 space-y-6">
				<Card>
					{#snippet header()}
						<Heading level="h4" class="text-lg font-semibold">Información General</Heading>
					{/snippet}
					
					<div class="grid gap-6 md:grid-cols-2">
						{#if $userStore.role === 'student'}
							<Input label="Nombre Completo" value={profileData.nombre} disabled />
							<Input label="Registro" value={profileData.registro} disabled />
							<Input label="Carnet" value={profileData.carnet} disabled icon={IdentificationIcon} />
							<Input label="Extensión" value={profileData.extension} disabled />
							<Input label="Fecha Nacimiento" value={new Date(profileData.fecha_nacimiento).toLocaleDateString()} disabled />
							<Input label="Tipo" value={profileData.es_estudiante_interno} disabled />
						{:else}
							<Input label="Username" value={profileData.username} disabled />
							<Input label="Rol" value={profileData.rol} disabled icon={BriefcaseIcon} />
						{/if}
						
						<Input label="Email" value={profileData.email} disabled icon={MailIcon} class="md:col-span-2" />
					</div>
				</Card>

				{#if $userStore.role === 'student' && profileData.titulo}
					<Card>
						{#snippet header()}
							<Heading level="h4" class="text-lg font-semibold">Información Académica (Título)</Heading>
						{/snippet}
						<div class="grid gap-6 md:grid-cols-2">
							<Input label="Título" value={profileData.titulo.titulo} disabled icon={AcademicCapIcon} />
							<Input label="Nº Título" value={profileData.titulo.numero_titulo} disabled />
							<Input label="Universidad" value={profileData.titulo.universidad} disabled />
							<Input label="Año" value={profileData.titulo.año_expedicion} disabled />
							<div class="md:col-span-2">
								<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado de Verificación</label>
								<span class={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
									profileData.titulo.estado === 'verificado' ? 'bg-green-100 text-green-800' :
									profileData.titulo.estado === 'rechazado' ? 'bg-red-100 text-red-800' :
									'bg-yellow-100 text-yellow-800'
								}`}>
									{profileData.titulo.estado || 'Pendiente'}
								</span>
							</div>
						</div>
					</Card>
				{/if}
			</div>

			<!-- Sidebar Info Column -->
			<div class="space-y-6">
				<Card>
					{#snippet header()}
						<Heading level="h4" class="text-lg font-semibold">Contacto y Detalles</Heading>
					{/snippet}
					<div class="space-y-4">
						{#if $userStore.role === 'student'}
							<Input label="Celular" value={profileData.celular} disabled icon={PhoneIcon} />
							<Input label="Domicilio" value={profileData.domicilio} disabled icon={MapPinIcon} />
						{:else}
							<Input label="Último Acceso" value={new Date(profileData.ultimo_acceso).toLocaleString()} disabled />
						{/if}
						<div class="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
							<div>
								<span class="text-xs text-gray-500 block">ID de Usuario</span>
								<span class="text-sm font-mono text-gray-700 dark:text-gray-300 break-all">{profileData._id}</span>
							</div>
							<div>
								<span class="text-xs text-gray-500 block">Creado el</span>
								<span class="text-sm text-gray-700 dark:text-gray-300">{new Date(profileData.created_at).toLocaleString()}</span>
							</div>
							<div>
								<span class="text-xs text-gray-500 block">Actualizado el</span>
								<span class="text-sm text-gray-700 dark:text-gray-300">{new Date(profileData.updated_at).toLocaleString()}</span>
							</div>
							{#if $userStore.role !== 'student'}
								<div>
									<span class="text-xs text-gray-500 block">Estado</span>
									<span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${profileData.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
										{profileData.activo ? 'Activo' : 'Inactivo'}
									</span>
								</div>
							{/if}
						</div>
					</div>
				</Card>
			</div>
		</div>


		{#if $userStore.role === 'student'}
			<!-- Documents Section -->
			<div class="space-y-6 ">
				<div class="">
					
						<Heading level="h4" class="text-lg font-semibold">Documentación</Heading>
					
					<div class="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
						<!-- Carnet -->
						<div class="flex flex-col items-center p-4 ">
							<IdentificationIcon class="size-8 text-blue-500 mb-2" />
							<span class="text-sm font-medium text-gray-900 dark:text-white mb-2">Carnet de Identidad</span>
							{#if profileData.ci_url}
								<a href={profileData.ci_url} target="_blank" class="text-xs text-primary-600 hover:underline">Ver PDF</a>
							{:else}
								<span class="text-xs text-red-500 mb-2">No tiene documento</span>
								<FileUpload 
									accept=".pdf" 
									onFileSelect={(f) => handleDocumentUpload('ci', f)} 
									label="Subir"
									
								/>
							{/if}
						</div>

						<!-- CV -->
						<div class="flex flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
							<svg class="size-8 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
							</svg>
							<span class="text-sm font-medium text-gray-900 dark:text-white mb-2">Curriculum Vitae</span>
							{#if profileData.cv_url}
								<a href={profileData.cv_url} target="_blank" class="text-xs text-primary-600 hover:underline">Ver PDF</a>
							{:else}
								<span class="text-xs text-red-500 mb-2">No tiene documento</span>
								<FileUpload 
									accept=".pdf" 
									onFileSelect={(f) => handleDocumentUpload('cv', f)} 
									label="Subir"
									
								/>
							{/if}
						</div>

						<!-- Afiliación -->
						<div class="flex flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
							<svg class="size-8 text-purple-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
							<span class="text-sm font-medium text-gray-900 dark:text-white mb-2">Afiliación</span>
							{#if profileData.afiliacion_url}
								<a href={profileData.afiliacion_url} target="_blank" class="text-xs text-primary-600 hover:underline">Ver PDF</a>
							{:else}
								<span class="text-xs text-red-500 mb-2">No tiene documento</span>
								<FileUpload 
									accept=".pdf" 
									onFileSelect={(f) => handleDocumentUpload('afiliacion', f)} 
									label="Subir"
								/>
							{/if}
						</div>

						<!-- Título -->
						<div class="flex flex-col items-center p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
							<AcademicCapIcon class="size-8 text-yellow-500 mb-2" />
							<span class="text-sm font-medium text-gray-900 dark:text-white mb-2">Título Profesional</span>
							{#if profileData.titulo?.titulo_url}
								<a href={profileData.titulo.titulo_url} target="_blank" class="text-xs text-primary-600 hover:underline">Ver PDF</a>
							{:else}
								<span class="text-xs text-red-500 mb-2">No tiene documento</span>
								<!-- Simple upload for title if metadata exists, otherwise this might fail validation on backend if it's strict, but user asked for upload. -->
								<FileUpload 
									accept=".pdf" 
									onFileSelect={(f) => handleDocumentUpload('titulo', f)} 
									label="Subir"
								/>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>
