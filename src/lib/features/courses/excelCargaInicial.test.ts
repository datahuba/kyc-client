// ============================================================================
// F-EXCEL-MULTIHOJA (2026-08-18): tests del parseo del Excel de carga inicial.
//
// Estos tests existen porque el parseo es la puerta de entrada de datos reales
// de estudiantes (CI, nombres, pagos historicos, descuentos) y hasta ahora no
// tenia ninguna cobertura: para ejercitarlo habia que abrir el modal en el
// navegador, logueado y con un archivo real.
//
// Se arman libros con la MISMA libreria que usa el navegador (xlsx) y se
// verifica el resultado del parseo, no las constantes de entrada.
// ============================================================================
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
	analizarHoja,
	cleanEmail,
	fusionarHojas,
	normColName,
	parseNumero,
	pickColumn,
	detectarHeaderRow,
	type HojaDetectada
} from './excelCargaInicial';

/** Convierte una matriz de celdas en el formato que devuelve XLSX al leer. */
function comoHoja(matriz: any[][]): any[][] {
	const ws = XLSX.utils.aoa_to_sheet(matriz);
	return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
}

const CABECERA = ['N°', 'NOMBRE COMPLETO', 'CARNET DE IDENTIDAD', 'CORREO ELECTRONICO', 'CELULAR'];

describe('normColName', () => {
	it('quita acentos, mayusculas y signos', () => {
		expect(normColName('Nombre(s) y Apellido(s)')).toBe('nombresyapellidos');
		expect(normColName('CORREO ELECTRÓNICO')).toBe('correoelectronico');
		expect(normColName('N° de Teléfono')).toBe('ndetelefono');
	});
});

describe('parseNumero', () => {
	it('acepta numero, string y decimales', () => {
		expect(parseNumero(294)).toBe(294);
		expect(parseNumero('294')).toBe(294);
		expect(parseNumero('294.50')).toBe(294.5);
		expect(parseNumero('Bs 1.200')).toBe(1.2); // separador de miles no soportado
	});
	it('devuelve 0 para vacio o basura', () => {
		expect(parseNumero(null)).toBe(0);
		expect(parseNumero('')).toBe(0);
		expect(parseNumero('sin dato')).toBe(0);
	});
});

describe('cleanEmail', () => {
	it('toma el primer email valido cuando la celda trae varios', () => {
		expect(cleanEmail('padillaalberto2026@gmail.com  otro@gmail.com')).toBe(
			'padillaalberto2026@gmail.com'
		);
		expect(cleanEmail('malo; bueno@uagrm.edu.bo')).toBe('bueno@uagrm.edu.bo');
	});
	it('devuelve vacio si ninguno es valido', () => {
		expect(cleanEmail('no tiene arroba')).toBe('');
		expect(cleanEmail('')).toBe('');
	});
});

describe('pickColumn', () => {
	it('prefiere el match exacto sobre el parcial', () => {
		const row = { CI: '7654321', 'CI SIN EXTENSION': '9999999' };
		expect(pickColumn(row, 'ci')).toBe('7654321');
	});
	it('no matchea headers de una letra con candidatos largos', () => {
		// "carnet".includes("n") es true: si el substring fuera bidireccional,
		// el header "N" se llevaria el valor del numero de fila.
		const row = { N: '1', 'CARNET DE IDENTIDAD': '5551234' };
		expect(pickColumn(row, 'carnet')).toBe('5551234');
	});
	it('devuelve vacio si no encuentra la columna', () => {
		expect(pickColumn({ OTRA: 'x' }, 'carnet')).toBe('');
	});
});

describe('detectarHeaderRow', () => {
	it('encuentra la cabecera aunque haya titulos arriba', () => {
		const filas = comoHoja([
			['UNIVERSIDAD AUTONOMA GABRIEL RENE MORENO'],
			['UNIDAD DE POSTGRADO - CONTADURIA PUBLICA'],
			[],
			['LISTA DE ESTUDIANTES'],
			CABECERA,
			['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223']
		]);
		expect(detectarHeaderRow(filas)).toBe(4);
	});

	it('devuelve -1 cuando no hay cabecera de estudiantes', () => {
		const filas = comoHoja([
			['RESUMEN DE INGRESOS'],
			['Modulo', 'Monto'],
			['Modulo 1', 2940]
		]);
		expect(detectarHeaderRow(filas)).toBe(-1);
	});
});

