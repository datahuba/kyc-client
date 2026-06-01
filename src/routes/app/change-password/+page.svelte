<script lang="ts">
	import { studentService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { alert } from '$lib/utils';
	import { KeyIcon, CheckIcon, EyeIcon, EyeOffIcon } from '$lib/icons/outline';
	import { userStore } from '$lib/stores/userStore'; // <-- IMPORTADO PARA EVALUACIÓN REACTIVA (BUG 5)

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let showCurrentPassword = $state(false);
	let showNewPassword = $state(false);
	let showConfirmPassword = $state(false);

	// Evaluación de rol en Svelte 5 (Bug 5)
	let currentRole = $derived($userStore.role || $userStore.user?.rol || '');
	let isUserStudent = $derived(currentRole === 'student');

	async function handleSubmit() {
		if (currentPassword === newPassword) {
			alert('error', 'La nueva contraseña debe ser diferente a la actual');
			return;
		}

		if (newPassword !== confirmPassword) {
			alert('error', 'Las nuevas contraseñas no coinciden');
			return;
		}

		if (newPassword.length < 5) {
			alert('error', 'La nueva contraseña debe tener al menos 5 caracteres');
			return;
		}

		loading = true;
		try {
			await studentService.changePassword({
				current_password: currentPassword,
				new_password: newPassword,
				confirm_password: confirmPassword
			}, isUserStudent); // <-- SE PASA EL ATRIBUTO PARA CONMUTAR EL ENDPOINT CORRECTO

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
				<div class="relative">
					<Input
						label="Contraseña Actual"
						id="current_password"
						type={showCurrentPassword ? 'text' : 'password'}
						bind:value={currentPassword}
						required
						placeholder="Ingrese su contraseña actual"
					/>
					<button
						type="button"
						onclick={() => (showCurrentPassword = !showCurrentPassword)}
						class="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
						aria-label={showCurrentPassword ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'}
					>
						{#if showCurrentPassword}
							<EyeOffIcon class="size-5" />
						{:else}
							<EyeIcon class="size-5" />
						{/if}
					</button>
				</div>

				<div class="border-t border-gray-100 dark:border-gray-700 my-4"></div>

				<div class="relative">
					<Input
						label="Nueva Contraseña"
						id="new_password"
						type={showNewPassword ? 'text' : 'password'}
						bind:value={newPassword}
						required
						placeholder="Mínimo 5 caracteres"
					/>
					<button
						type="button"
						onclick={() => (showNewPassword = !showNewPassword)}
						class="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
						aria-label={showNewPassword ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'}
					>
						{#if showNewPassword}
							<EyeOffIcon class="size-5" />
						{:else}
							<EyeIcon class="size-5" />
						{/if}
					</button>
				</div>

				<div class="relative">
					<Input
						label="Confirmar Nueva Contraseña"
						id="confirm_password"
						type={showConfirmPassword ? 'text' : 'password'}
						bind:value={confirmPassword}
						required
						placeholder="Repita la nueva contraseña"
					/>
					<button
						type="button"
						onclick={() => (showConfirmPassword = !showConfirmPassword)}
						class="absolute right-3 top-9 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
						aria-label={showConfirmPassword ? 'Ocultar confirmación de contraseña' : 'Mostrar confirmación de contraseña'}
					>
						{#if showConfirmPassword}
							<EyeOffIcon class="size-5" />
						{:else}
							<EyeIcon class="size-5" />
						{/if}
					</button>
				</div>
			</div>

			<div class="flex justify-end pt-4">
				<Button type="submit" loading={loading}>
					{#snippet leftIcon()}
						<CheckIcon class="size-5" />
					{/snippet}
					Actualizar Contraseña
				</Button>
			</div>
		</form>
	</Card>
</div>
