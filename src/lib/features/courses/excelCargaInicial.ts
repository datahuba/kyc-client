// ============================================================================
// F-EXCEL-MULTIHOJA (2026-08-18, Kevin): logica pura de parseo del Excel de
// carga inicial de estudiantes.
//
// Por que vive aca y no dentro de CargaInicialModal.svelte:
// este parseo es la puerta de entrada de datos reales de estudiantes al
// sistema (nombres, CI, pagos historicos, descuentos). Estando embebido en el
// componente no habia forma de probarlo: para ejercitarlo habia que abrir el
// modal en el navegador, logueado, con un archivo de verdad. Aca son funciones
// puras (entra una matriz de celdas, sale una lista de filas) y se prueban con
// libros armados a mano — ver excelCargaInicial.test.ts.
//
// El componente conserva todo lo que necesita red o estado: el catalogo de
// descuentos, el lookup contra la base y el envio al backend.
// ============================================================================

/** Una fila de estudiante leida del Excel, editable por el usuario antes de cargar. */
export interface FilaEstudiante {
	carnet: string;
	nombre: string;
	email: string;
	celular: string;
	estado: 'nuevo' | 'existe' | 'duplicado' | 'error';
	estudiante_id?: string;
	mensaje?: string;
	pagos: { modulo: string; monto: number }[];
	total_pagado?: number;
	descuento_pct?: number;
	descuento_id?: string;
	descuento_origen?: string;
	/**
	 * Hoja de la que salio esta fila. Con archivos de varias hojas, saber el
	 * origen es lo que permite entender un duplicado ("esta en Grupo A y en
	 * Grupo B") en vez de ver solo "repetido".
	 */
	hoja?: string;
}

/** Resultado del analisis de UNA hoja del libro. */
export interface HojaDetectada {
	nombre: string;
	filas: FilaEstudiante[];
	/** Cuantas filas tienen CI valido (las unicas que se pueden cargar). */
	conCarnet: number;
	/** true si la hoja parece tener estudiantes; false si es resumen/notas/vacia. */
	tieneEstudiantes: boolean;
	/** Por que se descarto, cuando tieneEstudiantes es false. */
	motivo: string;
	seleccionada: boolean;
}

/**
 * Normaliza un nombre de columna para comparacion flexible: minusculas, sin
 * acentos, sin espacios ni signos. Asi "Nombre(s) y Apellido(s)" matchea con
 * "nombresyapellidos".
 */
export function normColName(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]/g, '');
}

/**
 * Busca el valor de una columna probando varios nombres candidatos.
 *
 * 1. Match EXACTO normalizado (el mas confiable).
 * 2. Si no hay, substring en UNA sola direccion: el header incluye al
 *    candidato, nunca al reves. Evita que el candidato "carnet" matchee un
 *    header "N" (porque "carnet".includes("n") es true).
 * 3. El substring solo aplica si ambos tienen >= 4 caracteres normalizados,
 *    para no enganchar headers de una o dos letras.
 *
 * Devuelve '' si no encuentra nada.
 */
export function pickColumn(row: Record<string, any>, ...candidatos: string[]): string {
	const keys = Object.keys(row);
	const normKeys = new Map(keys.map((k) => [k, normColName(k)]));

	for (const candidato of candidatos) {
		const norm = normColName(candidato);
		for (const [key, kNorm] of normKeys.entries()) {
			if (kNorm === norm && row[key] != null && String(row[key]).trim() !== '') {
				return String(row[key]).trim();
			}
		}
	}

	for (const candidato of candidatos) {
		const norm = normColName(candidato);
		if (norm.length < 4) continue;
		for (const [key, kNorm] of normKeys.entries()) {
			if (kNorm.length < 4) continue;
			if (kNorm.includes(norm) && row[key] != null && String(row[key]).trim() !== '') {
				return String(row[key]).trim();
			}
		}
	}

	return '';
}

/** Parsea un numero que puede venir como 294, "294" o "294.0". 0 si no es numero. */
export function parseNumero(v: any): number {
	if (v == null) return 0;
	if (typeof v === 'number') return v;
	const s = String(v).replace(/[^\d.-]/g, '');
	const n = parseFloat(s);
	return isNaN(n) ? 0 : n;
}

