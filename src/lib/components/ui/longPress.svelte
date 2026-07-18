<!--
  LongPress — MOBILE-006
  Wrapper que detecta long-press (>500ms) en un elemento hijo.
  Dispara haptic feedback en tap.
  
  Uso:
    <LongPress onLongPress={() => showContextMenu()}>
      <Card>...</Card>
    </LongPress>
  
  Notas:
  - Mobile + desktop (mouse con timer similar)
  - Haptic feedback en long-press (vibrate 20ms)
  - onContextMenu nativo se preserva (right-click en desktop)
-->
<script lang="ts">
	interface Props {
		/** Duración en ms para considerar long-press (default 500) */
		threshold?: number;
		/** Callback al detectar long-press */
		onLongPress?: (e: Event) => void;
		/** Callback al hacer click normal (sin long-press) */
		onShortPress?: (e: Event) => void;
		children?: any;
		class?: string;
	}

	let {
		threshold = 500,
		onLongPress,
		onShortPress,
		children,
		class: className = ''
	}: Props = $props();

	let pressTimer: any = null;
	let isPressed = $state(false);
	let longPressFired = $state(false);

	function haptic(ms = 20) {
		if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
			try { navigator.vibrate(ms); } catch (_) { /* ignore */ }
		}
	}

	function start(e: Event) {
		longPressFired = false;
		isPressed = true;
		pressTimer = setTimeout(() => {
			if (isPressed) {
				longPressFired = true;
				haptic(20);
				onLongPress?.(e);
			}
		}, threshold);
	}

	function cancel() {
		isPressed = false;
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleClick(e: Event) {
		if (longPressFired) {
			// El long-press ya manejó esto, no disparar short-press
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		onShortPress?.(e);
	}

	function handleContextMenu(e: MouseEvent) {
		// Permitir context menu nativo en desktop (right-click)
		// Solo prevenir si no estamos en mobile
		if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
			e.preventDefault();
			start(e);
		}
	}
</script>

<div
	class={`${className} ${isPressed ? 'scale-[0.98] transition-transform' : 'transition-transform'}`}
	onmousedown={start}
	onmouseup={cancel}
	onmouseleave={cancel}
	ontouchstart={start}
	ontouchend={cancel}
	ontouchcancel={cancel}
	onclick={handleClick}
	oncontextmenu={handleContextMenu}
	role="button"
	tabindex="0"
>
	{@render children?.()}
</div>
