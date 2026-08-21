<script lang="ts">
	/**
	 * /app/reports/cuentas-por-cobrar — Reporte de CxC real vs estimada
	 *
	 * F-CUENTAS-POR-COBRAR (2026-07-29): vista staff para que Sandra/Rocío
	 * y los administrativos vean la diferencia entre la CxC estimada (todos
	 * los módulos del programa) y la CxC real a la fecha (solo módulos que
	 * ya se marcaron como 'en curso'). Soporta export XLSX.
	 *
	 * - Estudiante: NO ve esta página.
	 * - Staff: la ve, con filtro por cursos_asignados si es segmentado.
	 */

	import { onMount } from 'svelte';
	import { cuentasPorCobrarService, enrollmentService } from '$lib/services';
	import type { CxCResumen, CxCResumenReducido } from '$lib/services/cuentas-por-cobrar.service';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import GestionModulosModal from '$lib/components/ui/GestionModulosModal.svelte';
	import { DownloadIcon, ChartBarIcon, ClipboardIcon } from '$lib/icons/outline';
	import { formatCurrency } from '$lib/utils';

	// ========================================================================
	// STATE
	// ========================================================================

	let resumen: CxCResumen | null = $state(null);
	let loading = $state(true);
	let expandedCursos = $state<Set<string>>(new Set());

	// Estado del modal de gestión de módulos (F-MODAL-GESTION-MODULOS 2026-08-03)
	let modulosModalOpen = $state(false);
	let modulosModalEnrollment: any = $state(null);
	let modulosModalLoading = $state(false);

	function getApiBase(): string {
		// apiKyC ya normaliza las URLs; aquí solo queremos el prefijo del backend
		// para apuntar al endpoint XLSX sin pasar por el cliente fetch (que
		// trataría el XLSX como JSON y fallaría).
		if (typeof window === 'undefined') return '';
		const base = (import.meta.env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
		return base;
	}

	function downloadXlsx() {
		if (!resumen) return;
		const url = `${getApiBase()}${cuentasPorCobrarService.getXlsxUrl()}`;
		// Abrir en nueva pestaña con token (apiKyC inyecta Bearer)
		const token = typeof window !== 'undefined' ? localStorage.getItem('kyc_token') : null;
		// Fallback: usar apiKyC con getBlob para descargar
		window.open(url + (token ? `?token=${token}` : ''), '_blank');
		// Como window.open no envía el Bearer, hacemos la descarga vía fetch+blob
		void fetchXlsx();
	}

	async function fetchXlsx() {
		try {
			const url = cuentasPorCobrarService.getXlsxUrl();
			// Hacer fetch con el token; el helper apiKyC.getBlob no existe, lo
			// hacemos a mano con credentials.
			const { apiKyC } = await import('$lib/config');
			// Llamamos al endpoint de blob pasando credentials; el apiKyC.get
			// devuelve JSON, así que usamos fetch crudo.
			const apiBase = (import.meta.env.PUBLIC_API_BASE_URL || '').replace(/\/+$/, '');
			const blob = await fetchBlob(`${apiBase}${url}`);
			const dlUrl = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = dlUrl;
			a.download = `cuentas_por_cobrar_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '')}.xlsx`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
		} catch (err: any) {
			console.error('Error descargando XLSX:', err);
			alert('error', 'No se pudo descargar el XLSX.');
		}
	}

	async function fetchBlob(url: string): Promise<Blob> {
		const token = localStorage.getItem('kyc_token') || '';
		const resp = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
		return await resp.blob();
	}

	// ========================================================================
	// LIFECYCLE
	// ========================================================================

	onMount(async () => {
		try {
			resumen = await cuentasPorCobrarService.getResumen();
		} catch (err: any) {
			console.error('Error cargando reporte CxC:', err);
			alert('error', err?.message || 'No se pudo cargar el reporte de CxC.');
		} finally {
			loading = false;
		}
	});

	function toggleCurso(cursoId: string) {
		const next = new Set(expandedCursos);
		if (next.has(cursoId)) next.delete(cursoId);
		else next.add(cursoId);
		expandedCursos = next;
	}

	// Abre el modal de gestión de módulos cargando el enrollment fresco
	async function abrirGestionModulos(d: any) {
		modulosModalLoading = true;
		modulosModalOpen = true;
		try {
			const fresh = await enrollmentService.getById(d.enrollment_id);
			modulosModalEnrollment = fresh;
		} catch (e: any) {
			alert('error', e?.message || 'No se pudo cargar la inscripción');
			modulosModalOpen = false;
		} finally {
			modulosModalLoading = false;
		}
	}

	function cerrarGestionModulos() {
		modulosModalOpen = false;
		modulosModalEnrollment = null;
	}

	function getRole(): string {
		const u: any = $userStore?.user;
		return String(u?.role || u?.rol || '');
	}
	function isStaff(): boolean {
		const r = getRole();
		return ['admin', 'superadmin', 'mae', 'cpd', 'cobranza', 'encargado_curso', 'coordinador'].includes(r);
	}
</script>

<svelte:head>
	<title>Cuentas por Cobrar · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-6xl px-4 py-6 sm:py-8">
		<header class="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
			<div>
				<Heading level="h1" weight="bold" color="primary">
					{#snippet children()}
						<h1 class="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-300">
							Estado Financiero y Cuentas por Cobrar
						</h1>
						<p class="text-xs sm:text-sm text-light-four dark:text-dark-four mt-1 max-w-3xl leading-relaxed">
							<b>Principio de Devengado:</b> La <b>CxC Devengada Exigible</b> refleja únicamente la cartera en mora de matrículas y módulos <i>ya dictados o en ejecución</i>. La <b>Proyección Futura</b> corresponde a módulos programados que <i>aún no han iniciado</i>.
						</p>
					{/snippet}
				</Heading>
			</div>
			{#if resumen}
				<Button
					variant="primary"
					size="md"
					onclick={fetchXlsx}
					ariaLabel="Descargar reporte en XLSX"
				>
					<DownloadIcon class="w-4 h-4 mr-2" />
					Descargar XLSX
				</Button>
			{/if}
		</header>

		{#if loading}
			<div class="space-y-4">
				<Skeleton variant="block" lines={3} />
				<Skeleton variant="block" lines={3} />
			</div>
		{:else if !isStaff()}
			<EmptyState
				variant="bordered"
				size="md"
				title="Acceso restringido"
				description="Esta sección es solo para personal administrativo."
			/>
		{:else if !resumen}
			<EmptyState
				variant="bordered"
				size="md"
				title="Sin datos"
				description="No hay datos para mostrar."
			/>
		{:else}
			<!-- Tarjetas resumen (Capas Contables 2026-08-21) -->
			<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<!-- Capa 1: Recaudación Real -->
				<div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/50 shadow-sm">
					<p class="text-[11px] uppercase font-extrabold text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-emerald-500"></span>
						Recaudación Real (Cobrado)
					</p>
					<p class="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-1 tabular-nums">
						{formatCurrency(resumen.recaudacion_efectiva || 0)}
					</p>
					<p class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
						Ingresos efectivamente aprobados
					</p>
				</div>

				<!-- Capa 2: CxC Devengada Exigible (Mora) -->
				<div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/50 shadow-sm">
					<p class="text-[11px] uppercase font-extrabold text-amber-700 dark:text-amber-400 tracking-wider flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-amber-500"></span>
						CxC Devengada (Exigible)
					</p>
					<p class="text-2xl font-black text-amber-800 dark:text-amber-200 mt-1 tabular-nums">
						{formatCurrency(resumen.cxc_devengada || resumen.total_a_la_fecha || 0)}
					</p>
					<p class="text-[11px] text-amber-700 dark:text-amber-400 mt-1 font-semibold">
						{resumen.total_modulos_iniciados} módulo{resumen.total_modulos_iniciados === 1 ? '' : 's'} en curso / dictados
					</p>
				</div>

				<!-- Capa 3: Proyección Futura No Devengada -->
				<div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 shadow-sm">
					<p class="text-[11px] uppercase font-extrabold text-blue-700 dark:text-blue-400 tracking-wider flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-blue-500"></span>
						Proyección Futura (No Devengado)
					</p>
					<p class="text-2xl font-black text-blue-800 dark:text-blue-200 mt-1 tabular-nums">
						{formatCurrency(resumen.proyeccion_futura || 0)}
					</p>
					<p class="text-[11px] text-blue-600 dark:text-blue-400 mt-1">
						{resumen.total_modulos_no_iniciados} módulo{resumen.total_modulos_no_iniciados === 1 ? '' : 's'} aún por iniciar
					</p>
				</div>

				<!-- Compromiso Total -->
				<div class="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
					<p class="text-[11px] uppercase font-extrabold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1.5">
						<span class="size-2 rounded-full bg-slate-400"></span>
						Compromiso Total Contratos
					</p>
					<p class="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1 tabular-nums">
						{formatCurrency(resumen.total_estimado || 0)}
					</p>
					<p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
						{resumen.cantidad_enrollments} alumnos en {resumen.cantidad_cursos} programas
					</p>
				</div>
			</section>

			<!-- Desglose por curso -->
			<section>
				<h2 class="text-lg font-bold text-light-black dark:text-dark-white mb-3 flex items-center gap-2">
					<ChartBarIcon class="w-5 h-5 text-primary-600 dark:text-primary-400" />
					Desglose por programa
				</h2>

				{#if resumen.por_curso.length === 0}
					<EmptyState
						variant="bordered"
						size="md"
						title="Sin programas activos"
						description="No hay inscripciones activas para reportar."
					/>
				{:else}
					<div class="space-y-3">
						{#each resumen.por_curso as curso (curso.curso_id)}
							{@const isExpanded = expandedCursos.has(curso.curso_id)}
							{@const detalleCurso = resumen.detalle.filter(d => d.curso_id === curso.curso_id)}
							<Card variant="bordered">
								{#snippet header()}
									<button
										type="button"
										onclick={() => toggleCurso(curso.curso_id)}
										class="w-full text-left flex items-center justify-between gap-3 hover:opacity-80"
									>
										<div class="min-w-0 flex-1">
											<h3 class="text-base font-bold text-light-black dark:text-dark-white truncate">
												{curso.curso_nombre}
											</h3>
											<p class="text-xs text-light-four dark:text-dark-four mt-0.5">
												{curso.curso_codigo || ''}
												{#if curso.curso_codigo}· {/if}{curso.cantidad_estudiantes} estudiante{curso.cantidad_estudiantes === 1 ? '' : 's'}
											</p>
										</div>
										<div class="text-right shrink-0">
											<p class="text-xs font-semibold text-amber-800 dark:text-amber-300">CxC Devengada Exigible</p>
											<p class="text-base font-black text-amber-900 dark:text-amber-200 tabular-nums">
												{formatCurrency(curso.cxc_devengada ?? curso.total_a_la_fecha ?? 0)}
											</p>
											<p class="text-[10px] text-light-four dark:text-dark-four tabular-nums">
												Recaudado: {formatCurrency(curso.recaudacion_efectiva ?? 0)} · Futuro: {formatCurrency(curso.proyeccion_futura ?? 0)}
											</p>
										</div>
										<svg
											class="w-5 h-5 text-light-four dark:text-dark-four shrink-0 transition-transform {isExpanded ? 'rotate-180' : ''}"
											fill="none" viewBox="0 0 24 24" stroke="currentColor"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
								{/snippet}

								{#if isExpanded}
									<!-- Tabla de estudiantes del curso -->
									<div class="overflow-x-auto -mx-4 sm:mx-0">
										<table class="w-full text-sm min-w-[720px]">
											<thead class="bg-gray-50 dark:bg-dark-background text-light-four dark:text-dark-four">
												<tr>
													<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Estudiante</th>
													<th class="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">Estado</th>
													<th class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Recaudado (Real)</th>
													<th class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">CxC Devengada (Mora)</th>
													<th class="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider">Proyección Futura</th>
													<th class="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider">Acciones</th>
												</tr>
											</thead>
											<tbody>
												{#each detalleCurso as d (d.enrollment_id)}
													<tr class="border-t border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-background/30">
														<td class="px-3 py-2 text-light-black dark:text-dark-white">
															<span class="font-bold">{d.estudiante_nombre}</span>
															<p class="text-[10px] text-light-four dark:text-dark-four">
																Reg: {d.estudiante_registro || '—'}
															</p>
														</td>
														<td class="px-3 py-2 text-light-four dark:text-dark-four text-xs">
															{d.estado}
														</td>
														<td class="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
															{formatCurrency(d.recaudacion_efectiva ?? d.total_pagado ?? 0)}
														</td>
														<td class="px-3 py-2 text-right tabular-nums font-bold text-amber-800 dark:text-amber-300">
															{formatCurrency(d.cxc_devengada ?? d.saldo_a_la_fecha ?? 0)}
														</td>
														<td class="px-3 py-2 text-right tabular-nums text-blue-700 dark:text-blue-400">
															{formatCurrency(d.proyeccion_futura ?? 0)}
														</td>
														<td class="px-3 py-2 text-center">
															<Button
																size="sm"
																variant="secondary"
																onclick={() => abrirGestionModulos(d)}
																ariaLabel="Gestionar módulos de {d.estudiante_nombre}"
															>
																{#snippet leftIcon()}<ClipboardIcon class="size-4" />{/snippet}
																Módulos
															</Button>
														</td>
													</tr>
												{/each}
											</tbody>
										</table>
									</div>
								{/if}
							</Card>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</div>

	<!-- F-MODAL-GESTION-MODULOS (2026-08-03, Kevin): modal centralizado de gestión
	     de módulos, accesible desde esta vista de CxC. -->
	<GestionModulosModal
		isOpen={modulosModalOpen}
		enrollment={modulosModalEnrollment}
		onClose={cerrarGestionModulos}
		onUpdated={(updated) => {
			// refrescar el resumen para reflejar los cambios (ej. nuevo iniciado_en)
			if (updated) {
				void cuentasPorCobrarService.getResumen().then((r) => {
					resumen = r as CxCResumen;
				});
			}
		}}
	/>
</div>
