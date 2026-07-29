<script lang="ts">
	/**
	 * /app/certificates — Vista principal de Certificados del estudiante
	 *
	 * F-CERTIFICADOS (2026-07-29): el estudiante puede:
	 * - Solicitar emisión de Certificado de Notas (si cumple requisitos: programa
	 *   finalizado + saldo cero).
	 * - Solicitar emisión de Certificado de No Deudor hasta un módulo N (si los
	 *   módulos 1..N están pagados).
	 * - Ver y re-descargar su historial de certificados emitidos.
	 *
	 * Reglas de UI:
	 * - Svelte 5 runes ($state, $derived, $effect).
	 * - Validación reactiva con $derived.
	 * - try/catch en todas las llamadas async.
	 * - toasts con alert() de $lib/utils.
	 * - Mobile-first responsive (tabla desktop / cards móvil).
	 * - Tokens UAGRM (no colores hardcodeados).
	 */

	import { onMount } from 'svelte';
	import { enrollmentService, courseService, certificateService } from '$lib/services';
	import { userStore } from '$lib/stores/userStore';
	import { alert } from '$lib/utils';
	import type { Certificate, Enrollment, Course } from '$lib/interfaces';

	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Button from '$lib/components/ui/button.svelte';
	import Skeleton from '$lib/components/ui/skeleton.svelte';
	import EmptyState from '$lib/components/ui/emptyState.svelte';
	import {
		IdentificationIcon,
		FileTextIcon,
		DownloadIcon,
		CircleCheckIcon,
		ExclamationIcon
	} from '$lib/icons/outline';

	// ========================================================================
	// STATE
	// ========================================================================

	let enrollments: Enrollment[] = $state([]);
	let coursesMap: Record<string, Course> = $state({});
	let issuedCertificates: Certificate[] = $state([]);
	let loading = $state(true);
	let downloadingId = $state<string | null>(null);

	// Estado de emisión por enrollment_id y tipo
	let emittingNotas = $state<Record<string, boolean>>({});
	let emittingNoDeudor = $state<Record<string, boolean>>({});
	let hastaModuloNSelections = $state<Record<string, number>>({});

	// ID del usuario actual (string, nunca undefined en este punto del flujo)
	function getUserId(): string {
		const u: any = $userStore?.user;
		if (!u) return '';
		return String(u._id || u.id || '');
	}

	// ========================================================================
	// DERIVADOS: reglas de elegibilidad por enrollment
	// ========================================================================

	function notasCursando(e: Enrollment): string[] {
		if (!e.modulos) return [];
		return e.modulos
			.filter((m: any) => m.estado_academico === 'Cursando')
			.map((m: any) => m.nombre);
	}

	function isNotasElegible(e: Enrollment): { ok: boolean; motivo: string | null } {
		const pendientes = notasCursando(e);
		if (pendientes.length > 0) {
			return {
				ok: false,
				motivo: `Te faltan ${pendientes.length} módulo(s) por finalizar: ${pendientes.join(', ')}.`
			};
		}
		if ((e.saldo_pendiente ?? 0) > 0.01) {
			return {
				ok: false,
				motivo: `Tienes un saldo pendiente de Bs ${e.saldo_pendiente.toFixed(2)}. Cancélalo para habilitar el certificado.`
			};
		}
		return { ok: true, motivo: null };
	}

	function isNotasYaEmitido(e: Enrollment): Certificate | null {
		const eid = e._id || e.id;
		if (!eid) return null;
		return (
			issuedCertificates.find(
				(c) => c.tipo === 'notas' && c.enrollment_id === eid
			) || null
		);
	}

	function getModuloEstadoPago(e: Enrollment, hastaN: number): { ok: boolean; moduloPendiente: string | null } {
		if (!e.modulos) return { ok: true, moduloPendiente: null };
		for (let i = 0; i < hastaN && i < e.modulos.length; i++) {
			const m: any = e.modulos[i];
			if (m.estado !== 'Pagado') {
				return { ok: false, moduloPendiente: m.nombre };
			}
		}
		return { ok: true, moduloPendiente: null };
	}

	function ultimoModuloPagado(e: Enrollment): number {
		if (!e.modulos) return 0;
		let n = 0;
		for (let i = 0; i < e.modulos.length; i++) {
			const m: any = e.modulos[i];
			if (m.estado === 'Pagado') n = i + 1;
			else break;
		}
		return n;
	}

	function getNoDeudorElegibilidad(e: Enrollment, hastaN: number): { ok: boolean; motivo: string | null } {
		const total = e.modulos?.length ?? 0;
		if (total === 0) {
			return { ok: false, motivo: 'Esta inscripción no tiene módulos asociados.' };
		}
		if (hastaN < 1 || hastaN > total) {
			return { ok: false, motivo: `Selecciona un módulo entre 1 y ${total}.` };
		}
		const { ok, moduloPendiente } = getModuloEstadoPago(e, hastaN);
		if (!ok) {
			return {
				ok: false,
				motivo: `El módulo «${moduloPendiente}» aún no está pagado. Cancélalo para habilitar el certificado hasta ese punto.`
			};
		}
		return { ok: true, motivo: null };
	}

	function certificadosDeEnrollment(e: Enrollment): Certificate[] {
		const eid = e._id || e.id;
		if (!eid) return [];
		return issuedCertificates.filter((c) => c.enrollment_id === eid);
	}

	function getCourse(e: Enrollment): Course | null {
		const cid = e.curso_id;
		if (!cid) return null;
		return coursesMap[cid] || null;
	}

	// ========================================================================
	// DATA FETCHING
	// ========================================================================

	async function cargarDatos() {
		const userId = getUserId();
		if (!userId) {
			loading = false;
			return;
		}

		loading = true;
		try {
			const [enrollmentsData, certsData] = await Promise.all([
				enrollmentService.getByStudentId(userId),
				certificateService.listMy().catch((err) => {
					console.warn('No se pudieron cargar certificados emitidos:', err);
					return [];
				})
			]);

			enrollments = enrollmentsData || [];
			issuedCertificates = certsData;

			// Cargar cursos en batch
			const cursoIds = Array.from(
				new Set(enrollments.map((e) => e.curso_id).filter(Boolean))
			);
			if (cursoIds.length > 0) {
				try {
					const allCourses = await courseService.getAll(1, 200);
					const map: Record<string, Course> = {};
					const data: any[] = (allCourses as any).data || allCourses || [];
					for (const c of data) {
						if (c && c._id) map[c._id] = c;
					}
					coursesMap = map;
				} catch (err) {
					console.warn('No se pudieron cargar cursos:', err);
				}
			}
		} catch (err: any) {
			console.error('Error cargando datos:', err);
			alert('error', err?.message || 'No se pudieron cargar tus inscripciones.');
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		cargarDatos();
	});

	// ========================================================================
	// ACCIONES: emitir certificados
	// ========================================================================

	async function emitirNotas(e: Enrollment) {
		const eid = e._id || e.id;
		if (!eid) return;

		const elegible = isNotasElegible(e);
		if (!elegible.ok) {
			alert('warning', elegible.motivo || 'No cumples los requisitos.');
			return;
		}

		emittingNotas = { ...emittingNotas, [eid]: true };
		try {
			const cert = await certificateService.emitNotas(eid);
			issuedCertificates = [cert, ...issuedCertificates];
			alert(
				'success',
				`Certificado de Notas emitido. Folio: ${cert.folio}. La descarga empezará en breve.`
			);
			await descargarPdf(cert);
		} catch (err: any) {
			console.error('Error emitiendo notas:', err);
			const detail =
				err?.response?.data?.detail || err?.message || 'No se pudo emitir el certificado.';
			alert('error', detail);
		} finally {
			emittingNotas = { ...emittingNotas, [eid]: false };
		}
	}

	async function emitirNoDeudor(e: Enrollment) {
		const eid = e._id || e.id;
		if (!eid) return;

		const hastaN = hastaModuloNSelections[eid] || 1;
		const elegible = getNoDeudorElegibilidad(e, hastaN);
		if (!elegible.ok) {
			alert('warning', elegible.motivo || 'No cumples los requisitos.');
			return;
		}

		emittingNoDeudor = { ...emittingNoDeudor, [eid]: true };
		try {
			const cert = await certificateService.emitNoDeudor(eid, hastaN);
			issuedCertificates = [cert, ...issuedCertificates];
			alert(
				'success',
				`Certificado de No Deudor (hasta Módulo ${hastaN}) emitido. Folio: ${cert.folio}. La descarga empezará en breve.`
			);
			await descargarPdf(cert);
		} catch (err: any) {
			console.error('Error emitiendo no deudor:', err);
			const detail =
				err?.response?.data?.detail || err?.message || 'No se pudo emitir el certificado.';
			alert('error', detail);
		} finally {
			emittingNoDeudor = { ...emittingNoDeudor, [eid]: false };
		}
	}

	async function descargarPdf(cert: Certificate) {
		downloadingId = cert.id;
		try {
			const blob = await certificateService.downloadPdf(cert.id);
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = cert.pdf_filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err: any) {
			console.error('Error descargando PDF:', err);
			const detail =
				err?.response?.data?.detail || err?.message || 'No se pudo descargar el PDF.';
			alert('error', detail);
		} finally {
			downloadingId = null;
		}
	}

	// ========================================================================
	// HELPERS de UI
	// ========================================================================

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '—';
		try {
			const s = iso.includes('T') ? iso : iso.replace(' ', 'T');
			const clean = s.replace(/(\.\d+)?$/, '').replace(/([+-]\d{2}:?\d{2}|Z)$/, 'Z');
			const d = new Date(clean);
			return d.toLocaleDateString('es-BO', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric'
			});
		} catch {
			return iso;
		}
	}
