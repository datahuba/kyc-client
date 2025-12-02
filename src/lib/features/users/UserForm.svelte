<script lang="ts">
	import { userService } from '$lib/services';
	import type { CreateUserRequest, UserResponse } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon } from '$lib/icons/outline';

	interface Props {
		user?: UserResponse | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { user = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!user);
	let saving = $state(false);

	let formData: CreateUserRequest = $state({
		username: '',
		email: '',
		password: '',
		role: null,
		activo: true
	});

	$effect(() => {
		if (user) {
			formData = {
				username: user.username,
				email: user.email,
				password: '', // Don't populate password
				role: user.role,
				activo: user.activo
			};
		} else {
			formData = {
				username: '',
				email: '',
				password: '',
				role: null,
				activo: true
			};
		}
	});

	async function handleSubmit() {
		saving = true;
		try {
			if (isEditMode && user) {
				await userService.update(user._id, {
					...formData,
					password: formData.password || undefined
				});
				alert('success', 'Usuario actualizado correctamente');
			} else {
				await userService.create(formData);
				alert('success', 'Usuario creado correctamente');
			}
			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar usuario');
		} finally {
			saving = false;
		}
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
		<Input
			label="Nombre de Usuario"
			id="username"
			bind:value={formData.username}
			required
			placeholder="usuario1"
		/>
		<Input
			label="Email"
			id="email"
			type="email"
			bind:value={formData.email}
			required
			placeholder="usuario@kyc.com"
		/>
		
		<Select
			label="Rol"
			bind:value={formData.role}
			required
		>
			<option value="admin">Admin</option>
			<option value="superadmin">Superadmin</option>
			<option value="secretary">Secretaria</option>
		</Select>

		{#if !isEditMode}
			<Input
				label="Contraseña"
				id="password"
				type="password"
				bind:value={formData.password}
				required={!isEditMode}
				placeholder="********"
			/>
		{:else}
			<Input
				label="Nueva Contraseña (Opcional)"
				id="password"
				type="password"
				bind:value={formData.password}
				placeholder="Dejar en blanco para mantener actual"
			/>
		{/if}
	</div>

	<div class="flex items-center gap-2 pt-4">
		<input
			type="checkbox"
			id="activo"
			bind:checked={formData.activo}
			class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
		/>
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Usuario Activo
		</label>
	</div>

	<div class="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>
			Cancelar
		</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>
