-- ══════════════════════════════════════════════════════════════════════════════
--  NEXUS LED ERP — Esquema completo de base de datos
--  Ejecutar en Supabase → SQL Editor → New query
--  Orden: enums → tablas → índices → funciones → triggers → RLS
-- ══════════════════════════════════════════════════════════════════════════════


-- ────────────────────────────��────────────────────────────────────────────────
--  0. EXTENSIONES
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";


-- ─────────────────────────────────────────────────────────────────────────────
--  1. TIPOS ENUM
-- ─────────────────────────────────────────────────────────────────────────────

-- Roles de usuario en el sistema
create type rol_usuario as enum (
  'admin',        -- Acceso total
  'fabricador',   -- Ve y actualiza producción, sin precios
  'diseñador',    -- Ve pedidos asignados, sube archivos
  'finanzas'      -- Solo lectura + reportes financieros
);

-- Estados de una cotización
create type estado_cotizacion as enum (
  'pendiente',    -- Recién creada, esperando respuesta
  'aprobada',     -- Cliente aprobó, lista para convertir
  'convertida',   -- Ya se convirtió en pedido
  'cancelada'     -- Cancelada
);

-- Estados generales de un pedido
create type estado_pedido as enum (
  'Pedido realizado',
  'En proceso',
  'Enviado a proveedor',
  'En fabricación',
  'Terminado',
  'Entregado'
);

-- Estados de producción de cada item
create type estado_item as enum (
  'pendiente',
  'en_fabricacion',
  'terminado'
);

-- Tipos de producto
create type tipo_producto as enum (
  'nube',             -- Aviso acrílico con faja y LED
  'letra',            -- Letra por letra (perímetro manual)
  'neon',             -- Neon Flex (precios fijos)
  'vinilo',           -- Vinilo adhesivo (precio por m²)
  'acrilio',          -- Acrílico sin faja
  'acrilio_circular', -- Acrílico circular (diámetros fijos)
  'unico'             -- Producto único / personalizado (precio manual)
);

-- Tipos de movimiento financiero
create type tipo_movimiento as enum (
  'ingreso',    -- Pago total de un pedido
  'abono',      -- Pago parcial / anticipo
  'gasto',      -- Gasto operativo
  'ajuste'      -- Ajuste contable
);


-- ─────────────────────────────────────────────────────────────────────────────
--  2. TABLAS
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 2.1 PERFILES (extiende auth.users de Supabase) ───────────────────────────
create table public.perfiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  nombre        text          not null,
  rol           rol_usuario   not null default 'fabricador',
  activo        boolean       not null default true,
  avatar_url    text,
  ultimo_acceso timestamptz,
  created_at    timestamptz   not null default now()
);

comment on table public.perfiles is
  'Perfil de cada usuario del sistema. Se crea automáticamente al registrarse.';


-- ── 2.2 CLIENTES ─────────────────────────────────────────────────────────────
create table public.clientes (
  id          uuid          primary key default uuid_generate_v4(),
  nombre      text          not null,
  contacto    text,                         -- Teléfono / WhatsApp
  email       text,
  empresa     text,
  ciudad      text,
  notas       text,
  activo      boolean       not null default true,
  creado_por  uuid          references public.perfiles(id) on delete set null,
  created_at  timestamptz   not null default now(),
  updated_at  timestamptz   not null default now()
);

comment on table public.clientes is
  'Base de clientes de Nexus LED.';


-- ── 2.3 CATÁLOGO DE PARÁMETROS DE PRODUCTOS ──────────────────────────────────
-- Almacena los parámetros de precio editables desde el panel de admin.
-- Así no hay que tocar código para cambiar precios.
create table public.catalogo_parametros (
  id          uuid          primary key default uuid_generate_v4(),
  tipo        tipo_producto not null unique,
  nombre      text          not null,       -- "Aviso Nube", "Neon Flex", etc.
  activo      boolean       not null default true,
  parametros  jsonb         not null default '{}',
  -- Estructura de parametros según tipo:
  -- nube/letra/acrilio: { precio_cm2: 18, precio_led_m: 5000, margen: 0.40,
  --                       precio_mdo_pequeño: 100000, precio_mdo_mediano: 150000,
  --                       precio_mdo_grande: 220000, precio_faja_m: 1500,
  --                       precio_pvc_cm2: 3, instalacion: 60000, transporte_basico: 10000 }
  -- neon:               { small: 180000, medium: 250000, large: 340000, instalacion: 50000 }
  -- vinilo:             { precio_m2: 50000, instalacion: 60000, gratis_desde_m2: 3 }
  -- acrilio_circular:   { d40: 180000, d50: 220000, d60: 240000, d70: 280000, d80: 350000 }
  updated_at  timestamptz   not null default now()
);

