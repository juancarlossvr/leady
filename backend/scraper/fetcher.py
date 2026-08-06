"""
scraper/fetcher.py
Descarga el HTML de una página y lo convierte en texto limpio.
Respeta robots.txt (buena práctica ética del web scraping).
"""

import time
import urllib.robotparser
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

from .config import USER_AGENT, REQUEST_TIMEOUT, REQUEST_DELAY


def is_allowed_by_robots(url: str) -> bool:
    """
    Consulta el archivo robots.txt del sitio para verificar si tenemos
    permiso de acceder a la URL. Si no se puede leer robots.txt, asumimos
    que está permitido (comportamiento estándar).
    """
    parsed = urlparse(url)
    robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"

    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(robots_url)

    try:
        rp.read()
    except Exception:
        # Si no hay robots.txt o falla, asumimos permitido
        return True

    return rp.can_fetch(USER_AGENT, url)


def fetch_html(url: str) -> str | None:
    """
    Descarga el HTML crudo de una URL.
    Devuelve el HTML como string, o None si algo falla.
    """
    if not is_allowed_by_robots(url):
        print(f"  robots.txt no permite scrapear: {url}")
        return None

    headers = {"User-Agent": USER_AGENT}

    try:
        response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        # Espera cortés antes de liberar (evita ráfagas)
        time.sleep(REQUEST_DELAY)
        return response.text
    except requests.RequestException as e:
        print(f"  Error descargando {url}: {e}")
        return None


def html_to_text(html: str) -> str:
    """
    Convierte HTML en texto plano legible, eliminando menús, scripts,
    estilos y footer. El objetivo es quedarnos con el CONTENIDO real
    para enviárselo a la IA, sin ruido de navegación.
    """
    soup = BeautifulSoup(html, "lxml")

    # Eliminamos elementos que no aportan contenido útil
    for tag in soup(["script", "style", "nav", "header", "footer", "form", "noscript"]):
        tag.decompose()

    # Intentamos quedarnos con el <main> o el contenido principal si existe
    main = soup.find("main") or soup.find("article") or soup.body or soup

    # get_text con saltos de línea para preservar la estructura del texto
    text = main.get_text(separator="\n", strip=True)

    # Limpiamos líneas vacías repetidas
    lines = [line for line in text.split("\n") if line.strip()]
    clean_text = "\n".join(lines)

    return clean_text


def fetch_clean_text(url: str) -> str | None:
    """
    Función principal: baja una URL y devuelve su texto limpio,
    listo para enviar a la IA. None si falla.
    """
    html = fetch_html(url)
    if not html:
        return None
    return html_to_text(html)