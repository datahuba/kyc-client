<script lang="ts">
	// F-NOTAS-MODULOS-EJECUTADOS (2026-08-18, decisión de Kevin durante la
	// capacitación)
	// ============================================================================
	// Un programa que arranca a mitad de camino (ej. entra en el módulo 5)
	// tiene los módulos anteriores ya dictados, con nota. La carga inicial
	// trae pagos por módulo pero NUNCA trajo notas.
	//
	// Kevin eligió resolverlo con "un Excel aparte, solo de notas", para
	// estudiantes que YA EXISTEN en el sistema — a diferencia de la carga
	// inicial (CargaInicialModal.svelte), que también puede crear
	// estudiantes nuevos. Esta carga es más chica a propósito: solo dos
	// columnas por módulo, CI y nota, y si el CI no tiene inscripción en
	// este curso esa fila se reporta como fallida en vez de crear nada.
	import Modal from '$lib/components/ui/modal.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import { courseService } from '$lib/services';
	import { alert } from '$lib/utils';
	import type { Course } from '$lib/interfaces';
	import { DocumentAddIcon } from '$lib/icons/outline';

	interface Props {
		isOpen: boolean;
		course: Course | null;
		onClose: () => void;
	}

	let { isOpen, course, onClose }: Props = $props();

	let cargando = $state(false);
	let resultado: { actualizados: number; fallidos: { fila: number; carnet: string; motivo: string }[] } | null =
		$state(null);

	$effect(() => {
		if (!isOpen) {
			cargando = false;
			resultado = null;
		}
	});

	async function handleFile(file: File | undefined) {
		if (!file || !course) return;
		cargando = true;
		resultado = null;
		try {
			resultado = await courseService.cargarNotasModulosExcel(course._id, file);
			if (resultado.actualizados > 0) {
				alert('success', `${resultado.actualizados} nota(s) cargada(s).`);
			}
			if (resultado.fallidos.length > 0) {
				alert(
					'warning',
					`${resultado.fallidos.length} fila(s) no se pudieron cargar. Revisá el detalle abajo.`
				);
			}
		} catch (e: any) {
			const detail = e?.response?.data?.detail || e?.message || 'No se pudo procesar el Excel.';
			alert('error', detail);
		} finally {
			cargando = false;
		}
	}
</script>

<Modal {isOpen} title="Cargar Notas de Módulos Ejecutados" {onClose} maxWidth="sm:max-w-2xl">
	<div class="space-y-4 p-6">
		<div>
			<p class="text-sm font-medium text-gray-900 dark:text-white">
				{course?.nombre_programa ?? ''}
			</p>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
				Para estudiantes que ya están inscritos en este programa y ya cursaron algún módulo
				antes de entrar al sistema. Si necesitás también crear estudiantes o inscribirlos,
				usá "Carga Inicial de Estudiantes" en su lugar.
			</p>
		</div>

		<div class="rounded-md border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-600">
			<DocumentAddIcon class="mx-auto size-8 text-gray-400" />
			<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
				Subí un Excel con las notas de los módulos ya dictados.
			</p>
			<p class="mt-1 text-xs text-gray-500 dark:text-gray-500">
				Columnas: <strong>CI</strong> (o Carnet/Cédula) y <strong>Nota Módulo 1</strong>,
				<strong>Nota Módulo 2</strong>, etc. — una por cada módulo con nota conocida.
			</p>
			<label
				class="mt-4 inline-block cursor-pointer rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
			>
				{cargando ? 'Procesando…' : 'Seleccionar archivo'}
				<input
					type="file"
					accept=".xlsx,.xls"
					class="hidden"
					disabled={cargando}
					onchange={(e) => {
						const file = (e.target as HTMLInputElement).files?.[0];
						handleFile(file);
						(e.target as HTMLInputElement).value = '';
					}}
				/>
			</label>
		</div>

		{#if resultado}
			<div class="space-y-3">
				<div class="grid grid-cols-2 gap-2 text-center">
					<div class="rounded-md bg-green-50 p-2 dark:bg-green-900/20">
						<div class="text-2xl font-bold text-green-700 dark:text-green-300">
							{resultado.actualizados}
						</div>
						<div class="text-xs text-green-600 dark:text-green-400">Notas cargadas</div>
					</div>
					<div class="rounded-md bg-red-50 p-2 dark:bg-red-900/20">
						<div class="text-2xl font-bold text-red-700 dark:text-red-300">
							{resultado.fallidos.length}
						</div>
						<div class="text-xs text-red-600 dark:text-red-400">Filas con problemas</div>
					</div>
				</div>

				{#if resultado.fallidos.length > 0}
					<div class="max-h-48 overflow-y-auto rounded-md border border-red-100 dark:border-red-900/40">
						<table class="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
							<thead class="bg-gray-50 dark:bg-dark-background/60">
								<tr>
									<th class="px-3 py-1.5 text-left text-xs font-bold text-slate-500">Fila</th>
									<th class="px-3 py-1.5 text-left text-xs font-bold text-slate-500">CI</th>
									<th class="px-3 py-1.5 text-left text-xs font-bold text-slate-500">Motivo</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100 dark:divide-dark-border">
								{#each resultado.fallidos as f}
									<tr>
										<td class="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">{f.fila}</td>
										<td class="px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300">{f.carnet}</td>
										<td class="px-3 py-1.5 text-xs text-red-700 dark:text-red-400">{f.motivo}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}

		<div class="flex justify-end gap-2 pt-2">
			<Button variant="secondary" onclick={onClose}>Cerrar</Button>
		</div>
	</div>
</Modal>
