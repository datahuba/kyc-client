<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/stores/themeStore';
	import Splash from '$lib/components/ui/splash.svelte';
	import { setupPageTransitions } from '$lib/utils/pageTransitions';

	let { children } = $props();

	onMount(() => {
		initTheme();
		setupPageTransitions();

		// KEYBOARD-001: En mobile, cuando el usuario hace focus en un input,
		// el browser NO hace scrollIntoView automático al subir el keyboard.
		// Este handler garantiza que el input quede visible sobre el keyboard.
		const isMobile = window.matchMedia('(max-width: 768px)').matches;
		if (isMobile) {
			const onFocusIn = (e: FocusEvent) => {
				const target = e.target as HTMLElement | null;
				if (!target) return;
				const tag = target.tagName;
				if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') {
					// Esperar al siguiente frame para que el browser ya haya
					// procesado el focus y empiece a subir el keyboard
					requestAnimationFrame(() => {
						setTimeout(() => {
							try {
								target.scrollIntoView({
									behavior: 'smooth',
									block: 'center'
								});
							} catch (_) {
								/* ignore */
							}
						}, 250);
					});
				}
			};
			document.addEventListener('focusin', onFocusIn);
			return () => document.removeEventListener('focusin', onFocusIn);
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<!-- PWA / mobile web app -->
	<meta name="theme-color" content="#8a1f2f" media="(prefers-color-scheme: light)" />
	<meta name="theme-color" content="#0a1524" media="(prefers-color-scheme: dark)" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="Postgrado UAGRM" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="application-name" content="Postgrado UAGRM" />
	<meta name="format-detection" content="telephone=no" />
</svelte:head>

<Splash minDuration={800} />

{@render children()}
