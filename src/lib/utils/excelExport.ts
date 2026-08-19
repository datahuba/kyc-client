/**
 * Helper de export a Excel (XLSX) — F-XXX (2026-07-29).
 *
 * Kevin: "todas las exportaciones de excel no deben ser csv a nivel general
 * arregla eso en toda la plataforma". Este helper reemplaza todos los
 * `Descargar CSV` client-side por export XLSX real usando SheetJS.
 *
 * Uso:
 *   import { exportToExcel, type ColumnDef } from '$lib/utils/excelExport';
 *   const cols: ColumnDef[] = [
 *     { header: 'Nombre', key: 'nombre', width: 30 },
 *     { header: 'Email', key: 'email', width: 28 },
 *   ];
 *   const rows = students.map(s => ({ nombre: s.nombre, email: s.email }));
 *   exportToExcel(rows, cols, 'estudiantes_2026-07-29');
 *
 * El archivo se descarga automáticamente con la fecha en el nombre.
 */
import * as XLSX from 'xlsx';

export interface ColumnDef<T = any> {
	header: string;
	key: keyof T | string;
	width?: number;
	// Formato opcional para la celda (ej: 'currency', 'date', 'number')
	format?: 'currency' | 'date' | 'number' | 'text';
	// Alineación (default: 'left' para text, 'right' para currency/number)
	align?: 'left' | 'center' | 'right';
}

/**
 * Exporta un array de objetos a un archivo XLSX con descarga automática.
 * - headers: nombres legibles para la primera fila
 * - keys: campos del objeto que se mapean a cada columna
 * - filename: nombre base del archivo (sin extensión, se agrega .xlsx)
 */
export function exportToExcel<T extends Record<string, any>>(
	rows: T[],
	columns: ColumnDef<T>[],
	filename: string
): void {
	// 1) Convertir las filas a una matriz 2D usando el orden de columns.
	const data: any[][] = rows.map((row) =>
		columns.map((col) => {
			const val = row[col.key as keyof T];
			// Si el valor es undefined/null, dejar string vacío
			return val === undefined || val === null ? '' : val;
		})
	);

	// 2) Crear el worksheet
	const headers = columns.map((c) => c.header);
	const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

	// 3) Aplicar anchos de columna si están definidos
	const colWidths = columns.map((c) => ({ wch: c.width ?? 15 }));
	ws['!cols'] = colWidths;

	// 4) Formatear celdas según `format`
	for (let r = 1; r <= data.length; r++) {
		for (let c = 0; c < columns.length; c++) {
			const colDef = columns[c];
			const cellRef = XLSX.utils.encode_cell({ r, c });
			const cell = ws[cellRef];
			if (!cell) continue;

			// Formato numérico según el tipo
			if (colDef.format === 'currency' && typeof cell.v === 'number') {
				cell.z = '"Bs." #,##0.00';
				cell.t = 'n';
			} else if (colDef.format === 'number' && typeof cell.v === 'number') {
				cell.z = '#,##0.00';
				cell.t = 'n';
			} else if (colDef.format === 'date' && cell.v) {
				cell.t = 'd';
			} else if (colDef.format === 'text' || typeof cell.v === 'string') {
				cell.t = 's';
			}
		}
	}

	// 5) Crear el workbook y agregar el worksheet
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, 'Datos');

	// 6) Generar el archivo XLSX como ArrayBuffer y disparar la descarga
	const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
	const blob = new Blob([wbout], {
		type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	const fecha = new Date().toISOString().slice(0, 10);
	a.download = `${filename}_${fecha}.xlsx`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	// Pequeño delay para que el navegador procese la descarga antes de revocar
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