comment on table public.catalogo_parametros is
  'Parámetros de precio por tipo de producto. Editables desde el panel admin.';


-- ── 2.4 COTIZACIONES ─────────────────────────────────────────────────────────
create table public.cotizaciones (
  id              uuid                primary key default uuid_generate_v4(),
  cliente_id      uuid                not null references public.clientes(id) on delete restrict,
  creado_por      uuid                references public.perfiles(id) on delete set null,
  estado          estado_cotizacion   not null default 'pendiente',
  precio_subtotal numeric(12,0)       not null default 0,  -- Suma de items
  precio_total    numeric(12,0)       not null default 0,  -- Con descuento aplicado
  descuento       numeric(12,0)       not null default 0,
  nota            text,
  imagen_url      text,
  created_at      timestamptz         not null default now(),
  updated_at      timestamptz         not null default now()
);

comment on table public.cotizaciones is
  'Cotizaciones generadas para clientes.';


-- ── 2.5 ITEMS DE COTIZACIÓN ───────────────────────────────────────────────────
create table public.cotizacion_items (
  id                  uuid          primary key default uuid_generate_v4(),
  cotizacion_id       uuid          not null references public.cotizaciones(id) on delete cascade,
  tipo                tipo_producto not null,
  tipo_label          text          not null,   -- "Aviso Nube", "Neon Flex", etc.
  descripcion         text          not null,   -- "Nube · 80×60 cm"
  precio_fabricacion  numeric(12,0) not null default 0,  -- Costo real (60%)
  precio_cliente      numeric(12,0) not null default 0,  -- Precio al cliente
  parametros          jsonb         not null default '{}', -- Datos del cálculo
  orden               smallint      not null default 0,
  created_at          timestamptz   not null default now()
);

comment on table public.cotizacion_items is
  'Items individuales de cada cotización con desglose de costos.';


-- ── 2.6 PEDIDOS ──────────────────────────────────────────────────────────────
create table public.pedidos (
  id              uuid            primary key default uuid_generate_v4(),
  cotizacion_id   uuid            references public.cotizaciones(id) on delete set null,
  cliente_id      uuid            not null references public.clientes(id) on delete restrict,
  creado_por      uuid            references public.perfiles(id) on delete set null,
  estado          estado_pedido   not null default 'Pedido realizado',
  precio_total    numeric(12,0)   not null default 0,
  abono           numeric(12,0)   not null default 0,
  saldo           numeric(12,0)   generated always as (precio_total - abono) stored,
  fecha_entrega   date,
  nota            text,
  imagen_url      text,
  created_at      timestamptz     not null default now(),
  updated_at      timestamptz     not null default now()
);

comment on table public.pedidos is
  'Pedidos activos en producción.';


-- ── 2.7 ITEMS DE PEDIDO (con estado de producción individual) ─────────────────
create table public.pedido_items (
  id                   uuid          primary key default uuid_generate_v4(),
  pedido_id            uuid          not null references public.pedidos(id) on delete cascade,
  tipo                 tipo_producto not null,
  tipo_label           text          not null,
  descripcion          text          not null,
  precio_fabricacion   numeric(12,0) not null default 0,
  precio_cliente       numeric(12,0) not null default 0,
  estado_produccion    estado_item   not null default 'pendiente',
  asignado_a           uuid          references public.perfiles(id) on delete set null,
  archivo_diseno_url   text,         -- URL del archivo subido por diseñador
  diseno_completado    boolean       not null default false, -- Diseñador marca cuando termina el diseño
  notas_produccion     text,
  orden                smallint      not null default 0,
  updated_at           timestamptz   not null default now(),
  created_at           timestamptz   not null default now()
);

comment on table public.pedido_items is
  'Items de cada pedido con estado de producción individual por producto.';


