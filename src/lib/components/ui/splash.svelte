<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	/**
	 * Splash screen nativo (iOS launch screen / Android splash).
	 * Se muestra al primer load de la app y desaparece con fade.
	 * Inspirado en launch screens nativos: logo centrado, fondo de marca.
	 */
	interface Props {
		minDuration?: number; // ms mínimo visible (default 800ms para que se sienta "app native")
		appName?: string;
		subtitle?: string;
		logoSrc?: string;
	}

	let {
		minDuration = 800,
		appName = 'Postgrado UAGRM',
		subtitle = 'Cargando...',
		logoSrc = '/images/logo_uagrm_fondo_blanco.jpg',
	}: Props = $props();

	let visible = $state(true);
	let startTime = 0;

	onMount(() => {
		startTime = Date.now();
		const checkReady = () => {
			const elapsed = Date.now() - startTime;
			if (elapsed >= minDuration) {
				visible = false;
			} else {
				setTimeout(checkReady, 50);
			}
		};
		// Esperar a que window 'load' event o minDuration
		if (document.readyState === 'complete') {
			checkReady();
		} else {
			window.addEventListener('load', () => checkReady());
		}
	});
</script>

{#if visible}
	<div
		class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-dark-background dark:via-dark-surface dark:to-dark-primary"
		transition:fade={{ duration: 400 }}
		role="status"
		aria-label="Cargando aplicación"
	>
		<!-- Logo con pulse animation -->
		<div class="flex flex-col items-center gap-5 px-8">
			<div class="relative">
				<!-- Pulse ring -->
				<div class="absolute inset-0 rounded-3xl bg-primary-500/10 dark:bg-primary-400/10 animate-ping"></div>
				<!-- Logo container -->
				<div class="relative size-24 sm:size-28 rounded-3xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex items-center justify-center p-3 animate-pulse-slow">
					<img src={logoSrc} alt="UAGRM" class="size-full object-contain" />
				</div>
			</div>

			<!-- App name -->
			<div class="flex flex-col items-center gap-1 text-center">
				<h1 class="text-xl sm:text-2xl font-extrabold text-primary-800 dark:text-dark-tertiary">
					{appName}
				</h1>
				<p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 font-medium">
					{subtitle}
				</p>
			</div>

			<!-- Loading indicator -->
			<div class="mt-2 flex items-center gap-1.5">
				<div class="size-2 rounded-full bg-primary-600 dark:bg-primary-400 animate-bounce" style="animation-delay: 0ms"></div>
				<div class="size-2 rounded-full bg-primary-600 dark:bg-primary-400 animate-bounce" style="animation-delay: 150ms"></div>
				<div class="size-2 rounded-full bg-primary-600 dark:bg-primary-400 animate-bounce" style="animation-delay: 300ms"></div>
			</div>
		</div>

		<!-- Footer institucional -->
		<div class="absolute bottom-6 sm:bottom-8 left-0 right-0 text-center px-4">
			<p class="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 font-medium">
				Unidad de Postgrado · Ciencias Contables
			</p>
		</div>
	</div>
{/if}

<style>
	@keyframes pulse-slow {
		0%, 100% {
			transform: scale(1);
			opacity: 1;
		}
		50% {
			transform: scale(1.04);
			opacity: 0.95;
		}
	}
	.animate-pulse-slow {
		animation: pulse-slow 2s ease-in-out infinite;
	}
</style>
