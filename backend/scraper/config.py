"""
scraper/config.py
Configuración central del motor de scraping de Leady.
Define las fuentes web a monitorear y constantes globales.
"""

# User-Agent honesto: nos identificamos como el bot de Leady.
# Buena práctica ética: no nos hacemos pasar por un navegador humano.
USER_AGENT = "LeadyBot/1.0 (+[https://leady.py](https://leady.py); proyecto educativo)"

# Tiempo de espera entre peticiones a un mismo dominio (segundos).
# Evita sobrecargar los servidores de las organizaciones.
REQUEST_DELAY = 3

# Timeout para cada petición HTTP (segundos)
REQUEST_TIMEOUT = 20

# Umbral de similitud (0-100) para considerar dos oportunidades como duplicadas.
# Si dos títulos se parecen más que esto, se consideran la misma.
DEDUP_THRESHOLD = 85

# Modelo de IA para extraer datos estructurados del texto
AI_MODEL = "gpt-4.1-mini"

# ===== INSTAGRAM (Apify) =====
# Actor oficial de Apify para scrapear Instagram
APIFY_ACTOR = "apify/instagram-scraper"

# Cuántos posts revisar por cuenta (las convocatorias viejas ya vencieron)
POSTS_PER_ACCOUNT = 15

# Cuentas de Instagram a monitorear (sin @).
# El scraper crea automáticamente la organización si no existe (Opción 2).
#
# NOTA: Instagram bloquea el scraping masivo. Para PROBAR, arrancamos con
# pocas cuentas. Una vez confirmado que funciona, descomentamos el resto
# y las corremos en tandas (no las 21 de golpe).
INSTAGRAM_ACCOUNTS = [
    "becasparaguay",
   # "uwcpy",
    #"jciencarnacion",
     "juventudencar",
     "muniencarnacion",
     "rotaryyoungleaders",
     #"cruzrojapy_filialitapua",
     #"cruzrojaparaguaya",
     "becashayes",
     #"laembajada",
    # "interact_enc_norte",
    # "interact.cambyreta",
    # "interact.enc",
    # "itapuapy",
     "snjparaguay",
    # "changetheworldacademy",
    # "jcicambyreta",
    # "jcileaders",
     "redmunparaguay",
     "mardebecas",
     "ccpa_paraguay",
]

# ===== FUENTES WEB =====
# Cada fuente vincula una URL con la organización en tu tabla 'organizations'.
# 'org_id' es el UUID real de cada organización en Supabase.
WEB_SOURCES = [
    {
        "name": "UWC Paraguay",
        "url": "https://py.uwc.org/como-aplicar/",  # <-- Limpio, solo el link
        "org_id": "660ff951-a871-40f4-93d1-d3c90ffd78e1",
        "default_type": "Beca internacional",
    },
    # Próximas fuentes para activar (crear la organización en BD y pegar UUID):
    # {
    #     "name": "Rotary Youth Exchange",
    #     "url": "[https://www.rotary.org/es/our-programs/youth-exchanges](https://www.rotary.org/es/our-programs/youth-exchanges)",
    #     "org_id": "e08d0895-d244-46e8-86f3-e02f3a90abcc",
    #     "default_type": "Intercambio",
    # },
    # {
    #     "name": "Becal - Becas Disponibles",
    #     "url": "[https://www.becal.gov.py/v2/becas-disponibles/](https://www.becal.gov.py/v2/becas-disponibles/)",
    #     "org_id": "PEGAR-UUID-DE-BECAL-AQUI",
    #     "default_type": "Beca",
    # },
]