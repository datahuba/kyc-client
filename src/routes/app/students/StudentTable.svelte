<script lang="ts">
	import type { Student } from '$lib/interfaces';
	import { UserIcon, DotsVerticalIcon } from '$lib/icons/outline';
	import DropdownMenu from '$lib/components/ui/dropdownMenu.svelte';

	interface Props {
		students: Student[];
		isSuperAdmin: boolean;
		canEditStudent: boolean;
		togglingTypeIds: Set<string>;
		selectedStudentIds: string[];
		openDropdownId: string | null;
		getDropdownOptions: (student: Student) => any[];
		toggleSelectAll: () => void;
		toggleSelectStudent: (id: string) => void;
		toggleStudentType: (student: Student) => void;
		toggleDropdown: (id: string) => void;
	}

	let {
		students,
		isSuperAdmin,
		canEditStudent,
		togglingTypeIds,
		selectedStudentIds = $bindable(),
		openDropdownId = $bindable(),
		getDropdownOptions,
		toggleSelectAll,
		toggleSelectStudent,
		toggleStudentType,
		toggleDropdown
	}: Props = $props();

	let isAllSelected = $derived(
		students.length > 0 && students.every(s => selectedStudentIds.includes(s._id))
	);
</script>

<!-- ISSUE-X-COMPACT: Tabla consolidada SIN scroll horizontal (desktop) -->
<div class="hidden md:block border border-gray-200 dark:border-dark-border rounded-lg shadow-sm animate-fade-in overflow-hidden">
	<table class="w-full table-fixed divide-y divide-gray-200 dark:divide-dark-border">
		<thead class="bg-gray-50 dark:bg-dark-background">
			<tr>
				{#if isSuperAdmin}
					<th scope="col" class="w-10 px-4 py-3 text-left">
						<input type="checkbox" checked={isAllSelected} onchange={toggleSelectAll} class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-700 cursor-pointer" />
					</th>
				{/if}
				<th scope="col" class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estudiante</th>
				<th scope="col" class="w-[18%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Registro / Carnet</th>
				<th scope="col" class="w-[16%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
				<th scope="col" class="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Domicilio</th>
				<th scope="col" class="w-[6%] relative px-4 py-3"><span class="sr-only">Acciones</span></th>
			</tr>
		</thead>
		<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
			{#each students as student (student._id)}
				<tr class={selectedStudentIds.includes(student._id) ? 'bg-primary-50/40 dark:bg-primary-950/20 transition-colors align-top' : 'transition-colors align-top'}>
					{#if isSuperAdmin}
						<td class="px-4 py-4">
							<input type="checkbox" checked={selectedStudentIds.includes(student._id)} onchange={() => toggleSelectStudent(student._id)} class="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-700 cursor-pointer" />
						</td>
					{/if}

					<td class="px-4 py-4">
						<div class="flex items-center min-w-0">
							<div class="h-9 w-9 shrink-0">
								{#if student.foto_url}
								<img class="h-9 w-9 rounded-full object-cover" src={student.foto_url} alt="" />
								{:else}
								<span><UserIcon class="size-9"/></span>
								{/if}
							</div>
							<div class="ml-3 min-w-0">
								<div class="text-sm font-medium text-gray-900 dark:text-white truncate" title={student.nombre}>{student.nombre}</div>
								<div class="text-xs text-gray-500 dark:text-gray-400 truncate" title={student.email}>{student.email}</div>
							</div>
						</div>
					</td>
					<td class="px-4 py-4">
						<div class="text-sm text-gray-900 dark:text-white truncate">{student.registro}</div>
						<div class="text-xs text-gray-500 dark:text-gray-400 truncate">CI: {student.carnet}</div>
					</td>
					<td class="px-4 py-4">
						<div class="text-sm text-gray-900 dark:text-white truncate">{student.celular}</div>
						<!-- ISSUE H: BOTÓN DE MUTACIÓN RÁPIDA -->
						<div class="mt-1">
							<button 
								type="button"
								disabled={!canEditStudent || togglingTypeIds.has(student._id)}
								onclick={() => toggleStudentType(student)}
								class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors
									${student.es_estudiante_interno === 'interno' 
										? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' 
										: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400'}
									${!canEditStudent ? 'cursor-default opacity-80' : 'cursor-pointer'}
									${togglingTypeIds.has(student._id) ? 'opacity-50 pointer-events-none' : ''}
								`}
								title={canEditStudent ? 'Haga clic para cambiar entre Interno/Externo' : 'Tipo de Estudiante'}
							>
								{#if togglingTypeIds.has(student._id)}
									<svg class="animate-spin -ml-0.5 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
										<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
										<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
									</svg>
									Cambiando...
								{:else}
									{student.es_estudiante_interno}
								{/if}
							</button>
						</div>
					</td>
					<td class="px-4 py-4">
						<div class="text-sm text-gray-900 dark:text-white truncate" title={student.domicilio}>{student.domicilio || '—'}</div>
					</td>
					<td class="px-4 py-4 text-right text-sm font-medium relative">
						<button onclick={() => toggleDropdown(student._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del estudiante">
							<DotsVerticalIcon class="size-5" />
						</button>
						{#if openDropdownId === student._id}
							<div class="absolute right-0 mt-2 w-48 z-10">
								<DropdownMenu 
									options={getDropdownOptions(student)} 
									isOpen={true} 
									width="w-48" 
									class="origin-top-right right-0"
								/>
							</div>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<!-- ISSUE-X-COMPACT: Tarjetas para móvil -->
<div class="md:hidden space-y-3 animate-fade-in">
	{#each students as student (student._id)}
		<div class={`bg-white dark:bg-dark-surface border rounded-xl p-4 shadow-sm ${selectedStudentIds.includes(student._id) ? 'border-primary-400 dark:border-primary-700' : 'border-gray-200 dark:border-dark-border'}`}>
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-center min-w-0">
					{#if isSuperAdmin}
						<input type="checkbox" checked={selectedStudentIds.includes(student._id)} onchange={() => toggleSelectStudent(student._id)} class="mr-3 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 h-4 w-4 dark:bg-gray-700 cursor-pointer shrink-0" />
					{/if}
					<div class="h-10 w-10 shrink-0">
						{#if student.foto_url}
							<img class="h-10 w-10 rounded-full object-cover" src={student.foto_url} alt="" />
						{:else}
							<span><UserIcon class="size-10"/></span>
						{/if}
					</div>
					<div class="ml-3 min-w-0">
						<div class="text-sm font-semibold text-gray-900 dark:text-white truncate" title={student.nombre}>{student.nombre}</div>
						<div class="text-xs text-gray-500 dark:text-gray-400 truncate" title={student.email}>{student.email}</div>
					</div>
				</div>
				<div class="relative shrink-0">
					<button onclick={() => toggleDropdown(student._id)} class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300" aria-label="Acciones del estudiante">
						<DotsVerticalIcon class="size-5" />
					</button>
					{#if openDropdownId === student._id}
						<div class="absolute right-0 mt-2 w-48 z-10">
							<DropdownMenu options={getDropdownOptions(student)} isOpen={true} width="w-48" class="origin-top-right right-0" />
						</div>
					{/if}
				</div>
			</div>

			<div class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
				<div class="min-w-0">
					<span class="block text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] font-bold">Registro</span>
					<span class="block text-gray-900 dark:text-white truncate">{student.registro}</span>
				</div>
				<div class="min-w-0">
					<span class="block text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] font-bold">Carnet</span>
					<span class="block text-gray-900 dark:text-white truncate">{student.carnet}</span>
				</div>
				<div class="min-w-0">
					<span class="block text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] font-bold">Celular</span>
					<span class="block text-gray-900 dark:text-white truncate">{student.celular || '—'}</span>
				</div>
				<div class="min-w-0">
					<span class="block text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] font-bold">Tipo</span>
					<button 
						type="button"
						disabled={!canEditStudent || togglingTypeIds.has(student._id)}
						onclick={() => toggleStudentType(student)}
						class={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide transition-colors
							${student.es_estudiante_interno === 'interno' 
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
								: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}
							${!canEditStudent ? 'cursor-default opacity-80' : 'cursor-pointer'}
							${togglingTypeIds.has(student._id) ? 'opacity-50 pointer-events-none' : ''}`}
					>
						{togglingTypeIds.has(student._id) ? '...' : student.es_estudiante_interno}
					</button>
				</div>
				<div class="col-span-2 min-w-0">
					<span class="block text-gray-400 dark:text-gray-500 uppercase tracking-wide text-[10px] font-bold">Domicilio</span>
					<span class="block text-gray-900 dark:text-white truncate" title={student.domicilio}>{student.domicilio || '—'}</span>
				</div>
			</div>
		</div>
	{/each}
</div>
