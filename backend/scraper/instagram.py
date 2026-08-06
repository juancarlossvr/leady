"""
scraper/instagram.py
Scraping de Instagram vía Apify + extracción con IA.

Flujo:
  1. Apify baja los últimos posts de cada cuenta
  2. Por cada caption, la IA decide si es convocatoria y extrae datos
  3. Se crea la organización si no existe (Opción 2)
  4. Se normaliza, deduplica y guarda en Supabase
"""

import os
from dotenv import load_dotenv
from apify_client import ApifyClient

from .config import APIFY_ACTOR, POSTS_PER_ACCOUNT, INSTAGRAM_ACCOUNTS
from .extractor import extract_from_caption
from .loader import normalize, save_opportunity
from .db import get_or_create_organization

load_dotenv()

APIFY_TOKEN = os.getenv("APIFY_TOKEN")

if not APIFY_TOKEN:
    raise ValueError("Falta APIFY_TOKEN en el .env")


def fetch_instagram_posts(accounts: list[str]) -> list[dict]:
    """
    Llama al actor de Apify para bajar los posts de las cuentas dadas.
    Devuelve una lista de posts (cada uno con caption, url, ownerUsername, etc.).
    """
    client = ApifyClient(APIFY_TOKEN)

    run_input = {
        "directUrls": [f"https://www.instagram.com/{acc}/" for acc in accounts],
        "resultsType": "posts",
        "resultsLimit": POSTS_PER_ACCOUNT,
        "addParentData": True,  # incluye datos del perfil (nombre, foto)
        # Proxy residencial: clave para que Instagram no bloquee el scraper.
        # Los proxies de datacenter (por defecto) son detectados y baneados.
        "proxy": {
            "useApifyProxy": True,
            "apifyProxyGroups": ["RESIDENTIAL"],
        },
    }

    print(f"  Llamando a Apify para {len(accounts)} cuentas...")
    print("  (esto puede tardar unos minutos, esperá sin cerrar)")

    # call() lanza el actor y espera a que termine.
    # logger=None desactiva el streaming de logs (evita el TimeoutException).
    run = client.actor(APIFY_ACTOR).call(run_input=run_input, logger=None)

    # La versión nueva de apify-client devuelve un objeto Run (pydantic),
    # no un dict: se accede con punto (run.status), no con run["status"].
    # Soportamos ambas formas por las dudas.
    if isinstance(run, dict):
        status = run.get("status")
        dataset_id = run.get("defaultDatasetId")
    else:
        status = getattr(run, "status", None)
        dataset_id = getattr(run, "default_dataset_id", None) or getattr(run, "defaultDatasetId", None)

    print(f"  Estado del run: {status}")

    if str(status) != "SUCCEEDED":
        print("  El actor no terminó correctamente. Revisá el panel de Apify.")
        return []

    posts = list(client.dataset(dataset_id).iterate_items())
    print(f"  Apify devolvió {len(posts)} posts en total.")
    return posts


def run_instagram():
    print("=" * 50)
    print("LEADY — Scraping de Instagram (Apify + IA)")
    print("=" * 50)

    posts = fetch_instagram_posts(INSTAGRAM_ACCOUNTS)

    total_new = 0
    total_updated = 0
    total_expired = 0
    total_analyzed = 0

    for post in posts:
        caption = post.get("caption", "")
        handle = post.get("ownerUsername", "")
        post_url = post.get("url", "")

        if not handle:
            continue

        total_analyzed += 1

        # 1. ¿Es una convocatoria? (la IA filtra)
        data = extract_from_caption(caption)
        if not data:
            continue  # post común, lo ignoramos en silencio

        print(f"\n  Convocatoria detectada en @{handle}")

        # 2. Crear/obtener la organización (Opción 2)
        profile_name = post.get("ownerFullName") or handle
        logo_url = post.get("ownerProfilePicUrl")
        org_id = get_or_create_organization(handle, profile_name, logo_url)

        # 3. Normalizar (usamos el link del post como source_url)
        record = normalize(
            data,
            org_id=org_id,
            source_url=post_url,
            default_type=data.get("type") or "Otro",
        )

        # 4. Guardar con dedup + control de vigencia
        result = save_opportunity(record)
        print(f"  {result}")

        if "Nueva" in result:
            total_new += 1
        elif "Actualizada" in result:
            total_updated += 1
        elif "Vencida" in result:
            total_expired += 1

    print("\n" + "=" * 50)
    print(f"Posts analizados: {total_analyzed}")
    print(f"Nuevas: {total_new} | Actualizadas: {total_updated} | Vencidas descartadas: {total_expired}")
    print("=" * 50)


if __name__ == "__main__":
    run_instagram()