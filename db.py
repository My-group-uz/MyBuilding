"""
Схема базы данных и её миграции.

Раньше весь DDL лежал внутри main.py в обработчике startup — 100 строк,
перемешанных с бизнес-логикой. Здесь он собран в одном месте, и любое
изменение структуры видно в диффе одного файла.

Все операции идемпотентны (IF NOT EXISTS), поэтому функция безопасно
выполняется при каждом запуске приложения.
"""

import os

import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL")


# ---------------------------------------------------------------------------
# Таблицы
# ---------------------------------------------------------------------------

TABLES = [
    # --- Организации (арендаторы) ---
    # Каждая видит только свои объекты. Изоляция обеспечивается
    # колонкой objects.organization_id и проверкой в middleware.
    """
    CREATE TABLE IF NOT EXISTS organizations (
        id            SERIAL PRIMARY KEY,
        name          TEXT NOT NULL,
        full_name     TEXT,
        phone         TEXT,
        email         TEXT,
        password_hash TEXT,
        logo          TEXT,
        status        TEXT NOT NULL DEFAULT 'active',
        google_sub    TEXT,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Объекты ---
    """
    CREATE TABLE IF NOT EXISTS objects (
        id             SERIAL PRIMARY KEY,
        organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
        name           TEXT NOT NULL,
        customer       TEXT,
        customer_phone TEXT,
        address        TEXT,
        start_date     DATE,
        end_date       DATE,
        area           NUMERIC(15,3) NOT NULL DEFAULT 0,
        contract_sum   NUMERIC(15,2) NOT NULL DEFAULT 0,
        created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Приход ---
    """
    CREATE TABLE IF NOT EXISTS incomes (
        id          SERIAL PRIMARY KEY,
        object_id   INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        date        DATE,
        photo       TEXT,
        amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
        sender      TEXT,
        receiver    TEXT,
        comment     TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Бюджет: этапы ---
    """
    CREATE TABLE IF NOT EXISTS budget_stages (
        id          SERIAL PRIMARY KEY,
        object_id   INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        order_index INTEGER NOT NULL DEFAULT 0,
        collapsed   BOOLEAN NOT NULL DEFAULT FALSE
    );
    """,

    # --- Бюджет: виды работ ---
    """
    CREATE TABLE IF NOT EXISTS budget_work_types (
        id          SERIAL PRIMARY KEY,
        stage_id    INTEGER NOT NULL REFERENCES budget_stages(id) ON DELETE CASCADE,
        name        TEXT NOT NULL,
        unit        TEXT NOT NULL DEFAULT 'шт',
        quantity    NUMERIC(15,3) NOT NULL DEFAULT 0,
        order_index INTEGER NOT NULL DEFAULT 0,
        collapsed   BOOLEAN NOT NULL DEFAULT FALSE
    );
    """,

    # --- Бюджет: ресурсы ---
    """
    CREATE TABLE IF NOT EXISTS budget_resources (
        id            SERIAL PRIMARY KEY,
        work_type_id  INTEGER NOT NULL REFERENCES budget_work_types(id) ON DELETE CASCADE,
        photo         TEXT,
        resource_type TEXT NOT NULL,
        name          TEXT NOT NULL,
        unit          TEXT NOT NULL DEFAULT 'шт',
        quantity      NUMERIC(15,3) NOT NULL DEFAULT 0,
        price         NUMERIC(15,2) NOT NULL DEFAULT 0,
        supplier      TEXT,
        order_index   INTEGER NOT NULL DEFAULT 0
    );
    """,

    # --- Расход: факт по ресурсам ---
    """
    CREATE TABLE IF NOT EXISTS resource_expenses (
        id              SERIAL PRIMARY KEY,
        resource_id     INTEGER NOT NULL REFERENCES budget_resources(id) ON DELETE CASCADE,
        date            DATE NOT NULL,
        actual_quantity NUMERIC(15,3) NOT NULL,
        actual_price    NUMERIC(15,2) NOT NULL,
        receipt_photo_1 TEXT,
        receipt_photo_2 TEXT,
        receipt_photo_3 TEXT,
        comment         TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Фото раздела «Анализ» ---
    """
    CREATE TABLE IF NOT EXISTS object_analysis_photos (
        id         SERIAL PRIMARY KEY,
        object_id  INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        file_path  TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Настройки приложения ---
    # Ключи Google OAuth, задаваемые из админки. Переменные окружения
    # имеют приоритет, но их правка на Railway перезапускает контейнер —
    # ради одной пары строк это лишний простой.
    """
    CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,

    # --- Токены публичных ссылок ---
    """
    CREATE TABLE IF NOT EXISTS share_tokens (
        id         SERIAL PRIMARY KEY,
        object_id  INTEGER NOT NULL REFERENCES objects(id) ON DELETE CASCADE,
        token      TEXT UNIQUE NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    """,
]


# ---------------------------------------------------------------------------
# Миграции существующих баз
#
# CREATE TABLE IF NOT EXISTS ничего не делает с уже созданной таблицей,
# поэтому новые колонки и ужесточения добавляются отдельно.
# ---------------------------------------------------------------------------

MIGRATIONS = [
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS start_date DATE;",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS end_date DATE;",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS area NUMERIC(15,3) DEFAULT 0;",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();",
    "ALTER TABLE incomes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();",
    # Карточка заказчика и адрес объекта — выводятся рядом с рендером
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS customer TEXT;",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS customer_phone TEXT;",
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS address TEXT;",
    # Сумма договора с заказчиком — база для сравнения с бюджетом
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS contract_sum NUMERIC(15,2) NOT NULL DEFAULT 0;",

    # Мультиарендность. Колонка namely NULLABLE: объекты, заведённые
    # до появления организаций, иначе не прошли бы миграцию. Они
    # достаются первой организации в init_schema.
    "ALTER TABLE objects ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_sub TEXT;",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo TEXT;",

    # Логином служит и почта, и телефон, поэтому обязательна не почта,
    # а наличие хотя бы одного из них — это проверяет приложение.
    "ALTER TABLE organizations ALTER COLUMN email DROP NOT NULL;",
    # Пустая строка вместо NULL сломала бы уникальный индекс: два таких
    # значения равны между собой, а два NULL — нет.
    "UPDATE organizations SET email=NULL WHERE email='';",
]


# ---------------------------------------------------------------------------
# Индексы
#
# PostgreSQL создаёт индекс для PRIMARY KEY и UNIQUE, но НЕ для внешних
# ключей. А приложение почти всегда выбирает записи именно по родителю
# (все ресурсы вида работ, все этапы объекта) — без этих индексов каждый
# такой запрос читает таблицу целиком, и дерево бюджета замедляется
# тем сильнее, чем больше объектов заведено.
#
# Составные индексы включают order_index: он есть в ORDER BY этих же
# запросов, поэтому сортировка берётся готовой из индекса.
# ---------------------------------------------------------------------------

INDEXES = [
    # Список объектов всегда фильтруется по организации
    "CREATE INDEX IF NOT EXISTS idx_objects_org ON objects (organization_id, id);",
    # Вход по почте и через Google — оба ищут по одному значению
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_org_email ON organizations (lower(email));",
    # Телефон — такой же логин, как почта, и должен быть уникален.
    # Частичный индекс: организаций без телефона может быть сколько угодно.
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_org_phone ON organizations (phone) WHERE phone IS NOT NULL;",
    "CREATE INDEX IF NOT EXISTS idx_org_google ON organizations (google_sub);",

    "CREATE INDEX IF NOT EXISTS idx_incomes_object ON incomes (object_id, date);",
    "CREATE INDEX IF NOT EXISTS idx_stages_object ON budget_stages (object_id, order_index);",
    "CREATE INDEX IF NOT EXISTS idx_work_types_stage ON budget_work_types (stage_id, order_index);",
    "CREATE INDEX IF NOT EXISTS idx_resources_work_type ON budget_resources (work_type_id, order_index);",
    "CREATE INDEX IF NOT EXISTS idx_expenses_resource ON resource_expenses (resource_id, date);",
    "CREATE INDEX IF NOT EXISTS idx_analysis_photos_object ON object_analysis_photos (object_id);",
    "CREATE INDEX IF NOT EXISTS idx_share_tokens_object ON share_tokens (object_id);",
]


# ---------------------------------------------------------------------------
# Ограничения целостности
#
# Отрицательные количество и цена — всегда ошибка ввода, а не данные.
# Ловим их на уровне БД: иначе одна такая строка молча искажает итоги
# по объекту, и найти её потом сложно.
#
# ADD CONSTRAINT не поддерживает IF NOT EXISTS, поэтому каждое
# оборачивается в блок с перехватом duplicate_object.
# ---------------------------------------------------------------------------

CONSTRAINTS = [
    ("budget_resources", "chk_resources_qty", "quantity >= 0"),
    ("budget_resources", "chk_resources_price", "price >= 0"),
    ("budget_work_types", "chk_work_types_qty", "quantity >= 0"),
    ("resource_expenses", "chk_expenses_qty", "actual_quantity >= 0"),
    ("resource_expenses", "chk_expenses_price", "actual_price >= 0"),
    ("objects", "chk_objects_area", "area >= 0"),
    ("objects", "chk_objects_contract", "contract_sum >= 0"),
]


def _constraint_sql(table: str, name: str, check: str) -> str:
    return f"""
    DO $$
    BEGIN
        ALTER TABLE {table} ADD CONSTRAINT {name} CHECK ({check});
    EXCEPTION
        WHEN duplicate_object THEN NULL;
        -- Если в базе уже есть строки, нарушающие правило, ограничение
        -- не навешивается. Данные важнее: приложение должно подняться.
        WHEN check_violation THEN NULL;
    END $$;
    """


async def create_pool() -> asyncpg.Pool:
    """Пул соединений. min_size держит соединения тёплыми: на бесплатных
    хостингах установка TCP+TLS к базе заметно дороже самого запроса."""
    if not DATABASE_URL:
        raise RuntimeError(
            "Не задана переменная окружения DATABASE_URL. "
            "Пример: postgresql://postgres:пароль@127.0.0.1:5432/mybuilding"
        )
    return await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=10)


async def init_schema(pool: asyncpg.Pool) -> None:
    """Создаёт таблицы, применяет миграции, индексы и ограничения."""
    async with pool.acquire() as conn:
        for ddl in TABLES:
            await conn.execute(ddl)

        for sql in MIGRATIONS:
            await conn.execute(sql)

        for sql in INDEXES:
            await conn.execute(sql)

        for table, name, check in CONSTRAINTS:
            await conn.execute(_constraint_sql(table, name, check))

        await _adopt_orphan_objects(conn)


async def _adopt_orphan_objects(conn) -> None:
    """Объекты, созданные до мультиарендности, не имеют организации и
    были бы не видны никому. Отдаём их первой организации в базе;
    если организаций ещё нет — оставляем как есть, они подхватятся
    после создания первой."""
    orphans = await conn.fetchval(
        "SELECT count(*) FROM objects WHERE organization_id IS NULL"
    )
    if not orphans:
        return

    first_org = await conn.fetchval("SELECT id FROM organizations ORDER BY id LIMIT 1")
    if not first_org:
        return

    await conn.execute(
        "UPDATE objects SET organization_id=$1 WHERE organization_id IS NULL", first_org
    )
    print(f"Объектов без организации перенесено в организацию {first_org}: {orphans}")
