<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import { onMount } from 'svelte';
	import { initTheme } from '$lib/stores/themeStore';
	import Splash from '$lib/components/ui/splash.svelte';

	let { children } = $props();

	onMount(() => {
		initTheme();
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

<Splash minDuration={1500} />

{@render children()}
