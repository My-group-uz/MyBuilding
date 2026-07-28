"""
Маршруты входа, выхода и администрирования организаций.

Подключается из main.py вызовом register_auth_routes(app).
"""

import os
import re
import shutil
import time
import urllib.parse

from fastapi import HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import RedirectResponse

import auth
import storage

# --- Google OAuth ---
#
# Ключи берутся из переменных окружения, а если их нет — из таблицы
# app_settings, куда их можно вписать прямо в админке. Так настройка
# не требует передеплоя: на Railway правка переменных перезапускает
# контейнер, а это лишний простой ради одной пары строк.
#
# Без ключей кнопка входа через Google просто не показывается,
# приложение остаётся работоспособным с обычным паролем.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")


async def google_credentials(app) -> tuple:
    """Актуальная пара ключей: переменные окружения имеют приоритет."""
    if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
        return GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

    async with app.state.db.acquire() as conn:
        rows = await conn.fetch(
            "SELECT key, value FROM app_settings WHERE key = ANY($1)",
            ["google_client_id", "google_client_secret"],
        )
    values = {r["key"]: r["value"] for r in rows}
    return values.get("google_client_id", ""), values.get("google_client_secret", "")

# Тот же каталог, что у остальных загрузок: Volume на Railway
# либо локальная папка (storage.py)
UPLOAD_DIR = storage.UPLOAD_DIR

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Код страны по умолчанию: подставляется, когда номер введён без него.
DEFAULT_PHONE_CODE = "998"


def normalize_phone(value: str) -> str:
    """Телефон в едином виде +998XXXXXXXXX.

    Один и тот же номер записывают по-разному: «+998 90 123-45-67»,
    «998901234567», «901234567». Логин ищет точное совпадение, поэтому
    и при сохранении, и при входе номер приводится к одной форме —
    иначе организация не войдёт под тем же номером, что завела.

    Номер с другим кодом страны сохраняется как есть: приложением
    пользуются не только из Узбекистана.
    """
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""

    # 9 цифр — местный номер без кода страны
    if len(digits) == 9:
        digits = DEFAULT_PHONE_CODE + digits
    # 8 90 123 45 67 — набор внутри страны, где 8 заменяет код
    elif len(digits) == 10 and digits.startswith("8") and not value.strip().startswith("+"):
        digits = DEFAULT_PHONE_CODE + digits[1:]

    return "+" + digits


def looks_like_phone(value: str) -> bool:
    """Строка похожа на номер, а не на почту или логин суперадминистратора."""
    return bool(value) and "@" not in value and re.fullmatch(r"[\d\s()+\-]+", value) is not None


