<!--
  PullToRefresh — MOBILE-002
  Envuelve una lista y detecta el gesto de "tirar para refrescar" nativo de
  iOS/Android.

  Uso:
    <PullToRefresh onRefresh={loadStudents}>
      <StudentTable {students} />
    </PullToRefresh>

  Notas:
  - Solo actúa en mobile (<= 768px). En desktop es un wrapper transparente.
  - Threshold 80px muestra el spinner; 120px dispara el refresh al soltar.
  - Resistencia tipo iOS: el arrastre se amortigua a medida que baja.

  F-FIX-MOBILE-002 (2026-08-16): la primera versión de este componente creaba
  su PROPIO contenedor de scroll (`h-full overflow-hidden` + hijo
  `h-full overflow-y-auto`). En el layout real de la app eso no sirve: el
  scroll vive en `<main class="overflow-y-auto">` (ver routes/app/+layout.svelte),
  así que envolver una página habría anidado dos contenedores de scroll —
  el de adentro scrolleaba y el de afuera no. Por eso el componente quedó
  escrito pero con CERO usos desde el 2026-07-18. Ahora no crea scroll
  propio: busca el ancestro scrollable y solo engancha el gesto cuando ese
  ancestro está arriba del todo (scrollTop === 0).
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

	let { onRefresh, showThreshold = 80, refreshThreshold = 120, children }: Props = $props();

	let wrapperRef = $state<HTMLDivElement | null>(null);
	let dragOffset = $state(0);
	let isDragging = $state(false);
	let isRefreshing = $state(false);
	let isMobile = $state(false);

	let startY = 0;
	let scrollParent: HTMLElement | null = null;

	// Mantener isMobile sincronizado ante rotación / resize.
	$effect(() => {
		if (typeof window === 'undefined') return;
		const mq = window.matchMedia('(max-width: 768px)');
		isMobile = mq.matches;
		const onChange = (e: MediaQueryListEvent) => {
			isMobile = e.matches;
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});

	// Localizar el contenedor que realmente scrollea (en esta app, el <main>).
	$effect(() => {
		if (!wrapperRef) return;
		let el: HTMLElement | null = wrapperRef.parentElement;
		while (el) {
			const overflowY = getComputedStyle(el).overflowY;
			if (overflowY === 'auto' || overflowY === 'scroll') {
				scrollParent = el;
				return;
			}
			el = el.parentElement;
		}
		scrollParent = null; // sin ancestro scrollable: se usa el scroll del documento
	});

	function atTop(): boolean {
		if (scrollParent) return scrollParent.scrollTop <= 0;
		return (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
	}

	function handleTouchStart(e: TouchEvent) {
		if (!isMobile || isRefreshing || !onRefresh) return;
		if (!atTop()) return;
		startY = e.touches[0].clientY;
		isDragging = true;
		dragOffset = 0;
	}

	function handleTouchMove(e: TouchEvent) {
		if (!isDragging) return;
		const delta = e.touches[0].clientY - startY;

		if (delta <= 0) {
			// Se fue para arriba: soltar el gesto y devolver el scroll normal.
			dragOffset = 0;
			isDragging = false;
			return;
		}

		// Resistencia tipo iOS: cuanto más se tira, menos avanza.
		dragOffset = Math.round(delta / (1 + delta / 140));

		// Solo secuestrar el scroll una vez que el gesto es claramente un pull.
		if (dragOffset > 6 && e.cancelable) e.preventDefault();
	}

	async function handleTouchEnd() {
		if (!isDragging) return;
		isDragging = false;

		if (dragOffset >= refreshThreshold && onRefresh) {
			isRefreshing = true;
			dragOffset = 0;
			try {
				await onRefresh();
			} finally {
				isRefreshing = false;
			}
		} else {
			dragOffset = 0;
		}
	}

	// En reposo se deja `transform` SIN declarar a propósito. Un transform
	// distinto de `none` convierte al div en containing block y rompería el
	// posicionamiento de cualquier descendiente `position: fixed` (modales,
	// dropdowns). Solo se aplica mientras el gesto está activo.
	const contentStyle = $derived(
		isDragging && dragOffset > 0
			? `transform: translateY(${dragOffset}px); transition: none;`
			: ''
	);

	const indicatorHeight = $derived(isRefreshing ? 44 : Math.max(0, dragOffset));
	const spinnerOpacity = $derived(isRefreshing ? 1 : Math.min(1, dragOffset / showThreshold));
	const readyToRefresh = $derived(dragOffset >= refreshThreshold);
</script>

<div
	bind:this={wrapperRef}
	class="relative w-full"
	ontouchstart={handleTouchStart}
	ontouchmove={handleTouchMove}
	ontouchend={handleTouchEnd}
	ontouchcancel={handleTouchEnd}
>
	<!-- Indicador de pull: solo ocupa alto mientras se arrastra o refresca -->
	<div
		class="pointer-events-none flex items-start justify-center overflow-hidden"
		style="height: {indicatorHeight}px; transition: {isDragging ? 'none' : 'height 220ms cubic-bezier(0.22, 1, 0.36, 1)'};"
		aria-hidden={indicatorHeight === 0}
	>
		<div
			class="mt-1 flex size-9 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-gray-200 dark:bg-dark-surface dark:ring-dark-border"
			style="opacity: {spinnerOpacity}; transform: rotate({readyToRefresh && !isRefreshing
				? 180
				: 0}deg); transition: transform 180ms ease, opacity 120ms linear;"
		>
			<LoaderIcon class="size-5 text-primary-600 {isRefreshing ? 'animate-spin' : ''}" />
		</div>
	</div>

	<div style={contentStyle}>
		{@render children?.()}
	</div>
</div>

{#if isRefreshing}
	<span class="sr-only" role="status" aria-live="polite">Actualizando…</span>
{/if}
