/**
 * pageTransitions — Wrapper que aplica View Transitions API del browser
 * para transicionar entre páginas SvelteKit de forma nativa.
 *
 * @example
 *   import { pageTransition } from '$lib/utils/pageTransitions';
 *   // en +layout.svelte onMount:
 *   onMount(() => pageTransition());
 */

import { onNavigate } from '$app/navigation';

export function setupPageTransitions() {
	if (typeof document === 'undefined' || !document.startViewTransition) return;

	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
}

export function isViewTransitionSupported(): boolean {
	return typeof document !== 'undefined' && 'startViewTransition' in document;
}
