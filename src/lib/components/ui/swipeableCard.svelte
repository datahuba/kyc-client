<!--
  SwipeableCard — MOBILE-004
  Card que se puede arrastrar horizontalmente para revelar acciones.
  Patrón nativo de WhatsApp/Telegram: swipe left revela acciones.
  
  Uso:
    <SwipeableCard
      leftActions={[{ label: 'Eliminar', color: 'red', onClick: () => delete() }]}
      rightActions={[{ label: 'Editar', color: 'blue', onClick: () => edit() }]}
    >
      <Card>... contenido ...</Card>
    </SwipeableCard>
  
  Comportamiento:
  - Drag horizontal: revela acciones del lado opuesto
  - Threshold 60px muestra botones
  - Threshold 150px al soltar ejecuta la primera acción
  - Click normal no se ve afectado
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	export interface SwipeAction {
		label: string;
		icon?: any; // Componente
		color?: 'red' | 'blue' | 'green' | 'amber' | 'gray';
		onClick: () => void;
	}

	interface Props {
		leftActions?: SwipeAction[]; // Acciones que aparecen al arrastrar a la derecha
		rightActions?: SwipeAction[]; // Acciones que aparecen al arrastrar a la izquierda
		children?: any;
		class?: string;
	}

	let {
		leftActions = [],
		rightActions = [],
		children,
		class: className = ''
	}: Props = $props();

	let dragOffset = $state(0);
	let isDragging = $state(false);
	let startX = 0;
	let isMobile = $state(false);

	$effect(() => {
		isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
	});

	const colorClasses: Record<string, string> = {
		red: 'bg-red-500 text-white',
		blue: 'bg-blue-500 text-white',
		green: 'bg-green-500 text-white',
		amber: 'bg-amber-500 text-white',
		gray: 'bg-gray-500 text-white'
	};

	function handleTouchStart(e: TouchEvent) {
		if (!isMobile) return;
		startX = e.touches[0].clientX;
		isDragging = true;
		dragOffset = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const currentX = e.touches[0].clientX;
		const delta = currentX - startX;
		// Limitar según qué acciones hay
		if (delta > 0 && leftActions.length > 0) {
			// Swipe derecha: limita según el ancho de las acciones
			const maxWidth = leftActions.length * 80;
			dragOffset = Math.min(delta * 0.5, maxWidth);
		} else if (delta < 0 && rightActions.length > 0) {
			const maxWidth = rightActions.length * 80;
			dragOffset = Math.max(delta * 0.5, -maxWidth);
		} else {
			dragOffset = 0;
		}
	}

	function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		const THRESHOLD = 150;
		if (dragOffset > THRESHOLD && leftActions.length > 0) {
			leftActions[0].onClick();
		} else if (dragOffset < -THRESHOLD && rightActions.length > 0) {
			rightActions[0].onClick();
		}
		dragOffset = 0;
	}

	const cardStyle = $derived(
		isDragging && dragOffset !== 0
			? `transform: translateX(${dragOffset}px); transition: none;`
			: `transform: translateX(0); transition: transform 200ms ${cubicOut ? 'ease-out' : ''};`
	);

	function handleActionClick(action: SwipeAction) {
		action.onClick();
		dragOffset = 0;
	}
</script>

<div class={`relative overflow-hidden ${className}`} style="border-radius: inherit;">
	<!-- Acciones izquierdas (reveladas al arrastrar a la derecha) -->
	{#if leftActions.length > 0}
		<div
			class="absolute inset-y-0 left-0 flex items-stretch pointer-events-none z-0"
			style="width: {Math.max(0, dragOffset)}px;"
		>
			{#each leftActions as action (action.label)}
				<button
					type="button"
					onclick={() => handleActionClick(action)}
					class={`flex-1 flex items-center justify-center font-medium text-sm px-3 min-w-0 ${colorClasses[action.color ?? 'gray']} ${dragOffset > 60 ? 'pointer-events-auto' : ''}`}
				>
					{#if action.icon}{@render action.icon()}{/if}
					<span class="truncate ml-1">{action.label}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- Acciones derechas (reveladas al arrastrar a la izquierda) -->
	{#if rightActions.length > 0}
		<div
			class="absolute inset-y-0 right-0 flex items-stretch pointer-events-none z-0"
			style="width: {Math.max(0, -dragOffset)}px;"
		>
			{#each rightActions as action (action.label)}
				<button
					type="button"
					onclick={() => handleActionClick(action)}
					class={`flex-1 flex items-center justify-center font-medium text-sm px-3 min-w-0 ${colorClasses[action.color ?? 'gray']} ${dragOffset < -60 ? 'pointer-events-auto' : ''}`}
				>
					<span class="truncate mr-1">{action.label}</span>
					{#if action.icon}{@render action.icon()}{/if}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Card principal -->
	<div
		class="relative z-10 bg-white dark:bg-dark-surface"
		style={cardStyle}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		ontouchend={handleTouchEnd}
	>
		{@render children?.()}
	</div>
</div>
