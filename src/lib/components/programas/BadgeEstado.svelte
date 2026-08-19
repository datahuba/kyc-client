<script lang="ts">
	/**
	 * F-080 · Badge de estado del programa
	 * Reusable: muestra el estado con color, ícono y texto.
	 *
	 * Colores:
	 *   - programado      → amarillo (por iniciar)
	 *   - en_ejecucion   → verde (corriendo)
	 *   - cerrado        → gris (finalizado)
	 */
	export let estado: 'programado' | 'en_ejecucion' | 'cerrado' | string;
	export let size: 'sm' | 'md' = 'md';

	const COLORS = {
		programado: {
			bg: 'bg-amber-100',
			text: 'text-amber-800',
			border: 'border-amber-300',
			label: 'POR INICIAR',
			icon: '🟡'
		},
		en_ejecucion: {
			bg: 'bg-green-100',
			text: 'text-green-800',
			border: 'border-green-300',
			label: 'EN EJECUCIÓN',
			icon: '🟢'
		},
		cerrado: {
			bg: 'bg-slate-200',
			text: 'text-slate-700',
			border: 'border-slate-400',
			label: 'FINALIZADO',
			icon: '⚫'
		}
	} as const;

	$: config = COLORS[estado as keyof typeof COLORS] || COLORS.en_ejecucion;
	$: sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1';
</script>

<span
	class="inline-flex items-center gap-1 rounded-full border font-semibold {config.bg} {config.text} {config.border} {sizeClass}"
	title={config.label}
>
	<span class="text-[10px]">{config.icon}</span>
	<span>{config.label}</span>
</span>