def _org_public(row) -> dict:
    """Организация без пароля: наружу хеш не отдаём никогда."""
    return {
        "id": row["id"],
        "name": row["name"],
        "full_name": row["full_name"],
        "phone": row["phone"],
        "email": row["email"],
        "logo": row["logo"],
        "status": row["status"],
        "has_google": bool(row["google_sub"]),
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


def _set_session(response: Response, data: dict) -> None:
    response.set_cookie(
        auth.SESSION_COOKIE,
        auth.create_session(data),
        max_age=auth.SESSION_TTL,
        httponly=True,          # недоступна из JS — защита от кражи через XSS
        samesite="lax",         # lax, а не strict: иначе возврат от Google теряет куку
        secure=os.getenv("COOKIE_SECURE", "0") == "1",
        path="/",
    )


def _redirect_uri(request: Request) -> str:
    """Адрес возврата от Google.

    Строится из запроса, а не из настройки: тот же код работает
    и локально, и на Railway. За обратным прокси Railway схема
    приходит http — поэтому на проде принудительно https, иначе
    адрес не совпадёт с зарегистрированным в Google Console.
    """
    base = str(request.base_url).rstrip("/")
    if os.getenv("COOKIE_SECURE") == "1" and base.startswith("http://"):
        base = "https://" + base[len("http://"):]
    return base + "/api/auth/google/callback"


def require_superadmin(request: Request) -> None:
    session = auth.read_session(request.cookies.get(auth.SESSION_COOKIE, ""))
    if not session or session.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Требуются права администратора")


def register_auth_routes(app):

    # -------------------------------------------------------------------
    # Кто я
    # -------------------------------------------------------------------
    @app.get("/api/me")
    async def me(request: Request):
        session = auth.read_session(request.cookies.get(auth.SESSION_COOKIE, ""))
        if not session:
            client_id, secret = await google_credentials(app)
            return {"authenticated": False, "google_enabled": bool(client_id and secret)}

        if session.get("role") == "superadmin":
            return {"authenticated": True, "role": "superadmin", "name": "Администратор"}

        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM organizations WHERE id=$1", session.get("org_id")
            )
        if not row or row["status"] != "active":
            # Организацию заблокировали или удалили уже после входа
            return {"authenticated": False, "reason": "blocked"}

        return {"authenticated": True, "role": "org", "organization": _org_public(row)}

    # -------------------------------------------------------------------
    # Вход по паролю
    # -------------------------------------------------------------------
    @app.post("/api/login")
    async def login(response: Response, data: dict):
        login_value = (data.get("login") or "").strip()
        password = data.get("password") or ""

        if not login_value or not password:
            raise HTTPException(status_code=400, detail="Введите логин и пароль")

        # Суперадминистратор проверяется первым: его учётной записи
        # нет в таблице организаций.
        if (login_value == auth.SUPERADMIN_LOGIN
                and password == auth.SUPERADMIN_PASSWORD):
            _set_session(response, {"role": "superadmin"})
            return {"role": "superadmin", "redirect": "/frontend/admin.html"}

        # Введённый номер приводится к тому же виду, в каком хранится,
        # поэтому «+998 90 123 45 67» и «901234567» — один и тот же логин.
        phone = normalize_phone(login_value) if looks_like_phone(login_value) else ""

        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                """
                SELECT * FROM organizations
                WHERE (email IS NOT NULL AND lower(email)=lower($1))
                   OR ($2 <> '' AND phone=$2)
                """,
                login_value, phone,
            )

        if not row or not auth.verify_password(password, row["password_hash"] or ""):
            # Одно и то же сообщение для «нет такой почты» и «неверный
            # пароль»: иначе форма подсказывает, какие адреса заведены.
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")

        if row["status"] != "active":
            raise HTTPException(status_code=403, detail="Организация заблокирована")

        _set_session(response, {"role": "org", "org_id": row["id"]})
        return {"role": "org", "redirect": "/frontend/index.html"}

    @app.post("/api/logout")
    async def logout(response: Response):
        response.delete_cookie(auth.SESSION_COOKIE, path="/")
        return {"status": "ok"}

    # -------------------------------------------------------------------
    # Вход через Google
    # -------------------------------------------------------------------
    @app.get("/api/auth/google")
    async def google_start(request: Request):
        client_id, _ = await google_credentials(app)
        if not client_id:
            raise HTTPException(status_code=503, detail="Вход через Google не настроен")

        redirect_uri = _redirect_uri(request)
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "online",
            "prompt": "select_account",
        }
        url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)
        return RedirectResponse(url)

    @app.get("/api/auth/google/callback")
    async def google_callback(request: Request, code: str = "", error: str = ""):
        if error or not code:
            return RedirectResponse("/frontend/login.html?error=google")

        import httpx

        client_id, client_secret = await google_credentials(app)
        redirect_uri = _redirect_uri(request)

        async with httpx.AsyncClient(timeout=15) as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
            if token_res.status_code != 200:
                return RedirectResponse("/frontend/login.html?error=google")

            access_token = token_res.json().get("access_token")
            info_res = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            if info_res.status_code != 200:
                return RedirectResponse("/frontend/login.html?error=google")
            profile = info_res.json()

        email = (profile.get("email") or "").strip()
        google_sub = profile.get("sub")
        if not email:
            return RedirectResponse("/frontend/login.html?error=google")

        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM organizations WHERE google_sub=$1 OR lower(email)=lower($2)",
                google_sub, email,
            )
            # Организации заводит только администратор. Самостоятельная
            # регистрация через Google создавала бы арендаторов в обход него.
            if not row:
                return RedirectResponse("/frontend/login.html?error=unknown_account")

            if row["status"] != "active":
                return RedirectResponse("/frontend/login.html?error=blocked")

            # Привязываем аккаунт при первом входе, чтобы смена почты
            # в организации не отвязала Google
            if not row["google_sub"]:
                await conn.execute(
                    "UPDATE organizations SET google_sub=$1 WHERE id=$2", google_sub, row["id"]
                )

        response = RedirectResponse("/frontend/index.html")
        _set_session(response, {"role": "org", "org_id": row["id"]})
        return response

    # -------------------------------------------------------------------
    # Администрирование организаций (только суперадминистратор)
    # -------------------------------------------------------------------
    @app.get("/api/admin/organizations")
    async def list_orgs(request: Request):
        require_superadmin(request)
        async with app.state.db.acquire() as conn:
            rows = await conn.fetch("""
                SELECT o.*, (
                    SELECT count(*) FROM objects WHERE organization_id = o.id
                ) AS objects_count
                FROM organizations o ORDER BY o.id
            """)
        return [dict(_org_public(r), objects_count=r["objects_count"]) for r in rows]

    @app.post("/api/admin/organizations")
    async def create_org(request: Request, data: dict):
        require_superadmin(request)

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip()
        phone = normalize_phone(data.get("phone") or "")
        password = data.get("password") or ""

        if not name:
            raise HTTPException(status_code=400, detail="Укажите название организации")
        # Логином служит почта или телефон, поэтому обязательно не
        # конкретное поле, а наличие хотя бы одного: без них организация
        # не сможет войти.
        if not email and not phone:
            raise HTTPException(
                status_code=400, detail="Укажите почту или телефон — это логин для входа"
            )
        if email and not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Некорректная почта")
        if len(password) < 4:
            raise HTTPException(status_code=400, detail="Пароль короче 4 символов")

        async with app.state.db.acquire() as conn:
            if email and await conn.fetchval(
                "SELECT 1 FROM organizations WHERE lower(email)=lower($1)", email
            ):
                raise HTTPException(status_code=409, detail="Такая почта уже зарегистрирована")
            if phone and await conn.fetchval(
                "SELECT 1 FROM organizations WHERE phone=$1", phone
            ):
                raise HTTPException(status_code=409, detail="Такой телефон уже зарегистрирован")

            row = await conn.fetchrow("""
                INSERT INTO organizations (name, full_name, phone, email, password_hash, status)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
            """,
                name,
                (data.get("full_name") or "").strip() or None,
                phone or None,
                email or None,
                auth.hash_password(password),
                data.get("status") if data.get("status") in ("active", "blocked") else "active",
            )

            # Первая организация забирает объекты, созданные до
            # появления мультиарендности — иначе они остались бы ничьими.
            await conn.execute(
                "UPDATE objects SET organization_id=$1 WHERE organization_id IS NULL", row["id"]
            )

        return _org_public(row)

    @app.put("/api/admin/organizations/{org_id}")
    async def update_org(org_id: int, request: Request, data: dict):
        require_superadmin(request)

        async with app.state.db.acquire() as conn:
            current = await conn.fetchrow(
                "SELECT email, phone FROM organizations WHERE id=$1", org_id
            )
        if not current:
            raise HTTPException(status_code=404, detail="Организация не найдена")

        fields, params, idx = [], [], 1

        for key, column in (("name", "name"), ("full_name", "full_name"),
                            ("logo", "logo")):
            if key in data:
                fields.append(f"{column}=${idx}")
                params.append((data.get(key) or "").strip() or None)
                idx += 1

        email = (data.get("email") or "").strip() if "email" in data else current["email"]
        phone = (normalize_phone(data.get("phone") or "")
                 if "phone" in data else current["phone"])

        # Стереть оба поля нельзя: организация лишилась бы логина
        if not email and not phone:
            raise HTTPException(
                status_code=400, detail="Оставьте почту или телефон — это логин для входа"
            )

        if "email" in data:
            if email and not EMAIL_RE.match(email):
                raise HTTPException(status_code=400, detail="Некорректная почта")
            if email:
                async with app.state.db.acquire() as conn:
                    taken = await conn.fetchval(
                        "SELECT 1 FROM organizations WHERE lower(email)=lower($1) AND id<>$2",
                        email, org_id,
                    )
                if taken:
                    raise HTTPException(status_code=409, detail="Такая почта уже зарегистрирована")
            fields.append(f"email=${idx}")
            params.append(email or None)
            idx += 1

        if "phone" in data:
            if phone:
                async with app.state.db.acquire() as conn:
                    taken = await conn.fetchval(
                        "SELECT 1 FROM organizations WHERE phone=$1 AND id<>$2", phone, org_id
                    )
                if taken:
                    raise HTTPException(status_code=409, detail="Такой телефон уже зарегистрирован")
            fields.append(f"phone=${idx}")
            params.append(phone or None)
            idx += 1

        if "status" in data:
            if data["status"] not in ("active", "blocked"):
                raise HTTPException(status_code=400, detail="Неизвестный статус")
            fields.append(f"status=${idx}")
            params.append(data["status"])
            idx += 1

        # Пустой пароль означает «не менять», а не «стереть»
        if data.get("password"):
            if len(data["password"]) < 4:
                raise HTTPException(status_code=400, detail="Пароль короче 4 символов")
            fields.append(f"password_hash=${idx}")
            params.append(auth.hash_password(data["password"]))
            idx += 1

        if not fields:
            raise HTTPException(status_code=400, detail="Нет полей для обновления")

        fields.append("updated_at=now()")
        params.append(org_id)

        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                f"UPDATE organizations SET {','.join(fields)} WHERE id=${idx} RETURNING *",
                *params,
            )
        if not row:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        return _org_public(row)

    @app.delete("/api/admin/organizations/{org_id}")
    async def delete_org(org_id: int, request: Request):
        require_superadmin(request)
        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                "DELETE FROM organizations WHERE id=$1 RETURNING id", org_id
            )
        if not row:
            raise HTTPException(status_code=404, detail="Организация не найдена")
        return {"status": "deleted"}

    # -------------------------------------------------------------------
    # Настройка входа через Google из админки
    # -------------------------------------------------------------------
    @app.get("/api/admin/google")
    async def get_google_settings(request: Request):
        require_superadmin(request)
        client_id, secret = await google_credentials(app)

        return {
            # Секрет наружу не отдаём — только факт, что он задан
            "client_id": client_id,
            "secret_set": bool(secret),
            "configured": bool(client_id and secret),
            # Из переменных окружения ключи не переопределить через API
            "locked_by_env": bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET),
            # Готовый адрес для вставки в Google Console
            "redirect_uri": _redirect_uri(request),
        }

    @app.put("/api/admin/google")
    async def set_google_settings(request: Request, data: dict):
        require_superadmin(request)

        if GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET:
            raise HTTPException(
                status_code=409,
                detail="Ключи заданы переменными окружения — правьте их на хостинге",
            )

        client_id = (data.get("client_id") or "").strip()
        secret = (data.get("client_secret") or "").strip()

        async with app.state.db.acquire() as conn:
            async with conn.transaction():
                await conn.execute("""
                    INSERT INTO app_settings (key, value, updated_at)
                    VALUES ('google_client_id', $1, now())
                    ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()
                """, client_id or None)

                # Пустое поле секрета означает «не менять»: он не
                # показывается в форме, и стирать его при каждом
                # сохранении названия было бы неожиданно.
                if secret:
                    await conn.execute("""
                        INSERT INTO app_settings (key, value, updated_at)
                        VALUES ('google_client_secret', $1, now())
                        ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=now()
                    """, secret)
                elif not client_id:
                    # Очистили Client ID — убираем и секрет
                    await conn.execute(
                        "DELETE FROM app_settings WHERE key='google_client_secret'"
                    )

        new_id, new_secret = await google_credentials(app)
        return {"configured": bool(new_id and new_secret)}

    @app.post("/api/admin/organizations/{org_id}/logo")
    async def upload_logo(org_id: int, request: Request, logo: UploadFile = File(...)):
        require_superadmin(request)

        os.makedirs(UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(logo.filename or "")[1].lower() or ".png"
        if ext not in (".png", ".jpg", ".jpeg", ".webp", ".svg"):
            raise HTTPException(status_code=400, detail="Поддерживаются png, jpg, webp, svg")

        filename = f"logo_{org_id}_{int(time.time() * 1000)}{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as f:
            shutil.copyfileobj(logo.file, f)

        url = f"/uploads/{filename}"
        async with app.state.db.acquire() as conn:
            await conn.execute(
                "UPDATE organizations SET logo=$1, updated_at=now() WHERE id=$2", url, org_id
            )
        return {"logo": url}
