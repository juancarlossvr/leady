// =========================================================================
// recommendations.js — Motor de Recomendaciones y Mentor IA Leady
// =========================================================================

const RECOMMENDATIONS_API_URL = "https://api.leady.online";

let userFavoriteIds = new Set();
let cachedUserProfile = null;
// Almacenamiento seguro por índice (0, 1, 2) para evitar errores de comillas en HTML
window.RECOMMENDATIONS_DATA = [];

function getRecommendationsSkeletons() {
    return Array(3).fill(0).map(() => `
        <div class="col-md-4 d-flex align-items-stretch">
            <div class="p-3 rounded-3 w-100 skeleton-card d-flex flex-column justify-content-between" style="background: var(--surface); border: 1px solid var(--border); min-height: 220px;">
                <div>
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <div class="skeleton-item" style="width: 70px; height: 22px;"></div>
                        <div class="skeleton-item" style="width: 60px; height: 18px;"></div>
                    </div>
                    <div class="skeleton-item mb-2" style="width: 50%; height: 14px;"></div>
                    <div class="skeleton-item mb-3" style="width: 90%; height: 22px;"></div>
                    <div class="skeleton-item mb-2" style="width: 100%; height: 12px;"></div>
                    <div class="skeleton-item mb-2" style="width: 80%; height: 12px;"></div>
                </div>
                <div class="skeleton-item mt-3" style="width: 100%; height: 36px;"></div>
            </div>
        </div>
    `).join("");
}

function calculateDetailedMatch(opportunity, profile) {
    let score = 30;
    const breakdown = ["Perfil registrado y activo en Leady"];

    if (!profile) {
        return { score: 50, breakdown: ["Puntuación base estimada (Iniciá sesión para precisión)"] };
    }

    if (profile.age && opportunity.min_age && opportunity.max_age) {
        if (profile.age >= opportunity.min_age && profile.age <= opportunity.max_age) {
            score += 25;
            breakdown.push(`Tu edad (${profile.age} años) está en el rango ideal (${opportunity.min_age}-${opportunity.max_age} años)`);
        } else {
            score += 10;
            breakdown.push(`Edad cercana al rango buscado`);
        }
    } else {
        score += 15;
        breakdown.push("Convocatoria con rango de edad flexible");
    }

    if (profile.academic_level && opportunity.required_academic_level) {
        const userLvl = profile.academic_level.toLowerCase();
        const reqLvl = opportunity.required_academic_level.toLowerCase();

        if (reqLvl.includes(userLvl) || reqLvl.includes("todos") || reqLvl.includes("sin requisito")) {
            score += 25;
            breakdown.push(`Tu nivel académico (${profile.academic_level}) cumple con la exigencia`);
        } else {
            score += 10;
            breakdown.push(`Nivel académico adaptable`);
        }
    } else {
        score += 15;
        breakdown.push("Abierto a múltiples niveles académicos");
    }

    if (profile.department && opportunity.country) {
        if (opportunity.country.toLowerCase().includes("paraguay") || opportunity.country.toLowerCase().includes("online")) {
            score += 15;
            breakdown.push("Disponible para residentes en Paraguay / Modalidad Online");
        }
    }

    return { score: Math.min(score, 98), breakdown };
}

async function fetchUserFavoritesList(userId) {
    try {
        const { data: favorites } = await supabaseClient
            .from("favorites")
            .select("opportunity_id")
            .eq("user_id", userId);

        userFavoriteIds = new Set(favorites ? favorites.map(f => f.opportunity_id) : []);
    } catch (e) {
        console.error("Error al obtener favoritos:", e);
        userFavoriteIds = new Set();
    }
}

