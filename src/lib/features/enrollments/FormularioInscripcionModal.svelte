<script lang="ts">
	import Modal from '$lib/components/ui/modal.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Button from '$lib/components/ui/button.svelte';

	// Formulario de inscripción editable en línea. Pre-llena los datos que ya
	// tenemos del estudiante y permite completar el resto (profesión, lugar de
	// trabajo, referencia laboral). Al generar, abre una ventana con el formato
	// oficial listo para "Guardar como PDF / Imprimir" (sin dependencias extra).
	interface Props {
		isOpen: boolean;
		onClose: () => void;
		programa?: string;
		student?: any;
	}

	let { isOpen, onClose, programa = '', student = null }: Props = $props();

	let data = $state({
		nombre: '',
		apellidos: '',
		carnet: '',
		residencia: '',
		celular: '',
		profesion: '',
		lugarTrabajo: '',
		refLaboral: '',
		correo: ''
	});

	// Pre-llenado desde el perfil del estudiante cada vez que se abre.
	$effect(() => {
		if (isOpen && student) {
			const nombreCompleto = (student.nombre || '').trim();
			data = {
				nombre: nombreCompleto,
				apellidos: '',
				carnet: student.carnet || '',
				residencia: student.domicilio || '',
				celular: student.celular || '',
				profesion: '',
				lugarTrabajo: '',
				refLaboral: '',
				correo: student.email || ''
			};
		}
	});

	function esc(v: string): string {
		return (v || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	function generarPDF() {
		const fecha = new Date().toLocaleDateString('es-BO', { year: 'numeric', month: 'long', day: 'numeric' });
		const filas = [
			['NOMBRE', data.nombre],
			['APELLIDOS', data.apellidos],
			['CARNET DE IDENTIDAD', data.carnet],
			['LUGAR DE RESIDENCIA', data.residencia],
			['N° CELULAR', data.celular],
			['PROFESIÓN/CARGO', data.profesion],
			['LUGAR DE TRABAJO', data.lugarTrabajo],
			['N° DE REFERENCIA LABORAL', data.refLaboral],
			['CORREO ELECTRÓNICO', data.correo]
		];
		const filasHtml = filas
			.map(
				([l, v]) =>
					`<tr><td class="lbl">${esc(l)}</td><td class="val">${esc(v)}</td></tr>`
			)
			.join('');

		const html = `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>Formulario de Inscripción</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 40px; }
  .head { text-align: center; margin-bottom: 18px; }
  .head h1 { font-size: 15px; margin: 2px 0; font-style: italic; }
  .head h2 { font-size: 13px; margin: 2px 0; font-style: italic; }
  .head h3 { font-size: 11px; margin: 2px 0; font-style: italic; font-weight: normal; }
  .titulo { text-align:center; font-weight: bold; border: 1.5px solid #000; padding: 8px; margin: 14px 0; letter-spacing: .5px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td { border: 1px solid #000; padding: 8px 10px; font-size: 12px; vertical-align: middle; }
  td.lbl { width: 38%; font-weight: bold; background: #f2f2f2; text-transform: uppercase; }
  td.val { width: 62%; min-height: 20px; }
  .meta td.lbl { width: 25%; }
  .seccion { font-weight: bold; margin: 16px 0 6px; }
  .firma { margin-top: 60px; text-align: center; }
  .firma .linea { border-top: 1px solid #000; width: 260px; margin: 0 auto 4px; }
  @media print { body { margin: 18mm; } }
</style></head>
<body>
  <div class="head">
    <h1>Universidad Autónoma Gabriel René Moreno</h1>
    <h2>"UNIDAD DE POSGRADO"</h2>
    <h3>Facultad de Ciencias Contables, Auditoría, Sistemas de Control de Gestión y Finanzas.</h3>
  </div>
  <div class="titulo">FORMULARIO DE INSCRIPCIÓN &nbsp;&nbsp; GESTIÓN: 2025</div>
  <table class="meta">
    <tr><td class="lbl">PROGRAMA</td><td class="val">${esc(programa)}</td></tr>
  </table>
  <div class="seccion">DATOS PERSONALES</div>
  <table>${filasHtml}</table>
  <p style="margin-top:14px;font-size:12px;"><strong>Fecha:</strong> ${esc(fecha)}</p>
  <div class="firma">
    <div class="linea"></div>
    <div style="font-size:12px;">Nombre del Interesado</div>
    <div style="font-size:12px;font-weight:bold;">Firma Interesado</div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };<\/script>
</body></html>`;

		const w = window.open('', '_blank', 'width=800,height=900');
		if (!w) {
			alert('Habilita las ventanas emergentes para generar el PDF del formulario.');
			return;
		}
		w.document.open();
		w.document.write(html);
		w.document.close();
	}
</script>

<Modal {isOpen} title="Formulario de Inscripción" {onClose} maxWidth="sm:max-w-2xl">
	<div class="space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Completa tus datos. Al generar, se abrirá el formulario con el formato oficial listo para
			<strong>Guardar como PDF</strong> (o imprimir). Luego súbelo desde la opción "Subir formulario".
		</p>

		<Input label="Programa" value={programa} disabled />

		<div class="grid gap-4 sm:grid-cols-2">
			<Input label="Nombre" bind:value={data.nombre} />
			<Input label="Apellidos" bind:value={data.apellidos} />
			<Input label="Carnet de Identidad" bind:value={data.carnet} inputmode="numeric" />
			<Input label="N° Celular" bind:value={data.celular} inputmode="numeric" />
			<Input label="Lugar de Residencia" bind:value={data.residencia} class="sm:col-span-2" />
			<Input label="Profesión / Cargo" bind:value={data.profesion} />
			<Input label="Lugar de Trabajo" bind:value={data.lugarTrabajo} />
			<Input label="N° de Referencia Laboral" bind:value={data.refLaboral} />
			<Input label="Correo Electrónico" bind:value={data.correo} />
		</div>

		<div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-dark-border">
			<Button variant="secondary" onclick={onClose}>Cerrar</Button>
			<Button onclick={generarPDF}>Generar PDF</Button>
		</div>
	</div>
</Modal>
