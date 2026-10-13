-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: FLUJO DE PEDIDOS — instalación, proveedores, compras, eventos
--  Ejecutar en Supabase SQL Editor.
--
--  Agrega lo que faltaba para el negocio de comunicación visual:
--   1. Logística de entrega e instalación (a veces el cliente la pide)
--   2. Proveedores de materia prima
--   3. Órdenes de compra de material por pedido (el cuello de botella real)
--   4. Historial de etapas para medir tiempos de ciclo
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  1. PEDIDOS: logística de entrega / instalación / prioridad
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.pedidos
  add column if not exists requiere_instalacion boolean     not null default false,
  add column if not exists direccion_entrega    text,
  add column if not exists fecha_instalacion    date,
  add column if not exists fecha_entregado      timestamptz,
  add column if not exists entregado_por        uuid references public.perfiles(id) on delete set null,
  add column if not exists foto_entrega_url     text,
  add column if not exists prioridad            smallint    not null default 0;

comment on column public.pedidos.requiere_instalacion is
  'El cliente pidió instalación. Agrega la etapa de instalación al flujo.';
comment on column public.pedidos.direccion_entrega is
  'Dónde se entrega o instala. Necesario para planear la ruta del día.';
comment on column public.pedidos.fecha_instalacion is
  'Día agendado para instalar. Puede diferir de fecha_entrega.';
comment on column public.pedidos.fecha_entregado is
  'Momento real en que se entregó. Contra fecha_entrega da el cumplimiento.';
comment on column public.pedidos.prioridad is
  '0 = normal, 1 = alta, 2 = urgente. Ordena el tablero.';

create index if not exists idx_pedidos_instalacion on public.pedidos(fecha_instalacion);
create index if not exists idx_pedidos_prioridad   on public.pedidos(prioridad desc);
create index if not exists idx_pedidos_entregado   on public.pedidos(fecha_entregado);