-- ── 2.8 NOTAS DE PEDIDO (timeline interno) ───────────────────────────────────
create table public.pedido_notas (
  id          uuid          primary key default uuid_generate_v4(),
  pedido_id   uuid          not null references public.pedidos(id) on delete cascade,
  autor_id    uuid          references public.perfiles(id) on delete set null,
  contenido   text          not null,
  created_at  timestamptz   not null default now()
);

comment on table public.pedido_notas is
  'Notas internas del equipo sobre un pedido (timeline de cambios).';


-- ── 2.9 MOVIMIENTOS FINANCIEROS ──────────────────────────────────────────────
create table public.movimientos_financieros (
  id              uuid              primary key default uuid_generate_v4(),
  pedido_id       uuid              references public.pedidos(id) on delete set null,
  tipo            tipo_movimiento   not null,
  concepto        text              not null,
  monto           numeric(12,0)     not null,
  fecha           date              not null default current_date,
  registrado_por  uuid              references public.perfiles(id) on delete set null,
  created_at      timestamptz       not null default now()
);

comment on table public.movimientos_financieros is
  'Registro de todos los movimientos de dinero del negocio.';


-- ─────────────────────────────────────────────────────────────────────────────
--  3. ÍNDICES (para consultas rápidas)
-- ─────────────────────────────────────────────────────────────────────────────

-- Perfiles
create index idx_perfiles_rol    on public.perfiles(rol);
create index idx_perfiles_activo on public.perfiles(activo);

-- Clientes
create index idx_clientes_nombre    on public.clientes(nombre);
create index idx_clientes_contacto  on public.clientes(contacto);
create index idx_clientes_activo    on public.clientes(activo);

-- Cotizaciones
create index idx_cotizaciones_cliente    on public.cotizaciones(cliente_id);
create index idx_cotizaciones_estado     on public.cotizaciones(estado);
create index idx_cotizaciones_creado_por on public.cotizaciones(creado_por);
create index idx_cotizaciones_fecha      on public.cotizaciones(created_at desc);

-- Items cotización
create index idx_cot_items_cotizacion on public.cotizacion_items(cotizacion_id);
create index idx_cot_items_tipo       on public.cotizacion_items(tipo);

-- Pedidos
create index idx_pedidos_cliente      on public.pedidos(cliente_id);
create index idx_pedidos_estado       on public.pedidos(estado);
create index idx_pedidos_cotizacion   on public.pedidos(cotizacion_id);
create index idx_pedidos_fecha        on public.pedidos(created_at desc);
create index idx_pedidos_entrega      on public.pedidos(fecha_entrega);

-- Items pedido
create index idx_ped_items_pedido      on public.pedido_items(pedido_id);
create index idx_ped_items_estado      on public.pedido_items(estado_produccion);
create index idx_ped_items_asignado    on public.pedido_items(asignado_a);

-- Notas
create index idx_pedido_notas_pedido on public.pedido_notas(pedido_id);

-- Movimientos
create index idx_movimientos_pedido on public.movimientos_financieros(pedido_id);
create index idx_movimientos_fecha  on public.movimientos_financieros(fecha desc);
create index idx_movimientos_tipo   on public.movimientos_financieros(tipo);


-- ─────────────────────────────────────────────────────────────────────────────
--  4. FUNCIONES AUXILIARES
-- ─────────────────────────────────────────────────────────────────────────────

-- Obtiene el rol del usuario autenticado (usado en RLS)
create or replace function public.get_rol()
returns rol_usuario
language sql
security definer
stable
as $$
  select rol from public.perfiles
  where id = auth.uid()
  limit 1;
$$;

-- Verifica si el usuario autenticado tiene un rol específico
create or replace function public.es_rol(r rol_usuario)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = r and activo = true
  );
$$;

-- Verifica si el usuario es admin o tiene uno de los roles dados
create or replace function public.tiene_acceso(variadic roles rol_usuario[])
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid()
      and activo = true
      and (rol = 'admin' or rol = any(roles))
  );
$$;

-- Actualiza updated_at automáticamente
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
--  5. TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- Auto-crear perfil cuando se registra un nuevo usuario en Supabase Auth
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'fabricador')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Actualizar ultimo_acceso al iniciar sesión
create or replace function public.handle_user_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.perfiles
  set ultimo_acceso = now()
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_login
  after update of last_sign_in_at on auth.users
  for each row execute function public.handle_user_login();

