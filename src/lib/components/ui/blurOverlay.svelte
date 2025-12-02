<script lang="ts">
	//blurOverlay.svelte
	import { scale } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		children: Snippet;
		class?: string;
		inDuration?: number;
		outDuration?: number;
	}

	let { children, class: className = '', inDuration = 300, outDuration = 300 }: Props = $props();
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-slate-500/30 shadow-lg backdrop-blur-sm"
	aria-label="Close modal"
>
	<div
		class="my-auto flex h-full w-full flex-col sm:h-auto sm:w-auto {className}"
		in:scale={{ duration: inDuration }}
		out:scale={{ duration: outDuration }}
	>
		{@render children()}
	</div>
</div>