/**
 * Toma el primer email valido de una celda que puede traer varios separados
 * por espacio, coma, punto y coma o barra. '' si ninguno es valido.
 */
export function cleanEmail(raw: string): string {
	if (!raw) return '';
	const parts = String(raw)
		.split(/[\s,;|/]+/)
		.map((p) => p.trim())
		.filter((p) => p.length > 0);
	for (const p of parts) {
		if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) {
			return p;
		}
	}
	return '';
}

/** Palabras que delatan una fila de cabecera de estudiantes. */
const HEADER_KEYWORDS = [
	'nombre', 'apellido', 'carnet', 'ci', 'cedula', 'identidad',
	'correo', 'email', 'mail', 'celular', 'telefono', 'phone',
	'departamento', 'descuento', 'plataforma', 'cargo',
	'men', 'mensualidad', 'detalle', 'requisito', 'fecha'
];

/** Sub-cabeceras de requisitos que no son filas de datos. */
const SUBHEADER_KEYWORDS = /hoja|fotocopia|solicitud|credencial|fondo|provisi|requisito/i;

/**
 * F-EXCEL-PAGO-FANTASMA (2026-08-18): decide si una columna trae un IMPORTE
 * pagado por modulo, o solo el numero de modulo del estudiante.
 *
 * `kNorm` ya viene normalizado por normColName (minusculas, sin acentos ni
 * signos), asi que "Pago Módulo 1" llega como "pagomodulo1".
 *
 * La distincion clave: una columna de pago identifica CUAL modulo se pago,
 * asi que lleva el numero en el nombre. Una columna "MODULO" a secas dice en
 * que modulo va el alumno — su valor (1, 2, 3...) NO es dinero.
 */
export function esColumnaDePago(kNorm: string): boolean {
	// Los totales se calculan, no se importan como pago de un modulo.
	if (kNorm.includes('total')) return false;

	// "pagomodulo1", "pagomodulo2": explicitas, requieren el numero igual.
	if (kNorm.startsWith('pago') && /modulo\d/.test(kNorm)) return true;

	// "modulo1", "modulo2": el numero pegado al nombre indica de que modulo
	// es el importe. "modulo" solo, "moduloactual" o "moduloinicial" no.
	if (/^modulo\d/.test(kNorm)) return true;

	return false;
}

/**
 * Busca la fila de cabecera. No siempre es la primera: estos archivos suelen
 * traer el titulo del programa y el logo arriba (en un caso real los headers
 * estaban en la fila 6). Una cabecera tiene >= 4 celdas de texto corto y al
 * menos 2 palabras conocidas. Devuelve -1 si no la encuentra.
 */
export function detectarHeaderRow(rawRows: any[][]): number {
	for (let i = 0; i < Math.min(20, rawRows.length); i++) {
		const row = rawRows[i];
		if (!Array.isArray(row)) continue;
		const textCells = row.filter(
			(c) => typeof c === 'string' && c.trim().length > 0 && c.trim().length < 60
		);
		if (textCells.length < 4) continue;
		const allText = textCells.join(' ').toLowerCase();
		const matchCount = HEADER_KEYWORDS.filter((k) => allText.includes(k)).length;
		if (matchCount >= 2) return i;
	}
	return -1;
}

/**
 * Analiza UNA hoja y devuelve las filas de estudiantes que encontro.
 *
 * Nunca lanza ni alerta: si la hoja no sirve, lo dice en `motivo`. Una hoja
 * sin estudiantes (resumen, notas, docentes) es un caso normal en estos
 * archivos, no un error del usuario.
 */
