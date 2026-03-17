<script lang="ts">
	import { userStore } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';

	function handleSelectAcademicRole(role: 'teacher' | 'student') {
		userStore.setLoginType('academic');
		userStore.setAcademicRole(role);
		goto('/auth/sign-in');
	}

	function handleBack() {
		goto('/');
	}
</script>

<div class="relative flex min-h-dvh">
	<div class="relative z-20 flex flex-1 items-center justify-center bg-light-primary p-8 dark:bg-dark-primary">
		<div class="w-full max-w-md">
			<!-- Logo -->
			<div class="mb-10 flex flex-col items-center justify-center">
				<div class="mb-4 flex h-32 w-32 items-center justify-center">
					<img src="/images/logo_empty_datahub.png" alt="" />
				</div>
				<span class="text-3xl font-bold text-light-secondary dark:text-dark-secondary">
					DataHub<span class="ml-2 text-light-tertiary dark:text-dark-tertiary">Analytics</span>
				</span>
				<span class="mt-4 text-lg font-medium text-light-black/60 dark:text-dark-white/60">
					Selecciona tu rol
				</span>
			</div>

			<!-- Role Selection Cards -->
			<div class="space-y-4 mb-6">
				<button
					onclick={() => handleSelectAcademicRole('teacher')}
					class="group relative overflow-hidden w-full px-6 py-4 rounded-xl bg-light-primary dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-light-secondary dark:hover:border-light-secondary transition-all duration-300 hover:shadow-lg hover:shadow-light-four hover:-translate-y-1"
				>
					<div class="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>

					<div class="relative z-10 flex items-center gap-4 text-left">
						<svg class="w-8 h-8 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M12 6.253v13m0-13C6.5 6.253 3 9.585 3 13.667c0 5.202 9 11.053 9 11.053s9-5.851 9-11.053c0-4.082-3.5-7.414-9-7.414z" />
						</svg>

						<div class="flex flex-col">
							<span class="text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
								Docente
							</span>
							<span class="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/80 transition-colors duration-300">
								Acceso a classroom, tareas, exámenes
							</span>
						</div>
					</div>
				</button>

				<button
					onclick={() => handleSelectAcademicRole('student')}
					class="group relative overflow-hidden w-full px-6 py-4 rounded-xl bg-light-primary dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 hover:border-light-secondary dark:hover:border-light-secondary transition-all duration-300 hover:shadow-lg hover:shadow-light-four hover:-translate-y-1"
				>
					<div class="absolute inset-0 bg-gradient-to-r from-green-400 to-green-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>

					<div class="relative z-10 flex items-center gap-4 text-left">
						<svg class="w-8 h-8 text-green-600 dark:text-green-400 group-hover:text-white transition-colors duration-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path d="M22 10v6M2 10l10-5 10 5-10 5z" />
							<path d="M6 12v5c3 3 9 3 12 0v-5" />
						</svg>

						<div class="flex flex-col">
							<span class="text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-white transition-colors duration-300">
								Estudiante
							</span>
							<span class="text-sm text-gray-600 dark:text-gray-400 group-hover:text-white/80 transition-colors duration-300">
								Acceso a tus clases y tareas
							</span>
						</div>
					</div>
				</button>
			</div>

			<!-- Back Button -->
			<button
				onclick={handleBack}
				class="w-full px-4 py-2 rounded-lg text-sm font-medium text-light-black dark:text-dark-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-300"
			>
				← Volver
			</button>
		</div>
	</div>
</div>

<style>
	button {
		-webkit-tap-highlight-color: transparent;
	}
</style>
