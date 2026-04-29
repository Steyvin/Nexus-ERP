-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: BANCOS / CARTERAS
--  Ejecutar en Supabase SQL Editor.
--  Crea la tabla bancos, agrega banco_id a movimientos_financieros,
--  políticas RLS, índices y vista de saldos.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. TIPO ──────────────────────────────────────────────────────────────────
do $$ begin
  create type tipo_banco as enum ('banco', 'cartera', 'efectivo');
exception when duplicate_object then null; end $$;

-- ── 2. TABLA BANCOS ──────────────────────────────────────────────────────────
create table if not exists public.bancos (
  id              uuid            primary key default uuid_generate_v4(),
  nombre          text            not null,
  tipo            tipo_banco      not null default 'banco',
  numero_cuenta   text,
  saldo_inicial   numeric(12,0)   not null default 0,
  activo          boolean         not null default true,
  notas           text,
  color           text            not null default '#3b82f6',
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now()
);

comment on table public.bancos is
  'Cuentas bancarias, carteras y efectivo donde se registran los movimientos.';

-- ── 3. AGREGAR banco_id A MOVIMIENTOS ─────────────────────────────────────────
alter table public.movimientos_financieros
  add column if not exists banco_id uuid references public.bancos(id) on delete set null;

-- Ampliar los tipos de movimiento si aún no existen los nuevos valores
do $$ begin
  alter type tipo_movimiento add value if not exists 'compra';
exception when others then null; end $$;

do $$ begin
  alter type tipo_movimiento add value if not exists 'pago';
exception when others then null; end $$;

do $$ begin
  alter type tipo_movimiento add value if not exists 'transferencia';
exception when others then null; end $$;

-- ── 4. ÍNDICES ───────────────────────────────────────────────────────────────
create index if not exists idx_bancos_activo on public.bancos(activo);
create index if not exists idx_movimientos_banco on public.movimientos_financieros(banco_id);

-- ── 5. TRIGGER updated_at ────────────────────────────────────────────────────
drop trigger if exists set_updated_at_bancos on public.bancos;
create trigger set_updated_at_bancos
  before update on public.bancos
  for each row execute function public.set_updated_at();

-- ── 6. VISTA DE SALDOS POR BANCO ─────────────────────────────────────────────
-- Saldo calculado = saldo_inicial + ingresos + abonos - gastos/compras/pagos
-- Se castea m.tipo a text para evitar el error "unsafe use of new enum value"
-- cuando los nuevos valores ('compra', 'pago', 'transferencia') fueron agregados
-- en la misma transacción.
create or replace view public.v_bancos_saldo as
select
  b.id,
  b.nombre,
  b.tipo,
  b.numero_cuenta,
  b.saldo_inicial,
  b.activo,
  b.color,
  b.notas,
  b.created_at,
  b.updated_at,
  coalesce((
    select sum(
      case
        when m.tipo::text in ('ingreso', 'abono') then m.monto
        when m.tipo::text in ('gasto', 'compra', 'pago') then -m.monto
        when m.tipo::text = 'ajuste' then m.monto
        when m.tipo::text = 'transferencia' then m.monto
        else 0
      end
    )
    from public.movimientos_financieros m
    where m.banco_id = b.id
  ), 0) as total_movimientos,
  b.saldo_inicial + coalesce((
    select sum(
      case
        when m.tipo::text in ('ingreso', 'abono') then m.monto
        when m.tipo::text in ('gasto', 'compra', 'pago') then -m.monto
        when m.tipo::text = 'ajuste' then m.monto
        when m.tipo::text = 'transferencia' then m.monto
        else 0
      end
    )
    from public.movimientos_financieros m
    where m.banco_id = b.id
  ), 0) as saldo
from public.bancos b;

-- ── 7. RLS ────────────────────────────────────────────────────────────────────
alter table public.bancos enable row level security;

drop policy if exists "bancos: admin y finanzas ven" on public.bancos;
create policy "bancos: admin y finanzas ven"
  on public.bancos for select
  using (public.tiene_acceso('finanzas'));

drop policy if exists "bancos: admin y finanzas gestionan" on public.bancos;
create policy "bancos: admin y finanzas gestionan"
  on public.bancos for all
  using (public.tiene_acceso('finanzas'))
  with check (public.tiene_acceso('finanzas'));

-- ── 8. PERMISOS PARA LA VISTA ────────────────────────────────────────────────
grant select on public.v_bancos_saldo to authenticated;
