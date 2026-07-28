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

# --- Google OAuth ---
# Без переменных окружения вход через Google просто не показывается:
# приложение остаётся работоспособным с обычным паролем.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

UPLOAD_DIR = "uploads"

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


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
            return {"authenticated": False, "google_enabled": bool(GOOGLE_CLIENT_ID)}

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

        async with app.state.db.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM organizations WHERE lower(email)=lower($1) OR phone=$1",
                login_value,
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
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=503, detail="Вход через Google не настроен")

        redirect_uri = str(request.base_url).rstrip("/") + "/api/auth/google/callback"
        params = {
            "client_id": GOOGLE_CLIENT_ID,
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

        redirect_uri = str(request.base_url).rstrip("/") + "/api/auth/google/callback"
        async with httpx.AsyncClient(timeout=15) as client:
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
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
        password = data.get("password") or ""

        if not name:
            raise HTTPException(status_code=400, detail="Укажите название организации")
        if not EMAIL_RE.match(email):
            raise HTTPException(status_code=400, detail="Некорректная почта")
        if len(password) < 4:
            raise HTTPException(status_code=400, detail="Пароль короче 4 символов")

        async with app.state.db.acquire() as conn:
            exists = await conn.fetchval(
                "SELECT 1 FROM organizations WHERE lower(email)=lower($1)", email
            )
            if exists:
                raise HTTPException(status_code=409, detail="Такая почта уже зарегистрирована")

            row = await conn.fetchrow("""
                INSERT INTO organizations (name, full_name, phone, email, password_hash, status)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
            """,
                name,
                (data.get("full_name") or "").strip() or None,
                (data.get("phone") or "").strip() or None,
                email,
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

        fields, params, idx = [], [], 1

        for key, column in (("name", "name"), ("full_name", "full_name"),
                            ("phone", "phone"), ("logo", "logo")):
            if key in data:
                fields.append(f"{column}=${idx}")
                params.append((data.get(key) or "").strip() or None)
                idx += 1

        if "email" in data:
            email = (data.get("email") or "").strip()
            if not EMAIL_RE.match(email):
                raise HTTPException(status_code=400, detail="Некорректная почта")
            fields.append(f"email=${idx}")
            params.append(email)
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
