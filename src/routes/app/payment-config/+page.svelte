<script lang="ts">
	import { onMount } from 'svelte';
	import { paymentConfigService } from '$lib/services';
	import type { PaymentConfig } from '$lib/interfaces';
	import { userStore } from '$lib/stores/userStore';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
    import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import PaymentConfigForm from '$lib/features/payment-config/PaymentConfigForm.svelte';
	import { alert, formatDate } from '$lib/utils';
	import { PencilIcon, TrashIcon, QrCodeIcon } from '$lib/icons/outline';

	let config: PaymentConfig | null = $state(null);
	let loading = $state(true);
	let isEditModalOpen = $state(false);
    let isDeleteModalOpen = $state(false);
    let actionLoading = $state(false);

	let isAdmin = $derived($userStore.role === 'admin' || $userStore.role === 'superadmin');

	async function loadConfig() {
		loading = true;
		try {
			// This endpoint returns 404 if no config found? Or null?
            // The service returns the data directly.
			config = await paymentConfigService.get();
		} catch (error: any) {
			if (error.status === 404) {
				config = null;
			} else {
				console.error(error);
				alert('error', error.message || 'Error al cargar configuración');
			}
		} finally {
			loading = false;
		}
	}

    async function confirmDelete() {
        actionLoading = true;
        try {
            await paymentConfigService.delete();
            alert('success', 'Configuración eliminada (inactiva)');
            isDeleteModalOpen = false;
            loadConfig();
        } catch (error: any) {
            alert('error', error.message || 'Error al eliminar');
        } finally {
            actionLoading = false;
        }
    }

	onMount(() => {
		loadConfig();
	});
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Información de Pagos</Heading>
			<p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
				Datos necesarios para realizar depósitos o transferencias.
			</p>
		</div>

		{#if isAdmin}
			<div class="flex flex-wrap gap-2 sm:gap-3">
                {#if config}
				    <Button variant="destructive" onclick={() => isDeleteModalOpen = true}>
                        {#snippet leftIcon()} <TrashIcon class="size-5" /> {/snippet}
                        Eliminar
                    </Button>
                    <Button onclick={() => isEditModalOpen = true}>
                        {#snippet leftIcon()} <PencilIcon class="size-5" /> {/snippet}
                        Editar Configuración
                    </Button>
                {:else}
                    <Button onclick={() => isEditModalOpen = true}>
                        {#snippet leftIcon()} <QrCodeIcon class="size-5" /> {/snippet}
                        Crear Configuración
                    </Button>
                {/if}
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="animate-pulse space-y-4">
            <div class="h-64 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
            <div class="h-32 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
		</div>
	{:else if config}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- QR Code Section -->
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center justify-center">
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Código QR</h3>
                <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl">
                    <img src={config.qr_url} alt="QR de Pago" class="max-w-full max-h-[400px] object-contain rounded-lg" />
                </div>
                <p class="text-sm text-gray-500 mt-4 text-center">
                    Escanea este código desde tu aplicación bancaria
                </p>
            </div>

            <!-- Details Section -->
            <div class="space-y-6">
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-6">
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-700 pb-2">
                        Datos Bancarios
                    </h3>
                    
                    <dl class="space-y-4">
                         <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Banco</dt>
                            <dd class="text-sm text-gray-900 dark:text-white sm:col-span-2 font-semibold">{config.banco || '-'}</dd>
                        </div>
                         <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Número de Cuenta</dt>
                            <dd class="text-gray-900 dark:text-white sm:col-span-2 font-mono text-lg">{config.numero_cuenta}</dd>
                        </div>
                         <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Titular</dt>
                            <dd class="text-sm text-gray-900 dark:text-white sm:col-span-2">{config.titular || '-'}</dd>
                        </div>
                         <div class="grid grid-cols-1 sm:grid-cols-3 gap-1">
                            <dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Tipo de Cuenta</dt>
                            <dd class="text-sm text-gray-900 dark:text-white sm:col-span-2">{config.tipo_cuenta || '-'}</dd>
                        </div>
                    </dl>
                </div>

                {#if config.notas}
                    <div class="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-6 border border-primary-100 dark:border-primary-800">
                        <h4 class="text-sm font-semibold text-primary-800 dark:text-primary-300 mb-2">Notas Adicionales</h4>
                        <p class="text-sm text-primary-700 dark:text-primary-400 whitespace-pre-wrap">{config.notas}</p>
                    </div>
                {/if}

                <div class="text-xs text-gray-400 dark:text-gray-600 text-right">
                    Actualizado: {formatDate(config.updated_at)}
                </div>
            </div>
        </div>
	{:else}
		<div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <QrCodeIcon class="mx-auto h-12 w-12 text-gray-400" />
			<h3 class="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No hay información de pagos</h3>
			<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {#if isAdmin}
                    Aún no se ha configurado la información de pagos.
                {:else}
                    La información de pagos no está disponible en este momento. Contacte al administrador.
                {/if}
            </p>
			{#if isAdmin}
				<div class="mt-6">
					<Button onclick={() => isEditModalOpen = true}>
                        {#snippet leftIcon()} <QrCodeIcon class="size-5" /> {/snippet}
                        Crear Configuración
                    </Button>
				</div>
			{/if}
		</div>
	{/if}

    <!-- Modal for Create/Edit -->
    <Modal
		isOpen={isEditModalOpen}
		title={config ? 'Editar Configuración' : 'Crear Configuración'}
		onClose={() => isEditModalOpen = false}
		maxWidth="sm:max-w-2xl"
	>
		<PaymentConfigForm 
            initialData={config}
			onSuccess={() => {
				isEditModalOpen = false;
				loadConfig();
			}}
			onCancel={() => isEditModalOpen = false}
		/>
	</Modal>

    <!-- Modal for Delete -->
    <ModalConfirm 
        isOpen={isDeleteModalOpen}
        
        message="¿Estás seguro de que deseas eliminar esta configuración? No se mostrará a los estudiantes hasta que crees una nueva."
       
        onConfirm={confirmDelete}
        onCancel={() => isDeleteModalOpen = false}
        loading={actionLoading}
    />
</div>
