<script lang="ts">
	import Modal from '$lib/components/ui/modal.svelte';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	const beneficios = [
		{
			titulo: 'Docentes de Alto Nivel',
			descripcion: 'Formación a cargo de profesionales con experiencia académica y de campo en Contaduría Pública.',
			icon: 'M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z'
		},
		{
			titulo: 'Aula Virtual UAGRM',
			descripcion: 'Acceso a la plataforma virtual institucional para seguimiento de notas, materiales y clases.',
			icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'
		},
		{
			titulo: 'Certificación Institucional',
			descripcion: 'Diplomas y certificados avalados por la Universidad Autónoma Gabriel René Moreno.',
			icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		{
			titulo: 'Facilidades de Pago',
			descripcion: 'Planes de pago en cuotas y descuentos según convenios institucionales y becas disponibles.',
			icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08-.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
		},
		{
			titulo: 'Modalidades Flexibles',
			descripcion: 'Programas presenciales, virtuales e híbridos adaptados a tu disponibilidad de tiempo.',
			icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
		},
		{
			titulo: 'Red de Egresados',
			descripcion: 'Forma parte de la comunidad de profesionales graduados de Postgrado UAGRM.',
			icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
		}
	];
</script>

<Modal {isOpen} title="Beneficios del Postgrado" {onClose} maxWidth="sm:max-w-3xl">
	<div class="p-2 sm:p-4">
		<p class="text-sm text-gray-500 dark:text-gray-400 mb-5">
			Ventajas de estudiar en la Escuela de Postgrado de Contaduría Pública, UAGRM.
		</p>
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto pr-1">
			{#each beneficios as b}
				<div class="flex gap-3 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
					<div class="shrink-0 p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
						<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d={b.icon} />
						</svg>
					</div>
					<div class="min-w-0">
						<h3 class="text-sm font-bold text-gray-900 dark:text-white">{b.titulo}</h3>
						<p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{b.descripcion}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</Modal>