-- Triggers updated_at
create trigger set_updated_at_clientes
  before update on public.clientes
  for each row execute function public.set_updated_at();

create trigger set_updated_at_cotizaciones
  before update on public.cotizaciones
  for each row execute function public.set_updated_at();

create trigger set_updated_at_pedidos
  before update on public.pedidos
  for each row execute function public.set_updated_at();

create trigger set_updated_at_pedido_items
  before update on public.pedido_items
  for each row execute function public.set_updated_at();


-- ─────────────────────────────────────────────────────────────────────────────
--  6. ROW LEVEL SECURITY (RLS)
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS en todas las tablas
alter table public.perfiles                 enable row level security;
alter table public.clientes                 enable row level security;
alter table public.catalogo_parametros      enable row level security;
alter table public.cotizaciones             enable row level security;
alter table public.cotizacion_items         enable row level security;
alter table public.pedidos                  enable row level security;
alter table public.pedido_items             enable row level security;
alter table public.pedido_notas             enable row level security;
alter table public.movimientos_financieros  enable row level security;


-- ┌─────────────────────────────────────────────────────��───────────────────┐
-- │  PERFILES                                                               │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Cualquier usuario autenticado puede ver su propio perfil
create policy "perfiles: ver propio"
  on public.perfiles for select
  using (id = auth.uid());

-- Admin puede ver todos los perfiles
create policy "perfiles: admin ve todos"
  on public.perfiles for select
  using (public.es_rol('admin'));

-- Solo el propio usuario puede actualizar su perfil básico
create policy "perfiles: actualizar propio"
  on public.perfiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Solo admin puede crear / cambiar roles / desactivar
create policy "perfiles: admin gestiona"
  on public.perfiles for all
  using (public.es_rol('admin'));


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  CLIENTES                                                               │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Admin, finanzas y quien crea cotizaciones puede ver clientes
create policy "clientes: ver"
  on public.clientes for select
  using (public.tiene_acceso('finanzas', 'fabricador', 'diseñador'));

-- Solo admin puede crear, editar y eliminar clientes
create policy "clientes: admin gestiona"
  on public.clientes for all
  using (public.es_rol('admin'));


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  CATÁLOGO PARÁMETROS                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Todos los usuarios autenticados pueden leer el catálogo (para calcular precios)
create policy "catalogo: todos pueden leer"
  on public.catalogo_parametros for select
  using (auth.uid() is not null);

-- Solo admin puede modificar parámetros de precio
create policy "catalogo: solo admin modifica"
  on public.catalogo_parametros for all
  using (public.es_rol('admin'));


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  COTIZACIONES                                                           │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Admin y finanzas ven todas las cotizaciones
create policy "cotizaciones: admin y finanzas ven todo"
  on public.cotizaciones for select
  using (public.tiene_acceso('finanzas'));

-- Fabricadores y diseñadores NO ven cotizaciones (datos financieros)
-- (no se agrega policy de select para ellos)

-- Admin puede hacer todo
create policy "cotizaciones: admin gestiona"
  on public.cotizaciones for all
  using (public.es_rol('admin'));

-- Cualquier usuario autenticado puede crear cotizaciones
create policy "cotizaciones: crear"
  on public.cotizaciones for insert
  with check (auth.uid() is not null and creado_por = auth.uid());


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  ITEMS DE COTIZACIÓN                                                    │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Los items siguen las mismas reglas que la cotización padre
create policy "cot_items: admin y finanzas ven"
  on public.cotizacion_items for select
  using (
    public.tiene_acceso('finanzas') or
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id and c.creado_por = auth.uid()
    )
  );

create policy "cot_items: admin gestiona"
  on public.cotizacion_items for all
  using (public.es_rol('admin'));

create policy "cot_items: crear si dueño de cotización"
  on public.cotizacion_items for insert
  with check (
    exists (
      select 1 from public.cotizaciones c
      where c.id = cotizacion_id and c.creado_por = auth.uid()
    )
  );


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  PEDIDOS                                                                │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Admin y finanzas ven todos los pedidos (con precios)
create policy "pedidos: admin y finanzas ven todo"
  on public.pedidos for select
  using (public.tiene_acceso('finanzas'));

