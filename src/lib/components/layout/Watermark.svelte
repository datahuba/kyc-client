<script lang="ts">
	// ISSUE-X-WATERMARK: Marca de agua institucional sutil en el área de
	// contenido principal (columna Header + main, sin cubrir el Sidebar).
	// Puramente decorativa (aria-hidden, pointer-events desactivados) para
	// no interferir con la navegación ni la accesibilidad.
	//
	// Posicionamiento: `absolute inset-0` dentro del contenedor de columna
	// (que debe ser `relative` y `overflow-hidden`), permaneciendo fija
	// visualmente respecto a esa columna sin desplazarse con el scroll
	// interno de `<main>`. Opacidad muy baja para no afectar la legibilidad
	// del contenido en ningún tema.
</script>

<div
	aria-hidden="true"
	class="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
>
	<img
		src="/images/logo_empty_datahub.png"
		alt=""
		class="w-[28rem] max-w-[65vw] opacity-[0.04] select-none dark:opacity-[0.07]"
	/>
</div>
