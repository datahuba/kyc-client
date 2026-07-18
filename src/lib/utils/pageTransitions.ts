/**
 * pageTransitions — Wrapper que aplica View Transitions API del browser
 * para transicionar entre páginas SvelteKit de forma nativa.
 *
 * @example
 *   import { pageTransition } from '$lib/utils/pageTransitions';
 *   // en +layout.svelte onMount:
 *   onMount(() => pageTransition());
 */

const VIEW_TRANSITION_SUPPORTED = typeof document !== 'undefined' && 'startViewTransition' in document;

/**
 * Configura el hook onNavigate de SvelteKit para triggerear transiciones
 * nativas entre páginas. Solo funciona si el browser soporta View Transitions API.
 */
export function setupPageTransitions() {
	if (typeof window === 'undefined') return;
	if (!VIEW_TRANSITION_SUPPORTED) return;

	// Hook into SvelteKit navigation start
	// (SvelteKit expone los hooks via document events)
	const originalPushState = history.pushState;
	const originalReplaceState = history.replaceState;

	(history as any).pushState = function (...args: any[]) {
		triggerTransition(() => originalPushState.apply(this, args as Parameters<typeof originalPushState>));
	};

	(history as any).replaceState = function (...args: any[]) {
		// No animar replace (mantener instantáneo)
		originalReplaceState.apply(this, args as Parameters<typeof originalReplaceState>);
	};

	// También hookear back/forward
	window.addEventListener('popstate', () => {
		// SvelteKit ya maneja la navegación, no necesitamos duplicar
	});
}

function triggerTransition(callback: () => void) {
	if (!VIEW_TRANSITION_SUPPORTED) {
		callback();
		return;
	}
	(document as any).startViewTransition(callback);
}

/**
 * Devuelve true si el browser soporta View Transitions API.
 */
export function isViewTransitionSupported(): boolean {
	return VIEW_TRANSITION_SUPPORTED;
}
