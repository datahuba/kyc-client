import type { Curso } from "./curso.interface";
import type { Estudiante } from "./estudiante.interface";

export interface Pago {
  numeroTransaccion: string;      // Número de transacción o comprobante
  concepto: string;               // Ej. "Matrícula", "Cuota 1", "Curso X"
  
  estudiante: Estudiante;         // Datos básicos del estudiante que paga

  cantidad: number;               // Monto pagado
  curso?: Curso;                  // Curso asociado (si aplica)

  imagenVoucher: string | null;   // URL, base64 o file path

  estado: "aprobado" | "rechazado"; // Estado del pago

  fechaSubida: string;            // Fecha en la que subió el voucher
  fechaPagada?: string;           // Fecha confirmada (opcional)
}
