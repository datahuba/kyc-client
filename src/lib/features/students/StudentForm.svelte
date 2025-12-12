<script lang="ts">
	import { studentService, courseService } from '$lib/services';
	import type { CreateStudentRequest, Student, TituloData, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon, EyeIcon, EyeOffIcon, AcademicCapIcon, UserIcon, IdentificationIcon, CollectionIcon } from '$lib/icons/outline';

	interface Props {
		student?: Student | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { student = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!student);
	let saving = $state(false);
	let active = $state(true);
	let showPassword = $state(false);
	let uploadProgress = $state('');

	// Form Data
	let formData: CreateStudentRequest = $state({
		registro: '',
		carnet: '',
		nombre: '',
		extension: '',
		fecha_nacimiento: '',
		foto_url: '',
		celular: '',
		email: '',
		domicilio: '',
		carrera: '',
		es_estudiante_interno: 'interno',
		password: '',
		lista_cursos_ids: []
	});

	// File States
	let photoFile: File | null = $state(null);
	let cvFile: File | null = $state(null);
	let carnetFile: File | null = $state(null);
	let afiliacionFile: File | null = $state(null);
	let tituloFile: File | null = $state(null);

	// Title Metadata
	let tituloData: TituloData = $state({
		titulo: '',
		numero_titulo: '',
		año_expedicion: '',
		universidad: ''
	});
	
	let courses: Course[] = $state([]);

	$effect(() => {
		courseService.getAll().then(data => {
			courses = data;
		});
	});

	// Initialize form data when student prop changes
	$effect(() => {
		if (student) {
			formData = {
				registro: student.registro,
				carnet: student.carnet || '',
				nombre: student.nombre,
				extension: student.extension,
				fecha_nacimiento: student.fecha_nacimiento.split('T')[0],
				foto_url: student.foto_url,
				celular: student.celular,
				email: student.email,
				domicilio: student.domicilio,
				es_estudiante_interno: student.es_estudiante_interno,
				// password: '',
				//lista_cursos_ids: student.lista_cursos_ids || []
			};
			active = student.activo;
			
			if (student.titulo) {
				tituloData = {
					titulo: student.titulo.titulo,
					numero_titulo: student.titulo.numero_titulo,
					año_expedicion: student.titulo.año_expedicion,
					universidad: student.titulo.universidad
				};
			} else {
				tituloData = { titulo: '', numero_titulo: '', año_expedicion: '', universidad: '' };
			}
			// Note: We don't populate files for edit mode as they are re-uploads. (Except displaying previews which is handled by prop)
		} else {
			// Reset form for new student
			formData = {
				registro: '',
				carnet: '',
				nombre: '',
				extension: '',
				fecha_nacimiento: '',
				foto_url: '',
				celular: '',
				email: '',
				domicilio: '',
				es_estudiante_interno: 'interno',
				password: '',
				//lista_cursos_ids: []
			};
			active = true;
			tituloData = { titulo: '', numero_titulo: '', año_expedicion: '', universidad: '' };
			photoFile = null; cvFile = null; carnetFile = null; afiliacionFile = null; tituloFile = null;
		}
	});

	async function handleSubmit() {
		saving = true;
		uploadProgress = 'Guardando datos básicos...';
		try {
			let savedStudent: Student;

			if (isEditMode && student) {
				const hasTituloData = tituloData.titulo || tituloData.universidad;
				savedStudent = await studentService.update(student._id, {
					...formData,
					activo: active,
					password: formData.password || undefined,
					titulo: hasTituloData ? tituloData : undefined
				});
				alert('success', 'Estudiante actualizado correctamente');
			} else {
				savedStudent = await studentService.create(formData);
				uploadProgress = 'Estudiante creado. Subiendo documentos...';
			}

			// Handle uploads sequentially
			const id = savedStudent._id;

			const uploads = [
				{ file: photoFile, method: studentService.uploadPhoto, name: 'Foto' },
				{ file: carnetFile, method: studentService.uploadCarnet, name: 'Carnet' },
				{ file: cvFile, method: studentService.uploadCV, name: 'CV' },
				{ file: afiliacionFile, method: studentService.uploadAfiliacion, name: 'Afiliación' }
			];

			for (const upload of uploads) {
				if (upload.file) {
					uploadProgress = `Subiendo ${upload.name}...`;
					// @ts-ignore
					await upload.method.call(studentService, id, upload.file);
				}
			}

			if (tituloFile) {
				uploadProgress = 'Subiendo Título...';
				if (!tituloData.titulo || !tituloData.universidad) {
					alert('warning', 'Se subió el archivo de título pero faltan datos del título. Por favor actualice en detalles.');
				} /* else { */
					await studentService.uploadTitulo(id, tituloFile, tituloData);
				/* } */
			}

			if (!isEditMode) {
				alert('success', 'Estudiante creado y documentos subidos correctamente');
			}
			onSuccess();
		} catch (e: any) {
			console.error(e);
			alert('error', e.message || 'Error al guardar estudiante');
		} finally {
			saving = false;
			uploadProgress = '';
		}
	}
</script>

<form class="space-y-8" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	
	<!-- Personal Information -->
	<div class="p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
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
			<Input label="Nombre Completo" id="nombre" bind:value={formData.nombre} required placeholder="Juan Perez" class="md:col-span-2" />
			<Input label="Fecha de Nacimiento" id="fecha_nacimiento" type="date" bind:value={formData.fecha_nacimiento} required />
			<Input label="Carnet" id="carnet" bind:value={formData.carnet} required placeholder="12345678" />
			<Input label="Extensión CI" id="extension" bind:value={formData.extension} required placeholder="LP" />
			
			<Input label="Email" id="email" type="email" bind:value={formData.email} required placeholder="juan@example.com" class="md:col-span-2" />
			<Input label="Celular" id="celular" bind:value={formData.celular} required placeholder="+591 70000000" />
			<Input label="Domicilio" id="domicilio" bind:value={formData.domicilio} required placeholder="Av. Principal #123" />
		</div>
	</div>

	<!-- Academic & Account Info -->
	<div class="p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mb-6 flex items-center gap-3 pb-4">
			<div class="rounded-lg bg-orange-50 p-2 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
				<CollectionIcon class="size-6" /> <!-- Using Collection as surrogate for Academic/Folder -->
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Información Académica</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Registro y detalles de cuenta</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<Input label="Registro" id="registro" bind:value={formData.registro} required placeholder="EST-2024-001" />
			<Select label="Tipo de Estudiante" bind:value={formData.es_estudiante_interno} required>
				<option value="interno">Interno</option>
				<option value="externo">Externo</option>
			</Select>
			
			{#if isEditMode}
				<div class="relative w-full">
					<div class="relative">
						<Input 
							label="Nueva Contraseña" 
							id="password" 
							type={showPassword ? 'text' : 'password'} 
							bind:value={formData.password} 
							placeholder="Opcional (para cambiar)" 
						/>
						<button 
							type="button" 
							onclick={() => (showPassword = !showPassword)} 
							class="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
							tabindex="-1"
						>
							{#if showPassword} <EyeIcon class="size-5" /> {:else} <EyeOffIcon class="size-5" /> {/if}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Course Selection -->
	<!-- <div class="p-6 shadow-sm">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4">
			<div class="rounded-lg bg-green-50 p-2 text-green-600 dark:bg-green-900/20 dark:text-green-400">
				<CollectionIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Cursos Inscritos</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Seleccione los cursos</p>
			</div>
		</div> -->

		<!-- <div class="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto p-2 border border-gray-200 rounded-lg dark:border-gray-700">
			{#each courses as course}
				<label class="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer transition-colors">
					<input 
						type="checkbox" 
						value={course._id} 
						checked={formData.lista_cursos_ids?.includes(course._id)}
						onchange={(e) => {
							const checked = e.currentTarget.checked;
							const current = formData.lista_cursos_ids || [];
							if (checked) {
								formData.lista_cursos_ids = [...current, course._id];
							} else {
								formData.lista_cursos_ids = current.filter(id => id !== course._id);
							}
						}}
						class="rounded border-gray-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
					/>
					<span class="text-sm text-gray-700 dark:text-gray-300 select-none">{course.nombre_programa}</span>
				</label>
			{/each}
			{#if courses.length === 0}
				<p class="text-sm text-gray-500 col-span-2 text-center py-4">No hay cursos disponibles.</p>
			{/if}
		</div> -->
	<!-- </div> -->

	<!-- Documents & Title -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Documents -->
		<div class="p-6 shadow-sm">
			<div class="mb-6 flex items-center gap-3 pb-4">
				<div class="rounded-lg bg-blue-50 p-2 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
					<IdentificationIcon class="size-6" />
				</div>
				<div>
					<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Documentación</Heading>
					<p class="text-sm text-gray-500 dark:text-gray-400">Archivos adjuntos</p>
				</div>	
			</div>
			
			<div class="grid grid-cols-2 gap-4">
				<FileUpload label="Foto de Perfil" accept="image/*" file={photoFile} onFileSelect={(f) => photoFile = f} initialUrl={student?.foto_url} isEditable={isEditMode} />
				<FileUpload label="Carnet (PDF)" accept=".pdf" file={carnetFile} onFileSelect={(f) => carnetFile = f} initialUrl={student?.ci_url} isEditable={isEditMode} />
				<FileUpload label="Curriculum (PDF)" accept=".pdf" file={cvFile} onFileSelect={(f) => cvFile = f} initialUrl={student?.cv_url} isEditable={isEditMode} />
				<FileUpload label="Afiliación (PDF)" accept=".pdf" file={afiliacionFile} onFileSelect={(f) => afiliacionFile = f} initialUrl={student?.afiliacion_url} isEditable={isEditMode} />
			</div>
		</div>

		<!-- Title -->
		<div class="p-6 shadow-sm">
			<div class="mb-6 flex items-center gap-3 pb-4">
				<div class="rounded-lg bg-purple-50 p-2 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
					<AcademicCapIcon class="size-6" />
				</div>
				<div>
					<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Título Profesional</Heading>
					<p class="text-sm text-gray-500 dark:text-gray-400">Información de grado</p>
				</div>
			</div>

			<div class="space-y-4">
				<div class="grid grid-cols-2 gap-4">
					<Input label="Título" bind:value={tituloData.titulo} placeholder="Lic. en..." />
					<Input label="Nº Registro" bind:value={tituloData.numero_titulo} placeholder="12345" />
				</div>
				<div class="grid grid-cols-2 gap-4">
					<Input label="Año" bind:value={tituloData.año_expedicion} placeholder="2024" />
					<Input label="Universidad" bind:value={tituloData.universidad} placeholder="UAGRM" />
				</div>
				<FileUpload label="Documento de Título (PDF)" accept=".pdf" file={tituloFile} onFileSelect={(f) => tituloFile = f} initialUrl={student?.titulo?.titulo_url} />
			</div>
		</div>
	</div>

	{#if isEditMode}
		<div class="flex items-center gap-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
			<input type="checkbox" id="activo" bind:checked={active} class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
			<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">Estudiante Activo</label>
		</div>
	{/if}

	<div class="sticky bottom-0 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t border-gray-200 bg-gray-50/90 px-6 py-4 backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/90">
		<div class="text-sm text-gray-500">
			{#if uploadProgress}
				<span class="flex items-center gap-2 text-primary-600">
					<span class="relative flex h-3 w-3">
					  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
					  <span class="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
					</span>
					{uploadProgress}
				</span>
			{/if}
		</div>
		<div class="flex gap-4">
			<Button type="button" variant="secondary" onclick={onCancel} disabled={saving}>Cancelar</Button>
			<Button type="submit" loading={saving}>
				{#snippet leftIcon()} <CheckIcon class="size-5" /> {/snippet}
				{isEditMode ? 'Actualizar' : 'Crear Estudiante'}
			</Button>
		</div>
	</div>
</form>
