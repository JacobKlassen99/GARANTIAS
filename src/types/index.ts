/**
 * Definición de tipos para Registro de Garantía de Terrenos
 * Asoc. Civil "Colonia Chihuahua"
 *
 * Estructura alineada exactamente con las hojas de Google Sheets:
 * - clientes
 * - lotes
 * - bienes
 * - garantias
 * - garantia_lotes
 * - garantia_bienes
 * - configuracion
 */

export interface Cliente {
  cuenta: string | number;
  nombre: string;
  ci: string;
}

export type EstadoRegistro = 'Disponible' | 'Bloqueado' | 'Inactivo';

export interface Lote {
  idLote: string;
  numeroLote: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaEncargado?: string | number;
  encargado?: string;
  hectareas: number;
  ubicacion: string;
  estado: EstadoRegistro;
  motivoBloqueo?: string;
  fechaBloqueo?: string;
  observacion?: string;
  // Calculado dinámicamente según garantías activas:
  enGarantia?: boolean;
  solicitudGarantiaActiva?: string;
  hectareasEnGarantia?: number;
  hectareasDisponibles?: number;
}

export type TipoBien = 'Vehículo' | 'Maquinaria' | 'Implemento' | 'Otro bien';

export interface Bien {
  idBien: string;
  numeroPoliza: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaEncargado?: string | number;
  encargado?: string;
  tipoBien: TipoBien;
  descripcion: string;
  marca: string;
  modelo: string;
  placa: string;
  ubicacion: string;
  estado: EstadoRegistro;
  motivoBloqueo?: string;
  fechaBloqueo?: string;
  observacion?: string;
  // Calculado dinámicamente según garantías activas:
  enGarantia?: boolean;
  solicitudGarantiaActiva?: string;
  valorGarantiaUSD?: number;
  valorBienUSD?: number;
}

export type TipoGarantiaCon = 'Farmer Rechnung' | 'Campo Grande' | 'Cliente';

export interface GarantiaLoteRelacion {
  idGarantia?: string;
  idLote: string;
  numeroLote: string;
  hectareas: number;
  hectareasTotales?: number;
  hectareasDisponibles?: number;
  propietario?: string;
  cuentaPropietario?: string | number;
  ubicacion?: string;
  encargado?: string;
  garantiaConTipo?: TipoGarantiaCon | string;
  garantiaConCuenta?: string | number;
  garantiaConNombre?: string;
}

export interface GarantiaBienRelacion {
  idGarantia?: string;
  idBien: string;
  numeroPoliza: string;
  tipoBien: string;
  descripcion: string;
  marca: string;
  modelo: string;
  placa?: string;
  propietario?: string;
  cuentaPropietario?: string | number;
  ubicacion?: string;
  valorGarantiaUSD?: number;
  valorBienUSD?: number;
  garantiaConTipo?: TipoGarantiaCon | string;
  garantiaConCuenta?: string | number;
  garantiaConNombre?: string;
}

export interface Garantia {
  idGarantia: string;
  numeroSolicitud: string;
  fecha: string;
  fechaVencimiento?: string;
  estadoVencimiento?: 'Vigente' | 'Próxima a vencer' | 'Vencida' | 'Sin vencimiento' | string;
  diasRestantes?: number;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaPrestatario: string | number;
  prestatario: string;
  garantiaConTipo: TipoGarantiaCon;
  garantiaConCuenta?: string | number;
  garantiaConNombre: string;
  tipoGarantia: string; // 'Terreno' | 'Bien' | 'Terrenos y Bienes'
  modalidad?: 'Simple' | 'Múltiple';
  observacion?: string;
  // Relaciones cargadas desde garantia_lotes y garantia_bienes
  lotes: GarantiaLoteRelacion[];
  bienes: GarantiaBienRelacion[];
  // Campos resumen entregados por listarGarantias:
  lotesResumen?: string;
  polizasResumen?: string;
  ubicacionesResumen?: string;
  cantidadLotes?: number;
  cantidadBienes?: number;
  totalHectareas?: number;
  totalValorBienesUSD?: number;
}

export interface GarantiaLiberada {
  idGarantia: string;
  idLiberacion?: string;
  numeroSolicitud: string;
  fecha: string; // Fecha de garantía
  fechaLiberacion: string; // Fecha de liberación
  fechaVencimiento?: string;
  cuentaPropietario: string | number;
  propietario: string;
  cuentaPrestatario: string | number;
  prestatario: string;
  garantiaConTipo: TipoGarantiaCon | string;
  garantiaConCuenta?: string | number;
  garantiaConNombre: string;
  tipoGarantia: string;
  modalidad?: 'Simple' | 'Múltiple' | string;
  observacion?: string;
  motivoLiberacion?: string;
  lotes: GarantiaLoteRelacion[];
  bienes: GarantiaBienRelacion[];
  lotesResumen?: string;
  polizasResumen?: string;
  ubicacionesResumen?: string;
  cantidadLotes?: number;
  cantidadBienes?: number;
  totalHectareas?: number;
  totalValorBienesUSD?: number;
}

