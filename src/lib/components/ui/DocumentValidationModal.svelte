<script lang="ts">
	// DocumentValidationModal.svelte — KYC DataHub
	import { slide, fade } from 'svelte/transition';
	import { XIcon, CircleCheckIcon, StopwatchIcon, CheckIcon, XMarkIcon, EyeIcon, FileTextIcon, DocumentAddIcon, UsersIcon } from '$lib/icons/outline';
	import Button from '$lib/components/ui/button.svelte';
	import { enrollmentService, studentService, courseService } from '$lib/services';
	import type { Enrollment, Student } from '$lib/interfaces';
	import { goto } from '$app/navigation';
	import { alert } from '$lib/utils';

	interface Props {
		isOpen?: boolean;
		onClose: () => void;
	}

	let { isOpen = false, onClose }: Props = $props();

	let loading = $state(true);
	let actionLoading = $state<string | null>(null);
	let rejectingKey = $state<string | null>(null);
	let motivoRechazo = $state('');
	let fileInputEls = $state<Record<string, HTMLInputElement | null>>({});

	// Pestañas / Filtros
	let activeTab = $state<'estudiantes' | 'tipos'>('estudiantes');
	let searchQuery = $state('');

	// Subida por Staff Modal / Panel Formulario
	let showStaffUploadForm = $state(false);
	let selectedStudentForUpload = $state('');
	let uploadDocType = $state<'titulo' | 'cv' | 'carnet' | 'afiliacion' | 'requisito'>('titulo');
	let uploadTituloForm = $state({ titulo: '', numero_titulo: '', universidad: '', año_expedicion: '' });
	let uploadRequisitoEnrId = $state('');
	let uploadRequisitoIndex = $state(0);
	let staffFileToUpload = $state<File | null>(null);
	let isSubmittingStaffUpload = $state(false);

	function getSafeDocumentUrl(url: string): string {
		if (!url) return '';
		if (!/\.(pdf|jpg|jpeg|png|webp)($|\?)/i.test(url)) {
			if (url.includes('cloudinary.com')) {
				return `${url}.pdf`;
			}
		}
		return url;
	}

	// Interfaces unificadas
	export interface UnifiedDocItem {
		id: string;
		studentId: string;
		studentName: string;
		carnet: string;
		docCategory: 'titulo' | 'personal' | 'requisito';
		docLabel: string;
		url: string;
		estado: string;
		motivoRechazo?: string | null;
		// Referencias internas
		docTypePersonal?: 'cv' | 'carnet' | 'afiliacion';
		enrollmentId?: string;
		reqIndex?: number;
		tituloData?: { titulo: string; numeroTitulo: string; universidad: string; añoExpedicion: string };
		courseName?: string;
	}

	export interface StudentDocGroup {
		studentId: string;
		studentName: string;
		carnet: string;
		docs: UnifiedDocItem[];
	}

	let allStudentsList = $state<Student[]>([]);
	let allEnrollmentsList = $state<Enrollment[]>([]);
	let unifiedDocList = $state<UnifiedDocItem[]>([]);

	$effect(() => {
		if (isOpen) {
			loadPendingDocuments();
		}
	});

	async function loadPendingDocuments() {
		loading = true;
		rejectingKey = null;
		motivoRechazo = '';
		try {
			const [resEnrollments, studentsReq, coursesReq] = await Promise.all([
				enrollmentService.getAll(1, 150).catch(() => ({ data: [] })),
				studentService.getAll(1, 150).catch(() => ({ data: [] })),
				courseService.getAll().catch(() => ({ data: [] }))
			]);

			allStudentsList = studentsReq.data || [];
			allEnrollmentsList = resEnrollments.data || [];

			const studentsMap = (studentsReq.data || []).reduce((acc: Record<string, Student>, s: Student) => {
				acc[s._id] = s;
				return acc;
			}, {});

			const coursesMap = (coursesReq.data || []).reduce((acc: Record<string, string>, c: any) => {
				acc[c._id] = c.nombre_programa;
				return acc;
			}, {});

			const docs: UnifiedDocItem[] = [];

			// 1. Títulos Profesionales
			for (const s of (studentsReq.data || [])) {
				const tUrl = s.titulo?.titulo_url || (s.titulo as any)?.url;
				if (s.titulo && (s.titulo.estado === 'pendiente' || tUrl)) {
					docs.push({
						id: `title-${s._id}`,
						studentId: s._id,
						studentName: s.nombre,
						carnet: s.carnet || s.registro,
						docCategory: 'titulo',
						docLabel: `🎓 Título: ${s.titulo.titulo || 'Título Profesional'}`,
						url: tUrl || '',
						estado: s.titulo.estado || 'pendiente',
						motivoRechazo: (s.titulo as any)?.motivo_rechazo,
						tituloData: {
							titulo: s.titulo.titulo || 'N/A',
							numeroTitulo: s.titulo.numero_titulo || 'N/A',
							universidad: s.titulo.universidad || 'N/A',
							añoExpedicion: s.titulo.año_expedicion || 'N/A'
						}
					});
				}

				// 2. Documentos Personales (CV, Carnet, Afiliación)
				if (s.cv_url || s.cv_estado === 'pendiente') {
					docs.push({
						id: `personal-${s._id}-cv`,
						studentId: s._id,
						studentName: s.nombre,
						carnet: s.carnet || s.registro,
						docCategory: 'personal',
						docLabel: '📄 Curriculum Vitae (CV)',
						docTypePersonal: 'cv',
						url: s.cv_url || '',
						estado: s.cv_estado || 'pendiente',
						motivoRechazo: s.cv_motivo_rechazo
					});
				}
				if (s.carnet_url || s.carnet_estado === 'pendiente') {
					docs.push({
						id: `personal-${s._id}-carnet`,
						studentId: s._id,
						studentName: s.nombre,
						carnet: s.carnet || s.registro,
						docCategory: 'personal',
						docLabel: '🪪 Carnet de Identidad',
						docTypePersonal: 'carnet',
						url: s.carnet_url || '',
						estado: s.carnet_estado || 'pendiente',
						motivoRechazo: s.carnet_motivo_rechazo
					});
				}
				if (s.afiliacion_url || s.afiliacion_estado === 'pendiente') {
					docs.push({
						id: `personal-${s._id}-afiliacion`,
						studentId: s._id,
						studentName: s.nombre,
						carnet: s.carnet || s.registro,
						docCategory: 'personal',
						docLabel: '📜 Certificado de Afiliación',
						docTypePersonal: 'afiliacion',
						url: s.afiliacion_url || '',
						estado: s.afiliacion_estado || 'pendiente',
						motivoRechazo: s.afiliacion_motivo_rechazo
					});
				}
			}

			// 3. Requisitos por Curso
			for (const enr of (resEnrollments.data || [])) {
				const sName = studentsMap[enr.estudiante_id]?.nombre || 'Estudiante Desconocido';
				const sCarnet = studentsMap[enr.estudiante_id]?.carnet || studentsMap[enr.estudiante_id]?.registro || 'N/A';
				const cName = coursesMap[enr.curso_id] || 'Programa';

				if (enr.requisitos && enr.requisitos.length > 0) {
					enr.requisitos.forEach((req: any, rIdx: number) => {
						if (req.url || req.estado === 'en_proceso' || req.estado === 'pendiente') {
							docs.push({
								id: `req-${enr._id}-${rIdx}`,
								studentId: enr.estudiante_id,
								studentName: sName,
								carnet: sCarnet,
								docCategory: 'requisito',
								docLabel: `📝 ${req.descripcion}`,
								courseName: cName,
								url: req.url || '',
								estado: req.estado === 'en_proceso' ? 'pendiente' : req.estado,
								motivoRechazo: req.motivo_rechazo,
								enrollmentId: enr._id,
								reqIndex: rIdx
							});
						}
					});
				}
			}

			unifiedDocList = docs;
		} catch (error) {
			console.error("Error cargando documentos pendientes:", error);
		} finally {
			loading = false;
		}
	}

	// Filtros y Agrupaciones
	let filteredDocs = $derived(
		unifiedDocList.filter(d => {
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase();
			return (
				d.studentName.toLowerCase().includes(q) ||
				d.carnet.toLowerCase().includes(q) ||
				d.docLabel.toLowerCase().includes(q) ||
				(d.courseName && d.courseName.toLowerCase().includes(q))
			);
		})
	);

	let docsGroupedByStudent = $derived.by(() => {
		const map: Record<string, StudentDocGroup> = {};
		for (const doc of filteredDocs) {
			if (!map[doc.studentId]) {
				map[doc.studentId] = {
					studentId: doc.studentId,
					studentName: doc.studentName,
					carnet: doc.carnet,
					docs: []
				};
			}
			map[doc.studentId].docs.push(doc);
		}
		return Object.values(map);
	});

	let docsGroupedByCategory = $derived({
		titulos: filteredDocs.filter(d => d.docCategory === 'titulo'),
		personales: filteredDocs.filter(d => d.docCategory === 'personal'),
		requisitos: filteredDocs.filter(d => d.docCategory === 'requisito')
	});

	// Acciones de Validación
	async function handleAprobar(doc: UnifiedDocItem) {
		if (!doc.url) {
			alert('error', 'No se puede aprobar un documento sin archivo adjunto');
			return;
		}
		actionLoading = doc.id;
		try {
			if (doc.docCategory === 'titulo') {
				await studentService.verifyTitulo(doc.studentId, {});
			} else if (doc.docCategory === 'personal' && doc.docTypePersonal) {
				await studentService.verifyDocument(doc.studentId, doc.docTypePersonal);
			} else if (doc.docCategory === 'requisito' && doc.enrollmentId !== undefined && doc.reqIndex !== undefined) {
				await enrollmentService.aprobarRequisito(doc.enrollmentId, doc.reqIndex);
			}
			alert('success', 'Documento verificado y aprobado');
			await loadPendingDocuments();
		} catch (e: any) {
			alert('error', e?.message || 'Error al verificar documento');
		} finally {
			actionLoading = null;
		}
	}

	async function handleRechazar(doc: UnifiedDocItem) {
		if (!doc.url) {
			alert('error', 'No se puede rechazar un documento sin archivo adjunto');
			return;
		}
		if (!motivoRechazo.trim()) {
			alert('error', 'Ingresa el motivo del rechazo');
			return;
		}
		actionLoading = doc.id;
		try {
			if (doc.docCategory === 'titulo') {
				await studentService.rejectTitulo(doc.studentId, motivoRechazo.trim());
			} else if (doc.docCategory === 'personal' && doc.docTypePersonal) {
				await studentService.rejectDocument(doc.studentId, doc.docTypePersonal, motivoRechazo.trim());
			} else if (doc.docCategory === 'requisito' && doc.enrollmentId !== undefined && doc.reqIndex !== undefined) {
				await enrollmentService.rechazarRequisito(doc.enrollmentId, doc.reqIndex, motivoRechazo.trim());
			}
			alert('success', 'Documento rechazado con observaciones');
			rejectingKey = null;
			motivoRechazo = '';
			await loadPendingDocuments();
		} catch (e: any) {
			alert('error', e?.message || 'Error al rechazar documento');
		} finally {
			actionLoading = null;
		}
	}

	// Subida Directa por Staff
	function triggerStaffUpload(key: string) {
		fileInputEls[key]?.click();
	}

	async function handleFileSelectedForDoc(event: Event, doc: UnifiedDocItem) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		actionLoading = doc.id;
		try {
			if (doc.docCategory === 'titulo') {
				const tData = doc.tituloData || { titulo: 'Título Profesional', numeroTitulo: '123', universidad: 'UAGRM', añoExpedicion: '2024' };
				await studentService.uploadTitulo(doc.studentId, file, {
					titulo: tData.titulo,
					numero_titulo: tData.numeroTitulo,
					universidad: tData.universidad,
					año_expedicion: tData.añoExpedicion
				});
				await studentService.verifyTitulo(doc.studentId, {});
			} else if (doc.docCategory === 'personal' && doc.docTypePersonal) {
				if (doc.docTypePersonal === 'carnet') await studentService.uploadCarnet(doc.studentId, file);
				else if (doc.docTypePersonal === 'cv') await studentService.uploadCV(doc.studentId, file);
				else if (doc.docTypePersonal === 'afiliacion') await studentService.uploadAfiliacion(doc.studentId, file);
				await studentService.verifyDocument(doc.studentId, doc.docTypePersonal);
			} else if (doc.docCategory === 'requisito' && doc.enrollmentId && doc.reqIndex !== undefined) {
				await enrollmentService.subirRequisito(doc.enrollmentId, doc.reqIndex, file);
				await enrollmentService.aprobarRequisito(doc.enrollmentId, doc.reqIndex);
			}
			alert('success', 'Documento adjuntado y aprobado automáticamente por staff');
			await loadPendingDocuments();
		} catch (e: any) {
			alert('error', e?.message || 'Error al subir archivo por staff');
		} finally {
			actionLoading = null;
			input.value = '';
		}
	}

	// Formulario Global de Carga de Staff ("+ Cargar Documento por Alumno")
	async function submitGlobalStaffUpload() {
		if (!selectedStudentForUpload) {
			alert('error', 'Selecciona el estudiante');
			return;
		}
		if (!staffFileToUpload) {
			alert('error', 'Selecciona el archivo PDF o Imagen');
			return;
		}

		isSubmittingStaffUpload = true;
		try {
			if (uploadDocType === 'titulo') {
				if (!uploadTituloForm.titulo || !uploadTituloForm.universidad) {
					alert('error', 'Completa los datos del título (Nombre y Universidad)');
					isSubmittingStaffUpload = false;
					return;
				}
				await studentService.uploadTitulo(selectedStudentForUpload, staffFileToUpload, {
					titulo: uploadTituloForm.titulo,
					numero_titulo: uploadTituloForm.numero_titulo || 'S/N',
					universidad: uploadTituloForm.universidad,
					año_expedicion: uploadTituloForm.año_expedicion || new Date().getFullYear().toString()
				});
				await studentService.verifyTitulo(selectedStudentForUpload, {});
			} else if (['cv', 'carnet', 'afiliacion'].includes(uploadDocType)) {
				if (uploadDocType === 'carnet') await studentService.uploadCarnet(selectedStudentForUpload, staffFileToUpload);
				else if (uploadDocType === 'cv') await studentService.uploadCV(selectedStudentForUpload, staffFileToUpload);
				else if (uploadDocType === 'afiliacion') await studentService.uploadAfiliacion(selectedStudentForUpload, staffFileToUpload);
				await studentService.verifyDocument(selectedStudentForUpload, uploadDocType);
			} else if (uploadDocType === 'requisito') {
				if (!uploadRequisitoEnrId) {
					alert('error', 'Selecciona la inscripción correspondiente');
					isSubmittingStaffUpload = false;
					return;
				}
				await enrollmentService.subirRequisito(uploadRequisitoEnrId, uploadRequisitoIndex, staffFileToUpload);
				await enrollmentService.aprobarRequisito(uploadRequisitoEnrId, uploadRequisitoIndex);
			}

			alert('success', 'Documento subido y validado exitosamente');
			showStaffUploadForm = false;
			staffFileToUpload = null;
			await loadPendingDocuments();
		} catch (e: any) {
			alert('error', e?.message || 'Error al procesar subida de staff');
		} finally {
			isSubmittingStaffUpload = false;
		}
	}

	let selectedStudentEnrollments = $derived(
		allEnrollmentsList.filter(e => e.estudiante_id === selectedStudentForUpload)
	);

	function goToStudent(id: string) {
		onClose();
		goto(`/app/students?q=${id}`);
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm transition-opacity flex items-center justify-center p-3 sm:p-4"
		onclick={onClose}
		transition:fade={{ duration: 150 }}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="bg-white dark:bg-dark-surface rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-dark-border"
			onclick={(e) => e.stopPropagation()}
			transition:slide={{ duration: 250, axis: 'y' }}
		>
			<!-- Header Modal -->
			<div class="px-6 py-4 border-b border-gray-100 dark:border-dark-border bg-gray-50/60 dark:bg-dark-background/40">
				<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div class="flex items-center gap-3">
						<div class="p-2.5 bg-primary-600/10 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 rounded-xl">
							<FileTextIcon class="size-6" />
						</div>
						<div>
							<h2 class="text-lg font-bold text-gray-900 dark:text-dark-white flex items-center gap-2">
								Validación de Documentos
								<span class="px-2 py-0.5 text-xs font-bold rounded-full bg-primary-600 text-white">
									{filteredDocs.length}
								</span>
							</h2>
							<p class="text-xs text-gray-500 dark:text-gray-400">Revisión, aprobación y carga directa de títulos y KYC</p>
						</div>
					</div>

					<div class="flex items-center gap-2">
						<button
							type="button"
							onclick={() => showStaffUploadForm = !showStaffUploadForm}
							class="px-3 py-1.5 text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-sm"
						>
							<DocumentAddIcon class="size-4" />
							<span>+ Cargar Documento</span>
						</button>
						<button 
							onclick={onClose} 
							class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-background rounded-full transition-colors"
							aria-label="Cerrar modal"
						>
							<XIcon class="size-5" />
						</button>
					</div>
				</div>

				<!-- Panel de Carga Directa por Staff (Dropdown/Formulario Desplegable) -->
				{#if showStaffUploadForm}
					<div class="mt-4 p-4 bg-primary-50/80 dark:bg-primary-950/20 rounded-xl border border-primary-200 dark:border-primary-900/40 space-y-3" transition:slide={{ duration: 200 }}>
						<h3 class="text-xs font-bold uppercase tracking-wider text-primary-800 dark:text-primary-300 flex items-center gap-1.5">
							<DocumentAddIcon class="size-4" /> Cargar Documento Directo por Alumno (Auto-Aprobación Staff)
						</h3>

						<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
							<div>
								<label class="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Seleccionar Estudiante *</label>
								<select 
									bind:value={selectedStudentForUpload}
									class="w-full px-3 py-1.5 border rounded-lg dark:bg-dark-background dark:border-dark-border text-gray-900 dark:text-dark-white focus:ring-1 focus:ring-primary-500"
								>
									<option value="">-- Selecciona un alumno --</option>
									{#each allStudentsList as s}
										<option value={s._id}>{s.nombre} (CI/Reg: {s.carnet || s.registro})</option>
									{/each}
								</select>
							</div>

							<div>
								<label class="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Tipo de Documento *</label>
								<select 
									bind:value={uploadDocType}
									class="w-full px-3 py-1.5 border rounded-lg dark:bg-dark-background dark:border-dark-border text-gray-900 dark:text-dark-white focus:ring-1 focus:ring-primary-500"
								>
									<option value="titulo">🎓 Título Profesional</option>
									<option value="cv">📄 Curriculum Vitae (CV)</option>
									<option value="carnet">🪪 Carnet de Identidad</option>
									<option value="afiliacion">📜 Certificado de Afiliación</option>
									<option value="requisito">📝 Requisito de Programa</option>
								</select>
							</div>

							{#if uploadDocType === 'titulo'}
								<div>
									<input type="text" placeholder="Nombre del Título (ej: Lic. Contaduría)" bind:value={uploadTituloForm.titulo} class="w-full px-3 py-1.5 border rounded-lg dark:bg-dark-background text-gray-900 dark:text-white" />
								</div>
								<div>
									<input type="text" placeholder="Universidad de Emisión" bind:value={uploadTituloForm.universidad} class="w-full px-3 py-1.5 border rounded-lg dark:bg-dark-background text-gray-900 dark:text-white" />
								</div>
							{:else if uploadDocType === 'requisito'}
								<div class="sm:col-span-2">
									<label class="block font-semibold text-gray-700 dark:text-gray-300 mb-1">Inscripción / Requisito *</label>
									<select 
										bind:value={uploadRequisitoEnrId}
										class="w-full px-3 py-1.5 border rounded-lg dark:bg-dark-background text-gray-900 dark:text-white"
									>
										<option value="">-- Selecciona programa del estudiante --</option>
										{#each selectedStudentEnrollments as enr}
											<option value={enr._id}>Inscripción ID: {enr._id}</option>
										{/each}
									</select>
								</div>
							{/if}

							<div class="sm:col-span-2 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
								<input 
									type="file" 
									accept="application/pdf,image/*" 
									onchange={(e) => staffFileToUpload = (e.target as HTMLInputElement).files?.[0] || null} 
									class="text-xs text-gray-600 dark:text-gray-300"
								/>
								<div class="flex gap-2">
									<button 
										type="button" 
										onclick={() => showStaffUploadForm = false}
										class="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-surface rounded-lg"
									>
										Cancelar
									</button>
									<button 
										type="button" 
										onclick={submitGlobalStaffUpload}
										disabled={isSubmittingStaffUpload}
										class="px-4 py-1.5 text-xs font-bold text-white bg-uagrm-green hover:opacity-90 rounded-lg transition-colors disabled:opacity-50"
									>
										{isSubmittingStaffUpload ? 'Guardando...' : 'Subir y Validar'}
									</button>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Pestañas y Filtros del Modal -->
				<div class="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-gray-100 dark:border-dark-border pt-3">
					<div class="flex items-center gap-1 bg-gray-200/60 dark:bg-dark-background p-1 rounded-xl">
						<button
							type="button"
							onclick={() => activeTab = 'estudiantes'}
							class={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
								activeTab === 'estudiantes'
									? 'bg-white dark:bg-dark-surface text-primary-600 dark:text-primary-400 shadow-sm'
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
							}`}
						>
							<UsersIcon class="size-3.5" />
							<span>Por Estudiante ({docsGroupedByStudent.length})</span>
						</button>
						<button
							type="button"
							onclick={() => activeTab = 'tipos'}
							class={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
								activeTab === 'tipos'
									? 'bg-white dark:bg-dark-surface text-primary-600 dark:text-primary-400 shadow-sm'
									: 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
							}`}
						>
							<FileTextIcon class="size-3.5" />
							<span>Por Tipo de Documento</span>
						</button>
					</div>

					<div class="w-full sm:w-64">
						<input
							type="text"
							placeholder="🔍 Buscar por alumno, CI o doc..."
							bind:value={searchQuery}
							class="w-full px-3 py-1.5 text-xs border rounded-xl dark:bg-dark-background dark:border-dark-border text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
						/>
					</div>
				</div>
			</div>
			
			<!-- Body / Contenido de Documentos -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 dark:bg-dark-background/60 space-y-6">
				{#if loading}
					<div class="flex flex-col items-center justify-center py-16 text-gray-400">
						<svg class="animate-spin size-8 mb-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
						<p class="text-sm font-medium text-gray-600 dark:text-gray-300">Cargando lista de documentos...</p>
					</div>
				{:else if filteredDocs.length === 0}
					<div class="flex flex-col items-center justify-center py-16 text-center">
						<div class="size-16 bg-light-success/10 text-light-success dark:bg-dark-success/20 dark:text-dark-success rounded-full flex items-center justify-center mb-4">
							<CircleCheckIcon class="size-9" />
						</div>
						<h3 class="text-lg font-bold text-gray-900 dark:text-dark-white">¡Todo al día!</h3>
						<p class="text-sm text-gray-500 dark:text-gray-400 max-w-sm mt-1">No hay documentos pendientes de revisión con el filtro actual.</p>
					</div>
				{:else if activeTab === 'estudiantes'}
					<!-- VISTA AGRUPADA POR ESTUDIANTE -->
					<div class="space-y-4">
						{#each docsGroupedByStudent as group (group.studentId)}
							<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
								<!-- Nombre del Alumno -->
								<div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-dark-border">
									<div class="flex items-center gap-2">
										<h3 class="font-bold text-gray-900 dark:text-dark-white text-base">{group.studentName}</h3>
										<span class="text-xs text-gray-500 dark:text-gray-400 font-mono">C.I.: {group.carnet}</span>
									</div>
									<button
										type="button"
										onclick={() => goToStudent(group.studentId)}
										class="text-xs font-semibold text-primary-600 hover:underline"
									>
										Ver Perfil Alumno →
									</button>
								</div>

								<!-- Lista de Documentos del Alumno -->
								<div class="mt-3 space-y-2">
									{#each group.docs as doc (doc.id)}
										{@const key = doc.id}
										<div class="p-3 bg-gray-50 dark:bg-dark-background border border-gray-100 dark:border-dark-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-2">
													<span class="font-bold text-gray-800 dark:text-gray-200">{doc.docLabel}</span>
													<span class={`px-2 py-0.5 text-[10px] font-bold rounded ${
														!doc.url ? 'bg-gray-200/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400' :
														doc.estado === 'verificado' || doc.estado === 'aprobado' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
														doc.estado === 'rechazado' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
														'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
													}`}>
														{!doc.url ? 'Sin archivo subido' : doc.estado === 'pendiente' ? 'Pendiente Revisión' : doc.estado}
													</span>
												</div>

												{#if doc.courseName}
													<p class="text-[11px] text-primary-600 dark:text-primary-400 mt-0.5">{doc.courseName}</p>
												{/if}

												{#if doc.url}
													<a 
														href={getSafeDocumentUrl(doc.url)} 
														target="_blank" 
														rel="noopener noreferrer"
														class="inline-flex items-center gap-1 font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-1"
													>
														<EyeIcon class="size-3" /> Ver Documento Adjunto
													</a>
												{:else}
													<span class="text-[11px] text-gray-400 italic block mt-1">Sin archivo adjunto</span>
												{/if}

												{#if doc.motivoRechazo}
													<p class="text-red-600 dark:text-red-400 text-[11px] mt-0.5">Motivo rechazo: {doc.motivoRechazo}</p>
												{/if}
											</div>

											<!-- Botones de Acción Inline -->
											<div class="flex items-center gap-1.5 shrink-0">
												<input
													bind:this={fileInputEls[doc.id]}
													type="file"
													accept="application/pdf,image/*"
													class="hidden"
													onchange={(e) => handleFileSelectedForDoc(e, doc)}
												/>
												<button
													type="button"
													onclick={() => triggerStaffUpload(doc.id)}
													disabled={actionLoading === key}
													class="px-2.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
												>
													<DocumentAddIcon class="size-3.5" />
													<span>Adjuntar</span>
												</button>

												<button
													type="button"
													onclick={() => handleAprobar(doc)}
													disabled={!doc.url || actionLoading === key}
													title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Aprobar documento'}
													class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
														!doc.url 
															? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
															: 'bg-uagrm-green text-white hover:opacity-90 disabled:opacity-50'
													}`}
												>
													<CheckIcon class="size-3.5" />
													<span>{actionLoading === key ? '...' : 'Aprobar'}</span>
												</button>

												<button
													type="button"
													onclick={() => {
														if (rejectingKey === key) {
															rejectingKey = null;
														} else {
															rejectingKey = key;
															motivoRechazo = '';
														}
													}}
													disabled={!doc.url || actionLoading === key}
													title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Rechazar documento'}
													class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${
														!doc.url 
															? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' 
															: 'bg-uagrm-red text-white hover:opacity-90 disabled:opacity-50'
													}`}
												>
													<XMarkIcon class="size-3.5" />
													<span>Rechazar</span>
												</button>
											</div>
										</div>

										{#if rejectingKey === key}
											<div class="p-2 bg-red-50 dark:bg-red-950/20 rounded-xl flex gap-2" transition:slide={{ duration: 150 }}>
												<input
													type="text"
													placeholder="Motivo de la observación o rechazo..."
													bind:value={motivoRechazo}
													class="flex-1 px-3 py-1.5 text-xs border rounded-lg dark:bg-dark-background text-gray-900 dark:text-white"
												/>
												<button
													type="button"
													onclick={() => handleRechazar(doc)}
													disabled={actionLoading === key}
													class="px-3 py-1.5 text-xs font-bold text-white bg-uagrm-red hover:bg-red-700 rounded-lg shrink-0 disabled:opacity-50"
												>
													Confirmar Rechazo
												</button>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<!-- VISTA AGRUPADA POR CATEGORÍA DE DOCUMENTO -->
					<div class="space-y-6">
						{#if docsGroupedByCategory.titulos.length > 0}
							<div>
								<h3 class="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
									<StopwatchIcon class="size-4" /> 🎓 Títulos Profesionales ({docsGroupedByCategory.titulos.length})
								</h3>
								<div class="space-y-2">
									{#each docsGroupedByCategory.titulos as doc (doc.id)}
										{@const key = doc.id}
										<div class="bg-white dark:bg-dark-surface border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-2">
													<h4 class="font-bold text-gray-900 dark:text-white">{doc.studentName}</h4>
													<span class="text-xs text-gray-500 font-mono">CI: {doc.carnet}</span>
												</div>
												<p class="text-xs text-gray-600 dark:text-gray-300 font-medium mt-0.5">{doc.docLabel}</p>
												{#if doc.url}
													<a href={getSafeDocumentUrl(doc.url)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mt-1">
														<EyeIcon class="size-3.5" /> Ver PDF/Imagen
													</a>
												{:else}
													<span class="text-[11px] text-gray-400 italic block mt-1">Sin archivo adjunto</span>
												{/if}
											</div>
											<div class="flex items-center gap-1.5 shrink-0">
												<input bind:this={fileInputEls[doc.id]} type="file" accept="application/pdf,image/*" class="hidden" onchange={(e) => handleFileSelectedForDoc(e, doc)} />
												<button type="button" onclick={() => triggerStaffUpload(doc.id)} class="px-2.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-1">
													<DocumentAddIcon class="size-3.5" /> Adjuntar
												</button>
												<button type="button" onclick={() => handleAprobar(doc)} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Aprobar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-green text-white hover:opacity-90'}`}>
													<CheckIcon class="size-3.5" /> Aprobar
												</button>
												<button type="button" onclick={() => { if (doc.url) { rejectingKey = rejectingKey === key ? null : key; motivoRechazo = ''; } }} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Rechazar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-red text-white hover:opacity-90'}`}>
													<XMarkIcon class="size-3.5" /> Rechazar
												</button>
											</div>
										</div>
										{#if rejectingKey === key}
											<div class="p-2 bg-red-50 dark:bg-red-950/20 rounded-xl flex gap-2" transition:slide={{ duration: 150 }}>
												<input type="text" placeholder="Motivo del rechazo..." bind:value={motivoRechazo} class="flex-1 px-3 py-1.5 text-xs border rounded-lg dark:bg-dark-background text-gray-900 dark:text-white" />
												<button type="button" onclick={() => handleRechazar(doc)} class="px-3 py-1.5 text-xs font-bold text-white bg-uagrm-red rounded-lg">Confirmar</button>
											</div>
										{/if}
									{/each}
								</div>
							</div>
						{/if}

						{#if docsGroupedByCategory.personales.length > 0}
							<div>
								<h3 class="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-1.5">
									<FileTextIcon class="size-4" /> 📄 Documentos Personales (CV/Carnet/Afiliación) ({docsGroupedByCategory.personales.length})
								</h3>
								<div class="space-y-2">
									{#each docsGroupedByCategory.personales as doc (doc.id)}
										{@const key = doc.id}
										<div class="bg-white dark:bg-dark-surface border border-blue-200 dark:border-blue-900/40 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
											<div class="min-w-0 flex-1">
												<div class="flex items-center gap-2">
													<h4 class="font-bold text-gray-900 dark:text-white">{doc.studentName}</h4>
													<span class="text-xs text-gray-500 font-mono">CI: {doc.carnet}</span>
												</div>
												<p class="text-xs text-blue-700 dark:text-blue-300 font-medium mt-0.5">{doc.docLabel}</p>
												{#if doc.url}
													<a href={getSafeDocumentUrl(doc.url)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mt-1">
														<EyeIcon class="size-3.5" /> Abrir Documento
													</a>
												{:else}
													<span class="text-[11px] text-gray-400 italic block mt-1">Sin archivo adjunto</span>
												{/if}
											</div>
											<div class="flex items-center gap-1.5 shrink-0">
												<input bind:this={fileInputEls[doc.id]} type="file" accept="application/pdf,image/*" class="hidden" onchange={(e) => handleFileSelectedForDoc(e, doc)} />
												<button type="button" onclick={() => triggerStaffUpload(doc.id)} class="px-2.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-1">
													<DocumentAddIcon class="size-3.5" /> Adjuntar
												</button>
												<button type="button" onclick={() => handleAprobar(doc)} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Aprobar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-green text-white hover:opacity-90'}`}>
													<CheckIcon class="size-3.5" /> Aprobar
												</button>
												<button type="button" onclick={() => { if (doc.url) { rejectingKey = rejectingKey === key ? null : key; motivoRechazo = ''; } }} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Rechazar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-red text-white hover:opacity-90'}`}>
													<XMarkIcon class="size-3.5" /> Rechazar
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}

						{#if docsGroupedByCategory.requisitos.length > 0}
							<div>
								<h3 class="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-3">
									📝 Requisitos por Curso / Programa ({docsGroupedByCategory.requisitos.length})
								</h3>
								<div class="space-y-2">
									{#each docsGroupedByCategory.requisitos as doc (doc.id)}
										{@const key = doc.id}
										<div class="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
											<div class="min-w-0 flex-1">
												<h4 class="font-bold text-gray-900 dark:text-white">{doc.studentName}</h4>
												<p class="text-xs text-primary-600 dark:text-primary-400 font-semibold">{doc.courseName}</p>
												<p class="text-xs text-gray-700 dark:text-gray-300 mt-1">{doc.docLabel}</p>
												{#if doc.url}
													<a href={getSafeDocumentUrl(doc.url)} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mt-1">
														<EyeIcon class="size-3.5" /> Ver Adjunto
													</a>
												{:else}
													<span class="text-[11px] text-gray-400 italic block mt-1">Sin archivo adjunto</span>
												{/if}
											</div>
											<div class="flex items-center gap-1.5 shrink-0">
												<input bind:this={fileInputEls[doc.id]} type="file" accept="application/pdf,image/*" class="hidden" onchange={(e) => handleFileSelectedForDoc(e, doc)} />
												<button type="button" onclick={() => triggerStaffUpload(doc.id)} class="px-2.5 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-1">
													<DocumentAddIcon class="size-3.5" /> Adjuntar
												</button>
												<button type="button" onclick={() => handleAprobar(doc)} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Aprobar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-green text-white hover:opacity-90'}`}>
													<CheckIcon class="size-3.5" /> Aprobar
												</button>
												<button type="button" onclick={() => { if (doc.url) { rejectingKey = rejectingKey === key ? null : key; motivoRechazo = ''; } }} disabled={!doc.url || actionLoading === key} title={!doc.url ? 'Sin archivo adjunto para evaluar' : 'Rechazar'} class={`px-2.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1 ${!doc.url ? 'bg-gray-200 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'bg-uagrm-red text-white hover:opacity-90'}`}>
													<XMarkIcon class="size-3.5" /> Rechazar
												</button>
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}
			</div>
			
			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-100 dark:border-dark-border bg-white dark:bg-dark-surface flex justify-between items-center">
				<button 
					type="button"
					onclick={loadPendingDocuments} 
					class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
				>
					🔄 Actualizar Lista
				</button>
				<Button variant="outline" onclick={onClose}>Cerrar</Button>
			</div>
		</div>
	</div>
{/if}
