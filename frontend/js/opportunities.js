const API_URL = "http://127.0.0.1:8000";

let userProfileCache = null;
let allOpportunities = [];
let currentSortMode = "match"; // 'match' (mayor compatibilidad) o 'recent' (más recientes)

// 1. Cargar perfil del usuario logueado para calcular compatibilidad
async function getUserProfileForMatch() {
    if (userProfileCache) return userProfileCache;
    if (typeof supabaseClient === "undefined") return null;

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData?.session) return null;

        const { data: profile } = await supabaseClient
            .from("users_profiles")
            .select("age, academic_level, city, department, languages")
            .eq("id", sessionData.session.user.id)
            .maybeSingle();

        userProfileCache = profile;
        return profile;
    } catch (err) {
        console.error("Error al obtener perfil para match:", err);
        return null;
    }
}

// 2. Algoritmo de Compatibilidad (Match Score)
function calculateOpportunityMatch(opportunity, profile) {
    if (!profile) return null;

    let score = 40; // Base por estar registrado

    // Criterio 1: Edad (+30% si está en rango)
    if (profile.age && opportunity.min_age && opportunity.max_age) {
        if (profile.age >= opportunity.min_age && profile.age <= opportunity.max_age) {
            score += 30;
        }
    } else {
        score += 15;
    }

    // Criterio 2: Nivel Académico (+25% si coincide o es abierto)
    if (profile.academic_level && opportunity.required_academic_level) {
        const userLevel = profile.academic_level.toLowerCase();
        const reqLevel = opportunity.required_academic_level.toLowerCase();
        if (reqLevel.includes(userLevel) || reqLevel.includes("todos") || reqLevel.includes("sin requisito")) {
            score += 25;
        } else {
            score += 10;
        }
    } else {
        score += 15;
    }

    // Criterio 3: Datos de perfil completos (+3%)
    if (profile.city || profile.department) {
        score += 3;
    }

    return Math.min(score, 98); // Máximo 98%
}

