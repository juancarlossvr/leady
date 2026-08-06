const API_URL = "http://127.0.0.1:8000";
let currentOpportunityId = null;
let currentOpportunityData = null; // Guardamos la oportunidad para pasársela a la IA

function getOpportunityIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

function formatValue(value) {
    return value || "No especificado";
}

function formatArray(value) {
    if (!value || value.length === 0) return "No especificado";
    return value.join(", ");
}

function formatAge(min, max) {
    if (min && max) return `De ${min} a ${max} años`;
    if (min) return `Desde los ${min} años`;
    if (max) return `Hasta los ${max} años`;
    return "Sin límite de edad especificado";
}

async function saveFavorite() {
    const status = document.getElementById("favorite-status");
    const { data: sessionData } = await supabaseClient.auth.getSession();

    if (!sessionData.session) {
        status.textContent = "Debés iniciar sesión para guardar oportunidades.";
        status.className = "api-status mt-3 text-warning";
        setTimeout(() => window.location.href = "login.html", 1200);
        return;
    }

    const user = sessionData.session.user;
    const { error } = await supabaseClient
        .from("favorites")
        .insert([{ user_id: user.id, opportunity_id: currentOpportunityId }]);

    if (error) {
        if (error.code === "23505") {
            status.textContent = "Ya tenés guardada esta oportunidad en tus favoritos.";
            status.className = "api-status mt-3 text-info";
            return;
        }
        status.textContent = "Hubo un problema al guardar. Intentá de nuevo.";
        status.className = "api-status mt-3 text-danger";
        console.error(error);
        return;
    }

    status.textContent = "¡Oportunidad guardada con éxito en tu Dashboard!";
    status.className = "api-status mt-3 text-success";
}

async function loadOpportunityDetail() {
    const container = document.getElementById("opportunity-detail");
    const opportunityId = getOpportunityIdFromUrl();
    currentOpportunityId = opportunityId;

    if (!opportunityId) {
        container.innerHTML = "<p class='text-secondary'>No se encontró la ID de la oportunidad en la URL.</p>";
        return;
    }

    try {
        const response = await fetch(`${API_URL}/opportunities/${opportunityId}`);
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const opportunity = await response.json();
        currentOpportunityData = opportunity; // Guardado para IA

        const organizationName = opportunity.organizations?.name || "Organización no especificada";
        const organizationLogo = opportunity.organizations?.logo_url;

        const logoContent = organizationLogo
            ? `<img src="${organizationLogo}" alt="${organizationName}" class="detail-logo-img">`
            : `<i class="ph ph-compass fs-2"></i>`;

        container.innerHTML = `
            <div class="detail-header mb-4">
                <div class="detail-logo">${logoContent}</div>
                <div>
                    <span class="opportunity-type mb-2 d-inline-block">${opportunity.type || "Oportunidad"}</span>
                    <p class="organization-name mb-1" style="font-size: 0.95rem;">${organizationName}</p>
                    <h1 class="mb-0">${opportunity.title}</h1>
                </div>
            </div>

            <div class="p-4 rounded-3 mb-4" style="background: var(--background-secondary); border: 1px solid var(--border);">
                <h4 class="mb-2" style="font-size: 1.1rem; color: var(--sol);">Acerca del programa</h4>
                <p class="detail-description mb-0 text-light" style="line-height: 1.6;">
                    ${opportunity.description || "Sin descripción detallada disponible."}
                </p>
            </div>

            <h3 class="mt-4 mb-3" style="font-size: 1.4rem;">Requisitos y datos claves</h3>
            <div class="detail-grid">
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-globe-hemisphere-west fs-5"></i>
                    <div><strong>País / Ubicación</strong><span>${formatValue(opportunity.country)} ${opportunity.city ? '/ ' + opportunity.city : ''}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-laptop fs-5"></i>
                    <div><strong>Modalidad</strong><span>${formatValue(opportunity.modality)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-identification-card fs-5"></i>
                    <div><strong>Edad requerida</strong><span>${formatAge(opportunity.min_age, opportunity.max_age)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-graduation-cap fs-5"></i>
                    <div><strong>Nivel académico</strong><span>${formatValue(opportunity.required_academic_level)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-chart-bar fs-5"></i>
                    <div><strong>Promedio mínimo</strong><span>${formatValue(opportunity.min_academic_average)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-translate fs-5"></i>
                    <div><strong>Idiomas</strong><span>${formatArray(opportunity.required_languages)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-calendar-blank fs-5"></i>
                    <div><strong>Fecha límite</strong><span>${formatValue(opportunity.deadline)}</span></div>
                </div>
                <div class="detail-item d-flex align-items-center">
                    <i class="ph ph-wallet fs-5"></i>
                    <div><strong>Costo / Cobertura</strong><span>${formatValue(opportunity.cost)}</span></div>
                </div>
            </div>

            ${opportunity.benefits ? `
                <section class="detail-section mt-5 p-4 rounded-3" style="background: var(--surface-2); border-left: 4px solid var(--selva);">
                    <h2 style="font-size: 1.3rem; color: var(--selva);"><i class="ph ph-check-circle-fill me-2"></i>Beneficios que incluye</h2>
                    <p class="mb-0 text-light mt-2" style="white-space: pre-line;">${opportunity.benefits}</p>
                </section>
            ` : ""}

            <!-- BOTONERA DE ACCIONES CON NUEVO BOTÓN DE IA -->
            <div class="detail-actions mt-5 pt-3 d-flex gap-3 flex-wrap" style="border-top: 1px solid var(--border);">
                <a href="${opportunity.official_url || "#"}" target="_blank" rel="noopener noreferrer"
                   class="btn-primary-leady text-decoration-none px-4 py-2.5 text-center flex-grow-1 d-flex align-items-center justify-content-center gap-2">
                    <i class="ph ph-arrow-square-out fs-5"></i> Postular en sitio oficial
                </a>
                
                <button class="btn btn-warning fw-bold text-dark px-4 py-2.5 flex-grow-1 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                        style="background: var(--sol); border: none; border-radius: 12px; transition: 0.2s;"
                        onclick="generateAIEssay()">
                    <i class="ph-fill ph-magic-wand fs-5"></i>  Redactar borrador con IA
                </button>

                <button class="btn-secondary-leady px-4 py-2.5 flex-grow-1 d-flex align-items-center justify-content-center gap-2" onclick="saveFavorite()">
                    <i class="ph ph-bookmark-simple fs-5"></i> Guardar en favoritos
                </button>
            </div>

            <p id="favorite-status" class="api-status mt-2"></p>
        `;

    } catch (error) {
        console.error("Error cargando detalle:", error);
        container.innerHTML = `
            <div class="p-4 rounded text-center my-4" style="background: rgba(224, 81, 47, 0.1); border: 1px solid var(--ceibo);">
                <i class="ph ph-warning-octagon text-danger" style="font-size: 2rem;"></i>
                <h4 class="mt-2 text-white">No pudimos cargar el detalle</h4>
                <p class="text-secondary mb-0">Asegurate de que FastAPI esté corriendo en el puerto 8000.<br><small class="text-danger">${error.message}</small></p>
            </div>
        `;
    }
}

