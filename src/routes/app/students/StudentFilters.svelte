<script lang="ts">
	import type { Course } from '$lib/interfaces';
	import SearchInput from '$lib/components/ui/searchInput.svelte';

	interface Props {
		q: string;
		activo: string;
		estado_titulo: string;
		curso_id: string;
		allCourses: Course[];
		onSearchInput: () => void;
		onFilterChange: () => void;
	}

	let {
		q = $bindable(),
		activo = $bindable(),
		estado_titulo = $bindable(),
		curso_id = $bindable(),
		allCourses,
		onSearchInput,
		onFilterChange
	}: Props = $props();
</script>

<div class="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
	<div class="md:col-span-2">
		<label for="search" class="sr-only">Buscar</label>
		<SearchInput
			bind:value={q}
			placeholder="Buscar por nombre, CI, registro..."
			onInput={() => onSearchInput()}
		/>
	</div>
	
	<div>
		<select
			bind:value={activo}
			onchange={onFilterChange}
			class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		>
			<option value="all">Todos los estados</option>
			<option value="true">Activo</option>
			<option value="false">Inactivo</option>
		</select>
	</div>

	<div>
		<select
			bind:value={estado_titulo}
			onchange={onFilterChange}
			class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
		>
			<option value="all">Todos los títulos</option>
			<option value="pendiente">Pendiente</option>
			<option value="verificado">Verificado</option>
			<option value="rechazado">Rechazado</option>
			<option value="sin_titulo">Sin Título</option>
		</select>
	</div>

	<div class="flex flex-col gap-1">
		<div class="relative">
			<select
				bind:value={curso_id}
				onchange={onFilterChange}
				class="block w-full rounded-md border-0 py-1.5 pr-8 text-gray-900 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6
					{curso_id
						? 'ring-2 ring-inset ring-primary-500 bg-primary-50 font-medium text-primary-900 dark:bg-primary-900/30 dark:text-primary-200 dark:ring-primary-500'
						: 'ring-1 ring-inset ring-gray-300 dark:bg-gray-700 dark:text-white dark:ring-gray-600'}"
			>
				<option value="">Todos los cursos</option>
				{#each allCourses as course (course._id)}
					<option value={course._id}>{course.nombre_programa} ({course.codigo})</option>
				{/each}
			</select>
			{#if curso_id}
				<button
					type="button"
					onclick={() => { curso_id = ''; onFilterChange(); }}
					class="absolute right-7 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-primary-500 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors z-10"
					title="Quitar filtro de curso"
				>
					<svg class="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
				</button>
			{/if}
		</div>
	</div>
</div>
