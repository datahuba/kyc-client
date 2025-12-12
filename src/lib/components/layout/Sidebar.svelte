<script lang="ts">
	import { page } from '$app/stores';
	import { userStore } from '$lib/stores/userStore';
	import { 
		UsersIcon, 
		ClipboardIcon, 
		TagIcon, 
		XIcon,
		KeyIcon,

		FileTextIcon

	} from '$lib/icons/outline';
	import { slide } from 'svelte/transition';
	import Menu2Icon from '$lib/icons/outline/menu2Icon.svelte';
	import { BookIcon, CreditCardIcon, HomeIcon, LogoutIcon } from '$lib/icons/solid';
	import { goto } from '$app/navigation';

	interface Props {
		isOpen: boolean;
		onClose: () => void;
	}

	let { isOpen, onClose }: Props = $props();

	const navigation = [
				// Student roles
		{ name: 'Mi Dashboard', href: '/app/students/dashboard', icon: HomeIcon, roles: ['student'] },
		// Admin roles
		{ name: 'Dashboard', href: '/app/dashboard', icon: HomeIcon, roles: ['admin', 'superadmin'] },
		{ name: 'Estudiantes', href: '/app/students', icon: UsersIcon, roles: ['admin', 'superadmin'] },
		{ name: 'Cursos', href: '/app/courses', icon: BookIcon, roles: ['admin', 'superadmin'] },
		{ name: 'Inscripciones', href: '/app/enrollments', icon: FileTextIcon, roles: ['admin', 'superadmin', 'student'] },
		{ name: 'Pagos', href: '/app/payments', icon: CreditCardIcon, roles: ['admin', 'superadmin', 'student'] },
		{ name: 'Descuentos', href: '/app/discounts', icon: TagIcon, roles: ['admin', 'superadmin'] },
		{ name: 'Usuarios', href: '/app/users', icon: UsersIcon, roles: ['admin', 'superadmin'] },
		{ name: 'Contraseña', href: '/app/change-password', icon: KeyIcon, roles: ['student'] },
	];

	// Filter navigation based on user role
	// Assuming userStore.user.role is available. If not, show all or handle gracefully.
	// For now, I'll show all if role is missing or filter if present.
	// Actually, let's just show all for now or basic filter.
	// The userStore has loginType which is 'student' or 'admin'.
	// But the user object has 'role'.
	
	let userRole = $derived($userStore?.role || 'student'); // Default to student if not loaded? Or admin?
	// Better to check loginType
	let loginType = $derived($userStore.loginType);

	let filteredNavigation = $derived(navigation.filter(item => {
		if (loginType === 'student') {
			return item.roles.includes('student');
		} else {
			return item.roles.includes('admin') || item.roles.includes('superadmin');
		}
	}));

	function isCurrent(href: string) {
		return $page.url.pathname.startsWith(href);
	}

	function logout() {
		userStore.logout();
		onClose();
		goto('/auth/sign-in');
	}
</script>

<!-- Mobile sidebar backdrop -->
{#if isOpen}
	<div 
		class="fixed inset-0 z-40 bg-gray-900/80 backdrop-blur-sm lg:hidden"
		onclick={onClose}
		transition:slide={{ duration: 200, axis: 'y' }} 
	></div>
{/if}

<!-- Sidebar -->
<div class={`
	fixed inset-y-0 left-0 z-50 w-72 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800
	transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
	${isOpen ? 'translate-x-0' : '-translate-x-full'}
`}>
	<div class="flex h-16 items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
		<span class="text-xl font-bold text-light-tertiary dark:text-light-tertiary">KyC</span>
		<button 
			type="button" 
			class="-m-2.5 p-2.5 text-gray-700 dark:text-gray-200 lg:hidden"
			onclick={onClose}
		>
			<span class="sr-only">Cerrar sidebar</span>
			<XIcon class="size-6" />
		</button>
	</div>

	<div class="flex flex-col gap-y-5 overflow-y-auto px-6 pb-4 pt-8 h-[calc(100vh-4rem)]">
		<nav class="flex flex-1 flex-col">
			<ul role="list" class="flex flex-1 flex-col gap-y-7">
				<li>
					<ul role="list" class="-mx-2 space-y-1">
						{#each filteredNavigation as item}
							<li>
								<a
									href={item.href}
									class={`
										group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold
										${isCurrent(item.href)
											? 'bg-gray-50 dark:bg-gray-800 text-primary-600 dark:text-primary-400'
											: 'text-gray-700 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-800'}
									`}
								>
									{#snippet icon()}
										<item.icon class={`size-6 shrink-0 ${isCurrent(item.href) ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'}`} />
									{/snippet}
									{@render icon()}
									{item.name}
								</a>
							</li>
						{/each}
					</ul>
				</li>
				
				<li class="mt-auto">
					<button
						onclick={logout}
						class="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-red-600 dark:hover:text-red-400 w-full text-left"
					>
						<LogoutIcon class="size-6 shrink-0 text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
						Cerrar Sesión
					</button>
				</li>
			</ul>
		</nav>
	</div>
</div>
