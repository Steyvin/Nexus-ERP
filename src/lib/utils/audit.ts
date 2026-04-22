/**
 * Sistema de auditoría para operaciones sensibles del ERP.
 * Registra quién hizo qué, cuándo, y sobre qué registro.
 *
 * IMPORTANTE: Requiere crear la tabla audit_log en Supabase.
 * Ejecuta el SQL del README o del archivo audit_log.sql.
 */

type AccionAudit =
	| 'crear_usuario'
	| 'eliminar_usuario'
	| 'cambiar_rol'
	| 'cambiar_clave'
	| 'toggle_activo'
	| 'eliminar_pedido'
	| 'cambiar_estado_pedido'
	| 'actualizar_pedido'
	| 'agregar_abono'
	| 'eliminar_abono'
	| 'crear_banco'
	| 'actualizar_banco'
	| 'eliminar_banco'
	| 'agregar_movimiento_banco'
	| 'eliminar_movimiento_banco'
	| 'eliminar_cotizacion'
	| 'cambiar_precio_item'
	| 'cambiar_total_cotizacion'
	| 'convertir_a_pedido'

interface AuditEntry {
	accion: AccionAudit
	tabla: string
	registro_id: string
	usuario_id: string | null
	usuario_nombre?: string
	detalles?: Record<string, unknown>
}

/**
 * Registra una entrada de auditoría en la tabla audit_log.
 * No lanza errores si falla — la auditoría no debe bloquear la operación principal.
 */
export async function registrarAudit(
	supabase: any,
	entry: AuditEntry
): Promise<void> {
	try {
		await supabase.from('audit_log').insert({
			accion: entry.accion,
			tabla: entry.tabla,
			registro_id: entry.registro_id,
			usuario_id: entry.usuario_id,
			usuario_nombre: entry.usuario_nombre ?? null,
			detalles: entry.detalles ?? null,
			created_at: new Date().toISOString()
		})
	} catch {
		// Silenciar errores de auditoría — no bloquear la operación principal
		console.error('[Audit] Error al registrar auditoría:', entry.accion)
	}
}
