"""
admin_routes.py
Endpoints del panel de administración (solo owner).
Todas las operaciones de escritura usan el cliente con service_role
para saltarse RLS, pero protegidas por require_owner.

Se montan en main.py con: app.include_router(admin_router)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from admin_auth import require_owner
# Cliente con service_role (el mismo que usa el scraper)
from scraper.db import supabase_admin

admin_router = APIRouter(prefix="/admin", tags=["admin"])


# ===== MODELOS =====
class OpportunityIn(BaseModel):
    title: str
    type: str
    description: Optional[str] = None
    organization_id: str
    min_age: Optional[int] = None
    max_age: Optional[int] = None
    required_academic_level: Optional[str] = None
    min_academic_average: Optional[float] = None
    required_languages: Optional[list[str]] = None
    city: Optional[str] = None
    department: Optional[str] = None
    country: Optional[str] = "Paraguay"
    modality: Optional[str] = None
    cost: Optional[str] = None
    benefits: Optional[str] = None
    deadline: Optional[str] = None
    official_url: Optional[str] = None
    status: Optional[str] = "open"


class OrganizationIn(BaseModel):
    name: str
    description: Optional[str] = None
    city: Optional[str] = None
    department: Optional[str] = None
    country: Optional[str] = "Paraguay"
    website_url: Optional[str] = None
    instagram_url: Optional[str] = None
    contact_email: Optional[str] = None
    logo_url: Optional[str] = None


# ===== OPORTUNIDADES =====
@admin_router.get("/opportunities")
def admin_list_opportunities(user=Depends(require_owner)):
    """Lista TODAS las oportunidades (incluidas cerradas/vencidas)."""
    res = supabase_admin.table("opportunities") \
        .select("*, organizations(name)") \
        .order("created_at", desc=True) \
        .execute()
    return res.data


@admin_router.post("/opportunities")
def admin_create_opportunity(opp: OpportunityIn, user=Depends(require_owner)):
    res = supabase_admin.table("opportunities").insert(opp.model_dump()).execute()
    return {"message": "Oportunidad creada", "data": res.data}


@admin_router.put("/opportunities/{opp_id}")
def admin_update_opportunity(opp_id: str, opp: OpportunityIn, user=Depends(require_owner)):
    res = supabase_admin.table("opportunities") \
        .update(opp.model_dump()) \
        .eq("id", opp_id) \
        .execute()
    return {"message": "Oportunidad actualizada", "data": res.data}


@admin_router.delete("/opportunities/{opp_id}")
def admin_delete_opportunity(opp_id: str, user=Depends(require_owner)):
    supabase_admin.table("opportunities").delete().eq("id", opp_id).execute()
    return {"message": "Oportunidad eliminada"}


# ===== ORGANIZACIONES =====
@admin_router.get("/organizations")
def admin_list_organizations(user=Depends(require_owner)):
    res = supabase_admin.table("organizations") \
        .select("*") \
        .order("name") \
        .execute()
    return res.data


@admin_router.post("/organizations")
def admin_create_organization(org: OrganizationIn, user=Depends(require_owner)):
    res = supabase_admin.table("organizations").insert(org.model_dump()).execute()
    return {"message": "Organización creada", "data": res.data}


@admin_router.put("/organizations/{org_id}")
def admin_update_organization(org_id: str, org: OrganizationIn, user=Depends(require_owner)):
    res = supabase_admin.table("organizations") \
        .update(org.model_dump()) \
        .eq("id", org_id) \
        .execute()
    return {"message": "Organización actualizada", "data": res.data}


@admin_router.delete("/organizations/{org_id}")
def admin_delete_organization(org_id: str, user=Depends(require_owner)):
    supabase_admin.table("organizations").delete().eq("id", org_id).execute()
    return {"message": "Organización eliminada"}


# ===== VERIFICACIÓN DE ROL (para el frontend) =====
@admin_router.get("/me")
def admin_check_owner(user=Depends(require_owner)):
    """El frontend llama esto para saber si el usuario puede ver el panel."""
    return {"is_owner": True}