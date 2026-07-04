<script lang="ts">
	import { onMount } from 'svelte';
	import { bankStatementService } from '$lib/services';
	import type { BankStatementEntry, CreateBankStatementEntryRequest } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import Modal from '$lib/components/ui/modal.svelte';
	import TableSkeleton from '$lib/components/skeletons/TableSkeleton.svelte';
	import { alert, formatCurrency, formatDate } from '$lib/utils';
	import { PlusIcon } from '$lib/icons/outline';
	import { Pagination } from '$lib/components/ui';

	// ISSUE-P-EXTRACTO: registro y cruce MANUAL del extracto bancario (sin integración con el banco por ahora)

	let entries: BankStatementEntry[] = $state([]);
	let loading = $state(false);

	let page = $state(1);
	let limit = $state(20);
	let totalItems = $state(0);
	let totalPages = $state(1);

	let filters = $state({
		banco: '',
		soloSinCruzar: false
	});

	let isFormOpen = $state(false);
	let saving = $state(false);
	let formData: CreateBankStatementEntryRequest = $state({
		fecha_movimiento: new Date().toISOString().slice(0, 10),
		banco: '',
		monto: 0,
		tipo_movimiento: 'transferencia',
		referencia: '',
		notas: ''
	});

	// Modal de cruce manual
	let isMatchOpen = $state(false);
	let matchTarget: BankStatementEntry | null = $state(null);
	let matchPaymentId = $state('');
	let matchLoading = $state(false);

	onMount(loadEntries);

	async function loadEntries() {
		loading = true;
		try {
			const res = await bankStatementService.getAll(page, limit, {
				banco: filters.banco || undefined,
				solo_sin_cruzar: filters.soloSinCruzar || undefined
			});
			entries = res.data;
			totalItems = res.meta.totalItems;
			totalPages = res.meta.totalPages;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar el extracto bancario');
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		page = 1;
		loadEntries();
	}

	function handlePageChange(newPage: number) {
		page = newPage;
		loadEntries();
	}

	function handleLimitChange(newLimit: number) {
		limit = newLimit;
		page = 1;
		loadEntries();
	}

	function openCreateForm() {
		formData = {
			fecha_movimiento: new Date().toISOString().slice(0, 10),
			banco: '',
			monto: 0,
			tipo_movimiento: 'transferencia',
			referencia: '',
			notas: ''
		};
		isFormOpen = true;
	}

	async function handleCreate() {
		if (!formData.banco.trim() || formData.monto <= 0) {
			alert('error', 'Banco y monto son obligatorios (monto mayor a 0).');
			return;
		}
		saving = true;
		try {
			await bankStatementService.create(formData);
			alert('success', 'Movimiento registrado correctamente.');
			isFormOpen = false;
			await loadEntries();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo registrar el movimiento');
		} finally {
			saving = false;
		}
	}

	function openMatchModal(entry: BankStatementEntry) {
		matchTarget = entry;
		matchPaymentId = entry.payment_id || '';
		isMatchOpen = true;
	}

	async function confirmMatch() {
		if (!matchTarget || matchPaymentId.trim().length < 5) {
			alert('error', 'Ingresa un ID de pago válido.');
			return;
		}
		matchLoading = true;
		try {
			await bankStatementService.match(matchTarget._id, matchPaymentId.trim());
			alert('success', 'Movimiento cruzado con el pago correctamente.');
			isMatchOpen = false;
			matchTarget = null;
			await loadEntries();
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cruzar el movimiento');
		} finally {
			matchLoading = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<Heading level="h1">Extracto Bancario</Heading>
			<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
				Registro manual de movimientos bancarios para cruzarlos contra comprobantes sin
				identificación clara del estudiante. Aún sin integración automática con el banco.
			</p>
		</div>
		<Button onclick={openCreateForm}>
			{#snippet leftIcon()}
				<PlusIcon class="size-5" />
			{/snippet}
			Registrar Movimiento
		</Button>
	</div>

	<div class="flex flex-wrap items-end gap-3 bg-white dark:bg-dark-surface p-4 rounded-xl border border-gray-200 dark:border-dark-border">
		<div class="w-48">
			<Input label="Banco" id="filtro-banco" bind:value={filters.banco} oninput={handleFilterChange} placeholder="Ej: Banco Unión" />
		</div>
		<label class="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
			<input
				type="checkbox"
				bind:checked={filters.soloSinCruzar}
				onchange={handleFilterChange}
				class="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
			/>
			Solo sin cruzar
		</label>
	</div>

	{#if loading}
		<TableSkeleton columns={6} rows={8} />
	{:else if entries.length === 0}
		<div class="text-center py-12 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl">
			<p class="text-gray-500 dark:text-gray-400">No hay movimientos registrados.</p>
		</div>
	{:else}
		<div class="hidden md:block bg-white dark:bg-dark-surface rounded-xl shadow-sm border border-gray-200 dark:border-dark-border overflow-hidden">
			<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
				<thead class="bg-gray-50 dark:bg-dark-background">
					<tr>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fecha</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Banco</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tipo</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monto</th>
						<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Referencia</th>
						<th class="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cruce</th>
						<th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acción</th>
					</tr>
				</thead>
				<tbody class="bg-white dark:bg-dark-surface divide-y divide-gray-200 dark:divide-dark-border">
					{#each entries as entry (entry._id)}
						<tr>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{formatDate(entry.fecha_movimiento)}</td>
							<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{entry.banco}</td>
							<td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 capitalize">{entry.tipo_movimiento}</td>
							<td class="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-white">{formatCurrency(entry.monto)}</td>
							<td class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]" title={entry.referencia || ''}>{entry.referencia || '—'}</td>
							<td class="px-4 py-3 text-center">
								{#if entry.payment_id}
									<span class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Cruzado</span>
								{:else}
									<span class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Sin cruzar</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								<Button size="sm" variant="secondary" onclick={() => openMatchModal(entry)}>
									{entry.payment_id ? 'Recruzar' : 'Cruzar con Pago'}
								</Button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Tarjetas móviles -->
		<div class="md:hidden space-y-3">
			{#each entries as entry (entry._id)}
				<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 shadow-sm">
					<div class="flex items-start justify-between gap-3">
						<div>
							<p class="text-sm font-bold text-gray-900 dark:text-white">{entry.banco}</p>
							<p class="text-xs text-gray-500 dark:text-gray-400">{formatDate(entry.fecha_movimiento)} · <span class="capitalize">{entry.tipo_movimiento}</span></p>
						</div>
						<span class="text-base font-bold text-gray-900 dark:text-white">{formatCurrency(entry.monto)}</span>
					</div>
					{#if entry.referencia}
						<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Ref: {entry.referencia}</p>
					{/if}
					<div class="mt-3 flex items-center justify-between">
						{#if entry.payment_id}
							<span class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Cruzado</span>
						{:else}
							<span class="px-2 py-0.5 text-[10px] font-bold rounded-full uppercase tracking-wide bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300">Sin cruzar</span>
						{/if}
						<Button size="sm" variant="secondary" onclick={() => openMatchModal(entry)}>
							{entry.payment_id ? 'Recruzar' : 'Cruzar'}
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<Pagination currentPage={page} {totalPages} {totalItems} {limit} onPageChange={handlePageChange} onLimitChange={handleLimitChange} />
	{/if}
</div>

<!-- Modal de registro -->
<Modal isOpen={isFormOpen} title="Registrar Movimiento Bancario" onClose={() => { if (!saving) isFormOpen = false; }} maxWidth="sm:max-w-lg">
	<div class="p-4 space-y-4">
		<Input label="Fecha del Movimiento" id="fecha_movimiento" type="date" bind:value={formData.fecha_movimiento} required />
		<Input label="Banco" id="banco" bind:value={formData.banco} required placeholder="Ej: Banco Unión" />
		<Input label="Monto (Bs)" id="monto" type="number" min="0.01" step="0.01" bind:value={formData.monto} required />
		<Select label="Tipo de Movimiento" bind:value={formData.tipo_movimiento} required>
			<option value="transferencia">Transferencia</option>
			<option value="deposito">Depósito</option>
		</Select>
		<Input label="Referencia (opcional)" id="referencia" bind:value={formData.referencia} placeholder="Ej: Cuenta terminada en 1234" />
		<Input label="Notas (opcional)" id="notas" bind:value={formData.notas} placeholder="Observaciones adicionales" />

		<div class="flex justify-end gap-3 pt-2">
			<Button variant="secondary" onclick={() => isFormOpen = false} disabled={saving}>Cancelar</Button>
			<Button onclick={handleCreate} loading={saving}>Registrar</Button>
		</div>
	</div>
</Modal>

<!-- Modal de cruce con pago -->
<Modal isOpen={isMatchOpen} title="Cruzar con un Pago" onClose={() => { if (!matchLoading) isMatchOpen = false; }} maxWidth="sm:max-w-lg">
	<div class="p-4 space-y-4">
		<p class="text-sm text-gray-500 dark:text-gray-400">
			Ingresa el ID del pago (visible en la tabla de Gestión de Pagos) que corresponde a este
			movimiento bancario.
		</p>
		<Input label="ID del Pago" id="payment_id" bind:value={matchPaymentId} placeholder="Ej: 60a7f1c4e1f4b8c9d4b8e5c1" />
		<div class="flex justify-end gap-3">
			<Button variant="secondary" onclick={() => isMatchOpen = false} disabled={matchLoading}>Cancelar</Button>
			<Button onclick={confirmMatch} loading={matchLoading}>Confirmar Cruce</Button>
		</div>
	</div>
</Modal>
