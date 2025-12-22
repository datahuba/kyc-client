<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { studentService } from '$lib/services';
	import type { Student } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import { ClipboardIcon, TagIcon, UserIcon, KeyIcon } from '$lib/icons/outline';
	import { CreditCardIcon } from '$lib/icons/solid';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { goto } from '$app/navigation';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';

	let loading = true;
	let studentData: Student | null = null;
	let greeting = '';
	let interval: any;

	function setGreeting() {
		const hour = new Date().getHours();
		if (hour < 12) greeting = 'Buenos días';
		else if (hour < 18) greeting = 'Buenas tardes';
		else greeting = 'Buenas noches';
	}

	onMount(() => {
		setGreeting();
		interval = setInterval(setGreeting, 60000);

		(async () => {
			try {
				const userId = $userStore.user?._id;
				if (userId) {
					studentData = await studentService.getById(userId);
				}
			} catch (error) {
				console.error('Error loading student data:', error);
			} finally {
				loading = false;
			}
		})();

		return () => clearInterval(interval);
	});

	const studentShortcuts = [
		{ 
			title: 'Mis Inscripciones', 
			icon: ClipboardIcon, 
			href: '/app/enrollments',
			
		},
		{ 
			title: 'Mis Pagos', 
			icon: CreditCardIcon, 
			href: '/app/payments',
			
		},
		{ 
			title: 'Mi Perfil', 
			icon: UserIcon, 
			href: '/app/profile',
			
		},
		{ 
			title: 'Cambiar Contraseña', 
			icon: KeyIcon, 
			href: '/app/change-password',
			
		}
	];
</script>

<div class="space-y-8">
	{#if loading}
		<DashboardSkeleton />
	{:else if studentData}
		<div>
			<Heading level="h1">{greeting}, {studentData.nombre.split(' ')[0]}!</Heading>
			<p class="text-gray-500 dark:text-gray-400 mt-2">Bienvenido a tu panel de estudiante. ¿Qué deseas hacer hoy?</p>
			
			<div class="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				{#each studentShortcuts as shortcut}
					<button 
						onclick={() => goto(shortcut.href)}
						class="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 text-left w-full group"
					>
						<div class={`inline-flex p-3 rounded-lg bg-light-secondary text-light-primary mb-4 group-hover:scale-105 transition-transform`}>
							<shortcut.icon class="size-8" />
						</div>
						<h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
							{shortcut.title}
						</h3>
					</button>
				{/each}
			</div>

			<!-- Quick Info -->
			<div class="mt-8">
				<Card>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información Rápida</h3>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="size-10 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Carnet</p>
								<p class="font-medium text-gray-900 dark:text-white">{studentData.carnet}</p>
							</div>
						</div>
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="size-10 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Registro</p>
								<p class="font-medium text-gray-900 dark:text-white">{studentData.registro}</p>
							</div>
						</div>
					</div>
				</Card>
			</div>
		</div>
	{:else}
		<div class="text-center py-10">
			<Heading level="h2">Error cargando perfil</Heading>
			<p class="text-gray-500">No se pudo cargar la información del estudiante.</p>
		</div>
	{/if}
</div>