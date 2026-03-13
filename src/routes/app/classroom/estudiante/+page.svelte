<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { userStore } from '$lib/stores/userStore';
	import { classroomService } from '$lib/services';
	import type { Classroom } from '$lib/interfaces';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { alert } from '$lib/utils';
	import { AcademicCapIcon } from '$lib/icons/outline';

	// Guard: solo estudiantes
	onMount(() => {
		if ($userStore.loginType !== 'student') {
			goto('/app/classroom/docente', { replaceState: true });
			return;
		}
		loadClasses();
	});

	let classes: Classroom[] = $state([]);
	let loading = $state(false);

	async function loadClasses() {
		loading = true;
		try {
			classes = await classroomService.getMyClasses();
		} catch (e: any) {
			alert('error', e.message || 'Error al cargar clases');
		} finally {
			loading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<Heading level="h1">Classroom — Mis Clases</Heading>
	</div>

	{#if loading}
		<TableSkeleton columns={3} rows={4} />
	{:else if classes.length === 0}
		<div class="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow border border-dashed border-gray-300 dark:border-gray-600">
			<AcademicCapIcon class="mx-auto size-12 text-gray-300 dark:text-gray-600 mb-4" />
			<p class="text-gray-500 dark:text-gray-400 font-medium">Aún no estás inscrito en ninguna clase.</p>
			<p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Tus clases aparecerán aquí cuando el docente te agregue.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
			{#each classes as classroom}
				<a href={`/app/classroom/clase/${classroom._id}`} class="block">
					<Card>
						<div class="flex items-start gap-3">
							<div class="flex-shrink-0 p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
								<AcademicCapIcon class="size-6 text-primary-600 dark:text-primary-400" />
							</div>
							<div class="min-w-0">
								<p class="text-sm font-semibold text-gray-900 dark:text-white truncate">{classroom.nombre}</p>
								{#if classroom.teacher_name}
									<p class="text-xs text-gray-500 dark:text-gray-400">Docente: {classroom.teacher_name}</p>
								{/if}
								{#if classroom.course_nombre}
									<p class="text-xs text-gray-400 dark:text-gray-500 truncate">{classroom.course_nombre}</p>
								{/if}
							</div>
						</div>
					</Card>
				</a>
			{/each}
		</div>
	{/if}
</div>
