<script lang="ts">
	import { onMount } from 'svelte';

	// Estado para mostrar el botón de instalación
	let canInstall = $state(false);
	// Guardamos el evento para disparar el prompt en Android
	let deferredPrompt: any = null;
	// Estado para saber si estamos en un dispositivo iOS (donde no funciona el prompt automático)
	let isIOS = $state(false);
	// Estado para mostrar el modal explicativo en iOS
	let showIOSModal = $state(false);

	onMount(() => {
		// Detectamos si es iOS (iPhone/iPad) para mostrar las instrucciones manuales
		const ua = window.navigator.userAgent.toLowerCase();
		// Detectamos iPhone, iPod, iPad antiguos, y iPad modernos (que reportan como Mac pero tienen touch)
		isIOS = /iphone|ipad|ipod/.test(ua) || (ua.includes('mac') && navigator.maxTouchPoints > 1);
		
		// Verificamos si ya está instalada (standalone mode)
		const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

		if (!isStandalone) {
			// Si es iOS y no está en modo standalone, habilitamos el botón para mostrar modal
			if (isIOS) {
				canInstall = true;
			}
		}

		// Escuchar el evento beforeinstallprompt (funciona en Chrome, Android, Edge, etc.)
		window.addEventListener('beforeinstallprompt', (e) => {
			// Prevenir el prompt mini automático del navegador
			e.preventDefault();
			// Guardar el evento para dispararlo cuando el usuario haga clic en nuestro botón
			deferredPrompt = e;
			// Actualizar el estado de la UI
			canInstall = true;
		});

		// Opcional: Escuchar cuando la instalación fue exitosa para ocultar el botón
		window.addEventListener('appinstalled', () => {
			canInstall = false;
			deferredPrompt = null;
			showIOSModal = false;
		});
	});

	async function handleInstallClick() {
		if (isIOS) {
			// En iOS no hay prompt automático, mostramos modal con instrucciones
			showIOSModal = true;
			return;
		}

		if (deferredPrompt) {
			// Disparamos el prompt nativo
			deferredPrompt.prompt();
			// Esperamos la elección del usuario
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') {
				console.log('El usuario aceptó la instalación PWA');
			}
			// El evento solo se puede usar una vez
			deferredPrompt = null;
			canInstall = false;
		}
	}
</script>

{#if canInstall}
	<button
		onclick={handleInstallClick}
		class="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white shadow-md hover:shadow-lg transition-all duration-200"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-cloud"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/></svg>
		Instalar App
	</button>
{/if}

<!-- Modal de instrucciones para iOS -->
{#if showIOSModal}
	<div class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-opacity" onclick={() => showIOSModal = false}>
		<div class="bg-white dark:bg-dark-surface rounded-2xl shadow-xl w-full max-w-sm p-6 transform transition-all" onclick={e => e.stopPropagation()}>
			<div class="text-center">
				<div class="w-16 h-16 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg>
				</div>
				<h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Instalar en iOS</h3>
				<p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
					Para instalar esta aplicación en tu iPhone o iPad:
				</p>
				
				<ol class="text-left text-sm text-gray-700 dark:text-gray-300 space-y-4 mb-6">
					<li class="flex items-start gap-3">
						<span class="bg-primary-100 text-primary-700 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">1</span>
						<span>Toca el botón <strong>Compartir</strong> <span class="inline-block align-middle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/></svg></span> en la barra inferior de Safari.</span>
					</li>
					<li class="flex items-start gap-3">
						<span class="bg-primary-100 text-primary-700 font-bold rounded-full w-6 h-6 flex items-center justify-center shrink-0">2</span>
						<span>Desliza hacia abajo y selecciona <strong>"Agregar a inicio"</strong> <span class="inline-block align-middle"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg></span>.</span>
					</li>
				</ol>

				<button 
					onclick={() => showIOSModal = false}
					class="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 font-semibold rounded-lg transition-colors"
				>
					Entendido
				</button>
			</div>
		</div>
	</div>
{/if}
