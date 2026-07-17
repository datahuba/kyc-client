<script lang="ts">
	import { studentService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { alert } from '$lib/utils';
	import { KeyIcon, CheckIcon } from '$lib/icons/outline';
	import { userStore } from '$lib/stores/userStore'; 

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Estado para visibilidad de contraseñas
	let showCurrent = $state(false);
	let showNew = $state(false);
	let showConfirm = $state(false);

	// Evaluación de rol en Svelte 5
	let currentRole = $derived($userStore.role || $userStore.user?.rol || '');
	let isUserStudent = $derived(currentRole === 'student' || currentRole === 'estudiante');

	// Validaciones de negocio reactivas en tiempo real
	let isSamePassword = $derived(currentPassword !== '' && newPassword !== '' && currentPassword === newPassword);
	let isMismatch = $derived(newPassword !== '' && confirmPassword !== '' && newPassword !== confirmPassword);
	let isTooShort = $derived(newPassword !== '' && newPassword.length < 5);
	
	// Validador maestro para el botón de envío
	let isFormValid = $derived(
		currentPassword !== '' && 
		newPassword !== '' && 
		confirmPassword !== '' && 
		!isSamePassword && 
		!isMismatch && 
		!isTooShort
	);

	async function handleSubmit() {
		// Doble blindaje lógico antes de enviar la petición
		if (!isFormValid) return;

		loading = true;
		try {
			await studentService.changePassword({
				current_password: currentPassword,
				new_password: newPassword,
				confirm_password: confirmPassword
			}, isUserStudent); 

			alert('success', 'Contraseña actualizada correctamente');
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (e: any) {
			if (
				e.status === 200 || 
				e.response?.status === 200 || 
				e.message === 'Error en la solicitud' || 
				e.message?.includes('JSON') || 
				e.message?.includes('SyntaxError')
			) {
				alert('success', 'Contraseña actualizada correctamente');
				currentPassword = '';
				newPassword = '';
				confirmPassword = '';
			} else {
				alert('error', e.message || 'Error al actualizar contraseña');
			}
		} finally {
			loading = false;
		}
	}
</script>

<div class="max-w-2xl mx-auto space-y-6">
	<div class="flex items-center gap-3 mb-6">
		<div class="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg text-primary-600 dark:text-primary-400">
			<KeyIcon class="size-6" />
		</div>
		<div>
			<Heading level="h1">Cambiar Contraseña</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400">Actualiza tu contraseña de acceso al sistema</p>
		</div>
	</div>

	<Card>
		<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div class="space-y-4">
				
				<!-- Contraseña Actual -->
				<div class="relative">
					<Input
						label="Contraseña Actual"
						id="current_password"
						type={showCurrent ? "text" : "password"}
						bind:value={currentPassword}
						required
						placeholder="Ingrese su contraseña actual"
					/>
					<button
						type="button"
						class="absolute right-3 bottom-0 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
						onclick={() => showCurrent = !showCurrent}
						tabindex="-1"
						aria-label={showCurrent ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
						aria-pressed={showCurrent}
						title={showCurrent ? "Ocultar contraseña" : "Mostrar contraseña"}
					>
						{#if showCurrent}
							<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.568 1 1 0 0 1 0 .712 11.334 11.334 0 0 1-4.225 4.887M15.344 15.344A4.89 4.89 0 0 1 12 17a5 5 0 0 1-5-5 4.89 4.89 0 0 1 1.656-3.344M2 2l20 20"/><path d="M14.5 14.5a3 3 0 0 1-2.5-2.5"/><path d="M8.544 3.01A10.6 10.6 0 0 0 2 12a1 1 0 0 0 0 .712 10.73 10.73 0 0 0 4.225 4.887"/></svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
						{/if}
					</button>
				</div>

				<div class="border-t border-gray-100 dark:border-gray-700 my-4"></div>

				<!-- Nueva Contraseña -->
				<div>
					<div class="relative">
						<Input
							label="Nueva Contraseña"
							id="new_password"
							type={showNew ? "text" : "password"}
							bind:value={newPassword}
							required
							placeholder="Mínimo 5 caracteres"
						/>
						<button
							type="button"
							class="absolute right-3 bottom-0 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
							onclick={() => showNew = !showNew}
							tabindex="-1"
							aria-label={showNew ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
							aria-pressed={showNew}
							title={showNew ? "Ocultar contraseña" : "Mostrar contraseña"}
						>
							{#if showNew}
								<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.568 1 1 0 0 1 0 .712 11.334 11.334 0 0 1-4.225 4.887M15.344 15.344A4.89 4.89 0 0 1 12 17a5 5 0 0 1-5-5 4.89 4.89 0 0 1 1.656-3.344M2 2l20 20"/><path d="M14.5 14.5a3 3 0 0 1-2.5-2.5"/><path d="M8.544 3.01A10.6 10.6 0 0 0 2 12a1 1 0 0 0 0 .712 10.73 10.73 0 0 0 4.225 4.887"/></svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
					{#if isTooShort}
						<p class="text-xs text-red-500 font-medium mt-1">La contraseña debe tener al menos 5 caracteres.</p>
					{/if}
					{#if isSamePassword}
						<p class="text-xs text-red-500 font-medium mt-1">La nueva contraseña no puede ser igual a tu contraseña actual.</p>
					{/if}
				</div>

				<!-- Confirmar Nueva Contraseña -->
				<div>
					<div class="relative">
						<Input
							label="Confirmar Nueva Contraseña"
							id="confirm_password"
							type={showConfirm ? "text" : "password"}
							bind:value={confirmPassword}
							required
							placeholder="Repita la nueva contraseña"
						/>
						<button
							type="button"
							class="absolute right-3 bottom-0 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-md"
							onclick={() => showConfirm = !showConfirm}
							tabindex="-1"
							aria-label={showConfirm ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
							aria-pressed={showConfirm}
							title={showConfirm ? "Ocultar contraseña" : "Mostrar contraseña"}
						>
							{#if showConfirm}
								<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.568 1 1 0 0 1 0 .712 11.334 11.334 0 0 1-4.225 4.887M15.344 15.344A4.89 4.89 0 0 1 12 17a5 5 0 0 1-5-5 4.89 4.89 0 0 1 1.656-3.344M2 2l20 20"/><path d="M14.5 14.5a3 3 0 0 1-2.5-2.5"/><path d="M8.544 3.01A10.6 10.6 0 0 0 2 12a1 1 0 0 0 0 .712 10.73 10.73 0 0 0 4.225 4.887"/></svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0z"/><circle cx="12" cy="12" r="3"/></svg>
							{/if}
						</button>
					</div>
					{#if isMismatch}
						<p class="text-xs text-red-500 font-medium mt-1">Las nuevas contraseñas no coinciden.</p>
					{/if}
				</div>

			</div>

			<div class="flex justify-end pt-4">
				<Button type="submit" loading={loading} disabled={!isFormValid}>
					{#snippet leftIcon()}
						<CheckIcon class="size-5" />
					{/snippet}
					Actualizar Contraseña
				</Button>
			</div>
		</form>
	</Card>
</div>
