<!--
  NumberStepper — MOBILE-010
  Input numérico con botones +/- estilo iOS/Material 3.
  En mobile el teclado numérico ya aparece por type="number",
  pero los botones +/- permiten ajustar sin tipear.
  
  Uso:
    <NumberStepper bind:value={form.monto} min={0} max={1000000} step={100} suffix="Bs" />
  
  Comportamiento:
  - Long-press en +/-: auto-incrementa/decrementa (1 cada 100ms)
  - onChange se llama cuando el valor cambia
  - Input directo permitido
-->
<script lang="ts">
	import { PlusIcon } from '$lib/icons/outline';

	interface Props {
		value: number;
		min?: number;
		max?: number;
		step?: number;
		suffix?: string;
		prefix?: string;
		disabled?: boolean;
		ariaLabel?: string;
		onChange?: (value: number) => void;
	}

	let {
		value = $bindable(0),
		min = 0,
		max = Number.MAX_SAFE_INTEGER,
		step = 1,
		suffix = '',
		prefix = '',
		disabled = false,
		ariaLabel = 'Cantidad',
		onChange
	}: Props = $props();

	let intervalId: any = null;
	let longPressTimer: any = null;

	function clamp(v: number) {
		if (isNaN(v)) return min;
		return Math.max(min, Math.min(max, v));
	}

	function increment() {
		if (disabled) return;
		const next = clamp(value + step);
		if (next !== value) {
			value = next;
			onChange?.(value);
		}
	}

	function decrement() {
		if (disabled) return;
		const next = clamp(value - step);
		if (next !== value) {
			value = next;
			onChange?.(value);
		}
	}

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		const parsed = parseFloat(target.value);
		if (!isNaN(parsed)) {
			const next = clamp(parsed);
			value = next;
			onChange?.(value);
		}
	}

	function startLongPress(action: () => void) {
		if (disabled) return;
		longPressTimer = setTimeout(() => {
			intervalId = setInterval(action, 100);
		}, 400);
	}

	function stopLongPress() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
		if (intervalId) {
			clearInterval(intervalId);
			intervalId = null;
		}
	}
</script>

<div
	class={`inline-flex items-stretch rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden ${disabled ? 'opacity-50' : ''}`}
	role="group"
	aria-label={ariaLabel}
>
	<!-- Botón menos -->
	<button
		type="button"
		onclick={decrement}
		onmousedown={() => startLongPress(decrement)}
		onmouseup={stopLongPress}
		onmouseleave={stopLongPress}
		ontouchstart={() => startLongPress(decrement)}
		ontouchend={stopLongPress}
		disabled={disabled || value <= min}
		class="px-3 sm:px-4 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed select-none touch-manipulation"
		aria-label="Decrementar"
	>
		<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="size-4" aria-hidden="true">
			<path fill-rule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 10Z" clip-rule="evenodd" />
		</svg>
	</button>

	<!-- Input con prefix/suffix -->
	<div class="flex items-center min-w-0 border-x border-gray-300 dark:border-gray-700">
		{#if prefix}
			<span class="px-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">{prefix}</span>
		{/if}
		<input
			type="number"
			inputmode="decimal"
			{value}
			{min}
			{max}
			{step}
			{disabled}
			oninput={handleInput}
			class="w-full min-w-0 px-2 py-2.5 sm:py-2 text-center text-sm sm:text-base font-medium text-gray-900 dark:text-white bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
			aria-label={ariaLabel}
		/>
		{#if suffix}
			<span class="px-2 text-sm text-gray-500 dark:text-gray-400 shrink-0">{suffix}</span>
		{/if}
	</div>

	<!-- Botón más -->
	<button
		type="button"
		onclick={increment}
		onmousedown={() => startLongPress(increment)}
		onmouseup={stopLongPress}
		onmouseleave={stopLongPress}
		ontouchstart={() => startLongPress(increment)}
		ontouchend={stopLongPress}
		disabled={disabled || value >= max}
		class="px-3 sm:px-4 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed select-none touch-manipulation"
		aria-label="Incrementar"
	>
		<PlusIcon class="size-4" />
	</button>
</div>
