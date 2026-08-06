"""
scraper/loader.py
Normaliza los datos extraídos, deduplica contra lo que ya existe en Supabase
(usando similitud de texto / distancia de Levenshtein) y guarda.
"""

from datetime import date, datetime

from .db import supabase_admin as supabase
from .extractor import find_duplicate_with_ai


def is_expired(deadline_str: str | None) -> bool:
    """
    Determina si una oportunidad ya venció.
    Devuelve True si la fecha límite ya pasó, False si es futura o no hay fecha.
    """
    if not deadline_str:
        return False  # sin fecha no lo consideramos vencido (se maneja aparte)

    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
        return deadline < date.today()
    except (ValueError, TypeError):
        # Si la fecha viene en un formato raro, no la damos por vencida
        return False


def normalize(data: dict, org_id: str, source_url: str, default_type: str) -> dict:
    """
    Convierte el dict crudo de la IA al formato exacto de la tabla 'opportunities'.
    Completa los campos de control (organization_id, source_url, status, type).
    """
    return {
        "title": data.get("title"),
        "type": data.get("type") or default_type,
        "description": data.get("description"),
        "min_age": data.get("min_age"),
        "max_age": data.get("max_age"),
        "required_academic_level": data.get("required_academic_level"),
        "min_academic_average": data.get("min_academic_average"),
        "required_languages": data.get("required_languages"),
        "city": data.get("city"),
        "department": data.get("department"),
        "country": data.get("country") or "Paraguay",
        "modality": data.get("modality"),
        "cost": data.get("cost"),
        "benefits": data.get("benefits"),
        "deadline": data.get("deadline"),
        "organization_id": org_id,
        "source_url": source_url,
        "official_url": source_url,
        "status": "open",
    }


def find_duplicate(title: str, description: str, org_id: str) -> dict | None:
    """
    Busca si ya existe una oportunidad equivalente en la misma organización,
    usando la IA para comparar (más robusto que comparar solo títulos).
    Devuelve la fila existente si la encuentra, o None.
    """
    if not title:
        return None

    # Traemos las oportunidades existentes de la misma organización
    existing = supabase.table("opportunities") \
        .select("id, title, description") \
        .eq("organization_id", org_id) \
        .execute()

    rows = existing.data or []
    if not rows:
        return None

    duplicate_id = find_duplicate_with_ai(title, description, rows)

    if duplicate_id:
        # Buscamos la fila completa correspondiente
        for row in rows:
            if row["id"] == duplicate_id:
                return row

    return None


def save_opportunity(record: dict) -> str:
    """
    Guarda la oportunidad: si ya existe una similar, la actualiza;
    si no, la inserta. Descarta las que ya vencieron.
    Devuelve un texto con el resultado.
    """
    # Regla 1: si la fecha límite ya pasó, no la guardamos.
    if is_expired(record.get("deadline")):
        return f"  Vencida (descartada): {record['title']}"

    duplicate = find_duplicate(record["title"], record.get("description"), record["organization_id"])

    if duplicate:
        supabase.table("opportunities") \
            .update(record) \
            .eq("id", duplicate["id"]) \
            .execute()
        return f"  Actualizada: {record['title']}"
    else:
        supabase.table("opportunities").insert(record).execute()
        return f"  Nueva: {record['title']}"