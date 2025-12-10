<script lang="ts">
	import type { Student, TituloData } from '$lib/interfaces';
	import { studentService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import PdfPreview from '$lib/components/ui/PdfPreview.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon, XIcon, DownloadIcon, UserIcon, IdentificationIcon, AcademicCapIcon, CollectionIcon, FileTextIcon, LoaderIcon } from '$lib/icons/outline';

	interface Props {
		student: Student;
		onClose: () => void;
		onUpdate: () => void;
	}

	let { student = $bindable(), onClose, onUpdate }: Props = $props();

	let verifying = $state(false);
	let rejecting = $state(false);
	let rejectionReason = $state('');

	// Title verification data
	let verifyData: TituloData = $state({
		titulo: '',
		numero_titulo: '',
		año_expedicion: '',
		universidad: ''
	});

	// Only populate if student has title data
	$effect(() => {
		if (student && student.titulo) {
			verifyData = {
				titulo: student.titulo.titulo,
				numero_titulo: student.titulo.numero_titulo,
				año_expedicion: student.titulo.año_expedicion,
				universidad: student.titulo.universidad
			};
		}
	});

	async function handleVerify() {
		if (!student.titulo) return;
		verifying = true;
		try {
			const updatedStudent = await studentService.verifyTitulo(student._id, verifyData);
			student = updatedStudent;
			alert('success', 'Título verificado correctamente');
			onUpdate();
		} catch (e: any) {
			console.error(e);
			alert('error', e.message || 'Error al verificar título');
		} finally {
			verifying = false;
		}
	}

	async function handleReject() {
		if (!student.titulo) return;
		if (!rejectionReason.trim()) {
			alert('error', 'Debe ingresar un motivo de rechazo');
			return;
		}

		rejecting = true;
		try {
			// @ts-ignore
			const updatedStudent = await studentService.rejectTitulo(student._id, rejectionReason);
			student = updatedStudent;
			rejectionReason = '';
			alert('success', 'Título rechazado correctamente');
			onUpdate();
		} catch (e: any) {
			console.error(e);
			alert('error', e.message || 'Error al rechazar título');
		} finally {
			rejecting = false;
		}
	}

	// Granular loading state
	let uploadingDoc: string | null = $state(null);

	async function handleUpload(file: File | null, type: 'photo' | 'cv' | 'carnet' | 'afiliacion' | 'titulo') {
		if (!file) return;
		uploadingDoc = type;
		try {
			let updated: Student;
			switch (type) {
				case 'photo': updated = await studentService.uploadPhoto(student._id, file); break;
				case 'cv': updated = await studentService.uploadCV(student._id, file); break;
				case 'carnet': updated = await studentService.uploadCarnet(student._id, file); break;
				case 'afiliacion': updated = await studentService.uploadAfiliacion(student._id, file); break;
				case 'titulo': 
					 updated = await studentService.uploadTitulo(student._id, file, verifyData); 
					 break;
				default: throw new Error('Tipo de documento no válido');
			}
			student = updated;
			alert('success', 'Documento actualizado');
			onUpdate();
		} catch (e: any) {
			alert('error', e.message || 'Error al subir documento');
		} finally {
			uploadingDoc = null;
		}
	}

	function formatDate(dateString: string) {
		if (!dateString) return 'N/A';
		return new Date(dateString).toLocaleDateString('es-ES', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	async function downloadFile(url: string, filename: string) {
		try {
			const response = await fetch(url);
			if (!response.ok) throw new Error('Network response was not ok');
			const blob = await response.blob();
			const blobUrl = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = blobUrl;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(blobUrl);
			document.body.removeChild(a);
		} catch (error) {
			console.error('Download failed:', error);
			alert('error', 'Error al descargar el archivo');
		}
	}
</script>

<div class="space-y-8 pb-20">
	<!-- Personal Information -->
	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
			<div class="rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
				<UserIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Información Personal</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Datos básicos del estudiante</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Completo</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{student.nombre}</p>
			</div>
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">CI / Extensión</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{student.carnet || 'N/A'} {student.extension}</p>
			</div>
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha de Nacimiento</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{formatDate(student.fecha_nacimiento)}</p>
			</div>
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Celular</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{student.celular}</p>
			</div>
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white truncate" title={student.email}>{student.email}</p>
			</div>
			<div class="lg:col-span-2">
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Domicilio</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{student.domicilio}</p>
			</div>
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</label>
				<span class={`mt-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${student.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
					{student.activo ? 'Activo' : 'Inactivo'}
				</span>
			</div>
		</div>
	</div>

	<!-- Academic & Account Info -->
	<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
			<div class="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
				<CollectionIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Información Académica</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Registro y carrera</p>
			</div>
		</div>
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Registro</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white">{student.registro}</p>
			</div>
			
			<div>
				<label class="block text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</label>
				<p class="mt-1 text-base font-medium text-gray-900 dark:text-white capitalize">{student.es_estudiante_interno}</p>
			</div>
		</div>
	</div>

	<!-- Documents & Title -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Documents -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
				<div class="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
					<IdentificationIcon class="size-6" />
				</div>
				<div>
					<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Documentación</Heading>
					<p class="text-sm text-gray-500 dark:text-gray-400">Archivos adjuntos</p>
				</div>
			</div>
			
			<div class="grid grid-cols-2 gap-4">
				{#each [
					{ label: 'Foto Perfil', url: student.foto_url, type: 'photo', accept: 'image/*' },
					{ label: 'Carnet', url: student.ci_url, type: 'carnet', accept: '.pdf' },
					{ label: 'Curriculum', url: student.cv_url, type: 'cv', accept: '.pdf' },
					{ label: 'Afiliación', url: student.afiliacion_url, type: 'afiliacion', accept: '.pdf' }
				] as doc}
					<div class="flex flex-col gap-2">
						<span class="text-sm font-medium text-gray-700 dark:text-gray-300">{doc.label}</span>
						{#if doc.url}
							<div class="relative group h-48 w-full rounded-lg border border-gray-200 bg-gray-50 overflow-hidden dark:border-gray-700 dark:bg-gray-800">
								{#if uploadingDoc === doc.type}
									<div class="absolute inset-0 z-20 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
										<LoaderIcon class="animate-spin text-primary-600 size-8" />
									</div>
								{/if}

								{#if doc.accept.includes('image')}
									<img src={doc.url} alt={doc.label} class="h-full w-full object-cover" />
								{:else if doc.url}
									<PdfPreview url={doc.url} title={doc.label} />
								{:else}
									<div class="flex h-full w-full items-center justify-center text-gray-400">
										<FileTextIcon class="size-10" />
									</div>
								{/if}
								
								<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
									<button 
										type="button" 
										onclick={(e) => { e.preventDefault(); e.stopPropagation(); downloadFile(doc.url!, doc.label); }} 
										class="p-2 bg-white rounded-full text-gray-900 hover:text-primary-600 flex items-center justify-center" 
										title="Descargar"
									>
										<DownloadIcon class="size-5" />
									</button>
								</div>
							</div>
							<div class="text-xs text-center mt-1">
								<button 
									type="button"
									class="text-primary-600 hover:underline disabled:opacity-50" 
									onclick={(e) => { e.preventDefault(); document.getElementById(`upload-${doc.type}`)?.click(); }}
									disabled={!!uploadingDoc}
								>
									{uploadingDoc === doc.type ? 'Actualizando...' : 'Reemplazar'}
								</button>
							</div>
						{:else}
							<FileUpload 
								label="" 
								id={`upload-${doc.type}-full`}
								accept={doc.accept} 
								preview={false}
								loading={uploadingDoc === doc.type}
								onFileSelect={(f) => handleUpload(f, doc.type as any)} 
							/>
						{/if}
						<!-- Hidden input for replace action -->
						<input 
							id={`upload-${doc.type}`} 
							type="file" 
							accept={doc.accept} 
							class="hidden" 
							onchange={(e) => {
								const target = e.target as HTMLInputElement;
								if (target.files?.length) handleUpload(target.files[0], doc.type as any);
							}}
							disabled={!!uploadingDoc}
						/>
					</div>
				{/each}
			</div>
		</div>

		<!-- Title -->
		<div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
			<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-gray-700">
				<div class="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
					<AcademicCapIcon class="size-6" />
				</div>
				<div>
					<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Título Profesional</Heading>
					<p class="text-sm text-gray-500 dark:text-gray-400">Verificación de grado</p>
				</div>
			</div>

			{#if !student.titulo}
				<div class="text-center py-8">
					<p class="text-gray-500">No hay información de título registrada.</p>
					<p class="text-sm text-gray-400">Suba el documento en la sección de uploads para registrarlo.</p>
					<div class="mt-4 max-w-xs mx-auto">
						<FileUpload label="Subir Título" accept=".pdf" onFileSelect={(f) => handleUpload(f, 'titulo')} />
					</div>
				</div>
			{:else}
				<div class="space-y-6">
					<!-- Status Badge -->
					<div class="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50">
						<span class="text-sm font-medium text-gray-500">Estado</span>
						{#if student.titulo.estado === 'verificado'}
							<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
								<CheckIcon class="size-4" /> Validado
							</span>
						{:else if student.titulo.estado === 'rechazado'}
							<div class="text-right">
								<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
									<XIcon class="size-4" /> Rechazado
								</span>
								{#if (student.titulo as any).motivo_rechazo}
									<p class="text-xs text-red-600 mt-1">{(student.titulo as any).motivo_rechazo}</p>
								{/if}
							</div>
						{:else}
							<span class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
								{student.titulo.estado || 'Pendiente'}
							</span>
						{/if}
					</div>

					<!-- Form for Editing/Verifying -->
					<div class="grid grid-cols-2 gap-4">
						<Input label="Título" bind:value={verifyData.titulo} />
						<Input label="Nº Registro" bind:value={verifyData.numero_titulo} />
						<Input label="Año" bind:value={verifyData.año_expedicion} />
						<Input label="Universidad" bind:value={verifyData.universidad} />
					</div>

					<div class="flex items-center gap-4 flex-col">
						<button 
							type="button"
							onclick={() => downloadFile(student.titulo?.titulo_url!, 'Titulo_Profesional')}
							class="flex items-center justify-center gap-2 flex-1 h-9 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-md text-sm font-medium transition-colors dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100"
						>
							<DownloadIcon class="size-4" />
							Descargar Documento
						</button>
						
						{#if student.titulo}
							<div class="flex flex-col md:flex-row gap-3 pt-4 border-t border-gray-100 dark:border-gray-700 my-auto">
								<div class="flex flex-col gap-1.5">
									<label for="reject-reason" class="text-xs font-medium text-gray-700 dark:text-gray-300">
										Motivo de rechazo (solo si va a rechazar)
									</label>
									<textarea 
										id="reject-reason"
										bind:value={rejectionReason}
										rows="2"
										class="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
										placeholder="Ingrese el motivo de rechazo..."
									></textarea>
								</div>
								
								<div class="mt-auto">
									{#if student.titulo.estado !== 'rechazado'}
									<Button variant="destructive" loading={rejecting} onclick={handleReject} disabled={verifying}>
										{#snippet leftIcon()} <XIcon class="size-4" /> {/snippet}
										Rechazar
									</Button>
									{/if}
									{#if student.titulo.estado !== 'verificado'}
									<Button variant="primary" loading={verifying} onclick={handleVerify} disabled={rejecting}>
										{#snippet leftIcon()} <CheckIcon class="size-4" /> {/snippet}
										Verificar
									</Button>
									{/if}
								</div>
							</div>
						{/if}
					</div>
					
					{#if student.titulo.estado !== 'verificado' && student.titulo.estado !== 'rechazado'}
						<div class="border-t pt-4 mt-4">
							<label class="block text-sm font-medium text-red-700 mb-2">Rechazar Título</label>
							<div class="flex gap-2">
								<Input bind:value={rejectionReason} placeholder="Motivo del rechazo..." class="flex-1" />
								<Button variant="destructive" loading={rejecting} onclick={handleReject}>Rechazar</Button>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>
