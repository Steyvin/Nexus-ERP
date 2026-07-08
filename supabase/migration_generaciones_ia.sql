-- ═════════════════════════════════════════════════════════════════════════════
--  MIGRATION: GENERACIONES DE IMAGEN CON IA (Magnific / Mystic)
--  Ejecutar en Supabase SQL Editor.
--  Crea la tabla generaciones_ia (montajes de fachada por item de pedido),
--  agrega imagen_montaje_url a pedido_items, políticas RLS e índices.
-- ═════════════════════════════════════════════════════════════════════════════

-- ── 1. TIPO ──────────────────────────────────────────────────────────────────
do $$ begin
  create type estado_generacion_ia as enum ('procesando', 'completado', 'error');
exception when duplicate_object then null; end $$;

-- ── 2. TABLA GENERACIONES_IA ───────────────────────────────────────────────────
create table if not exists public.generaciones_ia (
  id                    uuid                    primary key default uuid_generate_v4(),
  pedido_id             uuid                    not null references public.pedidos(id) on delete cascade,
  pedido_item_id        uuid                    not null references public.pedido_items(id) on delete cascade,
  creado_por            uuid                    references public.perfiles(id) on delete set null,
  prompt                text                    not null,
  imagen_fachada_url    text                    not null,
  imagen_diseno_url     text                    not null,
  descripcion_usuario   text,
  num_variantes         smallint                not null default 3,
  task_ids              text[]                  not null default '{}',
  estado                estado_generacion_ia    not null default 'procesando',
  resultados            text[]                  not null default '{}',
  variante_elegida_url  text,
  error_mensaje         text,
  created_at            timestamptz             not null default now()
);

comment on table public.generaciones_ia is
  'Montajes de fachada generados con IA (Magnific/Mystic) por item de pedido. Cada fila puede disparar varias tareas (num_variantes) para mostrarle opciones al cliente.';

create index idx_gen_ia_pedido on public.generaciones_ia(pedido_id);
create index idx_gen_ia_item   on public.generaciones_ia(pedido_item_id);

-- ── 3. COLUMNA EN PEDIDO_ITEMS ─────────────────────────────────────────────────
-- Guarda el montaje elegido por el diseñador/admin para mostrarle al cliente.
-- No reemplaza archivo_diseno_url (ese es el archivo de diseño real de fabricación).
alter table public.pedido_items
  add column if not exists imagen_montaje_url text;

-- ── 4. RLS ──────────────────────────────────────────────────────────────────────
alter table public.generaciones_ia enable row level security;

-- Admin y finanzas pueden ver (finanzas solo lectura, igual que en pedido_items)
drop policy if exists "gen_ia: admin y finanzas ven" on public.generaciones_ia;
create policy "gen_ia: admin y finanzas ven"
  on public.generaciones_ia for select
  using (public.tiene_acceso('finanzas'));

-- Fabricadores ven (consistente con que ven todos los pedido_items)
drop policy if exists "gen_ia: fabricador ve" on public.generaciones_ia;
create policy "gen_ia: fabricador ve"
  on public.generaciones_ia for select
  using (public.es_rol('fabricador'));

-- Diseñador ve/crea/actualiza solo generaciones de items asignados a él
drop policy if exists "gen_ia: diseñador ve sus items" on public.generaciones_ia;
create policy "gen_ia: diseñador ve sus items"
  on public.generaciones_ia for select
  using (
    public.es_rol('diseñador')
    and exists (
      select 1 from public.pedido_items pi
      where pi.id = generaciones_ia.pedido_item_id and pi.asignado_a = auth.uid()
    )
  );

drop policy if exists "gen_ia: diseñador crea en sus items" on public.generaciones_ia;
create policy "gen_ia: diseñador crea en sus items"
  on public.generaciones_ia for insert
  with check (
    public.es_rol('diseñador')
    and creado_por = auth.uid()
    and exists (
      select 1 from public.pedido_items pi
      where pi.id = pedido_item_id and pi.asignado_a = auth.uid()
    )
  );

drop policy if exists "gen_ia: diseñador actualiza sus items" on public.generaciones_ia;
create policy "gen_ia: diseñador actualiza sus items"
  on public.generaciones_ia for update
  using (
    public.es_rol('diseñador')
    and exists (
      select 1 from public.pedido_items pi
      where pi.id = generaciones_ia.pedido_item_id and pi.asignado_a = auth.uid()
    )
  );

-- Admin gestiona todo
drop policy if exists "gen_ia: admin gestiona" on public.generaciones_ia;
create policy "gen_ia: admin gestiona"
  on public.generaciones_ia for all
  using (public.es_rol('admin'))
  with check (public.es_rol('admin'));