async function loadRecommendations() {
    const container = document.getElementById("recommendations-container");
    if (!container) return;

    try {
        container.innerHTML = getRecommendationsSkeletons();

        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData?.session) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <p class="text-secondary style-sm m-0">Iniciá sesión para ver recomendaciones personalizadas por IA.</p>
                </div>
            `;
            return;
        }

        const userId = sessionData.session.user.id;

        const [profileRes, _, opportunitiesRes] = await Promise.allSettled([
            supabaseClient.from("users_profiles").select("*").eq("id", userId).maybeSingle(),
            fetchUserFavoritesList(userId),
            fetch(`${RECOMMENDATIONS_API_URL}/opportunities`)
        ]);

        cachedUserProfile = profileRes.status === "fulfilled" ? profileRes.value.data : null;

        let opportunities = [];
        if (opportunitiesRes.status === "fulfilled" && opportunitiesRes.value.ok) {
            opportunities = await opportunitiesRes.value.json();
        } else {
            const { data: supaOpps } = await supabaseClient
                .from("opportunities")
                .select("*, organizations(*)");
            opportunities = supaOpps || [];
        }

        if (!opportunities || opportunities.length === 0) {
            container.innerHTML = `
                <div class="col-12 text-center py-4">
                    <p class="text-secondary m-0">No hay convocatorias recomendadas disponibles en este momento.</p>
                </div>
            `;
            return;
        }

        const scored = opportunities.map(opp => {
            const matchData = calculateDetailedMatch(opp, cachedUserProfile);
            return {
                ...opp,
                matchScore: matchData.score,
                matchBreakdown: matchData.breakdown
            };
        });

        scored.sort((a, b) => b.matchScore - a.matchScore);
        const top3 = scored.slice(0, 3);
        
        // Guardamos en el array global por índice
        window.RECOMMENDATIONS_DATA = top3;

        container.innerHTML = top3.map((opp, index) => buildRecommendationCard(opp, index)).join("");

    } catch (error) {
        console.error("Error en motor de recomendaciones:", error);
        container.innerHTML = `
            <div class="col-12 text-center py-3 text-secondary style-sm">
                No pudimos calcular las recomendaciones en este momento.
            </div>
        `;
    }
}

function buildRecommendationCard(opp, index) {
    const orgName = opp.organizations?.name || opp.organization_name || "Organización no especificada";
    const isFav = userFavoriteIds.has(opp.id);
    const favIconClass = isFav ? "ph-fill ph-bookmark text-warning" : "ph ph-bookmark text-secondary";
    const desc = opp.description ? opp.description.substring(0, 90) + "..." : "Sin descripción disponible.";

    // Llamamos a showMatchExplanation solo con el número (0, 1 o 2), cero riesgo de error sintáctico
    return `
        <div class="col-md-4 d-flex align-items-stretch">
            <div class="opportunity-card d-flex flex-column w-100 p-3 style-sm position-relative" 
                 style="background: var(--surface); border: 1px solid var(--border); border-radius: 14px;">
                
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <button type="button" 
                            class="btn p-0 border-0 badge bg-warning text-dark fw-bold style-sm d-inline-flex align-items-center gap-1 shadow-sm"
                            style="cursor: pointer; z-index: 5; position: relative;"
                            onclick="window.showMatchExplanation(${index})"
                            title="Hacé clic para ver el análisis de inteligencia artificial">
                        <i class="ph-fill ph-lightning"></i>${opp.matchScore}% Match
                    </button>

                    <button type="button" 
                            class="btn btn-sm p-1 border-0 rounded-circle d-flex align-items-center justify-content-center"
                            style="background: rgba(255,255,255,0.05); cursor: pointer; z-index: 5; position: relative;"
                            onclick="window.toggleFavoriteFromRec('${opp.id}', this)"
                            title="${isFav ? 'Quitar de guardados' : 'Guardar oportunidad'}">
                        <i class="${favIconClass} fs-5"></i>
                    </button>
                </div>

                <p class="organization-name text-warning mb-1 style-sm fw-bold">${orgName}</p>
                <h4 class="fs-6 fw-bold text-white mb-2" style="line-height: 1.3;">${opp.title}</h4>
                
                <p class="text-secondary style-sm flex-grow-1 mb-3" style="font-size: 0.85rem; line-height: 1.4;">
                    ${desc}
                </p>

                <a href="opportunity-detail.html?id=${opp.id}" 
                   class="btn-secondary-leady text-center text-decoration-none py-1.5 w-100 mt-auto d-block">
                    Ver recomendación
                </a>
            </div>
        </div>
    `;
}

async function toggleFavoriteFromRec(opportunityId, buttonEl) {
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData?.session) {
            window.location.href = "login.html";
            return;
        }

        const userId = sessionData.session.user.id;
        const iconEl = buttonEl.querySelector("i");
        const isFav = userFavoriteIds.has(opportunityId);

        if (isFav) {
            await supabaseClient.from("favorites").delete().eq("user_id", userId).eq("opportunity_id", opportunityId);
            userFavoriteIds.delete(opportunityId);
            iconEl.className = "ph ph-bookmark text-secondary fs-5";
            buttonEl.title = "Guardar oportunidad";
        } else {
            await supabaseClient.from("favorites").insert({ user_id: userId, opportunity_id: opportunityId });
            userFavoriteIds.add(opportunityId);
            iconEl.className = "ph-fill ph-bookmark text-warning fs-5";
            buttonEl.title = "Quitar de guardados";
        }

        if (typeof window.loadFavorites === "function") {
            window.loadFavorites();
        }
    } catch (err) {
        console.error("Error al cambiar estado de favorito:", err);
    }
}

// 7. FUNCIÓN DEL MODAL CONECTADA A TU FASTAPI /ai/explain-recommendation
async function showMatchExplanation(index) {
    const opp = window.RECOMMENDATIONS_DATA[index];
    if (!opp) {
        console.error("No se encontró la oportunidad en la posición:", index);
        return;
    }

    let modalEl = document.getElementById("match-explanation-modal");

    if (!modalEl) {
        const modalHtml = `
            <div class="modal fade" id="match-explanation-modal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content text-white" style="background: var(--surface); border: 1px solid var(--border); border-radius: 16px;">
                        <div class="modal-header border-bottom border-secondary border-opacity-25">
                            <h5 class="modal-header-title m-0 fs-6 fw-bold d-flex align-items-center gap-2">
                                <i class="ph-fill ph-sparkle text-warning"></i> Mentor IA Leady
                            </h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                        </div>
                        <div class="modal-body">
                            <p id="match-modal-opp-title" class="text-white fw-bold style-sm mb-3"></p>
                            
                            <!-- Caja de explicación de Inteligencia Artificial -->
                            <div class="p-3 rounded-3 mb-3" style="background: rgba(255, 183, 3, 0.08); border: 1px solid rgba(255, 183, 3, 0.3);">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <span class="fw-bold style-sm text-warning d-flex align-items-center gap-1">
                                        <i class="ph ph-magic-wand"></i> ¿Por qué te conviene esta beca?
                                    </span>
                                    <span id="match-modal-score" class="badge bg-warning text-dark fw-bold"></span>
                                </div>
                                <div id="match-modal-ai-text" class="style-sm text-white-50" style="line-height: 1.5;">
                                </div>
                            </div>

                            <h6 class="fs-6 fw-bold text-white mb-2" style="font-size: 0.85rem;">Criterios calculados por el sistema:</h6>
                            <ul id="match-modal-breakdown-list" class="list-unstyled d-flex flex-column gap-2 m-0 style-sm text-secondary">
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML("beforeend", modalHtml);
        modalEl = document.getElementById("match-explanation-modal");
    }

    document.getElementById("match-modal-opp-title").textContent = opp.title;
    document.getElementById("match-modal-score").textContent = `${opp.matchScore}% Match`;

    const listEl = document.getElementById("match-modal-breakdown-list");
    listEl.innerHTML = (opp.matchBreakdown || []).map(item => `
        <li class="p-2 rounded-2 d-flex align-items-start gap-2" style="background: var(--surface-2); border: 1px solid var(--border);">
            <i class="ph-fill ph-check-circle text-success fs-6 mt-1"></i>
            <span>${item}</span>
        </li>
    `).join("");

    const aiTextEl = document.getElementById("match-modal-ai-text");
    aiTextEl.innerHTML = `
        <div class="d-flex align-items-center gap-2 py-1">
            <span class="spinner-border spinner-border-sm text-warning" role="status"></span>
            <span>Consultando a GPT por qué este perfil encaja contigo...</span>
        </div>
    `;

    // Apertura del modal
    if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
        bsModal.show();
    } else {
        alert("Atención: No se encontró la librería de Bootstrap en el HTML para abrir el modal.");
        return;
    }

    // Petición al backend de FastAPI
    try {
        const payload = {
            user_profile: cachedUserProfile || {},
            opportunity: opp,
            score: opp.matchScore,
            reasons: opp.matchBreakdown || []
        };

        const res = await fetch(`${RECOMMENDATIONS_API_URL}/ai/explain-recommendation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("Error en respuesta de FastAPI");

        const data = await res.json();
        aiTextEl.innerHTML = `<span class="text-white normal-font">${data.explanation}</span>`;

    } catch (err) {
        console.warn("Fallo al conectar con IA de FastAPI, usando fallback local:", err);
        aiTextEl.innerHTML = `
            <span class="text-secondary">
                Esta convocatoria coincide muy bien con tu rango de edad y nivel académico actual. Te sugerimos revisar los requisitos completos para preparar tu postulación.
            </span>
        `;
    }
}

// Globalización
window.loadRecommendations = loadRecommendations;
window.toggleFavoriteFromRec = toggleFavoriteFromRec;
window.showMatchExplanation = showMatchExplanation;