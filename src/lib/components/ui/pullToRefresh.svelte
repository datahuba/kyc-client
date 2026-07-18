<!--
  PullToRefresh — MOBILE-002
  Componente que envuelve una zona scrollable y detecta el gesto de
  "tirar para refrescar" nativo de iOS/Android.
  
  Uso:
    <PullToRefresh onRefresh={async () => { await loadStudents(); }}>
      <div class="overflow-y-auto">
        ... lista ...
      </div>
    </PullToRefresh>
  
  Notas:
  - Solo en mobile (sm:hidden wrapper)
  - Threshold 80px muestra el spinner
  - Threshold 120px dispara el refresh al soltar
  - Bloquea el scroll del contenedor mientras se arrastra
-->
<script lang="ts">
	import { LoaderIcon } from '$lib/icons/outline';

	interface Props {
		/** Función async que se ejecuta al soltar tras superar el threshold */
		onRefresh?: () => Promise<void> | void;
		/** Threshold en px para mostrar el spinner */
		showThreshold?: number;
		/** Threshold en px para disparar el refresh al soltar */
		refreshThreshold?: number;
		children?: any;
	}

	let {
		onRefresh,
		showThreshold = 80,
		refreshThreshold = 120,
		children
	}: Props = $props();

	let containerRef = $state<HTMLDivElement | null>(null);
	let dragOffset = $state(0);
	let isDragging = $state(false);
	let isRefreshing = $state(false);
	let startY = 0;
	let isMobile = $state(false);

	$effect(() => {
		isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
	});

	function handleTouchStart(e: TouchEvent) {
		if (!isMobile || isRefreshing) return;
		// Solo activar si el scroll está en el top
		const scrollEl = e.currentTarget as HTMLElement;
		if (scrollEl.scrollTop > 0) return;
		startY = e.touches[0].clientY;
		isDragging = true;
		dragOffset = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const currentY = e.touches[0].clientY;
		const delta = currentY - startY;
		if (delta > 0) {
			dragOffset = delta;
			// Resistencia tipo iOS: el drag se reduce a medida que baja
			e.preventDefault();
		} else {
			dragOffset = 0;
		}
	}

	async function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;
		if (dragOffset >= refreshThreshold && onRefresh) {
			isRefreshing = true;
			try {
				await onRefresh();
			} finally {
				isRefreshing = false;
				dragOffset = 0;
			}
		} else {
			dragOffset = 0;
		}
	}

	const pullStyle = $derived(
		isDragging && dragOffset > 0
			? `transform: translateY(${dragOffset}px); transition: none;`
			: ''
	);

	const spinnerStyle = $derived(
		`opacity: ${Math.min(1, dragOffset / showThreshold)}; transform: rotate(${dragOffset * 3}deg);`
	);
</script>

<div
	bind:this={containerRef}
	class="relative w-full h-full overflow-hidden"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
>
	<!-- Indicador de pull -->
	<div
		class="absolute top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-10"
		style="height: {Math.max(0, dragOffset)}px; {isRefreshing ? 'opacity: 1; height: 48px;' : ''}"
	>
		<div
			class="flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-gray-800 shadow-lg ring-1 ring-gray-200 dark:ring-gray-700"
			style={spinnerStyle}
		>
			<LoaderIcon class="size-5 text-primary-600 {isRefreshing ? 'animate-spin' : ''}" />
		</div>
	</div>

	<div style={pullStyle} class="h-full overflow-y-auto">
		{@render children?.()}
	</div>
</div>
