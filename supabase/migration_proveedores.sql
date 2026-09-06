-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: PROVEEDORES / CUENTAS POR PAGAR
--  Ejecutar en Supabase SQL Editor.
--  Crea proveedores, creditos_proveedor, agrega proveedor_id a
--  movimientos_financieros, políticas RLS, índices y vista de saldos.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. TABLA PROVEEDORES ─────────────────────────────────────────────────────
create table if not exists public.proveedores (
  id          uuid          primary key default uuid_generate_v4(),
  nombre      text          not null,
  contacto    text,
  email       text,
  ciudad      text,
  notas       text,
  activo      boolean       not null default true,
  creado_por  uuid          references public.perfiles(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

comment on table public.proveedores is
  'Proveedores a los que se les debe dinero (cuentas por pagar).';

-- ── 2. TABLA CRÉDITOS DE PROVEEDOR (aumenta la deuda) ────────────────────────
create table if not exists public.creditos_proveedor (
  id              uuid          primary key default uuid_generate_v4(),
  proveedor_id    uuid          not null references public.proveedores(id) on delete cascade,
  concepto        text          not null,
  monto           numeric(12,0) not null,
  fecha           date          not null default current_date,
  registrado_por  uuid          references public.perfiles(id) on delete set null,
  created_at      timestamptz   not null default now()
);

comment on table public.creditos_proveedor is
  'Compras a crédito / facturas pendientes que aumentan la deuda con un proveedor.';

-- ── 3. AGREGAR proveedor_id A MOVIMIENTOS ────────────────────────────────────
-- Los pagos a proveedor se registran como movimientos_financieros con
-- tipo = 'pago' (ya existe desde migration_bancos.sql), banco_id obligatorio
-- y proveedor_id seteado. Así el pago descuenta automáticamente del saldo
-- del banco vía v_bancos_saldo, sin necesidad de tocar la tabla bancos.
alter table public.movimientos_financieros
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete set null;

-- ── 4. ÍNDICES ────────────────────────────────────────────────────────────────
create index if not exists idx_proveedores_activo          on public.proveedores(activo);
create index if not exists idx_creditos_proveedor_proveedor on public.creditos_proveedor(proveedor_id);
create index if not exists idx_movimientos_proveedor        on public.movimientos_financieros(proveedor_id);

-- ── 5. TRIGGER updated_at ─────────────────────────────────────────────────────
drop trigger if exists set_updated_at_proveedores on public.proveedores;
create trigger set_updated_at_proveedores
  before update on public.proveedores
  for each row execute function public.set_updated_at();

-- ── 6. VISTA DE SALDOS POR PROVEEDOR ─────────────────────────────────────────
create or replace view public.v_proveedores_saldo as
select
  p.id,
  p.nombre,
  p.contacto,
  p.email,
  p.ciudad,
  p.notas,
  p.activo,
  p.creado_por,
  p.created_at,
  p.updated_at,
  coalesce((
    select sum(c.monto) from public.creditos_proveedor c where c.proveedor_id = p.id
  ), 0) as total_creditos,
  coalesce((
    select sum(m.monto) from public.movimientos_financieros m
    where m.proveedor_id = p.id and m.tipo::text = 'pago'
  ), 0) as total_pagos,
  coalesce((
    select sum(c.monto) from public.creditos_proveedor c where c.proveedor_id = p.id
  ), 0) - coalesce((
    select sum(m.monto) from public.movimientos_financieros m
    where m.proveedor_id = p.id and m.tipo::text = 'pago'
  ), 0) as deuda
from public.proveedores p;

-- ── 7. RLS ────────────────────────────────────────────────────────────────────
alter table public.proveedores        enable row level security;
alter table public.creditos_proveedor enable row level security;

drop policy if exists "proveedores: admin y finanzas ven" on public.proveedores;
create policy "proveedores: admin y finanzas ven"
  on public.proveedores for select
  using (public.tiene_acceso('finanzas'));

drop policy if exists "proveedores: admin y finanzas gestionan" on public.proveedores;
create policy "proveedores: admin y finanzas gestionan"
  on public.proveedores for all
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_proveedor: admin y finanzas ven" on public.creditos_proveedor;
create policy "creditos_proveedor: admin y finanzas ven"
  on public.creditos_proveedor for select
  using (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_proveedor: crear" on public.creditos_proveedor;
create policy "creditos_proveedor: crear"
  on public.creditos_proveedor for insert
  with check (public.tiene_acceso('finanzas') and registrado_por = auth.uid());

drop policy if exists "creditos_proveedor: admin y finanzas eliminan" on public.creditos_proveedor;
create policy "creditos_proveedor: admin y finanzas eliminan"
  on public.creditos_proveedor for delete
  using (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_proveedor: admin y finanzas actualizan" on public.creditos_proveedor;
create policy "creditos_proveedor: admin y finanzas actualizan"
  on public.creditos_proveedor for update
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

-- ── 8. PERMISOS PARA LA VISTA ─────────────────────────────────────────────────
grant select on public.v_proveedores_saldo to authenticated;