// 3. Ordenador inteligente de convocatorias
function sortOpportunitiesList(list, sortBy = "match") {
    return [...list].sort((a, b) => {
        if (sortBy === "match") {
            const scoreA = calculateOpportunityMatch(a, userProfileCache) || 0;
            const scoreB = calculateOpportunityMatch(b, userProfileCache) || 0;
            return scoreB - scoreA; // De mayor a menor porcentaje
        } else if (sortBy === "recent") {
            return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
        return 0;
    });
}

function truncateText(text, maxLength = 115) {
    if (!text || text.length <= maxLength) return text || "Sin descripción disponible.";
    return text.substring(0, text.lastIndexOf(" ", maxLength)) + "...";
}

// 4. Renderizado de tarjeta individual
function buildOpportunityCard(opportunity) {
    const organization = opportunity.organizations;
    const organizationName = organization?.name || "Organización no especificada";
    const logoUrl = organization?.logo_url;

    const logoContent = logoUrl
        ? `<img src="${logoUrl}" alt="${organizationName}" class="organization-logo-img">`
        : `<i class="ph ph-compass fs-4"></i>`;

    const matchScore = calculateOpportunityMatch(opportunity, userProfileCache);
    const matchBadgeHtml = matchScore !== null
        ? `<span class="badge bg-warning text-dark border border-warning style-sm fw-bold" title="Compatibilidad calculada con tu perfil">
            <i class="ph ph-lightning me-1"></i>${matchScore}% Match
           </span>`
        : "";

    return `
        <div class="col-lg-4 col-md-6 d-flex align-items-stretch">
            <div class="opportunity-card d-flex flex-column w-100">
                
                <div class="flex-grow-1">
                    <div class="opportunity-header d-flex justify-content-between align-items-center mb-2">
                        <div class="organization-logo-placeholder">
                            ${logoContent}
                        </div>
                        <div class="d-flex gap-2">
                            ${matchBadgeHtml}
                            <span class="opportunity-type">${opportunity.type || "Oportunidad"}</span>
                        </div>
                    </div>

                    <p class="organization-name">${organizationName}</p>
                    <h3 class="mb-2">${opportunity.title}</h3>
                    
                    <p class="mb-3 text-secondary" style="font-size: 0.9rem;">
                        ${truncateText(opportunity.description)}
                    </p>
                </div>

                <div class="mt-auto pt-3" style="border-top: 1px solid var(--border);">
                    <div class="mb-2">
                        ${typeof getOpportunityBadge === "function" ? getOpportunityBadge(opportunity, organization) : ""}
                    </div>

                    <div class="opportunity-meta mb-3">
                        <span>
                            <i class="ph ph-globe-hemisphere-west fs-6"></i>
                            ${opportunity.country || "Paraguay / Online"}
                        </span>
                        <span>
                            <i class="ph ph-graduation-cap fs-6"></i>
                            ${opportunity.required_academic_level || "Todos los niveles"}
                        </span>
                    </div>

                    <a href="opportunity-detail.html?id=${opportunity.id}"
                       class="btn-primary-leady text-decoration-none w-100 text-center d-block">
                        Ver oportunidad
                    </a>
                </div>

            </div>
        </div>
    `;
}

function getSkeletonCards() {
    return Array(3).fill(0).map(() => `
        <div class="col-lg-4 col-md-6">
            <div class="skeleton-card d-flex flex-column justify-content-between">
                <div>
                    <div class="d-flex justify-content-between mb-3">
                        <div class="skeleton-item" style="width: 48px; height: 48px;"></div>
                        <div class="skeleton-item" style="width: 80px; height: 24px;"></div>
                    </div>
                    <div class="skeleton-item mb-2" style="width: 60%; height: 16px;"></div>
                    <div class="skeleton-item mb-3" style="width: 90%; height: 28px;"></div>
                    <div class="skeleton-item mb-2" style="width: 100%; height: 14px;"></div>
                    <div class="skeleton-item mb-4" style="width: 80%; height: 14px;"></div>
                </div>
                <div>
                    <div class="skeleton-item mb-3" style="width: 100%; height: 36px;"></div>
                    <div class="skeleton-item" style="width: 100%; height: 44px;"></div>
                </div>
            </div>
        </div>
    `).join("");
}

function getEmptyState() {
    return `
        <div class="col-12 text-center py-5">
            <div class="hero-card" style="max-width: 480px; margin: 0 auto; background: var(--background-secondary);">
                <i class="ph ph-compass" style="font-size: 3rem; color: var(--sol);"></i>
                <h3 class="mt-3 mb-2">No encontramos convocatorias</h3>
                <p class="text-secondary mb-0" style="font-size: 0.95rem;">
                    Por ahora no hay oportunidades activas en esta sección. Nuestro sistema con IA escanea nuevas fuentes continuamente.
                </p>
            </div>
        </div>
    `;
}

function renderFilteredOpportunities() {
    const container = document.getElementById("opportunities-container");
    if (!container) return;

    if (!allOpportunities || allOpportunities.length === 0) {
        container.innerHTML = getEmptyState();
        return;
    }

    const sorted = sortOpportunitiesList(allOpportunities, currentSortMode);
    container.innerHTML = sorted.map(buildOpportunityCard).join("");
}

// 5. Carga principal de datos (en paralelo)
async function loadOpportunities() {
    const container = document.getElementById("opportunities-container");
    if (!container) return;

    try {
        container.innerHTML = getSkeletonCards();

        // Cargar en paralelo el perfil del usuario y las oportunidades
        const [profile, response] = await Promise.all([
            getUserProfileForMatch(),
            fetch(`${API_URL}/opportunities`)
        ]);

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        allOpportunities = await response.json();
        renderFilteredOpportunities();

    } catch (error) {
        console.error("Error cargando oportunidades:", error);
        container.innerHTML = `
            <div class="col-12 text-center py-5">
                <div class="p-4 rounded" style="background: rgba(224, 81, 47, 0.1); border: 1px solid var(--ceibo); max-width: 500px; margin: 0 auto;">
                    <i class="ph ph-warning-octagon" style="font-size: 2.2rem; color: var(--ceibo);"></i>
                    <h4 class="mt-2 text-white">No se pudieron cargar las oportunidades</h4>
                    <p class="text-secondary mb-1" style="font-size: 0.9rem;">Verificá tu conexión o que FastAPI esté activo.</p>
                    <small style="color: var(--ceibo); font-family: monospace;">${error.message}</small>
                </div>
            </div>
        `;
    }
}

// Cambiar criterio de orden (por llamado de botón/select)
function setOpportunitySort(mode) {
    currentSortMode = mode;
    renderFilteredOpportunities();
}

window.loadOpportunities = loadOpportunities;
window.setOpportunitySort = setOpportunitySort;