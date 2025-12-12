<script lang="ts">
	import { studentService } from '$lib/services';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { alert } from '$lib/utils';
	import { KeyIcon, CheckIcon } from '$lib/icons/outline';

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);

	async function handleSubmit() {
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
			});
			alert('success', 'Contraseña actualizada correctamente');
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
		} catch (e: any) {
			alert('error', e.message || 'Error al actualizar contraseña');
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
				<Input
					label="Contraseña Actual"
					id="current_password"
					type="password"
					bind:value={currentPassword}
					required
					placeholder="Ingrese su contraseña actual"
				/>

				<div class="border-t border-gray-100 dark:border-gray-700 my-4"></div>

				<Input
					label="Nueva Contraseña"
					id="new_password"
					type="password"
					bind:value={newPassword}
					required
					placeholder="Mínimo 5 caracteres"
				/>

				<Input
					label="Confirmar Nueva Contraseña"
					id="confirm_password"
					type="password"
					bind:value={confirmPassword}
					required
					placeholder="Repita la nueva contraseña"
				/>
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
