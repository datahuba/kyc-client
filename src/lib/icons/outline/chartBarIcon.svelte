<script lang="ts">
	let { class: className = 'w-5 h-5' } = $props<{ class?: string }>();
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	fill="none"
	viewBox="0 0 24 24"
	stroke="currentColor"
	stroke-width="2"
	aria-hidden="true"
>
	<path
		stroke-linecap="round"
		stroke-linejoin="round"
		d="M3 3v18h18M7 14l4-4 4 4 6-6"
	/>
</svg>
