// ══════════════════════════════════════════════════════════════════════════════
//  NEXUS LED ERP — Tipos TypeScript sincronizados con el schema de Supabase
// ══════════════════════════════════════════════════════════════════════════════

// ─── Enums ────────────────────────────────────────────────────────────────────

export type Rol = 'admin' | 'fabricador' | 'diseñador' | 'finanzas'

export type EstadoCotizacion = 'pendiente' | 'aprobada' | 'convertida' | 'cancelada'

export type EstadoPedido =
  | 'Pedido realizado'
  | 'En proceso'
  | 'Enviado a proveedor'
  | 'En fabricación'
  | 'Terminado'
  | 'Entregado'

export type EstadoItem = 'pendiente' | 'en_fabricacion' | 'terminado'

export type TipoProducto =
  | 'nube'
  | 'letra'
  | 'neon'
  | 'vinilo'
  | 'acrilio'
  | 'acrilio_circular'

export type TipoMovimiento = 'ingreso' | 'abono' | 'gasto' | 'ajuste'

// ─── Tablas ───────────────────────────────────────────────────────────────────

export interface Perfil {
  id:             string
  nombre:         string
  rol:            Rol
  activo:         boolean
  avatar_url:     string | null
  ultimo_acceso:  string | null
  created_at:     string
  // Relaciones opcionales (con join)
  email?:         string
}

export interface Cliente {
  id:          string
  nombre:      string
  contacto:    string | null
  email:       string | null
  empresa:     string | null
  ciudad:      string | null
  notas:       string | null
  activo:      boolean
  creado_por:  string | null
  created_at:  string
  updated_at:  string
  // Relaciones opcionales
  _cotizaciones_count?: number
  _pedidos_count?:      number
  _total_comprado?:     number
}

export interface CatalogoParametros {
  id:          string
  tipo:        TipoProducto
  nombre:      string
  activo:      boolean
  parametros:  ParametrosNube | ParametrosNeon | ParametrosVinilo | ParametrosAcrilioCircular | Record<string, unknown>
  updated_at:  string
}

export interface Cotizacion {
  id:              string
  cliente_id:      string
  creado_por:      string | null
  estado:          EstadoCotizacion
  precio_subtotal: number
  precio_total:    number
  descuento:       number
  nota:            string | null
  imagen_url:      string | null
  created_at:      string
  updated_at:      string
  // Relaciones opcionales (con join)
  cliente?:        Cliente
  items?:          CotizacionItem[]
  creador?:        Perfil
}

export interface CotizacionItem {
  id:                   string
  cotizacion_id:        string
  tipo:                 TipoProducto
  tipo_label:           string
  descripcion:          string
  precio_fabricacion:   number
  precio_cliente:       number
  parametros:           Record<string, unknown>
  orden:                number
  created_at:           string
}

export interface Pedido {
  id:            string
  cotizacion_id: string | null
  cliente_id:    string
  creado_por:    string | null
  estado:        EstadoPedido
  precio_total:  number
  abono:         number
  saldo:         number   // columna generada en BD
  fecha_entrega: string | null
  nota:          string | null
  imagen_url:    string | null
  created_at:    string
  updated_at:    string
  // Relaciones opcionales (con join)
  cliente?:      Cliente
  items?:        PedidoItem[]
  notas?:        PedidoNota[]
  creador?:      Perfil
}

export interface PedidoItem {
  id:                   string
  pedido_id:            string
  tipo:                 TipoProducto
  tipo_label:           string
  descripcion:          string
  precio_fabricacion:   number
  precio_cliente:       number
  estado_produccion:    EstadoItem
  asignado_a:           string | null
  archivo_diseno_url:   string | null
  notas_produccion:     string | null
  orden:                number
  updated_at:           string
  created_at:           string
  // Relaciones opcionales
  asignado?:            Perfil
}

export interface PedidoNota {
  id:         string
  pedido_id:  string
  autor_id:   string | null
  contenido:  string
  created_at: string
  // Relaciones opcionales
  autor?:     Perfil
}

export interface MovimientoFinanciero {
  id:             string
  pedido_id:      string | null
  tipo:           TipoMovimiento
  concepto:       string
  monto:          number
  fecha:          string
  registrado_por: string | null
  created_at:     string
  // Relaciones opcionales
  pedido?:        Pedido
  registrador?:   Perfil
}

// ─── Parámetros de calculadoras ────────────────────────────────────────────��──

export interface ParametrosNube {
  precio_cm2_acrilico:           number
  precio_cm2_pvc:                number
  precio_led_m:                  number
  precio_faja_m_lineal:          number
  ancho_faja_normal_cm:          number
  ancho_faja_grande_cm:          number
  separacion_led_cm:             number
  margen_led:                    number
  mdo_pequeño:                   number
  mdo_mediano:                   number
  mdo_grande:                    number
  mdo_limite_pequeño_cm:         number
  mdo_limite_mediano_cm:         number
  transporte_sin_instalacion:    number
  transporte_con_instalacion:    number
  margen_ganancia:               number
}

export interface ParametrosNeon {
  small:       { precio: number; medida: string; max_palabras: number }
  medium:      { precio: number; medida: string; max_palabras: number }
  large:       { precio: number; medida: string; max_palabras: number }
  instalacion: number
}

export interface ParametrosVinilo {
  precio_m2:       number
  instalacion:     number
  gratis_desde_m2: number
}

export interface ParametrosAcrilioCircular {
  d40: number
  d50: number
  d60: number
  d70: number
  d80: number
}

// ─── Vistas (para reportes) ───────────────────────────────────────────────────

export interface ResumenSemanal {
  semana_inicio:       string
  total_pedidos:       number
  ventas_brutas:       number
  costo_fabricacion:   number
  ganancia_bruta:      number
  abonos_recibidos:    number
}

export interface ProductoTop {
  tipo:                TipoProducto
  tipo_label:          string
  cantidad_vendida:    number
  ingresos_totales:    number
  costos_totales:      number
  ganancia_total:      number
  margen_promedio_pct: number
}

// ─── Labels de UI ─────────────────────────────────────────────────────────────

export const TIPO_LABEL: Record<TipoProducto, string> = {
  nube:             'Aviso Nube',
  letra:            'Letra por Letra',
  neon:             'Neon Flex',
  vinilo:           'Vinilo',
  acrilio:          'Acrílico',
  acrilio_circular: 'Acrílico Circular'
}

export const ROL_LABEL: Record<Rol, string> = {
  admin:      'Administrador',
  fabricador: 'Fabricador',
  diseñador:  'Diseñador',
  finanzas:   'Finanzas'
}

export const ESTADOS_PEDIDO: EstadoPedido[] = [
  'Pedido realizado',
  'En proceso',
  'Enviado a proveedor',
  'En fabricación',
  'Terminado',
  'Entregado'
]

export const ESTADO_ITEM_LABEL: Record<EstadoItem, string> = {
  pendiente:       'Pendiente',
  en_fabricacion:  'En fabricación',
  terminado:       'Terminado'
}
