"""
scraper/extractor.py
Usa gpt-4.1-mini para leer el texto de una página y extraer
múltiples oportunidades en formato JSON estructurado, listos para 'opportunities'.

Este es el núcleo del enfoque "HTML + IA": en vez de selectores rígidos,
la IA interpreta el texto natural y devuelve una lista de datos estructurados.
"""

import json

# Reutilizamos el cliente de OpenAI que ya está configurado en database.py
from database import openai_client
from .config import AI_MODEL


# Esquema que le pedimos a la IA para listas completas de oportunidades.
MULTI_EXTRACTION_PROMPT = """
Sos un extractor de datos para Leady, una plataforma paraguaya que conecta
jóvenes con becas, intercambios, voluntariados y oportunidades de liderazgo.

Te voy a dar el TEXTO de una página web de una organización o portal de becas. Tu tarea es
identificar TODAS las OPORTUNIDADES CONCRETAS Y VIGENTES (becas, intercambios, programas,
convocatorias, voluntariados, talleres) que aparezcan descritas en el texto.

Reglas estrictas:
- Devolvé siempre un objeto JSON con una clave "opportunities" que contenga una LISTA de objetos.
- Si la página menciona 1 sola beca, la lista tendrá 1 objeto. Si menciona 5 becas distintas, tendrá 5 objetos.
- Si el texto es solo informativo/institucional sin ninguna convocatoria concreta, devolvé exactamente: {"opportunities": []}
- NO inventes datos. Si un campo no aparece en el texto, ponelo en null.
- Las fechas en formato YYYY-MM-DD. Si solo hay texto ("diciembre 2026"), interpretá la fecha más probable o null si es ambiguo.
- No exageres ni agregues información que no esté en el texto.

Devolvé SOLO el JSON, sin explicaciones, sin markdown, sin ```.

Estructura del JSON:
{
  "opportunities": [
    {
      "title": "título claro y conciso de la oportunidad",
      "type": "uno de: Beca internacional, Beca, Intercambio, Voluntariado, Programa de liderazgo, Curso, Taller, Otro",
      "description": "resumen de 2-3 oraciones en español, claro y honesto",
      "min_age": número o null,
      "max_age": número o null,
      "required_academic_level": "Secundario / Universitario / Egresado / Todos o null",
      "min_academic_average": número o null,
      "required_languages": ["idioma1", "idioma2"] o null,
      "city": "texto o null",
      "department": "texto o null",
      "country": "texto o null (ej: Paraguay, EE.UU., Alemania, Online)",
      "modality": "Presencial / Virtual / Mixta o null",
      "cost": "texto o null (ej: 'Gratuito', 'Beca cubre 100%')",
      "benefits": "texto o null",
      "deadline": "YYYY-MM-DD o null"
    }
  ]
}

TEXTO DE LA PÁGINA:
---
{page_text}
---
"""


def extract_opportunities_list(page_text: str) -> list[dict]:
    """
    Envía el texto a la IA y devuelve una LISTA de dicts con las oportunidades,
    o una lista vacía [] si no se encontró ninguna o hubo error.
    """
    # Limitamos el texto para no gastar tokens de más (ampliado para listados)
    trimmed = page_text[:8000]

    prompt = MULTI_EXTRACTION_PROMPT.replace("{page_text}", trimmed)

    try:
        response = openai_client.responses.create(
            model=AI_MODEL,
            input=prompt,
        )
        raw = response.output_text.strip()

        # Por si la IA devuelve con backticks a pesar de la instrucción
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lstrip().startswith("json"):
                raw = raw.lstrip()[4:]

        data = json.loads(raw)
        return data.get("opportunities", [])

    except json.JSONDecodeError as e:
        print(f"  La IA no devolvió JSON válido: {e}")
        return []
    except Exception as e:
        print(f"  Error en la extracción múltiple con IA: {e}")
        return []


# ===== EXTRACCIÓN DESDE INSTAGRAM =====