-- ─────────────────────────────────────────────────────────────────────────────
--  2. PROVEEDORES
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.proveedores (
  id          uuid        primary key default uuid_generate_v4(),
  nombre      text        not null,
  contacto    text,                       -- Teléfono / WhatsApp
  email       text,
  ciudad      text,
  materiales  text,                       -- "Acrílico, PVC, vinilo"
  notas       text,
  activo      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.proveedores is
  'Proveedores de materia prima (acrílico, PVC, LED, vinilo, estructura).';

-- Si la tabla ya existía (de una versión anterior), el `create table if not exists`
-- de arriba no hace nada y faltarían columnas. Esto completa lo que falte.
alter table public.proveedores
  add column if not exists contacto   text,
  add column if not exists email      text,
  add column if not exists ciudad     text,
  add column if not exists materiales text,
  add column if not exists notas      text,
  add column if not exists activo     boolean     not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_proveedores_activo on public.proveedores(activo);
create index if not exists idx_proveedores_nombre on public.proveedores(nombre);

drop trigger if exists set_updated_at_proveedores on public.proveedores;
create trigger set_updated_at_proveedores
  before update on public.proveedores
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
--  3. COMPRAS DE MATERIAL POR PEDIDO
-- ─────────────────────────────────────────────────────────────────────────────

do $$ begin
  create type estado_compra as enum (
    'por_pedir',        -- Sabemos que hace falta, aún no se pide
    'pedido',           -- Ya se le pidió al proveedor
    'recibido_parcial', -- Llegó parte
    'recibido'          -- Llegó todo
  );
exception when duplicate_object then null; end $$;

create table if not exists public.pedido_compras (
  id              uuid          primary key default uuid_generate_v4(),
  pedido_id       uuid          not null references public.pedidos(id)      on delete cascade,
  pedido_item_id  uuid          references public.pedido_items(id)          on delete set null,
  proveedor_id    uuid          references public.proveedores(id)           on delete set null,
  material        text          not null,                      -- "Acrílico 3mm transparente"
  cantidad        text,                                        -- "2 láminas", "6 m"
  costo_real      numeric(12,0) not null default 0,             -- Lo que de verdad pagamos
  estado          estado_compra not null default 'por_pedir',
  fecha_pedido    date,
  fecha_estimada  date,                                        -- Cuándo promete llegar
  fecha_recibido  date,
  notas           text,
  registrado_por  uuid          references public.perfiles(id) on delete set null,
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

comment on table public.pedido_compras is
  'Material que hay que comprar para un pedido. Permite ver qué pedido está '
  'frenado esperando proveedor y comparar costo real vs. costo estimado.';

-- Misma defensa que en proveedores: completar columnas si la tabla ya existía
alter table public.pedido_compras
  add column if not exists pedido_item_id uuid          references public.pedido_items(id) on delete set null,
  add column if not exists proveedor_id   uuid          references public.proveedores(id)  on delete set null,
  add column if not exists cantidad       text,
  add column if not exists costo_real     numeric(12,0) not null default 0,
  add column if not exists estado         estado_compra not null default 'por_pedir',
  add column if not exists fecha_pedido   date,
  add column if not exists fecha_estimada date,
  add column if not exists fecha_recibido date,
  add column if not exists notas          text,
  add column if not exists registrado_por uuid          references public.perfiles(id) on delete set null,
  add column if not exists created_at     timestamptz   not null default now(),
  add column if not exists updated_at     timestamptz   not null default now();

create index if not exists idx_compras_pedido    on public.pedido_compras(pedido_id);
create index if not exists idx_compras_item      on public.pedido_compras(pedido_item_id);
create index if not exists idx_compras_proveedor on public.pedido_compras(proveedor_id);
create index if not exists idx_compras_estado    on public.pedido_compras(estado);
create index if not exists idx_compras_estimada  on public.pedido_compras(fecha_estimada);

drop trigger if exists set_updated_at_pedido_compras on public.pedido_compras;
create trigger set_updated_at_pedido_compras
  before update on public.pedido_compras
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
--  4. EVENTOS DE PEDIDO (historial de etapas → tiempos de ciclo)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.pedido_eventos (
  id          bigserial     primary key,
  pedido_id   uuid          not null references public.pedidos(id)      on delete cascade,
  etapa       text          not null,   -- Valor de estado_pedido, o 'instalado', 'cerrado'
  usuario_id  uuid          references public.perfiles(id) on delete set null,
  created_at  timestamptz   not null default now()
);

comment on table public.pedido_eventos is
  'Cada vez que un pedido entra a una etapa. Append-only: con esto se mide '
  'cuánto tarda de verdad cada etapa en vez de prometer fechas a ojo.';

create index if not exists idx_eventos_pedido on public.pedido_eventos(pedido_id, created_at);
create index if not exists idx_eventos_etapa  on public.pedido_eventos(etapa);

-- Registrar automáticamente el cambio de estado del pedido
create or replace function public.log_etapa_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.estado is distinct from old.estado then
    insert into public.pedido_eventos (pedido_id, etapa, usuario_id)
    values (new.id, new.estado::text, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists log_etapa_pedido_ins on public.pedidos;
create trigger log_etapa_pedido_ins
  after insert on public.pedidos
  for each row execute function public.log_etapa_pedido();

drop trigger if exists log_etapa_pedido_upd on public.pedidos;
create trigger log_etapa_pedido_upd
  after update of estado on public.pedidos
  for each row execute function public.log_etapa_pedido();


-- ─────────────────────────────────────────────────────────────────────────────
--  5. VISTAS
-- ─────────────────────────────────────────────────────────────────────────────

-- 5.1 Material pendiente agrupado por proveedor.
-- Para hacer UNA llamada por proveedor en vez de cinco.
create or replace view public.v_material_pendiente as
select
  c.id,
  c.pedido_id,
  c.material,
  c.cantidad,
  c.estado,
  c.fecha_pedido,
  c.fecha_estimada,
  c.costo_real,
  pr.id                as proveedor_id,
  coalesce(pr.nombre, 'Sin proveedor') as proveedor_nombre,
  pr.contacto          as proveedor_contacto,
  p.estado             as pedido_estado,
  p.fecha_entrega,
  cl.nombre            as cliente_nombre,
  -- Alerta: el material llega después de la fecha prometida al cliente
  (c.fecha_estimada is not null
   and p.fecha_entrega is not null
   and c.fecha_estimada > p.fecha_entrega) as riesgo_atraso
from public.pedido_compras c
join public.pedidos  p  on p.id  = c.pedido_id
join public.clientes cl on cl.id = p.cliente_id
left join public.proveedores pr on pr.id = c.proveedor_id
where c.estado::text in ('por_pedir', 'pedido', 'recibido_parcial');

comment on view public.v_material_pendiente is
  'Material que todavía no llega, con alerta si llega después de la entrega prometida.';


-- 5.2 Costo real vs. estimado por pedido → margen de verdad
create or replace view public.v_pedido_costo_real as
select
  p.id                                                as pedido_id,
  p.precio_total,
  coalesce((select sum(i.precio_fabricacion)
            from public.pedido_items i
            where i.pedido_id = p.id), 0)             as costo_estimado,
  coalesce((select sum(c.costo_real)
            from public.pedido_compras c
            where c.pedido_id = p.id), 0)             as costo_material_real,
  p.precio_total - coalesce((select sum(c.costo_real)
            from public.pedido_compras c
            where c.pedido_id = p.id), 0)             as ganancia_real
from public.pedidos p;

comment on view public.v_pedido_costo_real is
  'Compara el costo estimado por las calculadoras contra el costo real de compras.';


-- 5.3 SEGURIDAD DE LAS VISTAS
-- Sin esto una vista corre con los permisos de su dueño (postgres) y SALTA el RLS
-- de las tablas que consulta: cualquier usuario autenticado vería todo.
-- `security_invoker` hace que la vista se evalúe con el rol de quien consulta.
alter view public.v_material_pendiente set (security_invoker = true);
alter view public.v_pedido_costo_real  set (security_invoker = true);


-- ─────────────────────────────────────────────────────────────────────────────
--  6. RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.proveedores    enable row level security;
alter table public.pedido_compras enable row level security;
alter table public.pedido_eventos enable row level security;

-- ── Proveedores: todo el equipo los ve (fabricador necesita saber a quién
--    se le pidió). Solo admin y finanzas los gestionan.
drop policy if exists "proveedores: equipo ve" on public.proveedores;
create policy "proveedores: equipo ve"
  on public.proveedores for select
  using (public.tiene_acceso('finanzas', 'fabricador', 'diseñador'));

drop policy if exists "proveedores: admin y finanzas gestionan" on public.proveedores;
create policy "proveedores: admin y finanzas gestionan"
  on public.proveedores for all
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

-- ── Compras: fabricador ve y marca recibido (es quien recibe el material).
--    Los costos se ocultan en el frontend según rol, igual que los precios.
drop policy if exists "compras: equipo ve" on public.pedido_compras;
create policy "compras: equipo ve"
  on public.pedido_compras for select
  using (public.tiene_acceso('finanzas', 'fabricador'));

drop policy if exists "compras: fabricador actualiza" on public.pedido_compras;
create policy "compras: fabricador actualiza"
  on public.pedido_compras for update
  using (public.es_rol('fabricador'))
  with check (public.es_rol('fabricador'));

drop policy if exists "compras: admin y finanzas gestionan" on public.pedido_compras;
create policy "compras: admin y finanzas gestionan"
  on public.pedido_compras for all
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

-- ── Eventos: lectura para el equipo, escritura solo por el trigger.
drop policy if exists "eventos: equipo ve" on public.pedido_eventos;
create policy "eventos: equipo ve"
  on public.pedido_eventos for select
  using (public.tiene_acceso('finanzas', 'fabricador', 'diseñador'));


-- ─────────────────────────────────────────────────────────────────────────────
--  7. PERMISOS DE VISTAS
-- ─────────────────────────────────────────────────────────────────────────────

grant select on public.v_material_pendiente  to authenticated;
grant select on public.v_pedido_costo_real   to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
--  8. BACKFILL: evento inicial para los pedidos que ya existen
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.pedido_eventos (pedido_id, etapa, usuario_id, created_at)
select p.id, p.estado::text, p.creado_por, p.created_at
from public.pedidos p
where not exists (
  select 1 from public.pedido_eventos e where e.pedido_id = p.id
);
