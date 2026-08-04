<script lang="ts">
	// F-HISTORICO-AUTOSERVICIO (2026-08-04): form específico para crear
	// programas HISTÓRICOS. Más simple que el CourseForm monolítico.
	// Características:
	//   - Código auto-generado (editable)
	//   - Costo total editable que se redistribuye automáticamente entre módulos
	//   - Cantidad de módulos dinámica
	//   - Docentes NO obligatorios
	//   - Fechas opcionales
	//   - Resolución opcional (PDF)
	//   - Descuentos: si existen se cargan después, no en este form
	//   - Estudiantes: se cargan DESPUÉS con CargaInicialModal (existing)
	import Button from '$lib/components/ui/button.svelte';
	import Input from '$lib/components/ui/input.svelte';
	import Select from '$lib/components/ui/select.svelte';
	import TextArea from '$lib/components/ui/textArea.svelte';
	import FileUpload from '$lib/components/ui/fileUpload.svelte';
	import { courseService } from '$lib/services';
	import { alert } from '$lib/utils';
	import { CheckIcon, ChevronLeftIcon } from '$lib/icons/outline';

	interface Props {
		onSuccess: () => void;
		onCancel: () => void;
	}

	let { onSuccess, onCancel }: Props = $props();

	let saving = $state(false);
	let errors: Record<string, string> = $state({});

	// Resolución
	let resolucionFile: File | null = $state(null);
	let subiendoResolucion = $state(false);

	// Datos del programa
	let codigo = $state('');
	let nombrePrograma = $state('');
	let descripcion = $state('');
	let tipoCurso: string = $state('diplomado');
	let modalidad: string = $state('presencial');

	// Costo total + cantidad de módulos
	let costoTotal = $state(0);
	let cantidadModulos = $state(5);
	let costoPorModulo = $derived(
		cantidadModulos > 0 ? Math.round((costoTotal / cantidadModulos) * 100) / 100 : 0
	);

	// Módulos: se inicializan con la cantidad default y se sincronizan con handlers explícitos.
	// NO usamos $effect para evitar loops infinitos (Svelte detecta cuando un effect escribe
	// a una variable que lee). Ver: https://svelte.dev/e/effect_update_depth_exceeded
	let modulos = $state<{ nombre: string; costo: number }[]>(
		Array.from({ length: 5 }, (_, i) => ({ nombre: `Módulo ${i + 1}`, costo: 0 }))
	);

	// Handler explícito: ajustar cantidad de módulos (reemplaza el effect)
	function ajustarCantidadModulos(target: number) {
		target = Math.max(1, Math.min(20, target));
		cantidadModulos = target;
		const current = modulos.length;
		if (target > current) {
			// agregar nuevos modulos con costoPorModulo actual
			const nuevos = Array.from({ length: target - current }, (_, i) => ({
				nombre: `Módulo ${current + i + 1}`,
				costo: costoPorModulo
			}));
			modulos = [...modulos, ...nuevos];
		} else if (target < current) {
			modulos = modulos.slice(0, target);
		}
	}

	// Handler: cuando cambia el costo total, redistribuir entre los modulos
	// (se llama desde el onchange del input de costo, NO en $effect)
	function redistribuirCosto() {
		if (costoPorModulo > 0) {
			modulos = modulos.map((m) => ({ ...m, costo: costoPorModulo }));
		}
	}

	// Fechas (opcionales)
	let fechaInicio = $state('');
	let fechaFin = $state('');

	// Auto-generar código cuando cambia el nombre del programa
	$effect(() => {
		if (!codigo && nombrePrograma) {
			const slug = nombrePrograma
				.toUpperCase()
				.normalize('NFD')
				.replace(/[\u0300-\u036f]/g, '')
				.replace(/[^A-Z0-9]+/g, '-')
				.replace(/^-+|-+$/g, '')
				.slice(0, 20);
			const year = new Date().getFullYear();
			codigo = `${slug}-${year}-H`;
		}
	});

	async function handleSubmit() {
		errors = {};

		// Validaciones
		if (!codigo.trim()) {
			errors.codigo = 'El código es obligatorio';
		}
		if (!nombrePrograma.trim()) {
			errors.nombrePrograma = 'El nombre del programa es obligatorio';
		}
		if (costoTotal < 0) {
			errors.costoTotal = 'El costo total no puede ser negativo';
		}
		if (cantidadModulos < 1) {
			errors.cantidadModulos = 'Debe haber al menos 1 módulo';
		}
		// Verificar que los nombres de módulos no estén vacíos
		const modulosVacios = modulos.some((m) => !m.nombre.trim());
		if (modulosVacios) {
			errors.modulos = 'Todos los módulos deben tener nombre';
		}

		if (Object.keys(errors).length > 0) {
			alert('error', 'Por favor corrige los errores antes de continuar');
			return;
		}

		saving = true;
		try {
			// 1. Crear el programa primero (necesitamos el id para subir la resolución)
			const payload: any = {
				codigo: codigo.trim(),
				nombre_programa: nombrePrograma.trim(),
				tipo_curso: tipoCurso,
				modalidad: modalidad,
				costo_total_interno: costoTotal,
				matricula_interno: 0, // historicos: sin matricula
				cantidad_cuotas: cantidadModulos,
				descuento_curso: 0,
				modulos: modulos.map((m) => ({ nombre: m.nombre.trim(), costo: m.costo, docente_id: null })),
				observacion: descripcion.trim() || undefined,
				fecha_inicio: fechaInicio || null, // null si vacío (Pydantic rechaza '')
				fecha_fin: fechaFin || null,
				activo: false, // historico no acepta inscripciones
				es_historico: true
			};

			console.log('[HistoricalCourseForm] Enviando payload:', JSON.stringify(payload, null, 2));

			const course = await courseService.create(payload);
			console.log('[HistoricalCourseForm] Programa creado:', course);

			// 2. Subir la resolución si hay (tolerante a fallos)
			if (resolucionFile && course._id) {
				try {
					subiendoResolucion = true;
					await courseService.subirResolucion(course._id, resolucionFile);
				} catch (resErr: any) {
					console.warn('No se pudo subir la resolución:', resErr);
					alert('warning', 'El programa se creó, pero la resolución no se pudo subir. Puedes reintentarlo desde el menú del programa.');
				} finally {
					subiendoResolucion = false;
				}
			}

			alert('success', 'Programa histórico creado correctamente');
			onSuccess();
		} catch (e: any) {
			console.error('Error creando programa histórico', e);
			console.error('Response data:', e?.response?.data);
			console.error('Response status:', e?.response?.status);
			const detail = e?.response?.data?.detail;
			let msg: string;
			if (Array.isArray(detail)) {
				// Errores 422 de validación de Pydantic vienen como array
				msg = detail.map((d: any) => `${d.loc?.join('.') || '?'}: ${d.msg}`).join('; ');
			} else if (typeof detail === 'string') {
				msg = detail;
			} else {
				msg = e?.message || 'Error desconocido';
			}
			alert('error', `Error al crear el programa: ${msg}`);
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-5 p-2 max-h-[70vh] overflow-y-auto">
	<!-- Header con botón de volver -->
	<div class="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
		<Button variant="ghost" size="sm" onclick={onCancel} disabled={saving}>
			<ChevronLeftIcon class="w-4 h-4 mr-1" />
			Cambiar tipo
		</Button>
		<span class="text-sm text-gray-500 dark:text-gray-400">
			Creando programa <strong class="text-amber-600 dark:text-amber-400">HISTÓRICO</strong>
		</span>
	</div>

	<!-- 1. DATOS BÁSICOS -->
	<section class="space-y-3">
		<h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
			1. Datos básicos
		</h3>

		<Input
			label="Nombre del programa *"
			bind:value={nombrePrograma}
			error={errors.nombrePrograma}
			placeholder="Ej: Diplomado en Docencia Universitaria 1era edición"
		/>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Input
				label="Código (auto-generado, editable) *"
				bind:value={codigo}
				error={errors.codigo}
				placeholder="DIPL-DDU-2024-H"
			/>

			<Select
				label="Tipo de programa *"
				bind:value={tipoCurso}
			>
				<option value="diplomado">Diplomado</option>
				<option value="maestría">Maestría</option>
				<option value="doctorado">Doctorado</option>
				<option value="curso">Curso</option>
				<option value="taller">Taller</option>
				<option value="otro">Otro</option>
			</Select>
		</div>

		<Select
			label="Modalidad *"
			bind:value={modalidad}
		>
			<option value="presencial">Presencial</option>
			<option value="virtual">Virtual</option>
			<option value="híbrido">Híbrido</option>
		</Select>

		<TextArea
			label="Descripción / Observación (opcional)"
			bind:value={descripcion}
			rows={2}
			placeholder="Notas sobre el programa histórico..."
		/>
	</section>

	<!-- 2. COSTO Y MÓDULOS -->
	<section class="space-y-3 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
		<h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
			2. Costo y módulos
		</h3>
		<p class="text-xs text-gray-600 dark:text-gray-400">
			💡 El costo total se redistribuye automáticamente entre los módulos. Podés ajustar el costo individual de cada módulo abajo.
		</p>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Input
				label="Costo total del programa (Bs) *"
				type="number"
				bind:value={costoTotal}
				oninput={() => redistribuirCosto()}
				error={errors.costoTotal}
				min="0"
				step="0.01"
			/>

			<Input
				label="Cantidad de módulos *"
				type="number"
				value={cantidadModulos}
				oninput={(e) => ajustarCantidadModulos(parseInt((e.target as HTMLInputElement).value) || 1)}
				error={errors.cantidadModulos}
				min="1"
				max="20"
			/>
		</div>

		<div class="bg-white dark:bg-gray-800 p-3 rounded border border-amber-200 dark:border-amber-800">
			<div class="flex items-center justify-between text-sm">
				<span class="text-gray-600 dark:text-gray-400">Costo por módulo (auto):</span>
				<span class="font-semibold text-amber-700 dark:text-amber-300">
					Bs {costoPorModulo.toFixed(2)}
				</span>
			</div>
		</div>

		<!-- Lista de módulos (editable) -->
		{#if modulos.length > 0}
			<div class="space-y-2">
				<span class="text-xs font-medium text-gray-600 dark:text-gray-400">
					Módulos (podés ajustar el costo individual):
				</span>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
					{#each modulos as modulo, i (i)}
						<div class="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
							<span class="text-xs text-gray-500 w-6">{i + 1}.</span>
							<input
								type="text"
								bind:value={modulo.nombre}
								class="flex-1 text-sm bg-transparent border-none focus:outline-none"
								placeholder="Nombre del módulo"
							/>
							<input
								type="number"
								bind:value={modulo.costo}
								class="w-20 text-sm text-right bg-transparent border border-gray-200 dark:border-gray-700 rounded px-1 focus:outline-none"
								step="0.01"
								min="0"
							/>
							<span class="text-xs text-gray-500">Bs</span>
						</div>
					{/each}
				</div>
				{#if errors.modulos}
					<p class="text-xs text-red-600 dark:text-red-400">{errors.modulos}</p>
				{/if}
			</div>
		{/if}
	</section>

	<!-- 3. RESOLUCIÓN -->
	<section class="space-y-3">
		<h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
			3. Resolución de respaldo (opcional)
		</h3>
		<p class="text-xs text-gray-600 dark:text-gray-400">
			Si tenés la resolución en PDF, podés subirla ahora. También podés agregarla después.
		</p>

		<FileUpload
			label="PDF de resolución"
			accept="application/pdf"
			file={resolucionFile}
			onFileSelect={(f) => (resolucionFile = f)}
			loading={subiendoResolucion}
		/>
	</section>

	<!-- 4. FECHAS (opcionales) -->
	<section class="space-y-3">
		<h3 class="font-semibold text-sm text-gray-700 dark:text-gray-300 uppercase tracking-wide">
			4. Fechas del programa (opcional)
		</h3>
		<p class="text-xs text-gray-600 dark:text-gray-400">
			Si no las sabés, dejalas vacías. El sistema puede derivarlas de los pagos después.
		</p>

		<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
			<Input
				label="Fecha de inicio"
				type="date"
				bind:value={fechaInicio}
			/>
			<Input
				label="Fecha de fin"
				type="date"
				bind:value={fechaFin}
			/>
		</div>
	</section>

	<!-- 5. INFO: Después de crear -->
	<section class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-sm">
		<p class="text-blue-900 dark:text-blue-200">
			<strong>📌 Después de crear el programa histórico</strong> podrás cargar los estudiantes usando
			el botón "Carga Inicial" (pegar carnets uno por uno) o "Agregar Estudiante" (uno por uno).
			Los descuentos se aplican después, no en este formulario.
		</p>
	</section>

	<!-- Botones -->
	<div class="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
		<Button variant="ghost" onclick={onCancel} disabled={saving}>
			Cancelar
		</Button>
		<Button variant="primary" onclick={handleSubmit} disabled={saving}>
			{#if saving}
				Creando...
			{:else}
				<CheckIcon class="w-4 h-4 mr-1" />
				Crear programa histórico
			{/if}
		</Button>
	</div>
</div>