INSTAGRAM_PROMPT = """
Sos un extractor de datos para Leady, plataforma paraguaya de oportunidades juveniles.

Te voy a dar el TEXTO (caption) de una publicación de Instagram de una organización.
La mayoría de los posts NO son convocatorias (son saludos, fotos de eventos, etc.).

Tu tarea:
1. Decidir si el post anuncia una OPORTUNIDAD CONCRETA para jóvenes
   (beca, intercambio, voluntariado, programa, convocatoria, curso, taller).
2. Si NO lo es, devolvé exactamente: {"found": false}
3. Si SÍ lo es, extraé los datos.

Reglas estrictas:
- NO inventes datos. Campo que no aparece = null.
- Fechas en formato YYYY-MM-DD. Si es ambiguo, null.
- Sé conservador: ante la duda de si es una oportunidad real, devolvé {"found": false}.
- Devolvé SOLO el JSON, sin markdown, sin ```.

Estructura cuando SÍ hay oportunidad:
{
  "found": true,
  "title": "título claro y conciso",
  "type": "Beca internacional, Beca, Intercambio, Voluntariado, Programa de liderazgo, Curso, Taller u Otro",
  "description": "resumen de 2-3 oraciones en español, honesto",
  "min_age": número o null,
  "max_age": número o null,
  "required_academic_level": "texto o null",
  "min_academic_average": número o null,
  "required_languages": ["idioma"] o null,
  "city": "texto o null",
  "department": "texto o null",
  "country": "texto o null",
  "modality": "Presencial / Virtual / Mixta o null",
  "cost": "texto o null",
  "benefits": "texto o null",
  "deadline": "YYYY-MM-DD o null"
}

CAPTION DEL POST:
---
{caption}
---
"""


def extract_from_caption(caption: str) -> dict | None:
    """
    Analiza un caption de Instagram. Devuelve los datos de la oportunidad
    si el post es una convocatoria, o None si no lo es.
    """
    if not caption or len(caption.strip()) < 20:
        return None  # captions muy cortos no son convocatorias

    prompt = INSTAGRAM_PROMPT.replace("{caption}", caption[:4000])

    try:
        response = openai_client.responses.create(
            model=AI_MODEL,
            input=prompt,
        )
        raw = response.output_text.strip()

        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lstrip().startswith("json"):
                raw = raw.lstrip()[4:]

        data = json.loads(raw)

        if not data.get("found"):
            return None

        data.pop("found", None)
        return data

    except json.JSONDecodeError:
        return None
    except Exception as e:
        print(f"    Error analizando caption: {e}")
        return None


# ===== DEDUPLICACIÓN CON IA =====

DEDUP_PROMPT = """
Sos un detector de duplicados para Leady.

Te doy una oportunidad NUEVA y una lista de oportunidades EXISTENTES de la
misma organización. Decidí si la nueva es LA MISMA oportunidad que alguna
existente (aunque el título esté redactado distinto).

Dos oportunidades son la MISMA si se refieren a la misma convocatoria/beca/programa
del mismo período, aunque las palabras difieran. Ejemplo: "Beca UWC 2026-2028" y
"Postulación para beca UWC 2026-2028" son la misma.
Pero "Beca UWC Mahindra College" y "Becas UWC East Africa" son DISTINTAS (colegios distintos).

Respondé SOLO con JSON, sin markdown:
- Si es duplicada: {"duplicate_id": "el_id_de_la_existente"}
- Si es nueva/distinta: {"duplicate_id": null}

OPORTUNIDAD NUEVA:
{new_opp}

OPORTUNIDADES EXISTENTES:
{existing_opps}
"""


def find_duplicate_with_ai(new_title: str, new_desc: str, existing: list[dict]) -> str | None:
    """
    Usa la IA para decidir si la oportunidad nueva ya existe entre las 'existing'.
    'existing' es una lista de dicts con 'id', 'title', 'description'.
    Devuelve el id de la duplicada, o None si es nueva.
    """
    if not existing:
        return None

    new_opp = f"Título: {new_title}\nDescripción: {new_desc or ''}"

    existing_text = "\n".join([
        f"- id: {o['id']} | título: {o.get('title', '')} | desc: {(o.get('description') or '')[:120]}"
        for o in existing
    ])

    prompt = DEDUP_PROMPT.replace("{new_opp}", new_opp).replace("{existing_opps}", existing_text)

    try:
        response = openai_client.responses.create(model=AI_MODEL, input=prompt)
        raw = response.output_text.strip()

        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.lstrip().startswith("json"):
                raw = raw.lstrip()[4:]

        data = json.loads(raw)
        return data.get("duplicate_id")
    except Exception as e:
        print(f"    Error en dedup con IA: {e}")
        return None