<script lang="ts">
	import { studentService } from '$lib/services';
	import type { CreateStudentRequest, Student } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon,EyeIcon,EyeOffIcon } from '$lib/icons/outline';

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

	let formData: CreateStudentRequest = $state({
		registro: '',
		nombre: '',
		extension: '',
		fecha_nacimiento: '',
		foto_url: '',
		celular: '',
		email: '',
		domicilio: '',
		carrera: '',
		es_estudiante_interno: 'interno',
		password: ''
	});

	// Initialize form data when student prop changes
	$effect(() => {
		if (student) {
			formData = {
				registro: student.registro,
				nombre: student.nombre,
				extension: student.extension,
				fecha_nacimiento: student.fecha_nacimiento.split('T')[0],
				foto_url: student.foto_url,
				celular: student.celular,
				email: student.email,
				domicilio: student.domicilio,
				carrera: student.carrera,
				es_estudiante_interno: student.es_estudiante_interno,
				password: ''
			};
			active = student.activo;
		} else {
			// Reset form for new student
			formData = {
				registro: '',
				nombre: '',
				extension: '',
				fecha_nacimiento: '',
				foto_url: '',
				celular: '',
				email: '',
				domicilio: '',
				carrera: '',
				es_estudiante_interno: 'interno',
				password: ''
			};
			active = true;
		}
	});

	async function handleSubmit() {
		saving = true;
		try {
			if (isEditMode && student) {
				await studentService.update(student._id, {
					...formData,
					activo: active,
					password: formData.password || undefined
				});
				alert('success', 'Estudiante actualizado correctamente');
			} else {
				await studentService.create(formData);
				alert('success', 'Estudiante creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar estudiante');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<Input
			label="Nombre Completo"
			id="nombre"
			bind:value={formData.nombre}
			required
			placeholder="Juan Perez"
		/>
		<Input
			label="Registro"
			id="registro"
			bind:value={formData.registro}
			required
			placeholder="EST-2024-001"
		/>
		<Input
			label="Email"
			id="email"
			type="email"
			bind:value={formData.email}
			required
			placeholder="juan@example.com"
		/>
		<Input
			label="Celular"
			id="celular"
			bind:value={formData.celular}
			required
			placeholder="+591 70000000"
		/>
		<Input
			label="CI / Extensión"
			id="extension"
			bind:value={formData.extension}
			required
			placeholder="1234567 LP"
		/>
		<Input
			label="Fecha de Nacimiento"
			id="fecha_nacimiento"
			type="date"
			bind:value={formData.fecha_nacimiento}
			required
		/>
		<Input
			label="Carrera"
			id="carrera"
			bind:value={formData.carrera}
			required
			placeholder="Ingeniería de Sistemas"
		/>
		<Select
			label="Tipo de Estudiante"
			bind:value={formData.es_estudiante_interno}
			required
		>
			<option value="interno">Interno</option>
			<option value="externo">Externo</option>
		</Select>
		<Input
			label="Domicilio"
			id="domicilio"
			bind:value={formData.domicilio}
			required
			placeholder="Av. Principal #123"
			class="md:col-span-2"
		/>
		<Input
			label="Foto URL"
			id="foto_url"
			bind:value={formData.foto_url}
			placeholder="https://..."
			class="md:col-span-2"
		/>
		
		{#if !isEditMode}
		<div class="relative w-full">
			<Input
				label="Contraseña"
				id="password"
				type={showPassword ? 'text' : 'password'}
				bind:value={formData.password}
				required={!isEditMode}
				placeholder="********"
				class="w-full"
			/>
			<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute top-12 right-2 -translate-y-1/2 text-light-black transition-colors hover:text-light-four dark:text-dark-white"
							disabled={saving}
						>
							{#if showPassword}
								<EyeIcon class="h-5 w-5" />
							{:else}
								<EyeOffIcon class="h-5 w-5" />
							{/if}
						</button>
			</div>
		{:else}
			<Input
				label="Nueva Contraseña (Opcional)"
				id="password"
				type="password"
				bind:value={formData.password}
				placeholder="Dejar en blanco para mantener actual"
			/>
		{/if}
	</div>

	{#if isEditMode}
		<div class="flex items-center gap-2">
			<input
				type="checkbox"
				id="activo"
				bind:checked={active}
				class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
			/>
			<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
				Estudiante Activo
			</label>
		</div>
	{/if}

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>
			Cancelar
		</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>