-- Fabricadores ven pedidos (para producción, sin ver que hay un campo precio en RLS)
-- El ocultamiento de precios se hace en el frontend, no en BD
create policy "pedidos: fabricador ve"
  on public.pedidos for select
  using (public.es_rol('fabricador'));

-- Diseñadores ven pedidos que tienen items asignados a ellos
create policy "pedidos: diseñador ve asignados"
  on public.pedidos for select
  using (
    public.es_rol('diseñador') and
    exists (
      select 1 from public.pedido_items pi
      where pi.pedido_id = id and pi.asignado_a = auth.uid()
    )
  );

-- Admin gestiona todo
create policy "pedidos: admin gestiona"
  on public.pedidos for all
  using (public.es_rol('admin'));

-- Cualquier usuario autenticado puede crear pedidos
create policy "pedidos: crear"
  on public.pedidos for insert
  with check (auth.uid() is not null and creado_por = auth.uid());


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  ITEMS DE PEDIDO                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Admin y finanzas ven todos los items
create policy "ped_items: admin y finanzas ven"
  on public.pedido_items for select
  using (public.tiene_acceso('finanzas'));

-- Fabricadores ven todos los items (para producción)
create policy "ped_items: fabricador ve"
  on public.pedido_items for select
  using (public.es_rol('fabricador'));

-- Fabricadores pueden actualizar solo el estado de producción
create policy "ped_items: fabricador actualiza estado"
  on public.pedido_items for update
  using (public.es_rol('fabricador'))
  with check (public.es_rol('fabricador'));

-- Diseñadores ven y actualizan sus items asignados
create policy "ped_items: diseñador ve sus asignados"
  on public.pedido_items for select
  using (public.es_rol('diseñador') and asignado_a = auth.uid());

create policy "ped_items: diseñador actualiza sus items"
  on public.pedido_items for update
  using (public.es_rol('diseñador') and asignado_a = auth.uid())
  with check (public.es_rol('diseñador') and asignado_a = auth.uid());

-- Admin gestiona todo
create policy "ped_items: admin gestiona"
  on public.pedido_items for all
  using (public.es_rol('admin'));


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  NOTAS DE PEDIDO                                                        │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Todos pueden ver notas de los pedidos que tienen acceso
create policy "notas: ver si tiene acceso al pedido"
  on public.pedido_notas for select
  using (
    public.tiene_acceso('fabricador', 'diseñador', 'finanzas')
  );

-- Todos pueden crear notas
create policy "notas: crear"
  on public.pedido_notas for insert
  with check (auth.uid() is not null and autor_id = auth.uid());

-- Solo el autor o admin puede borrar
create policy "notas: borrar propio o admin"
  on public.pedido_notas for delete
  using (autor_id = auth.uid() or public.es_rol('admin'));


-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  MOVIMIENTOS FINANCIEROS                                                │
-- └─────────────────────────────────────────────────────────────────────────┘

-- Solo admin y finanzas ven movimientos
create policy "movimientos: admin y finanzas ven"
  on public.movimientos_financieros for select
  using (public.tiene_acceso('finanzas'));

-- Solo admin y finanzas pueden registrar movimientos
create policy "movimientos: admin y finanzas registran"
  on public.movimientos_financieros for insert
  with check (public.tiene_acceso('finanzas') and registrado_por = auth.uid());

-- Solo admin puede modificar o eliminar
create policy "movimientos: solo admin modifica"
  on public.movimientos_financieros for update
  using (public.es_rol('admin'));

create policy "movimientos: solo admin elimina"
  on public.movimientos_financieros for delete
  using (public.es_rol('admin'));


-- ─────────────────────────────────────────────────────────────────────────────
--  7. DATOS INICIALES — Catálogo de parámetros de precio
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.catalogo_parametros (tipo, nombre, parametros) values

('nube', 'Aviso Nube (con faja)', '{
  "precio_cm2_acrilico": 17,
  "precio_cm2_acrilico_premium": 18,
  "precio_cm2_pvc": 3,
  "precio_faja_cm2": 15,
  "separacion_led_cm": 7,
  "precio_led_m": 5000,
  "precio_vinilo_m2": 50000,
  "estructura_pequena": 100000,
  "estructura_mediana": 150000,
  "estructura_grande": 200000,
  "transporte_pequeno": 30000,
  "transporte_grande": 80000,
  "mdo_pequena": 100000,
  "mdo_mediana": 150000,
  "mdo_grande": 200000,
  "margen_ganancia": 0.40
}'::jsonb),

