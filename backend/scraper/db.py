"""
scraper/db.py
Cliente de Supabase para el scraper, usando la SERVICE_ROLE key.
Incluye reintentos automáticos para resistir microcortes de red (WinError 10054).

¿Por qué un cliente aparte?
- El frontend y la API usan la ANON key, que respeta Row Level Security (RLS).
  Eso es seguro: protege la base de escrituras no autorizadas desde el navegador.
- El scraper es un script de confianza que corre del lado del servidor,
  y necesita INSERTAR oportunidades. Para eso usa la service_role key,
  que tiene permisos completos y se salta RLS.

IMPORTANTE: la service_role key es SECRETA. Vive solo en el .env,
nunca en el código ni en el frontend.
"""

import os
import time
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError(
        "Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env. "
        "La service_role key la sacás de Supabase: Settings > API > service_role."
    )

# Cliente con permisos completos, solo para uso del scraper
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def execute_with_retry(query, retries=3, delay=2):
    """
    Ejecuta una consulta de Supabase con reintentos automáticos en caso de cortes de red.
    """
    for attempt in range(1, retries + 1):
        try:
            return query.execute()
        except (httpx.ConnectError, httpx.HTTPError, Exception) as e:
            if attempt == retries:
                print(f"❌ Error definitivo de conexión con Supabase tras {retries} intentos: {e}")
                raise e
            print(f"  ⚠️ Microcorte de red detectado. Reintentando conexión ({attempt}/{retries})...")
            time.sleep(delay)


def get_or_create_organization(instagram_handle: str, profile_name: str = None,
                                logo_url: str = None) -> str:
    """
    Busca una organización por su cuenta de Instagram. Si no existe, la crea
    automáticamente (Opción 2: el sistema da de alta orgs al descubrirlas).

    Devuelve el organization_id (UUID).
    """
    instagram_url = f"https://www.instagram.com/{instagram_handle}/"

    # 1. ¿Ya existe una org con este Instagram?
    query_select = supabase_admin.table("organizations") \
        .select("id") \
        .eq("instagram_url", instagram_url)
    
    # Usamos nuestra función con reintentos en lugar de .execute() directo
    existing = execute_with_retry(query_select)

    if existing.data:
        return existing.data[0]["id"]

    # 2. No existe: la creamos con los datos que tengamos del perfil
    new_org = {
        "name": profile_name or instagram_handle,
        "instagram_url": instagram_url,
        "logo_url": logo_url,
        "country": "Paraguay",
    }

    query_insert = supabase_admin.table("organizations").insert(new_org)
    
    # Usamos nuestra función con reintentos en lugar de .execute() directo
    created = execute_with_retry(query_insert)
    
    print(f"    + Organización creada: {new_org['name']} (@{instagram_handle})")
    return created.data[0]["id"]