export function analizarHoja(rawRows: any[][], nombreHoja: string): HojaDetectada {
	const descartada = (motivo: string): HojaDetectada => ({
		nombre: nombreHoja,
		filas: [],
		conCarnet: 0,
		tieneEstudiantes: false,
		motivo,
		seleccionada: false
	});

	if (!rawRows || rawRows.length === 0) {
		return descartada('Hoja vacia');
	}

	const headerRowIdx = detectarHeaderRow(rawRows);
	if (headerRowIdx === -1) {
		return descartada('Sin cabecera de estudiantes (Nombre / CI / Email)');
	}

	const headers: string[] = rawRows[headerRowIdx].map(
		(h: any, idx: number) => String(h || `col_${idx}`).trim() || `col_${idx}`
	);

	// Construir las filas crudas como objetos {header: valor}
	const rows: Record<string, any>[] = [];
	for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
		const row = rawRows[i];
		if (!Array.isArray(row)) continue;
		if (row.every((c) => c === '' || c == null)) continue;

		// Descartar sub-cabeceras de requisitos (texto de requisitos, sin datos)
		const textCells = row.filter((c) => typeof c === 'string' && c.trim().length > 0);
		if (textCells.length > 0) {
			const allText = textCells.join(' ');
			const hasData = row.some(
				(c) => /^\d{5,}/.test(String(c).trim()) || /@/.test(String(c))
			);
			if (SUBHEADER_KEYWORDS.test(allText) && !hasData) continue;
		}

		const obj: Record<string, any> = {};
		for (let j = 0; j < headers.length; j++) {
			obj[headers[j]] = row[j];
		}
		rows.push(obj);
	}

	const filas: FilaEstudiante[] = [];
	for (const row of rows) {
		const carnet = pickColumn(
			row, 'ci', 'cisinextension', 'carnet', 'cedula', 'documento',
			'identidad', 'documentoidentidad'
		);
		const nombre = pickColumn(
			row, 'nombresyapellidos', 'nombrecompleto', 'nombreyapellido',
			'nombre', 'alumno', 'estudiante', 'fullname'
		);
		const emailRaw = pickColumn(
			row, 'direcciondecorreoelectronico', 'direcciondecorreo',
			'correoelectronico', 'email', 'correo', 'mail'
		);
		const email = cleanEmail(emailRaw);
		const celular = pickColumn(
			row, 'celular', 'telefono', 'phone', 'movil', 'f', 'ndetelefonocelular'
		);

		if (!carnet) {
			// F-EXCEL-FILAS-VACIAS (2026-08-18, Kevin en la capacitacion):
			// "estos que estan en error es por que? porque estan vacio, no hay
			// nada (...) pero esos no son alumnos, sino que estan vacio".
			//
			// Una fila sin NINGUN dato de persona no es un estudiante mal
			// cargado: es una linea vacia de la planilla (separadores, filas
			// de formato, el relleno del final de la hoja). Reportarla como
			// error obligaba a revisar decenas de "errores" que no lo eran y
			// escondia los pocos casos reales.
			//
			// Solo se marca error cuando hay una persona identificable pero le
			// falta el CI: ahi si hay algo que corregir.
			const tieneAlgunDato = Boolean(nombre || email || celular);
			if (!tieneAlgunDato) continue;

			filas.push({
				carnet: '',
				nombre,
				email,
				celular,
				estado: 'error',
				mensaje: 'Sin CI/carnet',
				pagos: [],
				hoja: nombreHoja
			});
			continue;
		}

		// Pagos por modulo: columnas tipo "Pago Modulo 1" o "MODULO 2".
		//
		// F-EXCEL-PAGO-FANTASMA (2026-08-18, Kevin en la capacitacion):
		// "aqui en pago, por ejemplo, dice una, hay que ver de donde esta
		// sacando este dato, pago un boliviano, de donde esta sacando este
		// pago".
		//
		// La causa: la regla anterior tomaba como pago CUALQUIER columna que
		// empezara con "modulo". Estos archivos traen una columna "MODULO" (o
		// "MODULO ACTUAL") con el NUMERO del modulo en el que va el
		// estudiante. Un 1 ahi se leia como "pago de 1 Bs", inventando plata
		// que nadie cobro.
		//
		// Ahora una columna de pago tiene que llevar el numero DEL MODULO en
		// el nombre ("modulo1", "pago modulo 2"). "MODULO" a secas es el
		// numero de modulo del alumno, no un importe.
		const pagos: { modulo: string; monto: number }[] = [];
		for (const key of Object.keys(row)) {
			const kNorm = normColName(key);
			if (!esColumnaDePago(kNorm)) continue;
			const monto = parseNumero(row[key]);
			if (monto > 0) {
				pagos.push({ modulo: key, monto });
			}
		}

		// Descuento del Excel: puede venir 0.5 (50%), 1 (100%) o
		// "BECA 100% POR MERITO". El mapeo a un descuento_id del catalogo lo
		// hace el componente, que es quien tiene acceso a la API.
		const descuentoRaw = pickColumn(row, 'descuentos', 'descuento');
		let descuento_pct: number | undefined;
		if (descuentoRaw) {
			const dStr = String(descuentoRaw).trim().toLowerCase();
			if (dStr === '100' || dStr === '1' || dStr.includes('beca 100') || dStr.includes('merito')) {
				descuento_pct = 100;
			} else {
				const d = parseNumero(descuentoRaw);
				if (d > 0 && d <= 1) {
					descuento_pct = d * 100;
				} else if (d === 100) {
					descuento_pct = 100;
				}
				// Cualquier otro numero (ej. 754800, que es un monto mal ubicado)
				// se ignora a proposito: mejor sin descuento que con uno inventado.
			}
		}

		filas.push({
			carnet,
			nombre,
			email,
			celular,
			estado: 'nuevo', // se ajusta despues del lookup contra la base
			pagos,
			total_pagado: pagos.reduce((acc, p) => acc + p.monto, 0),
			descuento_pct,
			descuento_id: undefined,
			descuento_origen: 'sin_descuento',
			hoja: nombreHoja
		});
	}

	const conCarnet = filas.filter((f) => f.carnet).length;
	return {
		nombre: nombreHoja,
		filas,
		conCarnet,
		tieneEstudiantes: conCarnet > 0,
		motivo: conCarnet > 0 ? '' : 'Tiene cabecera pero ninguna fila con CI',
		// Se preselecciona solo lo que tiene estudiantes reales, para que el
		// caso comun sea confirmar y seguir.
		seleccionada: conCarnet > 0
	};
}

