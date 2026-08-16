<script lang="ts">
	import { courseService, discountService, userService } from '$lib/services';
	import type { CreateCourseRequest, Course, Discount, User } from '$lib/interfaces';
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import Heading from '$lib/components/ui/heading.svelte';
	import Card from '$lib/components/ui/card.svelte';
	import Checkbox from '$lib/components/ui/checkbox.svelte';
	import Toggle from '$lib/components/ui/toggle.svelte';
	import ModalConfirm from '$lib/components/ui/modalConfirm.svelte';
	import { alert } from '$lib/utils';
	import { CheckIcon, DocumentAddIcon } from '$lib/icons/outline';
	import { onMount } from 'svelte';

	// F-US-006-3TIPOS (2026-08-04): el tipo de programa define comportamiento,
	// validaciones y visibilidad. Hay 3 tipos: proximo (próximo a iniciar),
	// en_ejecucion (ya empezó) e historico (cerrado, solo archivo).
	// Reemplaza el antiguo toggle binario Histórico/En-operación.
	// NOTA: 'proximo' y 'en_ejecucion' comparten estructura operacional; lo
	// que cambia entre ellos es el comportamiento de inscripciones (solo
	// 'proximo' acepta nuevas inscripciones de estudiantes). El flag
	// `es_historico` se deriva para mantener retrocompat con la lógica
	// existente del form (validaciones, secciones condicionales).
	type TipoPrograma = 'proximo' | 'en_ejecucion' | 'historico';

	interface Props {
		course?: Course | null;
		// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): el wizard pasa el
		// tipo preseleccionado para que el form se inicialice con el radio
		// button correcto (proximo / en_ejecucion). Si no se pasa, default
		// 'proximo' (igual que antes).
		initialTipoPrograma?: 'proximo' | 'en_ejecucion' | 'historico';
		onSuccess: () => void;
		onCancel: () => void;
	}

	// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): $props() DEBE ir
	// ANTES de cualquier uso de las props, sino Svelte 5 produce un
	// ReferenceError: Cannot access 're' (la prop renombrada) before
	// initialization. Esto es lo que causaba el error en consola al
	// intentar elegir un tipo de programa.
	let {
		course = null,
		initialTipoPrograma = 'proximo',
		onSuccess,
		onCancel
	}: Props = $props();

	// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): si el wizard paso
	// un initialTipoPrograma, lo respetamos. Si no, default 'proximo'.
	let tipo_programa: TipoPrograma = $state(initialTipoPrograma);
	let es_historico = $derived(tipo_programa === 'historico');

	let isEditMode = $derived(!!course);
	let saving = $state(false);
	let discounts: Discount[] = $state([]);
	let teachers: User[] = $state([]);
	let availableEncargados: User[] = $state([]);
	let selectedEncargadosIds: string[] = $state([]);

	// F-HISTORICO (2026-07-31): resolución de respaldo (opcional, cualquier programa).
	let resolucionFile: File | null = $state(null);
	let subiendoResolucion = $state(false);
	// F-2026-08-12-EC-RESOLUCION-OBLIGATORIA (Kevin 2026-08-12): para programas
	// en ejecucion la resolucion es OBLIGATORIA. El form sube el PDF primero
	// a POST /upload-resolucion-temp para obtener la URL, y la pasa en el
	// payload de create_course. Asi el backend puede validar antes de crear.
	let resolucionPdfUrl: string | null = $state(null);

	// ISSUE-REFACTOR (UI): validación inline por campo (estilo DiscountForm)
	// en vez de depender solo de alert() al fallar el submit.
	let errors: Record<string, string> = $state({});

	// BUG 3 FIX: Filtrado reactivo de descuentos para ocultar inactivos.
	// Soporta tanto booleanos (`activo: true`) como strings heredados (`estado: 'Activo'`)
	let activeDiscounts = $derived(
		discounts.filter((d: any) => d.activo === true || d.estado === 'Activo')
	);

	// F-DESCUENTO-PREVIEW (2026-08-05, Kevin): "% del descuento global aplicado
	// al programa en tiempo real". Lee el `descuento_id` seleccionado en el Select
	// y devuelve el porcentaje del catalogo. Si no hay descuento seleccionado,
	// retorna 0. Se usa para mostrar el costo efectivo de cada modulo
	// debajo del input de costo original.
	let descuentoGlobalPct = $derived.by(() => {
		if (!formData.descuento_id) return 0;
		const d = activeDiscounts.find((x: any) => x._id === formData.descuento_id);
		return d?.porcentaje ?? formData.descuento_curso ?? 0;
	});

	// F-DESCUENTO-PREVIEW: costo efectivo de un modulo con el descuento
	// global aplicado. Si no hay descuento, retorna el costo original.
	function costoConDescuento(costo: number | undefined): number {
		const c = Number(costo) || 0;
		if (descuentoGlobalPct <= 0) return c;
		return Math.round(c * (1 - descuentoGlobalPct / 100) * 100) / 100;
	}

	// F-DESCUENTO-PREVIEW: ahorro total del programa (suma de los ahorros
	// por modulo). Si no hay descuento, retorna 0.
	let ahorroTotalPrograma = $derived.by(() => {
		if (descuentoGlobalPct <= 0) return 0;
		return (formData.modulos || []).reduce((acc, m) => {
			const c = Number(m.costo) || 0;
			return acc + (c - costoConDescuento(c));
		}, 0);
	});

	let formData: CreateCourseRequest = $state({
		codigo: '',
		nombre_programa: '',
		tipo_curso: 'curso',
		modalidad: 'presencial',
		costo_total_interno: 0,
		matricula_interno: 0,
		matricula_primer_carrera: null as number | null,
		matricula_profesional: null as number | null,
		cargo_adicional_items: [],
		cantidad_cuotas: 1,
		descuento_curso: 0,
		descuento_id: '',
		observacion: '',
		fecha_inicio: '',
		fecha_fin: '',
		activo: true,
		// F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): cada modulo lleva su
		// estado_operacional (Pendiente/En Ejecucion/Ejecutado). Default
		// 'Pendiente'. El usuario lo cambia manualmente con radio buttons.
		modulos: [{ nombre: 'Módulo 1', costo: 0, docente_id: '', estado_operacional: 'Pendiente' }],
		requisitos: [],
		es_historico: false
	});

	let prevCuotas = $state(1);
	let prevCostoTotal = $state(0);
	let trackedCourseId = $state<string | undefined>(undefined);

	// ISSUE F: Candado de Cálculo Manual vs Automático
	let autoCalculateModules = $state(true);

	// ISSUE-REFACTOR (UI): reemplaza el confirm() nativo del navegador por un
	// ModalConfirm propio del design system, para no romper la consistencia
	// visual con el resto de la app.
	let showDiscrepancyModal = $state(false);
	let discrepancyMessage = $state('');
	let pendingSubmitPayload: any = $state(null);

	onMount(async () => {
		try {
			const [resDiscounts, resTeachers, resUsers] = await Promise.all([
				discountService.getAll(1, 100),
				userService.getTeachers(),
				userService.getAll(1, 100)
			]);
			discounts = resDiscounts.data;
			teachers = resTeachers;
			availableEncargados = resUsers.data.filter(u => u.rol === 'encargado_curso' || u.rol === 'coordinador' || u.role === 'encargado_curso' || u.role === 'coordinador');
		} catch (e) {
			console.error('Error fetching data for course form', e);
		}
	});

	// Inicializador
	$effect(() => {
		const currentId = course ? course._id : '';
		if (currentId !== trackedCourseId) {
			if (course) {
				formData = {
					codigo: course.codigo,
					nombre_programa: course.nombre_programa,
					tipo_curso: course.tipo_curso,
					modalidad: course.modalidad,
					costo_total_interno: course.costo_total_interno,
					matricula_interno: course.matricula_interno,
					matricula_primer_carrera: course.matricula_primer_carrera ?? null,
					matricula_profesional: course.matricula_profesional ?? null,
					cargo_adicional_items: course.cargo_adicional_items
						? course.cargo_adicional_items.map((it) => ({ ...it }))
						: [],
					cantidad_cuotas: course.cantidad_cuotas,
					descuento_curso: course.descuento_curso,
					descuento_id: (course as any).descuento_id || '',
					observacion: course.observacion,
					// F-HISTORICO-AUTOSERVICIO-EXCEL-FIX (2026-08-04): los cursos
					// historicos pueden no tener fecha_inicio/fin (o ser null).
					// Proteger el split contra null/undefined para no romper el form.
					fecha_inicio: course.fecha_inicio ? course.fecha_inicio.split('T')[0] : '',
					fecha_fin: course.fecha_fin ? course.fecha_fin.split('T')[0] : '',
					activo: course.activo,
					modulos: course.modulos
						? course.modulos.map((m) => ({ ...m, docente_id: m.docente_id || '' }))
						: Array.from({ length: course.cantidad_cuotas || 1 }, (_, i) => ({
								nombre: `Módulo ${i + 1}`,
								costo: 0,
								docente_id: ''
							})),
					requisitos: course.requisitos ? course.requisitos.map((r) => ({ ...r })) : [],
					// F-HISTORICO: persistir el flag al editar
					es_historico: (course as any).es_historico ?? false
				};
				es_historico = (course as any).es_historico ?? false;
				// F-US-006-3TIPOS (2026-08-04): preseleccionar el tipo de
				// programa según el estado del curso. Prioridad: si
				// es_historico=True → histórico. Si no, calculamos por
				// estado_calculado o estado persistido.
				if ((course as any).es_historico) {
					tipo_programa = 'historico';
				} else {
					const estadoCalc = (course as any).estado_calculado
						|| (course as any).estado
						|| 'en_ejecucion';
					if (estadoCalc === 'programado') {
						tipo_programa = 'proximo';
					} else if (estadoCalc === 'en_ejecucion') {
						tipo_programa = 'en_ejecucion';
					} else if (estadoCalc === 'cerrado') {
						// Cerrado que NO es histórico → lo mapeamos a
						// histórico para reflejar la realidad operacional.
						tipo_programa = 'historico';
					} else {
						tipo_programa = 'proximo';
					}
				}
				prevCuotas = course.cantidad_cuotas;
				prevCostoTotal = course.costo_total_interno;

				autoCalculateModules = false;
			} else {
				formData = {
					codigo: '',
					nombre_programa: '',
					tipo_curso: 'curso',
					modalidad: 'presencial',
					costo_total_interno: 0,
					matricula_interno: 0,
					matricula_primer_carrera: null,
					matricula_profesional: null,
					cargo_adicional_items: [],
					cantidad_cuotas: 1,
					descuento_curso: 0,
					descuento_id: '',
					observacion: '',
					fecha_inicio: '',
					fecha_fin: '',
					activo: true,
					modulos: [{ nombre: 'Módulo 1', costo: 0, docente_id: '' }],
					requisitos: [],
					es_historico: false
				};
				es_historico = false;
				// F-US-006-3TIPOS (2026-08-04): al crear un programa nuevo,
				// el default es 'proximo' (cambia el comportamiento default
				// del antiguo form que empezaba como "En operación").
				tipo_programa = 'proximo';
				prevCuotas = 1;
				prevCostoTotal = 0;

				autoCalculateModules = true;
			}
			
			// Inicializar los checkboxes de encargados seleccionados si es edición
			if (course) {
				selectedEncargadosIds = availableEncargados
					.filter(u => (u.cursos_asignados || []).includes(course._id))
					.map(u => u._id);
			} else {
				selectedEncargadosIds = [];
			}
			
			trackedCourseId = currentId;
			errors = {};
		}
	});

	// Cerebro Matemático Controlado (ISSUE F)
	$effect(() => {
		if (trackedCourseId === undefined || !autoCalculateModules) return;

		const count = formData.cantidad_cuotas || 0;
		const totalCosto = formData.costo_total_interno || 0;

		let changedArray = false;
		let newModulos = formData.modulos ? [...formData.modulos] : [];

		if (count !== newModulos.length) {
			if (count > newModulos.length) {
				while (newModulos.length < count) {
					newModulos.push({ nombre: `Módulo ${newModulos.length + 1}`, costo: 0, docente_id: '' });
				}
			} else {
				newModulos = newModulos.slice(0, count);
			}
			changedArray = true;
		}

		if (count !== prevCuotas || totalCosto !== prevCostoTotal) {
			const costoUnitario = count > 0 ? Number((totalCosto / count).toFixed(2)) : 0;
			newModulos = newModulos.map((m) => ({
				nombre: m.nombre,
				costo: costoUnitario,
				docente_id: m.docente_id
			}));
			changedArray = true;

			prevCuotas = count;
			prevCostoTotal = totalCosto;
		}

		if (changedArray) {
			formData.modulos = newModulos;
		}
	});

	// ISSUE-REFACTOR (UI): validación inline por campo antes de enviar.
	function validarFormulario(): boolean {
		const nuevosErrores: Record<string, string> = {};

		if (!formData.codigo?.trim()) {
			nuevosErrores.codigo = 'El código es obligatorio.';
		}
		if (!formData.nombre_programa?.trim() || formData.nombre_programa.trim().length < 3) {
			nuevosErrores.nombre_programa = 'El nombre del programa debe tener al menos 3 caracteres.';
		}
		// F-HISTORICO: fechas opcionales para historicos (puede no haber registros
		// exactos de inicio/fin de programas muy antiguos). Para programas en
		// ejecucion o por ejecutarse, las fechas siguen siendo obligatorias.
		if (!es_historico) {
			if (!formData.fecha_inicio) {
				nuevosErrores.fecha_inicio = 'La fecha de inicio es obligatoria.';
			}
			if (!formData.fecha_fin) {
				nuevosErrores.fecha_fin = 'La fecha de fin es obligatoria.';
			}
			if (
				formData.fecha_inicio &&
				formData.fecha_fin &&
				new Date(formData.fecha_fin) < new Date(formData.fecha_inicio)
			) {
				nuevosErrores.fecha_fin = 'La fecha de fin no puede ser anterior a la fecha de inicio.';
			}
		}
		// F-HISTORICO: costo/matricula/cuotas/modulos son opcionales para historicos.
		// Para programas en operacion real, se exigen.
		if (!es_historico) {
			if (!formData.costo_total_interno || formData.costo_total_interno <= 0) {
				nuevosErrores.costo_total_interno = 'El costo total interno debe ser mayor a 0.';
			}
			if (formData.matricula_interno === null || formData.matricula_interno === undefined || formData.matricula_interno < 0) {
				nuevosErrores.matricula_interno = 'La matrícula interna no puede ser negativa.';
			}
			if (!formData.cantidad_cuotas || formData.cantidad_cuotas < 1) {
				nuevosErrores.cantidad_cuotas = 'Debe haber al menos 1 módulo/cuota.';
			}
			if (formData.modulos?.some((m) => !m.nombre?.trim())) {
				nuevosErrores.modulos = 'Todos los módulos deben tener un nombre.';
			}
			// ISSUE-P-CARGO-MULTIITEM: cada ítem de cargo adicional debe tener
			// nombre (para que el estudiante sepa qué está pagando) y costo >= 0.
			if (formData.cargo_adicional_items?.some((it) => !it.nombre?.trim())) {
				nuevosErrores.cargo_adicional_items = 'Todos los ítems de cargo adicional deben tener un nombre.';
			}
		}
		if (selectedEncargadosIds.length > 0) {
			// Validar localmente (aunque el backend también lo validará)
			// No podemos validar estrictamente si un usuario ya tiene otros 4 y seleccionamos 2,
			// pero sí podemos mostrar error del backend si falla.
		}

		errors = nuevosErrores;
		return Object.keys(nuevosErrores).length === 0;
	}

	async function handleSubmit() {
		if (!validarFormulario()) {
			alert('error', 'Revisa los campos marcados en rojo antes de continuar.');
			return;
		}

		saving = true;
		try {
			// F-2026-08-12-EC-RESOLUCION-OBLIGATORIA (Kevin 2026-08-12 post-reunion):
			// para programas en ejecucion la resolucion es OBLIGATORIA. Subir
			// el PDF al endpoint temporal ANTES de crear el curso, obtener la
			// URL, y pasarla en el payload. Asi el backend puede validar.
			if (resolucionFile) {
				try {
					subiendoResolucion = true;
					const tempUpload = await courseService.uploadResolucionTemp(resolucionFile);
					resolucionPdfUrl = tempUpload.url;
				} catch (uploadErr: any) {
					alert(
						'error',
						`No se pudo subir la resolución: ${uploadErr?.message || 'Error desconocido'}. El programa no se creó.`
					);
					subiendoResolucion = false;
					saving = false;
					return;
				} finally {
					subiendoResolucion = false;
				}
			}

			// Se le hace `delete` de campos opcionales mas abajo, por eso el tipo laxo.
			const payload: Record<string, any> = { ...formData };
			// F-2026-08-12-EC-RESOLUCION-OBLIGATORIA: pasar la URL de la
			// resolucion subida (o el valor que ya tenia en edicion).
			payload.resolucion_pdf_url = resolucionPdfUrl || (formData as any).resolucion_pdf_url || null;
			// F-2026-08-12-DESCUENTO-BECA (Kevin 2026-08-12): normalizar las
			// matriculas diferenciadas. Si el admin dejo el campo vacio, el
			// override es null → el backend usa el default global (200/500).
			payload.matricula_primer_carrera = formData.matricula_primer_carrera || null;
			payload.matricula_profesional = formData.matricula_profesional || null;
			// F-HISTORICO (2026-07-31): sincronizar el flag desde el state local
			// y vaciar los campos operacionales (costo, modulos, requisitos) que
			// no aplican para programas historicos. Asi evitamos que el backend
			// rechace por validaciones que ya relajamos en el schema.
			payload.es_historico = es_historico;
			if (es_historico) {
				payload.costo_total_interno = 0;
				payload.matricula_interno = 0;
				payload.matricula_primer_carrera = null;
				payload.matricula_profesional = null;
				payload.cantidad_cuotas = 0;
				payload.modulos = [];
				payload.requisitos = [];
				payload.cargo_adicional_items = [];
				// FIX-F-2026-08-12-EC-ACTIVO-HISTORICO (Kevin 2026-08-12): antes
				// poniamos `payload.activo = false` para historicos, lo que los
				// hacia invisibles en el modal de "Editar Usuario" (que filtra
				// activo=true) y por tanto no se podian re-asignar. Ahora los
				// historicos quedan `activo=true` y se gestionan via el flag
				// `es_historico`. El catalogo publico ya excluye historicos del
				// listado "disponible para inscribirse" (ver
				// `get_courses_disponibles_para_estudiante` en course_service).
				payload.activo = true; // historico, pero `activo=true` para que sea visible/gestionable
				// F-FIX-CREAR-PROGRAMA-422 (2026-08-09, Kevin): borrar fechas
				// vacias para que el backend no rechace con 422 al validar
				// "Input should be a valid datetime".
				delete payload.fecha_inicio;
				delete payload.fecha_fin;
			}
			// F-CREAR-PROGRAMA-EN-EJECUCION (2026-08-05, Kevin): enviar
			// estado_override al backend para que el calculo automatico de
			// estado (programado/en_ejecucion/cerrado segun fechas) respete
			// la eleccion del usuario. Sin esto, si el usuario elige
			// "En ejecucion" pero las fechas dicen "programado", el curso
			// queda como programado en vez de en_ejecucion.
			if (!es_historico) {
				if (tipo_programa === 'en_ejecucion') {
					payload.estado_override = 'en_ejecucion';
				} else if (tipo_programa === 'proximo') {
					// 'proximo' = programado. Si el usuario eligio fechas futuras
					// el calculo automatico ya dara 'programado'. Pero si eligio
					// fechas pasadas, forzamos a 'programado' igual.
					payload.estado_override = 'programado';
				}
			} else {
				// Historico: estado_override = 'cerrado' para que el badge
				// muestre "cerrado" aunque las fechas sean raras.
				payload.estado_override = 'cerrado';
			}
			if (!payload.descuento_id) {
				if (isEditMode) {
					// En edición, enviar null explícito para remover descuento existente
					payload.descuento_id = null;
				} else {
					// En creación, omitir el campo cuando no hay descuento seleccionado
					delete payload.descuento_id;
				}
			}

			// ISSUE-P-CARGO-MULTIITEM: descartar ítems vacíos (sin nombre o con
			// costo 0 dejado a medio llenar) antes de enviar.
			payload.cargo_adicional_items = (payload.cargo_adicional_items || []).filter(
				(it: any) => it.nombre?.trim()
			);

			// ISSUE-Q-DOCUMENTOS-KYC: descartar requisitos vacíos (sin descripción)
			payload.requisitos = (payload.requisitos || []).filter((r: any) => r.descripcion?.trim());

			if (!es_historico) {
				payload.modulos = payload.modulos!.map((m: any) => {
					const mod = { ...m };
					if (!mod.docente_id) {
						// `docente_id` no es opcional en el tipo; se castea para poder
						// omitirlo del payload cuando está vacío (comportamiento previo).
						delete (mod as { docente_id?: string }).docente_id;
					}
					return mod;
				});
			}

			// ISSUE F: Verificador de congruencia financiera
			// (Solo aplica a programas en operacion real; los historicos no
			// tienen estructura financiera que validar.)
			if (!es_historico) {
				const sumModulos = (payload.modulos || []).reduce((acc: number, curr: any) => acc + Number(curr.costo), 0);
				if (!autoCalculateModules && sumModulos !== payload.costo_total_interno) {
					discrepancyMessage = `La suma manual de los módulos (Bs. ${sumModulos}) no coincide con el Costo Total (Bs. ${payload.costo_total_interno}). ¿Deseas guardar el programa con esta discrepancia?`;
					pendingSubmitPayload = payload;
					showDiscrepancyModal = true;
					saving = false;
					return;
				}
			}

			await guardarCurso(payload);
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar el curso');
			saving = false;
		}
	}

	async function guardarCurso(payload: any) {
		saving = true;
		try {
			let savedCourse: Course;
			if (isEditMode && course) {
				const updatePayload = {
					...payload,
					inscritos: course.inscritos
				};
				savedCourse = await courseService.update(course._id, updatePayload);
				alert('success', 'Programa y módulos actualizados correctamente');
			} else {
				savedCourse = await courseService.create(payload);
				alert('success', 'Programa creado correctamente');
			}

			// F-HISTORICO (2026-07-31): subir la resolución de respaldo si el
			// usuario adjuntó un PDF en este submit. Lo hacemos DESPUÉS de
			// guardar el curso porque el endpoint PUT /{id}/resolucion necesita
			// el id del curso. La subida es opcional y tolerante a fallos
			// (solo un warning, no rompe el flujo).
			if (savedCourse && savedCourse._id && resolucionFile) {
				try {
					subiendoResolucion = true;
					await courseService.subirResolucion(savedCourse._id, resolucionFile);
					alert('success', 'Resolución de respaldo subida correctamente');
				} catch (resErr: any) {
					alert('warning', resErr?.message || 'El programa se guardó, pero la resolución no se pudo subir. Puedes reintentarlo desde la opción "Subir Resolución" del menú.');
				} finally {
					subiendoResolucion = false;
					resolucionFile = null;
				}
			}

			// Asignar los encargados de curso seleccionados
			if (savedCourse && savedCourse._id && !es_historico) {
				try {
					await courseService.assignEncargados(savedCourse._id, selectedEncargadosIds);
				} catch (err: any) {
					alert('warning', err.message || 'El curso se guardó, pero hubo un error al asignar los encargados. Revisa el límite de 10 programas por usuario.');
				}
			}

			onSuccess();
		} catch (e: any) {
			alert('error', e.message || 'Error al guardar el curso');
		} finally {
			saving = false;
		}
	}

	function handleConfirmDiscrepancy() {
		showDiscrepancyModal = false;
		if (pendingSubmitPayload) {
			guardarCurso(pendingSubmitPayload);
			pendingSubmitPayload = null;
		}
	}

	function handleCancelDiscrepancy() {
		showDiscrepancyModal = false;
		pendingSubmitPayload = null;
	}
