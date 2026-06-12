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
		currentUserId?: string | null;
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { user = null, currentUserId = null, onSuccess, onCancel }: Props = $props();

	let isEditMode = $derived(!!user);
	let isEditingSelf = $derived(!!user && !!currentUserId && user._id === currentUserId);
	let disableActivoCheckbox = $derived(isEditMode && isEditingSelf);
	let disableRoleSelect = $derived(isEditMode && isEditingSelf);
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
			if (isEditMode && isEditingSelf && formData.activo === false) {
				alert('error', 'No puedes desactivar tu propia cuenta.');
				return;
			}

			if (isEditMode && isEditingSelf && user && formData.role !== user.role) {
				alert('error', 'No puedes cambiar tu propio rol.');
				return;
			}

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
		
		<!-- ISSUE L/M: Selector de Roles alineado a la jerarquía de Postgrado UAGRM -->
		<Select
			label="Rol"
			bind:value={formData.role}
			disabled={disableRoleSelect}
			required
		>
			<option value="superadmin">Superadmin (Soporte Técnico)</option>
			<option value="admin">Administrador General</option>
			<option value="mae">MAE (Decano / Director / JAF)</option>
			<option value="cpd">CPD (Gestión Académica)</option>
			<option value="cobranza">Cobranza (Cuentas por Cobrar)</option>
			<option value="docente">Docente</option>
		</Select>

		{#if disableRoleSelect}
			<p class="-mt-3 text-xs text-amber-600 dark:text-amber-400 md:col-span-2">
				No puedes cambiar tu propio rol.
			</p>
		{/if}

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
			disabled={disableActivoCheckbox}
			class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
		/>
		<label for="activo" class="text-sm font-medium text-gray-700 dark:text-gray-300">
			Usuario Activo
		</label>
	</div>

	{#if disableActivoCheckbox}
		<p class="-mt-3 text-xs text-amber-600 dark:text-amber-400">
			No puedes desactivar tu propia cuenta.
		</p>
	{/if}

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
