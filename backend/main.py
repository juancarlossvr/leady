from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from database import supabase, openai_client
from datetime import date
from admin_routes import admin_router

app = FastAPI(
    title="Leady API",
    description="API principal de Leady",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Leady API funcionando correctamente"
    }

@app.get("/health")
def health():
    return {
        "status": "online"
    }

@app.get("/test-db")
def test_db():
    response = supabase.table("opportunities").select("*").limit(1).execute()

    return {
        "message": "Conexión con Supabase funcionando",
        "data": response.data
    }

@app.get("/opportunities")
def get_opportunities():
    today = date.today().isoformat()

    response = supabase.table("opportunities") \
        .select("*, organizations(*)") \
        .eq("status", "open") \
        .or_(f"deadline.gte.{today},deadline.is.null") \
        .execute()

    return response.data

@app.get("/opportunities/{opportunity_id}")
def get_opportunity_by_id(opportunity_id: str):
    response = supabase.table("opportunities") \
        .select("*, organizations(*)") \
        .eq("id", opportunity_id) \
        .single() \
        .execute()

    return response.data

@app.get("/users/{user_id}/favorites")
def get_user_favorites(user_id: str):
    response = supabase.table("favorites") \
        .select("*, opportunities(*, organizations(*))") \
        .eq("user_id", user_id) \
        .execute()

    return response.data


class AIExplanationRequest(BaseModel):
    user_profile: dict
    opportunity: dict
    score: int
    reasons: list[str]


@app.post("/ai/explain-recommendation")
def explain_recommendation(request: AIExplanationRequest):
    prompt = f"""
Sos Leady, una plataforma paraguaya que ayuda a jóvenes de 13 a 25 años
a encontrar oportunidades de liderazgo, becas, intercambios y voluntariados.

Tu tarea es explicar de forma clara, breve, honesta y motivadora por qué
esta oportunidad puede ser relevante para el usuario.

Reglas:
- No inventes requisitos, beneficios ni fechas.
- No prometas aceptación.
- No exageres.
- No uses emojis.
- Usá español natural, profesional y juvenil.
- Si falta información, decilo con claridad.

Perfil del usuario:
{request.user_profile}

Oportunidad:
{request.opportunity}

Puntaje de compatibilidad:
{request.score}%

Razones calculadas por el sistema:
{request.reasons}

Redactá una explicación de máximo 4 líneas.
"""

    try:
        response = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=prompt
        )
        return {
            "explanation": response.output_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar explicación: {str(e)}")

app.include_router(admin_router)

class AIEssayRequest(BaseModel):
    user_profile: dict
    opportunity_title: str
    opportunity_description: str
    opportunity_requirements: str | None = None

@app.post("/ai/generate-essay-outline")
def generate_essay_outline(request: AIEssayRequest):
    prompt = f"""
Sos un mentor académico de Leady, experto en ayudar a jóvenes paraguayos a ganar becas y convocatorias internacionales.

Tu tarea es redactar un PRIMER BORRADOR o ESQUELETO ESTRUCTURADO para la carta de motivación / ensayo de postulación del usuario.

Reglas estrictas:
- Redactá en primera persona (como si fueras el postulante).
- Tono: Profesional, entusiasmado, maduro y honesto.
- Estructura clara en 3 o 4 párrafos cortos:
  1. Introducción y motivación principal para postular.
  2. Cómo el background o nivel académico del postulante se conecta con esta oportunidad.
  3. El impacto que busca lograr en su comunidad o en Paraguay al terminar el programa.
  4. Cierre formal.
- Dejá espacios entre corchetes como [Insertar experiencia en...] o [Mencionar tu logro en...] en las partes donde el usuario deba personalizar con sus anécdotas reales.
- NO inventes premios ni títulos que el usuario no haya mencionado en su perfil.

Perfil del postulante:
{request.user_profile}

Oportunidad a la que postula:
- Título: {request.opportunity_title}
- Descripción: {request.opportunity_description}
- Requisitos: {request.opportunity_requirements or 'No especificados'}
"""

    try:
        response = openai_client.responses.create(
            model="gpt-4.1-mini",
            input=prompt
        )
        return {
            "draft": response.output_text
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al generar el borrador: {str(e)}")