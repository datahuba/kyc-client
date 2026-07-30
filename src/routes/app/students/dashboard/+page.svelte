<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { studentService, certificateService } from '$lib/services';
	import type { Student } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import {
		ClipboardIcon,
		TagIcon,
		UserIcon,
		AcademicCapIcon,
		FileTextIcon,
		BellIcon
	} from '$lib/icons/outline';
	import { CreditCardIcon, ShieldIcon, CalendarIcon } from '$lib/icons/solid';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import { goto } from '$app/navigation';
	import DashboardSkeleton from '$lib/components/skeletons/DashboardSkeleton.svelte';

	let loading = true;
	let studentData: Student | null = null;
	let greeting = '';
	let interval: any;

	// F-DASH-ESTUDIANTE (2026-07-30): quick stats para que el estudiante
	// vea de un vistazo qué puede hacer hoy (certificados emitidos, etc).
	let cantidadCertificados = $state(0);

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

		// Stats secundarios (no bloquean el load principal)
		(async () => {
			try {
				const certs = await certificateService.getMy();
				cantidadCertificados = Array.isArray(certs) ? certs.length : 0;
			} catch {}
		})();

		return () => clearInterval(interval);
	});

	const studentShortcuts = [
		{
			title: 'Mis Inscripciones',
			subtitle: 'Libreta, módulos y pagos',
			icon: ClipboardIcon,
			href: '/app/enrollments',
			color: 'from-blue-500 to-blue-600'
		},
		{
			title: 'Certificados',
			subtitle: 'Notas y No Deudor',
			icon: ShieldIcon,
			href: '/app/certificates',
			color: 'from-emerald-500 to-emerald-600'
		},
		{
			title: 'Calendario',
			subtitle: 'Programas en ejecución',
			icon: CalendarIcon,
			href: '/app/courses/calendario',
			color: 'from-purple-500 to-purple-600'
		},
		{
			title: 'Solicitudes',
			subtitle: 'Trámites y constancias',
			icon: FileTextIcon,
			href: '/app/requests',
			color: 'from-amber-500 to-amber-600'
		},
		{
			title: 'Mis Pagos',
			subtitle: 'Historial y deudas',
			icon: CreditCardIcon,
			href: '/app/payments',
			color: 'from-rose-500 to-rose-600'
		},
		{
			title: 'Mi Perfil',
			subtitle: 'Datos personales',
			icon: UserIcon,
			href: '/app/profile',
			color: 'from-slate-500 to-slate-600'
		},
		{
			title: 'Mi Aula',
			subtitle: 'Clases y materiales',
			icon: AcademicCapIcon,
			href: '/app/classroom',
			color: 'from-cyan-500 to-cyan-600'
		},
		{
			title: 'Notificaciones',
			subtitle: 'Buzón y avisos',
			icon: BellIcon,
			href: '/app/profile',
			color: 'from-pink-500 to-pink-600'
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

			<!-- F-DASH-ESTUDIANTE: 8 accesos rápidos con descripción y color por tipo -->
			<div class="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
				{#each studentShortcuts as shortcut}
					<button
						onclick={() => goto(shortcut.href)}
						class="relative bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm hover:shadow-lg transition-all text-left w-full group cursor-pointer border border-slate-200 dark:border-slate-700 overflow-hidden"
					>
						<div class={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${shortcut.color}`}></div>
						<div class={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${shortcut.color} text-white mb-3 shadow-sm`}>
							<shortcut.icon class="size-5" />
						</div>
						<h3 class="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary-600 transition-colors">
							{shortcut.title}
						</h3>
						<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
							{shortcut.subtitle}
						</p>
					</button>
				{/each}
			</div>

			<!-- Quick Info -->
			<div class="mt-8">
				<Card>
					<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Información Rápida</h3>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
							<div class="size-10 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Carnet</p>
								<p class="font-medium text-gray-900 dark:text-white">{studentData.carnet}</p>
							</div>
						</div>
						<div class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
							<div class="size-10 shrink-0 rounded-full bg-light-tertiary dark:bg-light-tertiary flex items-center justify-center text-light-primary">
								<TagIcon class="size-5" />
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-xs text-gray-500 dark:text-gray-400">Registro</p>
								<p class="font-medium text-gray-900 dark:text-white break-all" title={studentData.registro}>
									{studentData.registro}
								</p>
							</div>
						</div>
						<div class="flex items-center space-x-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
							<div class="size-10 rounded-full bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
								<ShieldIcon class="size-5" />
							</div>
							<div>
								<p class="text-xs text-gray-500 dark:text-gray-400">Certificados emitidos</p>
								<p class="font-bold text-emerald-700 dark:text-emerald-300 text-lg">{cantidadCertificados}</p>
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
