import type { Estudiante } from "./estudiante.interface";

export interface Descuento {
  nombre: string;                 // Nombre del descuento
  porcentaje: number;             // Porcentaje de descuento (0–100)
  estudiantes: Estudiante[];      // Lista de estudiantes que reciben este descuento
}