</script>

<svelte:head>
	<title>Certificados · KYC DataHub</title>
</svelte:head>

<div class="min-h-screen bg-light-primary dark:bg-dark-background">
	<div class="container mx-auto max-w-5xl px-4 py-6 sm:py-8">
		<!-- Header -->
		<header class="mb-6">
			<Heading level="h1" weight="bold" color="primary">
				{#snippet children()}
					<h1 class="text-2xl sm:text-3xl font-bold text-primary-700 dark:text-primary-300">
						Tus Certificados
					</h1>
					<p class="text-sm text-light-four dark:text-dark-four mt-1">
						Descarga constancias oficiales emitidas por la Unidad de Postgrado.
					</p>
				{/snippet}
			</Heading>
		</header>

		<!-- Loading -->
		{#if loading}
			<div class="space-y-4">
				<Skeleton variant="block" lines={3} />
				<Skeleton variant="block" lines={3} />
			</div>

		<!-- Empty state -->
		{:else if enrollments.length === 0}
			<EmptyState
				variant="bordered"
				size="lg"
				icon="inbox"
				title="No tienes inscripciones activas"
				description="Cuando te inscribas a un diplomado o programa, aquí podrás solicitar tus certificados de Notas y de No Deudor."
			/>

		<!-- Contenido principal -->
		{:else}
			<div class="space-y-6">
				{#each enrollments as enrollment (enrollment._id || enrollment.id || '')}
					{@const eid = String(enrollment._id || enrollment.id || '')}
					{@const course = getCourse(enrollment)}
					{@const elegibleNotas = isNotasElegible(enrollment)}
					{@const notasYaEmitido = isNotasYaEmitido(enrollment)}
					{@const totalModulos = enrollment.modulos?.length ?? 0}
					{@const ultPagado = ultimoModuloPagado(enrollment)}
					{@const hastaN = hastaModuloNSelections[eid] || Math.min(ultPagado || 1, Math.max(totalModulos, 1))}
					{@const elegibleNoDeudor = getNoDeudorElegibilidad(enrollment, hastaN)}

					<Card variant="bordered">
						{#snippet header()}
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0 flex-1">
									<h3 class="text-lg font-bold text-light-black dark:text-dark-white truncate">
										{course?.nombre_programa || 'Programa'}
									</h3>
									<p class="text-sm text-light-four dark:text-dark-four mt-1">
										{course?.codigo ? `Código: ${course.codigo}` : ''}
										{#if totalModulos > 0}
											· {totalModulos} módulo{totalModulos === 1 ? '' : 's'}
										{/if}
										{#if (enrollment.saldo_pendiente ?? 0) > 0.01}
											· <span class="text-light-error dark:text-dark-error font-medium">
												Saldo pendiente: Bs {enrollment.saldo_pendiente.toFixed(2)}
											</span>
										{:else if totalModulos > 0}
											· <span class="text-light-success dark:text-dark-success font-medium">
												Pagado completo
											</span>
										{/if}
									</p>
								</div>
							</div>
						{/snippet}

						<!-- SECCIÓN 1: Certificado de Notas -->
						<section class="mb-6">
							<div class="flex items-center gap-2 mb-3">
								<FileTextIcon class="w-5 h-5 text-primary-600 dark:text-primary-400" />
								<h4 class="text-base font-semibold text-light-black dark:text-dark-white">
									Certificado de Notas
								</h4>
							</div>

							{#if notasYaEmitido}
								<div
									class="rounded-lg border border-light-success/40 bg-light-success/5 dark:border-dark-success/40 dark:bg-dark-success/5 p-4"
								>
									<div class="flex items-start gap-3">
										<CircleCheckIcon class="w-6 h-6 text-light-success dark:text-dark-success shrink-0 mt-0.5" />
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium text-light-black dark:text-dark-white">
												Ya emitido · Folio {notasYaEmitido.folio}
											</p>
											<p class="text-xs text-light-four dark:text-dark-four mt-0.5">
												{formatDate(notasYaEmitido.emitido_en)}
											</p>
										</div>
										<Button
											variant="primary"
											size="sm"
											loading={downloadingId === notasYaEmitido.id}
											onclick={() => descargarPdf(notasYaEmitido)}
											ariaLabel="Re-descargar Certificado de Notas {notasYaEmitido.folio}"
										>
											<DownloadIcon class="w-4 h-4 mr-1.5" />
											Descargar
										</Button>
									</div>
								</div>
							{:else if elegibleNotas.ok}
								<div
									class="rounded-lg border border-light-success/40 bg-light-success/5 dark:border-dark-success/40 dark:bg-dark-success/5 p-4"
								>
									<p class="text-sm text-light-black dark:text-dark-white mb-3">
										¡Cumples todos los requisitos! Programa finalizado y sin saldo pendiente.
									</p>
									<Button
										variant="primary"
										size="md"
										loading={emittingNotas[eid]}
										onclick={() => emitirNotas(enrollment)}
										ariaLabel="Emitir Certificado de Notas"
									>
										<DownloadIcon class="w-4 h-4 mr-2" />
										Descargar Certificado de Notas
									</Button>
								</div>
							{:else}
								<div
									class="rounded-lg border border-light-warning/40 bg-light-warning/5 dark:border-dark-warning/40 dark:bg-dark-warning/5 p-4"
								>
									<div class="flex items-start gap-3">
										<ExclamationIcon class="w-5 h-5 text-light-warning dark:text-dark-warning shrink-0 mt-0.5" />
										<div>
											<p class="text-sm font-medium text-light-black dark:text-dark-white">
												Aún no puedes emitir este certificado
											</p>
											<p class="text-sm text-light-four dark:text-dark-four mt-1">
												{elegibleNotas.motivo}
											</p>
										</div>
									</div>
								</div>
							{/if}
						</section>

						<!-- SECCIÓN 2: Certificado de No Deudor -->
						<section>
							<div class="flex items-center gap-2 mb-3">
								<IdentificationIcon class="w-5 h-5 text-uagrm-blue dark:text-dark-tertiary" />
								<h4 class="text-base font-semibold text-light-black dark:text-dark-white">
									Certificado de No Deudor
								</h4>
							</div>

							<div
								class="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-4"
							>
								<p class="text-sm text-light-black dark:text-dark-white mb-3">
									Puedes solicitar este certificado en cualquier momento, indicando hasta qué
									módulo ya has cancelado.
								</p>

								{#if totalModulos === 0}
									<p class="text-sm text-light-four dark:text-dark-four italic">
										Esta inscripción no tiene módulos asociados.
									</p>
								{:else}
									<label
										class="block mb-2 text-sm font-medium text-light-black dark:text-dark-white"
										for="modulo-n-{eid}"
									>
										¿Hasta qué módulo?
									</label>
									<div class="flex flex-col sm:flex-row sm:items-center gap-3">
										<select
											id="modulo-n-{eid}"
											class="rounded-lg border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-surface text-light-black dark:text-dark-white px-3 py-2 text-sm min-w-[8rem] focus:ring-2 focus:ring-primary-500 focus:border-transparent"
											value={hastaN}
											onchange={(ev) => {
												const v = parseInt(
													(ev.currentTarget as HTMLSelectElement).value,
													10
												);
												hastaModuloNSelections = {
													...hastaModuloNSelections,
													[eid]: v
												};
											}}
										>
											{#each Array.from({ length: totalModulos }, (_, i) => i + 1) as n}
												<option value={n}>Módulo {n}</option>
											{/each}
										</select>

										<Button
											variant="primary"
											size="md"
											disabled={!elegibleNoDeudor.ok}
											loading={emittingNoDeudor[eid]}
											onclick={() => emitirNoDeudor(enrollment)}
											ariaLabel="Emitir Certificado de No Deudor hasta Módulo {hastaN}"
										>
											<DownloadIcon class="w-4 h-4 mr-2" />
											Descargar No Deudor
										</Button>
									</div>

									{#if !elegibleNoDeudor.ok}
										<p class="text-xs text-light-error dark:text-dark-error mt-2">
											{elegibleNoDeudor.motivo}
										</p>
									{:else if ultPagado >= hastaN}
										<p class="text-xs text-light-success dark:text-dark-success mt-2">
											✓ Los módulos 1 a {hastaN} están pagados. Puedes emitir este certificado.
										</p>
									{/if}
								{/if}

								<!-- Certificados de No Deudor ya emitidos -->
								{#if certificadosDeEnrollment(enrollment).filter((c) => c.tipo === 'no_deudor').length > 0}
									<div class="mt-4 pt-4 border-t border-gray-100 dark:border-dark-border space-y-2">
										<p
											class="text-xs font-semibold text-light-four dark:text-dark-four uppercase tracking-wider"
										>
											Ya emitidos
										</p>
										{#each certificadosDeEnrollment(enrollment).filter((c) => c.tipo === 'no_deudor') as cert (cert.id)}
											<div
												class="flex items-center justify-between gap-2 rounded-md bg-gray-50 dark:bg-dark-background px-3 py-2"
											>
												<div class="min-w-0 flex-1">
													<p class="text-sm font-medium text-light-black dark:text-dark-white">
														{cert.folio}{#if cert.hasta_modulo_n}· hasta Módulo {cert.hasta_modulo_n}{/if}
													</p>
													<p class="text-xs text-light-four dark:text-dark-four">
														{formatDate(cert.emitido_en)}
													</p>
												</div>
												<Button
													variant="ghost"
													size="sm"
													loading={downloadingId === cert.id}
													onclick={() => descargarPdf(cert)}
													ariaLabel="Re-descargar {cert.folio}"
												>
													<DownloadIcon class="w-4 h-4" />
												</Button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</section>
					</Card>
				{/each}

				<!-- Sección Historial -->
				{#if issuedCertificates.length > 0}
					<section class="mt-8">
						<Heading level="h2" weight="bold" color="primary">
							{#snippet children()}
								<h2 class="text-xl font-bold text-primary-700 dark:text-primary-300">
									Historial de certificados emitidos
								</h2>
								<p class="text-sm text-light-four dark:text-dark-four mt-1">
									Total: {issuedCertificates.length} certificado{issuedCertificates.length === 1
										? ''
										: 's'}.
								</p>
							{/snippet}
						</Heading>

						<!-- Desktop: tabla -->
						<div
							class="hidden sm:block mt-4 rounded-lg border border-gray-200 dark:border-dark-border overflow-hidden"
						>
							<table class="w-full text-sm">
								<thead
									class="bg-primary-50 dark:bg-primary-900/30 text-light-four dark:text-dark-four"
								>
									<tr>
										<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Folio</th>
										<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Tipo</th>
										<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Programa</th>
										<th class="px-3 py-2 text-left font-medium uppercase tracking-wider text-xs">Emitido</th>
										<th class="px-3 py-2 text-right font-medium uppercase tracking-wider text-xs">Acción</th>
									</tr>
								</thead>
								<tbody>
									{#each issuedCertificates as cert (cert.id)}
										<tr class="border-t border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-background">
											<td class="px-3 py-2 font-mono font-semibold text-primary-700 dark:text-primary-300">
												{cert.folio}
											</td>
											<td class="px-3 py-2">
												<span
													class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {cert.tipo ===
													'notas'
														? 'bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200'
														: 'bg-uagrm-sky/10 text-uagrm-blue dark:bg-dark-tertiary/10 dark:text-dark-tertiary'}"
												>
													{cert.tipo === 'notas' ? 'Notas' : 'No Deudor'}{#if cert.hasta_modulo_n}· M{cert.hasta_modulo_n}{/if}
												</span>
											</td>
											<td
												class="px-3 py-2 text-light-black dark:text-dark-white max-w-xs truncate"
												title={cert.programa_nombre}
											>
												{cert.programa_nombre}
											</td>
											<td class="px-3 py-2 text-light-four dark:text-dark-four">
												{formatDate(cert.emitido_en)}
											</td>
											<td class="px-3 py-2 text-right">
												<Button
													variant="ghost"
													size="sm"
													loading={downloadingId === cert.id}
													onclick={() => descargarPdf(cert)}
													ariaLabel="Re-descargar {cert.folio}"
												>
													<DownloadIcon class="w-4 h-4" />
												</Button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Móvil: cards -->
						<div class="sm:hidden space-y-3 mt-4">
							{#each issuedCertificates as cert (cert.id)}
								<Card variant="bordered">
									<div class="flex items-start justify-between gap-3">
										<div class="min-w-0 flex-1">
											<p class="font-mono text-sm font-semibold text-primary-700 dark:text-primary-300">
												{cert.folio}
											</p>
											<p class="text-xs mt-1 text-light-four dark:text-dark-four">
												{cert.tipo === 'notas'
													? 'Certificado de Notas'
													: `No Deudor · hasta Módulo ${cert.hasta_modulo_n ?? ''}`}
											</p>
											<p
												class="text-sm mt-1 text-light-black dark:text-dark-white truncate"
												title={cert.programa_nombre}
											>
												{cert.programa_nombre}
											</p>
											<p class="text-xs mt-1 text-light-four dark:text-dark-four">
												{formatDate(cert.emitido_en)}
											</p>
										</div>
										<Button
											variant="ghost"
											size="sm"
											loading={downloadingId === cert.id}
											onclick={() => descargarPdf(cert)}
											ariaLabel="Re-descargar {cert.folio}"
										>
											<DownloadIcon class="w-4 h-4" />
										</Button>
									</div>
								</Card>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</div>
