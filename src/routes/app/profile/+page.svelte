<script lang="ts">
	import Card from '$lib/components/ui/card.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import { UserIcon, MailIcon, MapPinIcon, PhoneIcon } from '$lib/icons/outline';
	import { BriefcaseIcon } from '$lib/icons/solid';

	// Dummy data
	let userProfile = $state({
		firstName: 'Juan',
		lastName: 'Pérez',
		email: 'juan.perez@example.com',
		phone: '+591 70000000',
		role: 'Administrador',
		location: 'Santa Cruz, Bolivia',
		bio: 'Desarrollador de software apasionado por crear experiencias de usuario increíbles. Me encanta el café y el código limpio.',
		avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
		coverUrl: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80'
	});

	let isEditing = $state(false);

	function handleSave() {
		isEditing = false;
		// Logic to save would go here
		console.log('Saved:', userProfile);
	}
</script>

<div class="space-y-6">
	<Heading level="h1">Mi perfil</Heading>

	<!-- Cover and Avatar Section -->
	<div class="relative mb-16 rounded-xl bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
		<div class="h-48 w-full overflow-hidden">
			<img 
				src={userProfile.coverUrl} 
				alt="Cover" 
				class="h-full w-full object-cover"
			/>
		</div>
		<div class="absolute bottom-0 left-8 translate-y-1/2 transform">
			<div class="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white dark:border-gray-800 bg-white dark:bg-gray-700">
				<img 
					src={userProfile.avatarUrl} 
					alt="Avatar" 
					class="h-full w-full object-cover"
				/>
			</div>
		</div>
		<div class="flex justify-end p-4 pt-2">
			{#if !isEditing}
				<Button variant="outline" onclick={() => isEditing = true}>
					Editar Perfil
				</Button>
			{:else}
				<div class="flex gap-2">
					<Button variant="ghost" onclick={() => isEditing = false}>Cancelar</Button>
					<Button onclick={handleSave}>Guardar Cambios</Button>
				</div>
			{/if}
		</div>
	</div>

	<div class="grid gap-6 md:grid-cols-3">
		<!-- Main Info Column -->
		<div class="md:col-span-2 space-y-6">
			<Card title="Información Personal">
				<div class="grid gap-6 md:grid-cols-2">
					<Input 
						label="Nombre" 
						bind:value={userProfile.firstName} 
						disabled={!isEditing} 
						placeholder="Tu nombre"
					/>
					<Input 
						label="Apellido" 
						bind:value={userProfile.lastName} 
						disabled={!isEditing} 
						placeholder="Tu apellido"
					/>
					<Input 
						label="Correo Electrónico" 
						type="email"
						bind:value={userProfile.email} 
						disabled={!isEditing} 
						icon={MailIcon}
						placeholder="correo@ejemplo.com"
					/>
					<Input 
						label="Teléfono" 
						type="tel"
						bind:value={userProfile.phone} 
						disabled={!isEditing} 
						icon={PhoneIcon}
						placeholder="+591 ..."
					/>
				</div>
				<div class="mt-6">
					<TextArea 
						label="Biografía" 
						bind:value={userProfile.bio} 
						disabled={!isEditing} 
						placeholder="Cuéntanos un poco sobre ti..."
						rows={4}
					/>
				</div>
			</Card>
		</div>

		<!-- Sidebar Info Column -->
		<div class="space-y-6">
			<Card title="Detalles">
				<div class="space-y-4">
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rol</label>
						<div class="flex items-center gap-2 text-gray-900 dark:text-white">
							<BriefcaseIcon class="size-5 text-gray-400" />
							<span>{userProfile.role}</span>
						</div>
					</div>
					<div>
						<label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ubicación</label>
						<div class="flex items-center gap-2 text-gray-900 dark:text-white">
							<MapPinIcon class="size-5 text-gray-400" />
							{#if isEditing}
								<input 
									type="text" 
									bind:value={userProfile.location} 
									class="bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 w-full"
								/>
							{:else}
								<span>{userProfile.location}</span>
							{/if}
						</div>
					</div>
				</div>
			</Card>
		</div>
	</div>
</div>