/**
 * Fusiona las filas de las hojas elegidas, deduplicando por CI.
 *
 * Se conserva la PRIMERA aparicion de cada CI y las siguientes se marcan como
 * 'duplicado' indicando de que hoja venian. Es deliberado que la primera
 * quede valida: antes se marcaban TODAS las apariciones como duplicado y,
 * como las filas en ese estado se descartan al cargar, un CI repetido hacia
 * que ese estudiante no se cargara en absoluto. Con un archivo que trae una
 * hoja por grupo mas una consolidada, eso borraba a medio curso.
 *
 * Las filas sin CI pasan tal cual (ya vienen marcadas como error) para que el
 * usuario las vea y las corrija en el preview.
 */
/**
 * F-EXCEL-CONTEO-UNICOS (2026-08-18, Kevin en la capacitacion): cuenta las
 * PERSONAS distintas de un conjunto de hojas.
 *
 * Kevin, mirando el selector: "esos 52 esta sumado seguramente 87 mas 87 mas
 * 87". El boton sumaba el total de cada hoja por separado, asi que un archivo
 * con una hoja por grupo mas una consolidada mostraba el triple de gente de
 * la que se iba a cargar. La carga estaba bien —fusionarHojas deduplica— pero
 * el numero prometia algo que no iba a pasar.
 */
export function contarEstudiantesUnicos(hojas: HojaDetectada[]): number {
	const carnets = new Set<string>();
	for (const hoja of hojas) {
		for (const fila of hoja.filas) {
			if (fila.carnet) carnets.add(fila.carnet);
		}
	}
	return carnets.size;
}

export function fusionarHojas(hojas: HojaDetectada[]): FilaEstudiante[] {
	const vistos = new Map<string, string>(); // carnet -> hoja de la primera aparicion
	const fusionadas: FilaEstudiante[] = [];

	for (const hoja of hojas) {
		for (const fila of hoja.filas) {
			if (!fila.carnet) {
				fusionadas.push({ ...fila });
				continue;
			}
			const hojaPrevia = vistos.get(fila.carnet);
			if (hojaPrevia !== undefined) {
				fusionadas.push({
					...fila,
					estado: 'duplicado',
					mensaje:
						hojaPrevia === fila.hoja
							? `CI repetido dentro de "${hojaPrevia}"; se carga la primera aparicion`
							: `Ya venia en la hoja "${hojaPrevia}"; se carga esa`
				});
				continue;
			}
			vistos.set(fila.carnet, fila.hoja || '');
			fusionadas.push({ ...fila });
		}
	}

	return fusionadas;
}
