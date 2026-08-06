"""
admin_auth.py
Verificación de identidad y rol para el panel de administración.

Verifica el token haciendo una llamada directa al endpoint de Supabase
que valida usuarios. Funciona con cualquier tipo de firma (HS256, ES256, RS256)
porque es Supabase quien valida, no nosotros.
"""

import os
import requests
from fastapi import Header, HTTPException
from dotenv import load_dotenv

from database import supabase
# Cliente con service_role para consultar el rol saltándose RLS
from scraper.db import supabase_admin

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")  # anon key


def get_current_user(authorization: str = Header(None)) -> dict:
    """
    Verifica el token consultando el endpoint /auth/v1/user de Supabase.
    Devuelve los datos del usuario. Lanza 401 si el token falta o es inválido.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de autenticación.")

    token = authorization.split(" ")[1]

    try:
        # Llamada directa al endpoint de Supabase que valida el token.
        # Timeout de 10s para no colgarnos indefinidamente.
        resp = requests.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": SUPABASE_KEY,
            },
            timeout=10,
        )

        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Token inválido o expirado.")

        user = resp.json()
        return {"sub": user.get("id"), "email": user.get("email")}

    except HTTPException:
        raise
    except requests.RequestException as e:
        print(f"ERROR verificando token: {type(e).__name__}: {e}")
        raise HTTPException(status_code=401, detail="No se pudo verificar la sesión.")


def require_owner(authorization: str = Header(None)) -> dict:
    """
    Dependencia para endpoints de admin: verifica que el usuario sea 'owner'.
    Se usa así en un endpoint:  user = Depends(require_owner)
    Lanza 403 si no es owner.
    """
    user = get_current_user(authorization)
    user_id = user.get("sub")

    # Consultamos el rol con el cliente admin (service_role) para saltarnos RLS.
    # Con la anon key, RLS podría ocultar el perfil y devolver 0 filas.
    result = supabase_admin.table("users_profiles") \
        .select("role") \
        .eq("id", user_id) \
        .execute()

    rows = result.data or []
    role = rows[0].get("role") if rows else None

    if role != "owner":
        raise HTTPException(status_code=403, detail="No tenés permisos de administrador.")

    return user