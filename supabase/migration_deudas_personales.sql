-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: DEUDAS PERSONALES (PERSONAL Y DEL NEGOCIO)
--  Ejecutar en Supabase SQL Editor.
--  Crea acreedores_personales, creditos_deuda_personal, agrega
--  acreedor_personal_id a movimientos_financieros, políticas RLS,
--  índices y vista de saldos.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. TIPO ───────────────────────────────────────────────────────────────────
do $$ begin
  create type tipo_deuda_personal as enum ('personal', 'negocio');
exception when duplicate_object then null; end $$;

-- ── 2. TABLA ACREEDORES PERSONALES ───────────────────────────────────────────
create table if not exists public.acreedores_personales (
  id          uuid                  primary key default uuid_generate_v4(),
  nombre      text                  not null,
  tipo        tipo_deuda_personal   not null default 'personal',
  contacto    text,
  notas       text,
  activo      boolean               not null default true,
  creado_por  uuid                  references public.perfiles(id) on delete set null,
  created_at  timestamptz           not null default now(),
  updated_at  timestamptz           not null default now()
);

comment on table public.acreedores_personales is
  'Terceros a los que el usuario o el negocio les debe dinero (deudas personales, no proveedores de mercancía).';

-- ── 3. TABLA CRÉDITOS DE DEUDA PERSONAL (aumenta la deuda) ───────────────────
create table if not exists public.creditos_deuda_personal (
  id              uuid          primary key default uuid_generate_v4(),
  acreedor_id     uuid          not null references public.acreedores_personales(id) on delete cascade,
  concepto        text          not null,
  monto           numeric(12,0) not null,
  fecha           date          not null default current_date,
  registrado_por  uuid          references public.perfiles(id) on delete set null,
  created_at      timestamptz   not null default now()
);

comment on table public.creditos_deuda_personal is
  'Aumentos de una deuda personal o del negocio (préstamos, cargos a tarjeta, etc.).';

-- ── 4. AGREGAR acreedor_personal_id A MOVIMIENTOS ────────────────────────────
-- Los pagos de deudas personales se registran como movimientos_financieros con
-- tipo = 'pago', banco_id obligatorio y acreedor_personal_id seteado. Así el
-- pago descuenta automáticamente del saldo del banco vía v_bancos_saldo.
alter table public.movimientos_financieros
  add column if not exists acreedor_personal_id uuid references public.acreedores_personales(id) on delete set null;

-- ── 5. ÍNDICES ────────────────────────────────────────────────────────────────
create index if not exists idx_acreedores_personales_activo   on public.acreedores_personales(activo);
create index if not exists idx_acreedores_personales_tipo     on public.acreedores_personales(tipo);
create index if not exists idx_creditos_deuda_personal_acreedor on public.creditos_deuda_personal(acreedor_id);
create index if not exists idx_movimientos_acreedor_personal  on public.movimientos_financieros(acreedor_personal_id);

-- ── 6. TRIGGER updated_at ─────────────────────────────────────────────────────
drop trigger if exists set_updated_at_acreedores_personales on public.acreedores_personales;
create trigger set_updated_at_acreedores_personales
  before update on public.acreedores_personales
  for each row execute function public.set_updated_at();

-- ── 7. VISTA DE SALDOS ────────────────────────────────────────────────────────
create or replace view public.v_deudas_personales_saldo as
select
  a.id,
  a.nombre,
  a.tipo,
  a.contacto,
  a.notas,
  a.activo,
  a.creado_por,
  a.created_at,
  a.updated_at,
  coalesce((
    select sum(c.monto) from public.creditos_deuda_personal c where c.acreedor_id = a.id
  ), 0) as total_creditos,
  coalesce((
    select sum(m.monto) from public.movimientos_financieros m
    where m.acreedor_personal_id = a.id and m.tipo::text = 'pago'
  ), 0) as total_pagos,
  coalesce((
    select sum(c.monto) from public.creditos_deuda_personal c where c.acreedor_id = a.id
  ), 0) - coalesce((
    select sum(m.monto) from public.movimientos_financieros m
    where m.acreedor_personal_id = a.id and m.tipo::text = 'pago'
  ), 0) as deuda
from public.acreedores_personales a;

-- ── 8. RLS ────────────────────────────────────────────────────────────────────
alter table public.acreedores_personales    enable row level security;
alter table public.creditos_deuda_personal  enable row level security;

drop policy if exists "acreedores_personales: admin y finanzas ven" on public.acreedores_personales;
create policy "acreedores_personales: admin y finanzas ven"
  on public.acreedores_personales for select
  using (public.tiene_acceso('finanzas'));

drop policy if exists "acreedores_personales: admin y finanzas gestionan" on public.acreedores_personales;
create policy "acreedores_personales: admin y finanzas gestionan"
  on public.acreedores_personales for all
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_deuda_personal: admin y finanzas ven" on public.creditos_deuda_personal;
create policy "creditos_deuda_personal: admin y finanzas ven"
  on public.creditos_deuda_personal for select
  using (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_deuda_personal: crear" on public.creditos_deuda_personal;
create policy "creditos_deuda_personal: crear"
  on public.creditos_deuda_personal for insert
  with check (public.tiene_acceso('finanzas') and registrado_por = auth.uid());

drop policy if exists "creditos_deuda_personal: admin y finanzas eliminan" on public.creditos_deuda_personal;
create policy "creditos_deuda_personal: admin y finanzas eliminan"
  on public.creditos_deuda_personal for delete
  using (public.tiene_acceso('finanzas'));

drop policy if exists "creditos_deuda_personal: admin y finanzas actualizan" on public.creditos_deuda_personal;
create policy "creditos_deuda_personal: admin y finanzas actualizan"
  on public.creditos_deuda_personal for update
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

-- ── 9. PERMISOS PARA LA VISTA ─────────────────────────────────────────────────
grant select on public.v_deudas_personales_saldo to authenticated;
