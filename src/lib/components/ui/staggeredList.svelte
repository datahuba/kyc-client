<!--
  StaggeredList — MOBILE-003
  Envuelve un slot y le pasa el `index` para que las cards internas puedan
  animar con stagger (una a una, no todas a la vez).
  
  Uso:
    <StaggeredList items={students} let:index>
      <Card>...{students[index].nombre}...</Card>
    </StaggeredList>
  
  O con cada item:
    {#each students as student, i (student.id)}
      <StaggeredItem index={i}>
        <Card>...</Card>
      </StaggeredItem>
    {/each}
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	interface Props {
		index: number;
		delayMs?: number; // ms entre cada item
		duration?: number; // duración de la animación por item
		distance?: number; // distancia inicial (px)
		children?: any;
	}

	let {
		index,
		delayMs = 30,
		duration = 300,
		distance = 16,
		children
	}: Props = $props();
</script>

<div in:fly|global={{ y: distance, duration, delay: index * delayMs, easing: cubicOut }}>
	{@render children?.()}
</div>