describe('analizarHoja', () => {
	it('lee estudiantes de una hoja normal', () => {
		const hoja = analizarHoja(
			comoHoja([
				CABECERA,
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223'],
				['2', 'Ana Lopez', '8765432', 'ana@mail.com', '70044556']
			]),
			'Grupo A'
		);

		expect(hoja.tieneEstudiantes).toBe(true);
		expect(hoja.conCarnet).toBe(2);
		expect(hoja.seleccionada).toBe(true);
		expect(hoja.filas.map((f) => f.carnet)).toEqual(['7654321', '8765432']);
		expect(hoja.filas[0].nombre).toBe('Juan Perez');
		expect(hoja.filas[0].email).toBe('juan@mail.com');
		// El origen queda anotado para poder explicar duplicados despues
		expect(hoja.filas.every((f) => f.hoja === 'Grupo A')).toBe(true);
	});

	it('descarta una hoja de resumen sin marcarla como error', () => {
		const hoja = analizarHoja(
			comoHoja([['RESUMEN'], ['Modulo', 'Recaudado'], ['Modulo 1', 2940]]),
			'Resumen'
		);
		expect(hoja.tieneEstudiantes).toBe(false);
		expect(hoja.conCarnet).toBe(0);
		expect(hoja.seleccionada).toBe(false);
		expect(hoja.motivo).toContain('Sin cabecera');
	});

	it('marca como error la fila sin CI en vez de descartarla en silencio', () => {
		const hoja = analizarHoja(
			comoHoja([
				CABECERA,
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223'],
				['2', 'Sin Carnet', '', 'sc@mail.com', '70000000']
			]),
			'Grupo A'
		);
		expect(hoja.conCarnet).toBe(1);
		expect(hoja.filas).toHaveLength(2);
		const sinCi = hoja.filas.find((f) => !f.carnet);
		expect(sinCi?.estado).toBe('error');
		expect(sinCi?.mensaje).toBe('Sin CI/carnet');
	});

	it('detecta pagos por modulo y calcula el total', () => {
		const hoja = analizarHoja(
			comoHoja([
				[...CABECERA, 'Pago Modulo 1', 'Pago Modulo 2'],
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223', 294, 294]
			]),
			'Grupo A'
		);
		expect(hoja.filas[0].pagos).toHaveLength(2);
		expect(hoja.filas[0].total_pagado).toBe(588);
	});

	it('interpreta el descuento como 0.5 = 50% y la beca por merito como 100%', () => {
		const hoja = analizarHoja(
			comoHoja([
				[...CABECERA, 'DESCUENTOS'],
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223', 0.5],
				['2', 'Ana Lopez', '8765432', 'ana@mail.com', '70044556', 'BECA 100% POR MERITO']
			]),
			'Grupo A'
		);
		expect(hoja.filas[0].descuento_pct).toBe(50);
		expect(hoja.filas[1].descuento_pct).toBe(100);
	});

	it('ignora un numero absurdo en la columna descuento en vez de inventar uno', () => {
		const hoja = analizarHoja(
			comoHoja([
				[...CABECERA, 'DESCUENTOS'],
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223', 754800]
			]),
			'Grupo A'
		);
		expect(hoja.filas[0].descuento_pct).toBeUndefined();
	});

	it('limpia el email cuando la celda trae varios', () => {
		const hoja = analizarHoja(
			comoHoja([
				CABECERA,
				['1', 'Juan Perez', '7654321', 'juan@mail.com otro@mail.com', '70011223']
			]),
			'Grupo A'
		);
		expect(hoja.filas[0].email).toBe('juan@mail.com');
	});
});

