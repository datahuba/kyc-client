<script lang="ts">
	// ISSUE-Q-PRE: Términos y Condiciones en el primer login del estudiante.
	// Modal BLOQUEANTE (sin botón de cerrar ni click-outside): el estudiante
	// no puede navegar el portal hasta aceptar el reglamento de Postgrado.
	import BlurOverlay from '$lib/components/ui/blurOverlay.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import { studentService } from '$lib/services/student.service';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';

	interface Props {
		isOpen: boolean;
	}

	let { isOpen }: Props = $props();

	let checked = $state(false);
	let isLoading = $state(false);

	async function handleAccept() {
		if (!checked) return;
		isLoading = true;
		try {
			const updated = await studentService.acceptTerms();
			userStore.updateCurrentUser({ terminos_aceptados: updated.terminos_aceptados });
			alert('success', 'Términos y condiciones aceptados. ¡Bienvenido/a!');
		} catch (error: any) {
			alert('error', error?.message || 'No se pudo registrar la aceptación. Intenta nuevamente.');
		} finally {
			isLoading = false;
		}
	}
</script>

{#if isOpen}
	<div class="relative z-[60]" role="dialog" aria-modal="true" aria-labelledby="terms-modal-title">
		<BlurOverlay class="overflow-y-auto">
			<div class="flex items-center justify-center p-4 text-center sm:p-0">
				<div
					class="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white text-left shadow-xl transition-all dark:bg-dark-surface"
				>
					<!-- Header (sin botón de cierre: aceptación obligatoria) -->
					<div
						class="border-b border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-dark-border dark:bg-dark-surface"
					>
						<Heading level="h5">
							<span id="terms-modal-title">Reglamento de Postgrado — UAGRM</span>
						</Heading>
					</div>

					<!-- Body -->
					<div class="w-full p-4 sm:p-6">
						<p class="mb-4 text-sm text-gray-500 dark:text-gray-400">
							Antes de continuar, debes leer y aceptar el reglamento de la Escuela de Postgrado de
							Contaduría Pública de la UAGRM. Esta aceptación es obligatoria para acceder al
							portal.
						</p>

						<div
							class="max-h-[45vh] space-y-3 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-dark-border dark:bg-dark-primary dark:text-gray-300"
						>
							<p>
								<strong>1. Aceptación de condiciones académicas.</strong> El estudiante reconoce y
								acepta las normas académicas, administrativas y financieras vigentes de la Escuela
								de Postgrado de Contaduría Pública de la Universidad Autónoma Gabriel René Moreno
								(UAGRM).
							</p>
							<p>
								<strong>2. Matrícula y colegiatura.</strong> El estudiante no adquiere el estado
								académico de "Activo" ni se habilitan sus módulos hasta cancelar la matrícula
								institucional correspondiente al programa en el que se inscribe.
							</p>
							<p>
								<strong>3. Veracidad de la información.</strong> El estudiante declara que los
								datos personales, académicos y documentos (CI, título, CV, afiliación) cargados en
								la plataforma son verídicos y podrán ser verificados por el CPD (Coordinación de
								Postgrado) en cualquier momento.
							</p>
							<p>
								<strong>4. Uso de la plataforma.</strong> El acceso al Aula Virtual, notificaciones
								y kardex es personal e intransferible. El estudiante es responsable de la
								confidencialidad de sus credenciales de acceso.
							</p>
							<p>
								<strong>5. Comunicaciones institucionales.</strong> El estudiante acepta recibir
								notificaciones transaccionales (pagos, notas, requisitos) a través del correo y la
								plataforma registrados.
							</p>
							<p class="text-xs text-gray-400 dark:text-gray-500">
								Documento resumido con fines de aceptación digital. El reglamento completo está
								disponible en la Coordinación de Postgrado.
							</p>
						</div>

						<label class="mt-4 flex items-start gap-3">
							<input
								type="checkbox"
								bind:checked
								class="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 dark:border-dark-border dark:bg-dark-primary"
							/>
							<span class="text-sm font-medium text-gray-700 dark:text-gray-300">
								He leído y acepto el reglamento de la Escuela de Postgrado de Contaduría Pública -
								UAGRM.
							</span>
						</label>

						<div class="mt-6 flex justify-end">
							<Button onclick={handleAccept} disabled={!checked || isLoading} loading={isLoading}>
								Aceptar y continuar
							</Button>
						</div>
					</div>
				</div>
			</div>
		</BlurOverlay>
	</div>
{/if}
