<script lang="ts">
	// F-HISTORICO-AUTOSERVICIO (2026-08-04): wizard de creación de programas con
	// selector visible de los 3 tipos. El usuario elige el tipo PRIMERO y luego
	// se le muestra el form específico para ese tipo. Reemplaza al CourseForm
	// monolítico para el caso "crear nuevo programa". El CourseForm original
	// sigue siendo usado para editar programas existentes.
	// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): habilita los 3 tipos
	// (antes solo historico estaba disponible). Los tipos "proximo" y
	// "en_ejecucion" ahora abren el CourseForm con el tipo preseleccionado.
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import HistoricalCourseForm from './HistoricalCourseForm.svelte';
	import CourseForm from './CourseForm.svelte';
	import {
		ClipboardIcon,
		ChevronRightIcon,
		FileTextIcon
	} from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		onSuccess?: () => void;
	}

	let { isOpen, onClose, onSuccess }: Props = $props();

	type TipoPrograma = 'proximo' | 'en_ejecucion' | 'historico';
	let tipoSeleccionado: TipoPrograma | null = $state(null);

	// Reset al cerrar
	$effect(() => {
		if (!isOpen) {
			tipoSeleccionado = null;
		}
	});

	function handleHistoricalSuccess() {
		tipoSeleccionado = null;
		onSuccess?.();
		onClose();
	}

	function handleActiveSuccess() {
		// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05): unifica el flujo de
		// "proximo" y "en_ejecucion" con el de historico. El CourseForm
		// ya tiene el tipo preseleccionado via prop `initialTipoPrograma`.
		tipoSeleccionado = null;
		onSuccess?.();
		onClose();
	}

	function handleActiveCancel() {
		tipoSeleccionado = null;
	}

	const TIPOS = [
		{
			id: 'proximo' as const,
			titulo: 'Próximo / Programado',
			descripcion: 'Aún no inicia. Estudiantes pueden inscribirse solos desde su dashboard.',
			icon: ClipboardIcon,
			color: 'blue',
			disponible: true
		},
		{
			id: 'en_ejecucion' as const,
			titulo: 'En ejecución',
			descripcion: 'Ya empezó. Inscripciones solo por admin/encargado (carga inicial / masiva).',
			icon: ChevronRightIcon,
			color: 'green',
			disponible: true
		},
		{
			id: 'historico' as const,
			titulo: 'Histórico / Cerrado',
			descripcion: 'Ya cerró. Solo archivo. Costo editable, docentes opcionales, fechas opcionales.',
			icon: FileTextIcon,
			color: 'amber',
			disponible: true
		}
	];
</script>

<Modal
	{isOpen}
	title="Nuevo Programa"
	{onClose}
	maxWidth="sm:max-w-3xl"
>
	{#if !tipoSeleccionado}
		<!-- PASO 1: Seleccionar tipo -->
		<div class="space-y-3 p-2">
			<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
				Selecciona el tipo de programa que querés crear:
			</p>

			{#each TIPOS as tipo (tipo.id)}
				{@const Icon = tipo.icon}
				{@const colorClasses = {
					blue: 'border-blue-300 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
					green: 'border-green-300 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20',
					amber: 'border-amber-300 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
				}[tipo.color]}

				<button
					type="button"
					class="w-full text-left p-4 border-2 rounded-lg transition-colors
						{colorClasses}
						{!tipo.disponible ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
					disabled={!tipo.disponible}
					onclick={() => tipo.disponible && (tipoSeleccionado = tipo.id)}
				>
					<div class="flex items-start gap-3">
						<div class="flex-shrink-0 mt-0.5">
							<Icon class="w-6 h-6" />
						</div>
						<div class="flex-1">
							<div class="flex items-center justify-between">
								<h3 class="font-semibold text-base text-gray-900 dark:text-gray-100">
									{tipo.titulo}
								</h3>
								{#if !tipo.disponible}
									<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
										Próximamente
									</span>
								{:else}
									<ChevronRightIcon class="w-5 h-5 text-gray-400" />
								{/if}
							</div>
							<p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
								{tipo.descripcion}
							</p>
						</div>
					</div>
				</button>
			{/each}
		</div>

	{:else if tipoSeleccionado === 'historico'}
		<!-- PASO 2: Form histórico -->
		<HistoricalCourseForm
			onSuccess={handleHistoricalSuccess}
			onCancel={() => (tipoSeleccionado = null)}
		/>
	{:else if tipoSeleccionado === 'proximo' || tipoSeleccionado === 'en_ejecucion'}
		<!-- F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): para programas
		     proximos y en ejecucion usamos el CourseForm normal, pasando el
		     tipo preseleccionado para que el form se inicialice correctamente
		     y el backend sepa que estado_override aplicar. -->
		<CourseForm
			course={null}
			initialTipoPrograma={tipoSeleccionado}
			onSuccess={handleActiveSuccess}
			onCancel={handleActiveCancel}
		/>
	{/if}
</Modal>