// NUEVO: GENERADOR DE BORRADOR DE ENSAYO / CARTA CON IA (CONEXIÓN A FASTAPI)
async function generateAIEssay() {
    if (!currentOpportunityData) return;

    const modalEl = document.getElementById("ai-essay-modal");
    const contentEl = document.getElementById("ai-essay-content");
    
    if (!modalEl || !contentEl) return;

    // Mostrar modal con estado de carga
    contentEl.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center py-5 text-center gap-3">
            <div class="spinner-border text-warning" role="status" style="width: 3rem; height: 3rem;"></div>
            <div>
                <strong class="d-block text-white fs-6">Analizando requisitos y redactando tu esqueleto...</strong>
                <small class="text-secondary">Esto puede tomar unos segundos mientras GPT estructura los párrafos.</small>
            </div>
        </div>
    `;

    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
    bsModal.show();

    try {
        // 1. Obtener perfil de usuario
        const { data: sessionData } = await supabaseClient.auth.getSession();
        let userProfile = {};
        
        if (sessionData?.session) {
            const { data } = await supabaseClient
                .from("users_profiles")
                .select("*")
                .eq("id", sessionData.session.user.id)
                .maybeSingle();
            if (data) userProfile = data;
        }

        // 2. Enviar datos al endpoint de tu backend en FastAPI
        const payload = {
            user_profile: userProfile,
            opportunity_title: currentOpportunityData.title,
            opportunity_description: currentOpportunityData.description || "",
            opportunity_requirements: currentOpportunityData.benefits || ""
        };

        const res = await fetch(`${API_URL}/ai/generate-essay-outline`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("No se pudo generar el texto en el servidor.");

        const responseData = await res.json();
        
        // 3. Renderizar el borrador
        contentEl.textContent = responseData.draft || "No se recibió texto del servidor.";

    } catch (error) {
        console.error("Error generando borrador IA:", error);
        contentEl.innerHTML = `
            <div class="text-center py-4 text-danger">
                <i class="ph ph-warning fs-1 mb-2 d-block"></i>
                <p class="mb-1">Ocurrió un error al consultar con el mentor IA.</p>
                <small class="text-secondary">${error.message}</small>
            </div>
        `;
    }
}

// FUNCIÓN PARA COPIAR AL PORTAPAPELES
function copyEssayToClipboard(btnEl) {
    const textEl = document.getElementById("ai-essay-content");
    if (!textEl) return;

    navigator.clipboard.writeText(textEl.textContent).then(() => {
        const originalHtml = btnEl.innerHTML;
        btnEl.innerHTML = `<i class="ph-fill ph-check-circle fs-5 text-success"></i> <span>¡Copiado!</span>`;
        btnEl.classList.replace("btn-primary-leady", "btn-success");
        
        setTimeout(() => {
            btnEl.innerHTML = originalHtml;
            btnEl.classList.replace("btn-success", "btn-primary-leady");
        }, 2500);
    }).catch(err => {
        alert("No se pudo copiar el texto automáticamente. Por favor seleccioná y copiá manualmente.");
    });
}

// Globalizar funciones
window.saveFavorite = saveFavorite;
window.loadOpportunityDetail = loadOpportunityDetail;
window.generateAIEssay = generateAIEssay;
window.copyEssayToClipboard = copyEssayToClipboard;

setTimeout(() => {
    const container = document.getElementById("opportunity-detail");
    if (container && container.innerHTML.includes("Cargando")) {
        if (typeof protectPage === "function") {
            protectPage().then(user => { if (user) loadOpportunityDetail(); });
        } else {
            loadOpportunityDetail();
        }
    }
}, 50);