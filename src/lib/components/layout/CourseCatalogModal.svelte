<script lang="ts">
	import { onMount } from 'svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import { courseService } from '$lib/services';
	import type { Course } from '$lib/interfaces';
	import { formatCurrency } from '$lib/utils';
	import { userStore } from '$lib/stores/userStore';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	let courses = $state<Course[]>([]);
	let loading = $state(false);
	let loaded = $state(false);
	let errorMsg = $state('');
	let selectedCourse = $state<Course | null>(null);

	let currentUser: any = $state(null);
	userStore.subscribe((state) => {
		currentUser = state.user;
	});

	// F-CATALOGO-INSCRIPCION (2026-07-30): el botón "Inscribirme" solo
	// aparece para estudiantes. Staff/admin ven el botón "Ver detalle" o
	// "Editar" (no se inscribe a sí mismo).
	const ROLES_QUE_SE_INSCRIBEN = new Set(['estudiante', 'student']);

	const puedeInscribirse = $derived.by(() => {
		const rol = currentUser?.rol || currentUser?.role;
		return ROLES_QUE_SE_INSCRIBEN.has(rol);
	});

	async function loadCourses() {
		if (loaded) return;
		loading = true;
		errorMsg = '';
		try {
			const res = await courseService.getAll(1, 100, { activo: true });
			courses = res.data || [];
			loaded = true;
		} catch (e: any) {
			errorMsg = e?.message || 'No se pudo cargar el catálogo de cursos.';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (isOpen) loadCourses();
	});

	function handleInscribirme(course: Course, e: MouseEvent) {
		e.stopPropagation();
		selectedCourse = course;
		// TODO (F-INSC-DESDE-CATALOGO): abrir wizard de inscripción
		alert('info', `Inscripción a "${course.nombre_programa}". Próximamente: wizard de inscripción.`);
		selectedCourse = null;
	}
</script>

<Modal {isOpen} title="Catálogo de Programas" {onClose} maxWidth="sm:max-w-3xl">
	<div class="p-2 sm:p-4">
		{#if loading}
			<div class="flex justify-center py-10">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
			</div>
		{:else if errorMsg}
			<div class="text-center py-8 text-sm text-light-error">{errorMsg}</div>
		{:else if courses.length === 0}
			<div class="text-center py-10 text-sm text-gray-500 dark:text-gray-400">
				No hay programas activos disponibles en este momento.
			</div>
		{:else}
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto pr-1">
				{#each courses as course (course._id)}
					<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
						<div class="h-1.5 bg-gradient-to-r from-primary-600 to-primary-800"></div>
						<div class="p-4 flex-1 flex flex-col">
							<span class="inline-block self-start px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 capitalize">
								{course.tipo_curso}
							</span>
							<h3 class="mt-2 text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2" title={course.nombre_programa}>
								{course.nombre_programa}
							</h3>
							<div class="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
								<span class="capitalize">{course.modalidad}</span>
								<span>·</span>
								<span>{course.cantidad_cuotas} módulos</span>
							</div>
							<div class="mt-3 pt-2 border-t border-gray-100 dark:border-dark-border">
								<div class="flex items-center justify-between">
									<div class="text-xs">
										<span class="block text-gray-400 dark:text-gray-500">Colegiatura</span>
										<span class="font-bold text-primary-700 dark:text-primary-300">{formatCurrency(course.costo_total_interno || 0)}</span>
									</div>
									{#if course.cargo_adicional_items && course.cargo_adicional_items.length > 0}
										<div class="text-xs text-right">
											{#each course.cargo_adicional_items as item}
												<div>
													<span class="block text-gray-400 dark:text-gray-500">{item.nombre}</span>
													<span class="font-bold text-gray-700 dark:text-gray-300">+{formatCurrency(item.costo)}</span>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
							<!-- F-CATALOGO-INSCRIPCION (2026-07-30): botón Inscribirme para estudiantes -->
							{#if puedeInscribirse}
								<button
									type="button"
									onclick={(e) => handleInscribirme(course, e)}
									class="mt-3 w-full px-3 py-2 text-xs font-bold bg-primary-600 hover:bg-primary-700 text-white rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
								>
									<span>✍️</span> Inscribirme
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</Modal>
