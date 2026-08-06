"""
scraper/run.py
Orquestador del scraping web de Leady con soporte para multi-extracción por página.

Ejecutar desde la carpeta backend/ con:
    python -m scraper.run

Proceso por cada fuente:
  1. Baja el texto limpio de la página (fetcher)
  2. La IA extrae TODAS las oportunidades en una lista JSON (extractor)
  3. Se normaliza y deduplica cada una (loader)
  4. Se guarda en Supabase
"""

from .config import WEB_SOURCES
from .fetcher import fetch_clean_text
from .extractor import extract_opportunities_list
from .loader import normalize, save_opportunity


def run():
    print("=" * 50)
    print("LEADY — Motor de scraping web multi-convocatoria")
    print("=" * 50)

    total_new = 0
    total_updated = 0
    total_skipped = 0
    total_found = 0

    for source in WEB_SOURCES:
        print(f"\nFuente: {source['name']}")
        print(f"  URL: {source['url']}")

        # 1. Bajar el texto limpio
        text = fetch_clean_text(source["url"])
        if not text:
            print("  No se pudo obtener el contenido. Salteando.")
            total_skipped += 1
            continue

        # 2. Extraer TODAS las oportunidades de la página con IA
        print("  🧠 Analizando texto con GPT para detectar convocatorias...")
        opps_list = extract_opportunities_list(text)
        
        if not opps_list:
            print("  La IA no encontró convocatorias vigentes en esta página.")
            total_skipped += 1
            continue

        print(f"  ✨ ¡Se detectaron {len(opps_list)} convocatorias en esta página!")
        total_found += len(opps_list)

        # 3. Normalizar y guardar cada una en un bucle
        for data in opps_list:
            record = normalize(
                data,
                org_id=source["org_id"],
                source_url=source["url"],
                default_type=source["default_type"],
            )

            # 4. Guardar (con dedup + control de vigencia)
            result = save_opportunity(record)
            print(result)

            if "Nueva" in result:
                total_new += 1
            elif "Actualizada" in result:
                total_updated += 1

    print("\n" + "=" * 50)
    print("RESUMEN FINAL DE SCRAPING WEB")
    print(f"Detectadas por IA:  {total_found}")
    print(f"Nuevas en BD:       {total_new}")
    print(f"Actualizadas:       {total_updated}")
    print(f"Salteadas/Vencidas: {total_skipped}")
    print("=" * 50)


if __name__ == "__main__":
    run()