('letra', 'Letra por Letra', '{
  "precio_cm2_acrilico": 17,
  "precio_cm2_acrilico_premium": 18,
  "precio_cm2_pvc": 3,
  "precio_faja_cm2": 15,
  "precio_led_m": 5000,
  "precio_vinilo_m2": 50000,
  "estructura_pequena": 100000,
  "estructura_mediana": 150000,
  "estructura_grande": 200000,
  "transporte_pequeno": 30000,
  "transporte_grande": 80000,
  "mdo_pequena": 100000,
  "mdo_mediana": 150000,
  "mdo_grande": 200000,
  "margen_ganancia": 0.40
}'::jsonb),

('neon', 'Neon Flex', '{
  "small":  {"precio": 180000, "medida": "60 × 45 cm", "max_palabras": 2},
  "medium": {"precio": 250000, "medida": "80 × 50 cm", "max_palabras": 3},
  "large":  {"precio": 340000, "medida": "100 × 60 cm", "max_palabras": 5},
  "instalacion": 50000
}'::jsonb),

('vinilo', 'Vinilo Adhesivo', '{
  "precio_m2": 50000,
  "instalacion": 60000,
  "gratis_desde_m2": 3
}'::jsonb),

('acrilio', 'Acrílico sin Faja', '{
  "precio_cm2_acrilico": 17,
  "precio_led_m_perimetro": 12000,
  "margen_ganancia": 0.40
}'::jsonb),

('acrilio_circular', 'Acrílico Circular', '{
  "d40": 180000,
  "d50": 220000,
  "d60": 240000,
  "d70": 280000,
  "d80": 350000
}'::jsonb)
on conflict (tipo) do update set
  nombre     = excluded.nombre,
  parametros = excluded.parametros;


-- ─────────────────────────────────────────────────────────────────────────────
--  8. VISTA: RESUMEN FINANCIERO SEMANAL (para reportes)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_resumen_semanal as
select
  date_trunc('week', p.created_at)::date              as semana_inicio,
  count(distinct p.id)                                as total_pedidos,
  sum(p.precio_total)                                 as ventas_brutas,
  sum(pi_agg.costo_total)                             as costo_fabricacion,
  sum(p.precio_total) - sum(pi_agg.costo_total)       as ganancia_bruta,
  sum(p.abono)                                        as abonos_recibidos
from public.pedidos p
left join lateral (
  select
    pedido_id,
    sum(precio_fabricacion) as costo_total
  from public.pedido_items
  where pedido_id = p.id
  group by pedido_id
) pi_agg on true
where p.estado != 'Pedido realizado'
group by date_trunc('week', p.created_at)
order by semana_inicio desc;

comment on view public.v_resumen_semanal is
  'Resumen financiero agrupado por semana para el panel de reportes.';


-- ─────────────────────────────────────────────────────────────────────────────
--  9. VISTA: PRODUCTOS MÁS VENDIDOS
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.v_productos_top as
select
  pi.tipo,
  pi.tipo_label,
  count(*)                            as cantidad_vendida,
  sum(pi.precio_cliente)              as ingresos_totales,
  sum(pi.precio_fabricacion)          as costos_totales,
  sum(pi.precio_cliente - pi.precio_fabricacion) as ganancia_total,
  round(
    avg((pi.precio_cliente - pi.precio_fabricacion)::numeric / nullif(pi.precio_cliente, 0) * 100), 1
  )                                   as margen_promedio_pct
from public.pedido_items pi
join public.pedidos p on p.id = pi.pedido_id
where p.estado in ('Terminado', 'Entregado')
group by pi.tipo, pi.tipo_label
order by ingresos_totales desc;

comment on view public.v_productos_top is
  'Ranking de productos más vendidos con margen de ganancia.';


-- ────────────────────────────────────────────────────────────────────��────────
--  FIN DEL SCHEMA
-- ─────────────────────────────────────────────────────────────────────────────