</script>

<form class="space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
	<!-- SECCIÓN: Datos básicos -->
	<Card variant="ghost" padding="none">
		<div class="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
			<Heading level="h4">Datos Básicos</Heading>

			<!-- F-US-006-3TIPOS (2026-08-04): selector de tipo de programa
			     (reemplaza el antiguo toggle binario Historico/En-operacion).
			     Hay 3 tipos con comportamiento y validaciones distintas:
			       - Proximo/Programado: aun no inicia, acepta inscripciones.
			       - En ejecucion: ya empezo, NO acepta nuevas inscripciones
			         de estudiantes. Admin/encargado anade rezagados.
			       - Historico/Cerrado: solo archivo, todos los datos opcionales. -->
			<Select
				label="Tipo de Programa"
				id="tipo_programa"
				bind:value={tipo_programa}
			>
				<option value="proximo">Proximo / Programado (acepta inscripciones)</option>
				<option value="en_ejecucion">En ejecucion (NO acepta nuevas inscripciones)</option>
				<option value="historico">Historico / Cerrado (solo archivo, datos opcionales)</option>
			</Select>
		</div>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Código"
				id="codigo"
				bind:value={formData.codigo}
				required
				placeholder="DIPL-2024-001"
				error={errors.codigo}
			/>
			<Input
				label="Nombre del Programa"
				id="nombre_programa"
				bind:value={formData.nombre_programa}
				required
				placeholder="Diplomado en..."
				error={errors.nombre_programa}
			/>

			<Select label="Tipo de Curso" bind:value={formData.tipo_curso} required>
				<option value="">Seleccione un tipo de curso</option>
				{#each [
					{ value: 'curso', label: 'Curso' },
					{ value: 'taller', label: 'Taller' },
					{ value: 'diplomado', label: 'Diplomado' },
					{ value: 'maestría', label: 'Maestría' },
					{ value: 'doctorado', label: 'Doctorado' },
					{ value: 'seminario', label: 'Seminario' },
					{ value: 'otro', label: 'Otro' }
				] as tipo_curso}
					<option value={tipo_curso.value}>{tipo_curso.label}</option>
				{/each}
			</Select>

			<Select label="Modalidad" bind:value={formData.modalidad} required>
				<option value="">Seleccione una modalidad</option>
				{#each [
					{ value: 'presencial', label: 'Presencial' },
					{ value: 'virtual', label: 'Virtual' },
					{ value: 'híbrido', label: 'Híbrido' }
				] as modalidad}
					<option value={modalidad.value}>{modalidad.label}</option>
				{/each}
			</Select>

			<!-- F-HISTORICO: fechas opcionales para programas muy antiguos. -->
			<Input
				label="Fecha Inicio"
				id="fecha_inicio"
				type="date"
				bind:value={formData.fecha_inicio}
				required={!es_historico}
				error={errors.fecha_inicio}
			/>
			<Input
				label="Fecha Fin"
				id="fecha_fin"
				type="date"
				bind:value={formData.fecha_fin}
				required={!es_historico}
				error={errors.fecha_fin}
			/>
		</div>

		<!-- F-HISTORICO: aviso amarillo explicando que el resto de secciones se oculta. -->
		{#if es_historico}
			<div class="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
				<strong>Modo Histórico activo.</strong> Se omiten los datos operacionales
				(docentes, módulos, pagos, requisitos, descuentos). Solo se guardan los
				datos básicos del programa y, opcionalmente, la resolución de respaldo.
			</div>
		{/if}
	</Card>

	<!-- F-HISTORICO: las siguientes secciones se OCULTAN cuando es_historico=True.
	     Un programa pasado no tiene operacion academica ni financiera que cargar. -->
	{#if !es_historico}
	<!-- SECCIÓN: Encargados de Curso -->
	<Card variant="bordered" padding="md">
		<Heading level="h4" class="mb-3 text-primary-700 dark:text-dark-tertiary">Gestión Académica</Heading>
		<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
			Selecciona a los Encargados de Curso o Coordinadores que administrarán este programa. Recuerda que cada usuario puede administrar un máximo de 10 programas a la vez.
		</p>
		
		{#if availableEncargados.length > 0}
			<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
				{#each availableEncargados as encargado}
					<label class="flex items-start gap-2 p-3 rounded-md border border-gray-100 bg-gray-50/50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-750 cursor-pointer transition-colors">
						<input 
							type="checkbox" 
							class="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-600 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-900"
							value={encargado._id}
							bind:group={selectedEncargadosIds}
						/>
						<div class="flex flex-col">
							<span class="text-sm font-medium text-gray-900 dark:text-white leading-tight">
								{encargado.nombre || encargado.username}
							</span>
							<span class="text-xs text-gray-500 dark:text-gray-400">
								{(encargado.rol || encargado.role) === 'coordinador' ? 'Coordinador' : 'Encargado de Curso'}
							</span>
						</div>
					</label>
				{/each}
			</div>
		{:else}
			<p class="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-md border border-amber-100 dark:border-amber-800">
				No hay Encargados de Curso o Coordinadores registrados en el sistema.
			</p>
		{/if}
	</Card>

	<!-- SECCIÓN: Costo del Programa (precio único para todos los estudiantes) -->
	<Card variant="bordered" padding="md">
		<Heading level="h4" class="mb-3 text-primary-700 dark:text-dark-tertiary">Costo del Programa</Heading>
		<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
			Precio único: aplica por igual a todos los estudiantes, sin importar su lugar de procedencia.
		</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<div>
				<Input
					label="Costo Total (Colegiatura)"
					id="costo_total_interno"
					type="number"
					bind:value={formData.costo_total_interno}
					required
					error={errors.costo_total_interno}
				/>
				<!-- F-DESCUENTO-PREVIEW: preview del costo con descuento global.
				     Visible solo en modo Cálculo Auto (no en Manual). -->
				{#if descuentoGlobalPct > 0 && autoCalculateModules && (formData.costo_total_interno || 0) > 0}
					<p class="mt-1 whitespace-nowrap text-xs text-green-700 dark:text-green-400">
						Con {descuentoGlobalPct}% descuento: <strong>Bs. {costoConDescuento(formData.costo_total_interno).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
					</p>
				{/if}
			</div>
			<Input
				label="Matrícula"
				id="matricula_interno"
				type="number"
				bind:value={formData.matricula_interno}
				required
				error={errors.matricula_interno}
			/>
		</div>

		<!-- F-2026-08-12-DESCUENTO-BECA (Kevin 2026-08-12, reunion UAGRM):
		     diferencia la matricula de PRIMERA CARRERA vs PROFESIONAL CON TITULO.
		     Si ambos quedan vacios, se usan los defaults GLOBALES del sistema
		     (MATRICULA_PRIMER_CARRERA_DEFAULT=200, MATRICULA_PROFESIONAL_DEFAULT=500).
		     Tipico en educacion continua: primer carrera paga 200, profesional paga 500. -->
		<div class="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-900/10 p-3">
			<p class="mb-2 text-xs font-semibold text-indigo-900 dark:text-indigo-200">
				Matrícula diferenciada por tipo de estudiante (educación continua)
			</p>
			<p class="mb-3 text-[11px] text-indigo-700 dark:text-indigo-300">
				Opcional. Si los dejas vacíos, se usan los defaults del sistema
				(primer carrera 200 Bs, profesional 500 Bs).
			</p>
			<div class="grid grid-cols-2 gap-3">
				<Input
					label="Matrícula primer carrera (override)"
					id="matricula_primer_carrera"
					type="number"
					bind:value={formData.matricula_primer_carrera}
					placeholder="Default: 200"
				/>
				<Input
					label="Matrícula profesional (override)"
					id="matricula_profesional"
					type="number"
					bind:value={formData.matricula_profesional}
					placeholder="Default: 500"
				/>
			</div>
		</div>
	</Card>

	<!-- SECCIÓN: Cargo adicional (ISSUE-P-CARGO-MULTIITEM, 2026-07-08) -->
	<!-- El precio del programa (costo total + matrícula) es el MISMO para
	     todos los estudiantes, sin distinción de procedencia. Este bloque es
	     para gastos complementarios OPCIONALES al programa en su conjunto
	     (ej. "Taller de Excel Avanzado" 100 Bs + "Certificación Internacional"
	     50 Bs), cada uno con su propio nombre y costo, que se suman al total
	     a pagar de cada estudiante inscrito a este curso. -->
	<Card variant="bordered" padding="md">
		<div class="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
			<div>
				<Heading level="h4" class="text-primary-700 dark:text-dark-tertiary">Cargo Adicional (Opcional)</Heading>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Gastos complementarios al programa (ej. talleres o capacitaciones necesarias), cada uno
					con su propio nombre y costo. Se suman al total a pagar de todos los estudiantes
					inscritos a este curso. Deja la lista vacía si no aplica.
				</p>
			</div>
			<Button
				type="button"
				variant="secondary"
				onclick={() => {
					formData.cargo_adicional_items = [
						...(formData.cargo_adicional_items || []),
						{ nombre: '', costo: 0 }
					];
				}}
			>
				+ Agregar Ítem
			</Button>
		</div>

		{#if errors.cargo_adicional_items}
			<p class="mb-3 text-sm text-light-error">{errors.cargo_adicional_items}</p>
		{/if}

		{#if formData.cargo_adicional_items && formData.cargo_adicional_items.length > 0}
			<div class="grid grid-cols-1 gap-4">
				{#each formData.cargo_adicional_items as _item, i}
					<div
						class="flex flex-col items-center gap-4 rounded-md border border-gray-100 bg-white p-3 shadow-sm xl:flex-row dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="w-full xl:flex-1">
							<Input
								label="Concepto"
								id={`cargo_adicional_nombre_${i}`}
								bind:value={formData.cargo_adicional_items[i].nombre}
								placeholder="Ej: Taller de Excel Avanzado"
							/>
						</div>
						<div class="w-full xl:w-1/4">
							<Input
								label="Costo (Bs)"
								id={`cargo_adicional_costo_${i}`}
								type="number"
								min="0"
								step="0.01"
								bind:value={formData.cargo_adicional_items[i].costo}
								placeholder="Ej: 100"
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							class="mt-2 shrink-0 xl:mt-6"
							onclick={() => {
								formData.cargo_adicional_items = formData.cargo_adicional_items!.filter(
									(_, idx) => idx !== i
								);
							}}
						>
							Quitar
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- SECCIÓN: Documentos requeridos (ISSUE-Q-DOCUMENTOS-KYC, 2026-07-09) -->
	<!-- Define qué documentos debe subir el estudiante al inscribirse a este
	     curso (ej. CV, fotocopia de CI, título en provisión nacional). El
	     CPD/Encargado de Curso podrá aprobar o rechazar cada documento desde
	     la libreta de la inscripción una vez que el estudiante lo suba. -->
	<Card variant="bordered" padding="md">
		<div class="mb-3 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
			<div>
				<Heading level="h4" class="text-primary-700 dark:text-dark-tertiary">Documentos Requeridos (Opcional)</Heading>
				<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
					Documentos que el estudiante deberá subir desde su perfil al inscribirse (ej. CV,
					fotocopia de carnet). CPD o el Encargado de Curso los revisan y aprueban/rechazan.
					Deja la lista vacía si este curso no requiere documentación adicional.
				</p>
			</div>
			<Button
				type="button"
				variant="secondary"
				onclick={() => {
					formData.requisitos = [...(formData.requisitos || []), { descripcion: '' }];
				}}
			>
				+ Agregar Documento
			</Button>
		</div>

		{#if formData.requisitos && formData.requisitos.length > 0}
			<div class="grid grid-cols-1 gap-4">
				{#each formData.requisitos as _req, i}
					<div
						class="flex flex-col items-center gap-4 rounded-md border border-gray-100 bg-white p-3 shadow-sm sm:flex-row dark:border-gray-700 dark:bg-gray-800"
					>
						<div class="w-full flex-1">
							<Input
								label="Nombre del Documento"
								id={`requisito_descripcion_${i}`}
								bind:value={formData.requisitos[i].descripcion}
								placeholder="Ej: Fotocopia de Carnet de Identidad"
							/>
						</div>
						<Button
							type="button"
							variant="ghost"
							class="mt-2 shrink-0 sm:mt-6"
							onclick={() => {
								formData.requisitos = formData.requisitos!.filter((_, idx) => idx !== i);
							}}
						>
							Quitar
						</Button>
					</div>
				{/each}
			</div>
		{/if}
	</Card>

	<!-- SECCIÓN: Estructura de pago -->
	<Card variant="ghost" padding="none">
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<Input
				label="Cantidad de Módulos (Cuotas)"
				id="cantidad_cuotas"
				type="number"
				min="1"
				bind:value={formData.cantidad_cuotas}
				required
				error={errors.cantidad_cuotas}
			/>

			<!-- BUG 3 FIX: Iteración sobre activeDiscounts en lugar de discounts -->
			<Select label="Descuento Global" bind:value={formData.descuento_id}>
				<option value="">Ninguno</option>
				{#each activeDiscounts as discount}
					<option value={discount._id}>{discount.nombre} ({discount.porcentaje}%)</option>
				{/each}
			</Select>
		</div>
	</Card>

	<!-- SECCIÓN DINÁMICA DE MÓDULOS CON ASIGNACIÓN DE DOCENTES -->
	{#if formData.modulos && formData.modulos.length > 0}
		<Card variant="bordered" padding="md">
			<div
				class="mb-4 flex flex-col items-start justify-between gap-2 border-b border-gray-200 pb-3 sm:flex-row sm:items-center dark:border-gray-700"
			>
				<Heading level="h4" class="text-primary-700 dark:text-dark-tertiary">Configuración de Módulos y Docentes</Heading>

				<Toggle
					bind:checked={autoCalculateModules}
					labelOn="Cálculo Auto"
					labelOff="Edición Manual"
				/>
			</div>

			{#if errors.modulos}
				<p class="mb-3 text-sm text-light-error">{errors.modulos}</p>
			{/if}

			<div class="grid grid-cols-1 gap-4">
				{#each formData.modulos as modulo, i}
					<div
						class="flex flex-col items-center gap-4 rounded-md border border-gray-100 bg-white p-3 shadow-sm transition-colors xl:flex-row dark:border-gray-700 dark:bg-gray-800 {autoCalculateModules
							? 'opacity-80'
							: ''}"
					>
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 font-bold text-gray-400 dark:bg-gray-700"
							>{i + 1}</span
						>
						<div class="w-full xl:w-2/5">
							<Input
								label="Nombre del Módulo"
								id={`modulo_nombre_${i}`}
								bind:value={formData.modulos[i].nombre}
								required
								placeholder="Ej: Introducción a la IA"
							/>
						</div>
						<div class="w-full xl:w-1/5">
							<Input
								label="Costo (Bs)"
								id={`modulo_costo_${i}`}
								type="number"
								bind:value={formData.modulos[i].costo}
								required
								placeholder="Ej: 588"
								readonly={autoCalculateModules}
								class={autoCalculateModules
									? 'bg-gray-100 text-gray-500 border-dashed dark:bg-gray-900'
									: 'border-primary-300 font-semibold dark:border-primary-700'}
							/>
							<!-- F-DESCUENTO-PREVIEW (2026-08-05, Kevin): preview del costo
							     con descuento global aplicado, visible SOLO en modo
							     Cálculo Auto (no en modo Manual, donde el usuario edita
							     libremente y el sistema no debe sugerirle valores).
							     F-LOGICA-DESCUENTOS-MAX: el sistema SIEMPRE toma el
							     descuento mayor, por eso el preview muestra ese monto. -->
							{#if descuentoGlobalPct > 0 && autoCalculateModules}
								<p class="mt-1 whitespace-nowrap text-xs text-green-700 dark:text-green-400">
									Con {descuentoGlobalPct}% descuento: <strong>Bs. {costoConDescuento(formData.modulos[i].costo).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
								</p>
							{/if}
						</div>
						<div class="w-full xl:w-2/5">
							<Select label="Docente Titular (Opcional)" bind:value={formData.modulos[i].docente_id}>
								<option value="">Sin asignar</option>
								{#each teachers as teacher}
									<option value={teacher._id}>{teacher.username} ({teacher.email})</option>
								{/each}
							</Select>
						</div>
						<!-- F-MAESTRIA-EN-EJECUCION (2026-08-05, Kevin): selector manual
						     de estado operacional del modulo. Solo visible para
						     programas en ejecucion (no para proximos ni historicos).
						     Default 'Pendiente' si el modulo no se ha marcado. -->
						{#if tipo_programa === 'en_ejecucion'}
							<div class="w-full xl:w-3/5">
								<label
									for={`modulo_estado_op_${i}`}
									class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200"
								>
									Estado del módulo en el cronograma
								</label>
								<select
									id={`modulo_estado_op_${i}`}
									bind:value={formData.modulos[i].estado_operacional}
									class="block w-full rounded-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-primary-600 sm:text-sm sm:leading-6 dark:bg-gray-700 dark:text-white dark:ring-gray-600"
								>
									<option value="Pendiente">⏳ Pendiente (aún no se inicia)</option>
									<option value="En Ejecucion">🟡 En Ejecución (corriendo ahora)</option>
									<option value="Ejecutado">✅ Ejecutado (ya finalizado)</option>
								</select>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{#if autoCalculateModules}
				<p
					class="mt-3 flex items-center gap-1.5 rounded-md bg-uagrm-sky/10 p-2 text-xs text-uagrm-sky"
				>
					<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/></svg
					>
					El sistema está prorrateando el costo equitativamente. Cambia el switch superior a "Edición
					Manual" para alterar los precios y no perder los cambios.
				</p>
			{/if}

			<!-- F-DESCUENTO-PREVIEW (2026-08-05, Kevin): resumen del efecto del
			     descuento global sobre el costo total del programa. Se muestra
			     SOLO en modo Cálculo Auto (no en Manual, donde el usuario edita
			     libremente). El descuento se aplica al inscribir (no se pisa el
			     costo de los módulos). -->
			{#if descuentoGlobalPct > 0 && autoCalculateModules}
				<div
					class="mt-3 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
				>
					<div class="flex items-center gap-2 font-semibold">
						<svg class="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
							/></svg
						>
						Resumen con Descuento Global {descuentoGlobalPct}%
					</div>
					<div class="mt-1 grid grid-cols-3 gap-2 text-xs">
						<div>
							<div class="text-gray-600 dark:text-gray-400">Costo original</div>
							<div class="font-semibold">Bs. {((formData.modulos || []).reduce((acc, m) => acc + (Number(m.costo) || 0), 0)).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						</div>
						<div>
							<div class="text-gray-600 dark:text-gray-400">Ahorro total</div>
							<div class="font-semibold text-green-700 dark:text-green-400">Bs. {ahorroTotalPrograma.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						</div>
						<div>
							<div class="text-gray-600 dark:text-gray-400">Costo con descuento</div>
							<div class="font-semibold">Bs. {(((formData.modulos || []).reduce((acc, m) => acc + (Number(m.costo) || 0), 0)) - ahorroTotalPrograma).toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
						</div>
					</div>
				</div>
			{/if}
		</Card>
	{/if}

	<!-- SECCIÓN: Observación y estado -->
	<Card variant="ghost" padding="none">
		<TextArea label="Observación" id="observacion" bind:value={formData.observacion} rows={3} />
		{#if !es_historico}
			<Checkbox class="mt-4" id="activo" label="Curso Activo" bind:checked={formData.activo} />
		{/if}
	</Card>
	{/if}

	<!-- F-HISTORICO (2026-07-31): Resolución de Respaldo.
	     F-2026-08-12-EC-RESOLUCION-OBLIGATORIA (Kevin 2026-08-12 post-reunion):
	     - Historico: opcional
	     - Programado (proximo): opcional
	     - En ejecucion: OBLIGATORIA (sin esto no se puede crear el programa)
	     Se sube al crear o editar; tambien se puede subir mas tarde desde el
	     menu desplegable del catalogo de programas. -->
	<Card variant="bordered" padding="md">
		<Heading level="h4" class="mb-3 text-primary-700 dark:text-dark-tertiary">
			Resolución de Respaldo {tipo_programa === 'en_ejecucion' ? '(Obligatoria)' : '(Opcional)'}
		</Heading>
		<p class="mb-3 text-xs text-gray-500 dark:text-gray-400">
			PDF de la resolución que respalda este programa (ej. resolución del Comité Académico,
			resolución del Director, etc).
			{#if tipo_programa === 'en_ejecucion'}
				<strong class="text-red-600 dark:text-red-400">Es OBLIGATORIA para programas en ejecución.</strong>
			{:else}
				Es <strong>opcional</strong>: podés dejarlo en blanco y subirlo más tarde.
			{/if}
		</p>

		{#if isEditMode && course && (course as any).resolucion_pdf_url}
			<div class="mb-3 flex items-center gap-2 rounded-md border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20 p-2 text-sm text-green-800 dark:text-green-200">
				<DocumentAddIcon class="size-5 shrink-0" />
				<div class="flex-1">
					<div class="font-semibold">Ya tenés una resolución cargada</div>
					<a href={(course as any).resolucion_pdf_url} target="_blank" rel="noopener" class="text-xs underline break-all">
						Ver PDF actual
					</a>
				</div>
			</div>
		{/if}

		<label for="resolucion-pdf" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
			Subir nuevo PDF (reemplaza el actual)
		</label>
		<input
			id="resolucion-pdf"
			type="file"
			accept="application/pdf"
			class="block w-full text-sm text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 rounded-md cursor-pointer bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
			onchange={(e) => {
				const target = e.target as HTMLInputElement;
				resolucionFile = target.files?.[0] || null;
			}}
		/>
		{#if resolucionFile}
			<p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
				Seleccionado: <strong>{resolucionFile.name}</strong> ({Math.round(resolucionFile.size / 1024)} KB).
				Se subirá al guardar el programa.
			</p>
		{/if}
	</Card>

	<div class="flex justify-end gap-4 border-t border-gray-200 pt-4 dark:border-gray-700">
		<Button type="button" variant="secondary" onclick={onCancel}>Cancelar</Button>
		<Button type="submit" loading={saving}>
			{#snippet leftIcon()}
				<CheckIcon class="size-5" />
			{/snippet}
			Guardar
		</Button>
	</div>
</form>

<ModalConfirm
	isOpen={showDiscrepancyModal}
	message={discrepancyMessage}
	onConfirm={handleConfirmDiscrepancy}
	onCancel={handleCancelDiscrepancy}
	loading={saving}
/>