describe('libro con varias hojas', () => {
	/** Arma un libro real de varias hojas y lo analiza como lo hace el modal. */
	function analizarLibro(hojas: Record<string, any[][]>): HojaDetectada[] {
		const wb = XLSX.utils.book_new();
		for (const [nombre, matriz] of Object.entries(hojas)) {
			XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(matriz), nombre);
		}
		const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
		const leido = XLSX.read(buf, { type: 'array' });
		return leido.SheetNames.map((n) =>
			analizarHoja(XLSX.utils.sheet_to_json<any[]>(leido.Sheets[n], { header: 1, defval: '' }), n)
		);
	}

	it('lee TODAS las hojas, no solo la primera', () => {
		// Este es el caso que rompia: el parser viejo leia SheetNames[0] y
		// descartaba el resto en silencio, cargando 1 de 3 estudiantes.
		const hojas = analizarLibro({
			'Grupo A': [CABECERA, ['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223']],
			'Grupo B': [
				CABECERA,
				['1', 'Ana Lopez', '8765432', 'ana@mail.com', '70044556'],
				['2', 'Luis Gomez', '9876543', 'luis@mail.com', '70077889']
			],
			Resumen: [['RESUMEN'], ['Modulo', 'Recaudado'], ['Modulo 1', 2940]]
		});

		expect(hojas).toHaveLength(3);
		const utiles = hojas.filter((h) => h.tieneEstudiantes);
		expect(utiles.map((h) => h.nombre)).toEqual(['Grupo A', 'Grupo B']);
		expect(utiles.reduce((acc, h) => acc + h.conCarnet, 0)).toBe(3);

		// La hoja de resumen se ve, se explica y queda sin marcar
		const resumen = hojas.find((h) => h.nombre === 'Resumen')!;
		expect(resumen.tieneEstudiantes).toBe(false);
		expect(resumen.seleccionada).toBe(false);
	});

	it('fusiona las hojas elegidas conservando el estudiante repetido una sola vez', () => {
		const hojas = analizarLibro({
			'Grupo A': [CABECERA, ['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223']],
			Consolidado: [
				CABECERA,
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223'],
				['2', 'Ana Lopez', '8765432', 'ana@mail.com', '70044556']
			]
		});

		const fusionadas = fusionarHojas(hojas.filter((h) => h.tieneEstudiantes));

		// Juan aparece en las dos hojas: se conserva UNA sola vez como cargable.
		const cargables = fusionadas.filter((f) => f.estado !== 'duplicado' && f.carnet);
		expect(cargables.map((f) => f.carnet).sort()).toEqual(['7654321', '8765432']);

		// La repeticion se informa diciendo de que hoja venia, no se borra.
		const repetido = fusionadas.find((f) => f.estado === 'duplicado');
		expect(repetido?.carnet).toBe('7654321');
		expect(repetido?.mensaje).toContain('Grupo A');
	});

	it('NO pierde al estudiante cuyo CI viene repetido (regresion)', () => {
		// Antes se marcaban como 'duplicado' TODAS las apariciones, incluida la
		// primera, y como las filas duplicadas se descartan al cargar, el
		// estudiante desaparecia por completo de la importacion.
		const hojas = analizarLibro({
			Lista: [
				CABECERA,
				['1', 'Juan Perez', '7654321', 'juan@mail.com', '70011223'],
				['2', 'Juan Perez', '7654321', 'juan@mail.com', '70011223']
			]
		});

		const fusionadas = fusionarHojas(hojas);
		const cargables = fusionadas.filter((f) => f.estado !== 'duplicado' && f.carnet);

		expect(cargables).toHaveLength(1);
		expect(cargables[0].carnet).toBe('7654321');
	});

	it('respeta el orden de las hojas al decidir cual aparicion se conserva', () => {
		const hojas = analizarLibro({
			Primera: [CABECERA, ['1', 'Juan P', '7654321', 'primera@mail.com', '70011223']],
			Segunda: [CABECERA, ['1', 'Juan P', '7654321', 'segunda@mail.com', '70011223']]
		});

		const fusionadas = fusionarHojas(hojas);
		const cargable = fusionadas.find((f) => f.estado !== 'duplicado' && f.carnet)!;
		expect(cargable.hoja).toBe('Primera');
		expect(cargable.email).toBe('primera@mail.com');
	});
});
