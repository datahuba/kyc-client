<script lang="ts">
	import { studentService, courseService } from '$lib/services';
	import type { CreateStudentRequest, Student, TituloData, Course } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
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

	// ISSUE-REFACTOR (UI): validación inline por campo (estilo CourseForm/DiscountForm)
	// en vez de depender solo de alert() al fallar el submit.
	let errors: Record<string, string> = $state({});

	// Form Data
	let formData: CreateStudentRequest = $state({
		registro: '',
		carnet: '',
		complemento_carnet: '',
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
		course_id: '',
		lista_cursos_ids: [],
		// Datos oficiales UAGRM
		sexo: '',
		estado_civil: '',
		pais: '',
		departamento: '',
		provincia: '',
		nacionalidad: '',
		telefono: '',
		modalidad_ingreso: '',
		periodo: '',
		tipo_sangre: '',
		titulo_bachiller: ''
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
	let selectedCourseName = $derived(courses.find((course) => course._id === formData.course_id)?.nombre_programa || '');

	function courseOptionLabel(course: Course): string {
		const baseLabel = `${course.codigo} · ${course.nombre_programa}`;
		return baseLabel.length > 46 ? `${baseLabel.slice(0, 46)}...` : baseLabel;
	}

	$effect(() => {
		courseService.getAll(1, 100, { activo: true }).then((response) => {
			courses = response.data;
		});
	});

	// Initialize form data when student prop changes
	$effect(() => {
		if (student) {
			formData = {
				registro: student.registro,
				carnet: student.carnet || '',
				complemento_carnet: student.complemento_carnet || '',
				password: '',
				course_id: student.lista_cursos_ids?.[0] || '',
				nombre: student.nombre,
				extension: student.extension,
				fecha_nacimiento: student.fecha_nacimiento ? student.fecha_nacimiento.split('T')[0] : '',
				foto_url: student.foto_url,
				celular: student.celular,
				email: student.email,
				domicilio: student.domicilio,
				es_estudiante_interno: student.es_estudiante_interno,
				// Datos oficiales UAGRM
				sexo: student.sexo || '',
				estado_civil: student.estado_civil || '',
				pais: student.pais || '',
				departamento: student.departamento || '',
				provincia: student.provincia || '',
				nacionalidad: student.nacionalidad || '',
				telefono: student.telefono || '',
				modalidad_ingreso: student.modalidad_ingreso || '',
				periodo: student.periodo || '',
				tipo_sangre: student.tipo_sangre || '',
				titulo_bachiller: student.titulo_bachiller || ''
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
			// Nota: en modo edición no se prellenan los inputs de archivo (son re-subidas);
			// las vistas previas existentes se muestran vía la prop initialUrl de FileUpload.
		} else {
			// Reset form for new student
			formData = {
				registro: '',
				carnet: '',
				complemento_carnet: '',
				course_id: '',
				nombre: '',
				extension: '',
				fecha_nacimiento: '',
				foto_url: '',
				celular: '',
				email: '',
				domicilio: '',
				es_estudiante_interno: 'interno',
				password: '',
				sexo: '',
				estado_civil: '',
				pais: '',
				departamento: '',
				provincia: '',
				nacionalidad: '',
				telefono: '',
				modalidad_ingreso: '',
				periodo: '',
				tipo_sangre: '',
				titulo_bachiller: ''
			};
			active = true;
			tituloData = { titulo: '', numero_titulo: '', año_expedicion: '', universidad: '' };
			photoFile = null; cvFile = null; carnetFile = null; afiliacionFile = null; tituloFile = null;
		}
		errors = {};
	});

	// Fecha máxima permitida para nacimiento (hoy; no se permiten fechas futuras)
	const hoyISO = new Date().toISOString().split('T')[0];

	// ISSUE-REFACTOR (UI): validación inline por campo antes de enviar.
	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};

		const nombre = (formData.nombre || '').trim();
		const carnet = (formData.carnet || '').trim();
		const extension = (formData.extension || '').trim();
		const email = (formData.email || '').trim();
		const celular = (formData.celular || '').trim();
		const domicilio = (formData.domicilio || '').trim();
		const registro = (formData.registro || '').trim();
		const telefono = (formData.telefono || '').trim();

		if (nombre.length < 3) nuevosErrores.nombre = 'Ingresa el nombre completo (mínimo 3 caracteres).';
		if (!/^\d{5,10}$/.test(carnet)) nuevosErrores.carnet = 'El carnet debe tener entre 5 y 10 dígitos (solo números).';
		if (!extension) nuevosErrores.extension = 'La extensión del CI es obligatoria.';
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) nuevosErrores.email = 'Ingresa un correo electrónico válido.';
		if (!celular || !/^\d{6,15}$/.test(celular)) nuevosErrores.celular = 'El celular debe contener solo números (6 a 15 dígitos).';
		if (!domicilio) nuevosErrores.domicilio = 'El domicilio es obligatorio.';
		if (telefono && !/^\d{6,15}$/.test(telefono)) nuevosErrores.telefono = 'El teléfono debe contener solo números.';
		if (!registro) nuevosErrores.registro = 'El registro es obligatorio.';

		if (!formData.fecha_nacimiento) {
			nuevosErrores.fecha_nacimiento = 'La fecha de nacimiento es obligatoria.';
		} else {
			const f = new Date(formData.fecha_nacimiento);
			if (isNaN(f.getTime())) nuevosErrores.fecha_nacimiento = 'La fecha de nacimiento no es válida.';
			else if (f > new Date()) nuevosErrores.fecha_nacimiento = 'La fecha de nacimiento no puede ser futura.';
			else if (f.getFullYear() < 1940) nuevosErrores.fecha_nacimiento = 'La fecha de nacimiento no es válida (año demasiado antiguo).';
		}

		if (!isEditMode) {
			if (!formData.course_id) nuevosErrores.course_id = 'Selecciona un curso/programa para inscribir al estudiante.';
			// ISSUE-Q-PASSWORD-UNIFICADA: la contraseña ya no es obligatoria al
			// crear -- si se deja en blanco, el backend genera 'Uagrm.<CI>'
			// automáticamente (misma convención que docentes/staff).
			if (formData.password && formData.password.length < 5) {
				nuevosErrores.password = 'La contraseña debe tener al menos 5 caracteres, o déjala en blanco para autogenerarla.';
			}
		}

		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit() {
		if (!validarFormulario()) {
			alert('error', 'Revisa los campos marcados en rojo antes de continuar.');
			return;
		}
		saving = true;
		uploadProgress = 'Guardando datos básicos...';
		try {
			let savedStudent: Student;

			if (isEditMode && student) {
				const hasTituloData = tituloData.titulo || tituloData.universidad;

				// Excluir course_id del payload de actualización para evitar envíos huérfanos a la API
				const { course_id, ...updatePayload } = formData;

				savedStudent = await studentService.update(student._id, {
					...updatePayload,
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
				}
				await studentService.uploadTitulo(id, tituloFile, tituloData);
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

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>

	<!-- Información Personal -->
	<Card variant="default" padding="lg">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-dark-border">
			<div class="rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400">
				<UserIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Información Personal</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Datos básicos del estudiante</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<Input label="Nombre Completo" id="nombre" bind:value={formData.nombre} required minlength={3} maxlength={200} placeholder="Juan Perez" class="md:col-span-2" error={errors.nombre} />
			<Input label="Fecha de Nacimiento" id="fecha_nacimiento" type="date" bind:value={formData.fecha_nacimiento} required min="1940-01-01" max={hoyISO} error={errors.fecha_nacimiento} />
			<Input label="Carnet" id="carnet" bind:value={formData.carnet} required inputmode="numeric" pattern="[0-9]*" minlength={5} maxlength={10} placeholder="12345678" error={errors.carnet} />
			<!-- ISSUE-Q-COMPLEMENTO-CI (2026-07-08): complemento del CI (ej. '1D', '1J'),
			     distinto de la Extensión (lugar de expedición del carnet). -->
			<Input label="Complemento CI (opcional)" id="complemento_carnet" bind:value={formData.complemento_carnet} maxlength={10} placeholder="Ej: 1D" />
			<Input label="Extensión CI" id="extension" bind:value={formData.extension} required maxlength={4} placeholder="LP" error={errors.extension} />

			<Input label="Email" id="email" type="email" bind:value={formData.email} required placeholder="juan@example.com" class="md:col-span-2" error={errors.email} />
			<Input label="Celular" id="celular" bind:value={formData.celular} required inputmode="numeric" pattern="[0-9]*" maxlength={15} placeholder="70000000" error={errors.celular} />
			<Input label="Domicilio" id="domicilio" bind:value={formData.domicilio} required maxlength={200} placeholder="Av. Principal #123" error={errors.domicilio} />
		</div>
	</Card>

	<!-- Datos Oficiales UAGRM -->
	<Card variant="default" padding="lg">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-dark-border">
			<div class="rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/20 dark:text-primary-300">
				<IdentificationIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Datos Oficiales (UAGRM)</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Ficha oficial de datos personales y académicos</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
			<Select label="Sexo" bind:value={formData.sexo}>
				<option value="">— Seleccione —</option>
				<option value="masculino">Masculino</option>
				<option value="femenino">Femenino</option>
			</Select>
			<Select label="Estado Civil" bind:value={formData.estado_civil}>
				<option value="">— Seleccione —</option>
				<option value="soltero">Soltero(a)</option>
				<option value="casado">Casado(a)</option>
				<option value="divorciado">Divorciado(a)</option>
				<option value="viudo">Viudo(a)</option>
				<option value="otro">Otro</option>
			</Select>
			<Select label="Tipo de Sangre" bind:value={formData.tipo_sangre}>
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
			<Input label="Teléfono (fijo)" id="telefono" bind:value={formData.telefono} inputmode="numeric" pattern="[0-9]*" maxlength={15} placeholder="Solo números" error={errors.telefono} />

			<Input label="Nacionalidad" id="nacionalidad" bind:value={formData.nacionalidad} placeholder="Boliviana" />
			<Input label="País" id="pais" bind:value={formData.pais} placeholder="Bolivia" />
			<Input label="Departamento" id="departamento" bind:value={formData.departamento} placeholder="Santa Cruz" />
			<Input label="Provincia" id="provincia" bind:value={formData.provincia} placeholder="Andrés Ibáñez" />

			<Input label="Modalidad de Ingreso" id="modalidad_ingreso" bind:value={formData.modalidad_ingreso} placeholder="P.S.A." />
			<Input label="Periodo" id="periodo" bind:value={formData.periodo} placeholder="1/2019" />
			<Input label="Título de Bachiller" id="titulo_bachiller" bind:value={formData.titulo_bachiller} placeholder="Nº de título" class="md:col-span-2" />
		</div>
	</Card>

	<!-- Información Académica y Cuenta -->
	<Card variant="default" padding="lg">
		<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-dark-border">
			<div class="rounded-lg bg-light-secondary/10 p-2 text-light-secondary dark:bg-dark-secondary/20 dark:text-dark-secondary">
				<CollectionIcon class="size-6" />
			</div>
			<div>
				<Heading level="h4" class="text-lg font-semibold text-gray-900 dark:text-white">Información Académica</Heading>
				<p class="text-sm text-gray-500 dark:text-gray-400">Registro y detalles de cuenta</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<Input label="Registro" id="registro" bind:value={formData.registro} required placeholder="EST-2024-001" error={errors.registro} />
			<Select label="Tipo de Estudiante" bind:value={formData.es_estudiante_interno} required>
				<option value="interno">Interno</option>
				<option value="externo">Externo</option>
			</Select>

			{#if !isEditMode}
				<Select
					label="Curso / Programa"
					bind:value={formData.course_id}
					required={true}
					title={selectedCourseName}
					error={errors.course_id}
				>
					<option value="" disabled selected>Seleccione un curso activo</option>
					{#each courses as course}
						<option value={course._id} title={course.nombre_programa}>{courseOptionLabel(course)}</option>
					{/each}
				</Select>
			{/if}

			<div class="relative w-full">
				<div class="relative">
					<Input
						label={isEditMode ? 'Nueva Contraseña' : 'Contraseña (opcional)'}
						id="password"
						type={showPassword ? 'text' : 'password'}
						bind:value={formData.password}
						minlength={5}
						placeholder={isEditMode ? 'Opcional (para cambiar)' : `Uagrm.${formData.carnet?.trim() || '<CI>'}`}
						error={errors.password}
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
				{#if !isEditMode}
					<!-- ISSUE-Q-PASSWORD-UNIFICADA: si se deja en blanco, la contraseña
					     inicial es 'Uagrm.<CI>' (misma convención que docentes/staff). -->
					<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
						Si la dejas en blanco, la contraseña inicial será
						<span class="font-mono">Uagrm.{formData.carnet?.trim() || '&lt;CI&gt;'}</span>.
					</p>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Documents & Title -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Documents -->
		<Card variant="default" padding="lg">
			<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-dark-border">
				<div class="rounded-lg bg-light-tertiary/10 p-2 text-light-tertiary dark:bg-dark-tertiary/20 dark:text-dark-tertiary">
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
		</Card>

		<!-- Title -->
		<Card variant="default" padding="lg">
			<div class="mb-6 flex items-center gap-3 border-b border-gray-100 pb-4 dark:border-dark-border">
				<div class="rounded-lg bg-light-accent/10 p-2 text-light-accent dark:bg-dark-accent/10 dark:text-dark-accent">
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
		</Card>
	</div>

	{#if isEditMode}
		<Card variant="ghost" padding="sm">
			<Checkbox id="activo" label="Estudiante Activo" bind:checked={active} />
		</Card>
	{/if}

	<div class="sticky bottom-0 -mx-6 -mb-6 mt-8 flex items-center justify-between border-t border-gray-200 bg-gray-50/90 px-6 py-4 backdrop-blur-sm dark:border-dark-border dark:bg-dark-background/90">
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
