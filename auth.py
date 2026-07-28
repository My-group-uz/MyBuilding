"""
Аутентификация и мультиарендность.

Здесь три вещи:
  1. Хеширование паролей — PBKDF2 из стандартной библиотеки, без
     внешних зависимостей (bcrypt тянул бы за собой компиляцию).
  2. Сессии — подписанная кука. Своё состояние на сервере не храним:
     Railway перезапускает контейнер при каждом деплое, и сессии
     в памяти отваливались бы вместе с ним.
  3. Разрешение владельца — по любому идентификатору из пути
     определяем организацию, которой принадлежат данные.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

# Ключ подписи кук. В проде обязателен свой: без него после
# перезапуска все сессии станут недействительными.
SECRET_KEY = os.getenv("SECRET_KEY") or secrets.token_hex(32)

# Учётные данные суперадминистратора. Значения по умолчанию рабочие,
# но на проде их следует переопределить переменными окружения.
SUPERADMIN_LOGIN = os.getenv("SUPERADMIN_LOGIN", "994067406")
SUPERADMIN_PASSWORD = os.getenv("SUPERADMIN_PASSWORD", "7406")

SESSION_COOKIE = "mb_session"
SESSION_TTL = 60 * 60 * 24 * 30  # 30 дней

PBKDF2_ROUNDS = 200_000


# ---------------------------------------------------------------------------
# Пароли
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Возвращает строку вида pbkdf2$rounds$salt$hash."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ROUNDS)
    return "pbkdf2${}${}${}".format(
        PBKDF2_ROUNDS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str) -> bool:
    if not stored:
        return False
    try:
        algo, rounds, salt_b64, hash_b64 = stored.split("$")
        if algo != "pbkdf2":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), base64.b64decode(salt_b64), int(rounds)
        )
        # compare_digest, а не ==: обычное сравнение выходит раньше на
        # первом несовпавшем байте и выдаёт длину общего префикса.
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Сессии
# ---------------------------------------------------------------------------

def _sign(payload: bytes) -> str:
    return base64.urlsafe_b64encode(
        hmac.new(SECRET_KEY.encode(), payload, hashlib.sha256).digest()
    ).decode().rstrip("=")


def create_session(data: dict) -> str:
    body = dict(data)
    body["exp"] = int(time.time()) + SESSION_TTL
    payload = base64.urlsafe_b64encode(json.dumps(body).encode()).decode().rstrip("=")
    return f"{payload}.{_sign(payload.encode())}"


def read_session(token: str):
    """Возвращает содержимое сессии либо None, если подпись не сходится
    или срок истёк."""
    if not token or "." not in token:
        return None
    payload, signature = token.rsplit(".", 1)

    if not hmac.compare_digest(signature, _sign(payload.encode())):
        return None

    try:
        padded = payload + "=" * (-len(payload) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded))
    except Exception:
        return None

    if data.get("exp", 0) < time.time():
        return None
    return data


# ---------------------------------------------------------------------------
# Разрешение владельца данных
#
# Часть маршрутов вложена в объект (/objects/{id}/...), часть обращается
# к сущностям напрямую (/budget/resources/{id}). Чтобы не проверять
# доступ в каждом обработчике, определяем организацию-владельца по
# любому из этих идентификаторов одним запросом.
# ---------------------------------------------------------------------------

OWNER_QUERIES = {
    "object": "SELECT organization_id FROM objects WHERE id=$1",
    "stage": """
        SELECT o.organization_id FROM budget_stages s
        JOIN objects o ON o.id = s.object_id WHERE s.id=$1
    """,
    "work_type": """
        SELECT o.organization_id FROM budget_work_types wt
        JOIN budget_stages s ON s.id = wt.stage_id
        JOIN objects o ON o.id = s.object_id WHERE wt.id=$1
    """,
    "resource": """
        SELECT o.organization_id FROM budget_resources r
        JOIN budget_work_types wt ON wt.id = r.work_type_id
        JOIN budget_stages s ON s.id = wt.stage_id
        JOIN objects o ON o.id = s.object_id WHERE r.id=$1
    """,
    "expense": """
        SELECT o.organization_id FROM resource_expenses e
        JOIN budget_resources r ON r.id = e.resource_id
        JOIN budget_work_types wt ON wt.id = r.work_type_id
        JOIN budget_stages s ON s.id = wt.stage_id
        JOIN objects o ON o.id = s.object_id WHERE e.id=$1
    """,
}


async def owner_org_id(pool, kind: str, entity_id: int):
    """Организация-владелец сущности. None — сущности нет."""
    query = OWNER_QUERIES.get(kind)
    if not query:
        return None
    async with pool.acquire() as conn:
        return await conn.fetchval(query, entity_id)
