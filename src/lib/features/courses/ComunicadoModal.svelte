<script lang="ts">
	import Modal from '$lib/components/ui/modal.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { courseService } from '$lib/services';
	import { alert } from '$lib/utils';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
		courseId: string;
		programa: string;
	}

	let { isOpen, onClose, courseId, programa }: Props = $props();

	// Plantillas predefinidas: al elegir una, rellena asunto/mensaje (editables).
	// Se puede dejar en "Personalizado" y escribir libremente.
	const plantillas: Record<string, { asunto: string; mensaje: string }> = {
		'': { asunto: '', mensaje: '' },
		inicio: {
			asunto: 'Inicio de clases',
			mensaje:
				'Estimado estudiante, le recordamos que las clases del programa inician próximamente. Por favor esté atento al cronograma y asegúrese de tener su documentación y pagos al día.'
		},
		pago: {
			asunto: 'Recordatorio de pago',
			mensaje:
				'Estimado estudiante, le recordamos mantener al día el pago de su colegiatura para conservar su condición de estudiante activo. Puede registrar su pago desde el portal.'
		},
		documentacion: {
			asunto: 'Documentación pendiente',
			mensaje:
				'Estimado estudiante, le recordamos completar la carga de su documentación requerida (formulario de inscripción, carnet, título, etc.) desde su perfil en el portal.'
		},
		reunion: {
			asunto: 'Reunión informativa',
			mensaje:
				'Estimado estudiante, se convoca a una reunión informativa del programa. Le compartiremos los detalles de fecha y hora a la brevedad.'
		}
	};

	let plantillaSel = $state('');
	let asunto = $state('');
	let mensaje = $state('');
	let enviando = $state(false);

	function aplicarPlantilla() {
		const p = plantillas[plantillaSel];
		if (p && plantillaSel) {
			asunto = p.asunto;
			mensaje = p.mensaje;
		}
	}

	// Reinicia al abrir
	$effect(() => {
		if (isOpen) {
			plantillaSel = '';
			asunto = '';
			mensaje = '';
		}
	});

	async function enviar() {
		if (!asunto.trim()) {
			alert('error', 'Ingresa el asunto del comunicado.');
			return;
		}
		if (!mensaje.trim()) {
			alert('error', 'Ingresa el mensaje del comunicado.');
			return;
		}
		enviando = true;
		try {
			const res = await courseService.enviarComunicado(courseId, {
				asunto: asunto.trim(),
				mensaje: mensaje.trim()
			});
			if (res.total_estudiantes === 0) {
				alert('warning', 'El programa no tiene estudiantes inscritos.');
			} else {
				alert(
					'success',
					`Comunicado enviado a ${res.total_estudiantes} estudiante(s). Correos enviados: ${res.correos_enviados}.`
				);
			}
			onClose();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo enviar el comunicado.');
		} finally {
			enviando = false;
		}
	}
</script>

<Modal {isOpen} title="Enviar Comunicado" {onClose} maxWidth="sm:max-w-lg">
	<div class="space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Se enviará a <strong>todos los estudiantes</strong> del programa <strong>{programa}</strong>
			(notificación en el sistema + correo). Elige una plantilla o escribe tu propio mensaje.
		</p>

		<Select label="Plantilla" bind:value={plantillaSel} onchange={aplicarPlantilla}>
			<option value="">Personalizado (escribir libremente)</option>
			<option value="inicio">Inicio de clases</option>
			<option value="pago">Recordatorio de pago</option>
			<option value="documentacion">Documentación pendiente</option>
			<option value="reunion">Reunión informativa</option>
		</Select>

		<Input label="Asunto *" bind:value={asunto} placeholder="Ej. Inicio de clases" />

		<TextArea label="Mensaje *" bind:value={mensaje} rows={6} placeholder="Escribe el comunicado..." />

		<div class="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-dark-border">
			<Button variant="secondary" onclick={onClose} disabled={enviando}>Cancelar</Button>
			<Button onclick={enviar} loading={enviando}>Enviar Comunicado</Button>
		</div>
	</div>
</Modal>