export interface DetalleClienteGarantia {
  idGarantia: string;
  numeroSolicitud: string;
  fecha: string;
  fechaVencimiento?: string;
  estadoVencimiento?: string;
  garantiaConTipo: string;
  garantiaConNombre?: string;
  modalidad?: string;
  tipoGarantia?: string;
  rol?: string; // 'Propietario' | 'Prestatario' | 'Acreedor'
  prestatario?: string;
  propietario?: string;
  lotesResumen?: string;
  polizasResumen?: string;
}

export interface RelacionLoteGarantia {
  hectareas: number;
  garantiaConTipo?: string;
  garantiaConCuenta?: string | number;
  garantiaConNombre?: string;
  numeroSolicitud?: string;
  idGarantia?: string;
}

export interface DetalleClienteLote {
  idLote: string;
  numeroLote: string;
  ubicacion: string;
  hectareas: number;
  hectareasEnGarantia: number;
  hectareasDisponibles: number;
  estado: EstadoRegistro;
  enGarantia?: boolean;
  propietario?: string;
  cuentaPropietario?: string | number;
  relaciones?: RelacionLoteGarantia[];
}

export interface RelacionBienGarantia {
  idGarantia?: string;
  numeroSolicitud?: string;
  garantiaConTipo?: string;
  garantiaConCuenta?: string | number;
  garantiaConNombre?: string;
  valorGarantiaUSD?: number;
}

export interface DetalleClienteBien {
  idBien: string;
  numeroPoliza: string;
  tipoBien: string;
  descripcion: string;
  marca?: string;
  modelo?: string;
  placa?: string;
  ubicacion: string;
  estado: EstadoRegistro;
  enGarantia?: boolean;
  propietario?: string;
  cuentaPropietario?: string | number;
  garantiaConCuenta?: string | number;
  garantiaConNombre?: string;
  valorGarantiaUSD?: number;
  valorBienUSD?: number;
  numeroSolicitud?: string;
  relaciones?: RelacionBienGarantia[];
}

export interface DetalleCliente {
  cuenta: string | number;
  nombre: string;
  ci: string;
  garantias: DetalleClienteGarantia[];
  lotes: DetalleClienteLote[];
  bienes: DetalleClienteBien[];
}

export interface ConfiguracionSistema {
  nombreInstitucion: string;
}

export interface DashboardStats {
  garantiasActivas: number | null;
  hectareasEnGarantia: number | null;
  hectareasDisponibles: number | null;
  bienesEnGarantia: number | null;
  valorBienesEnGarantiaUSD: number | null;
  garantiasExternas: number | null;
  lotesBloqueados: number | null;
  bienesBloqueados: number | null;
}

export interface UbicacionEstadistica {
  ubicacion: string;
  cantidadLotes: number;
  hectareasTotales: number;
  hectareasEnGarantia: number;
  hectareasDisponibles: number;
  hectareasBloqueadas: number;
}

export interface GarantiaProximaVencer {
  idGarantia: string;
  numeroSolicitud: string | number;
  propietario: string;
  cuentaPropietario?: string | number;
  prestatario: string;
  cuentaPrestatario?: string | number;
  fechaVencimiento: string;
  diasRestantes?: number;
  estadoVencimiento?: 'Vencida' | 'Próxima a vencer' | 'Vigente' | 'Sin vencimiento';
}

export interface ClienteEstadistica {
  cuenta: string | number;
  nombre: string;
  cantidadGarantias: number;
  hectareasEnGarantia: number;
  bienesEnGarantia?: number;
}

export interface EstadisticasPanel {
  porUbicacion: UbicacionEstadistica[];
  proximasAVencer: GarantiaProximaVencer[];
  totalProximasAVencer: number;
  principalesClientes: ClienteEstadistica[];
  criterioClientes?: string;
  periodoVencimientoDias?: number;
}

export interface QueryParams {
  page: number;
  pageSize: number; // Por defecto 200
  search?: string;
  filters?: Record<string, any>;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  from?: number;
  to?: number;
}

export interface ReporteItem {
  id: string;
  titulo: string;
  descripcion: string;
  codigo: string;
}
