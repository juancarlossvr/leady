const API_URL = "http://127.0.0.1:8000";

const GREETINGS_CATALOG = [
    { text: "¡Mba'éichapa", lang: "Guaraní 🇵🇾" },
    { text: "¡Bienvenido", lang: "Español" },
    { text: "Welcome", lang: "Inglés 🇬🇧" },
    { text: "Bem-vindo", lang: "Portugués 🇧🇷" },
    { text: "Willkommen", lang: "Alemán 🇩🇪" },
    { text: "Bienvenue", lang: "Francés 🇫🇷" },
    { text: "Benvenuto", lang: "Italiano 🇮🇹" },
    { text: "ようこそ (Yōkoso)", lang: "Japonés 🇯🇵" }
];

let greetingIndex = 0;

// 1. Motor de Saludo Multilingüe Dinámico
function initDynamicGreeting(userFirstName = "") {
    const greetingTextEl = document.getElementById("dynamic-greeting-text");
    const langBadgeEl = document.getElementById("dynamic-greeting-lang");

    if (!greetingTextEl) return;

    // Primer render inmediato
    const nameSuffix = userFirstName ? `, ${userFirstName}` : "";
    greetingTextEl.textContent = `${GREETINGS_CATALOG[0].text}${nameSuffix}!`;

    // Rotación cada 3.5 segundos
    setInterval(() => {
        greetingTextEl.classList.add("greeting-fade-out");

        setTimeout(() => {
            greetingIndex = (greetingIndex + 1) % GREETINGS_CATALOG.length;
            const current = GREETINGS_CATALOG[greetingIndex];

            greetingTextEl.textContent = `${current.text}${nameSuffix}!`;

            if (langBadgeEl) {
                langBadgeEl.textContent = current.lang;
            }

            greetingTextEl.classList.remove("greeting-fade-out");
        }, 400);
    }, 3500);
}

// 2. Cargar perfil del usuario logueado e iniciar el saludo
async function loadCurrentUser() {
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData?.session) return;

        const userId = sessionData.session.user.id;

        const { data: profile } = await supabaseClient
            .from("users_profiles")
            .select("full_name, username")
            .eq("id", userId)
            .maybeSingle();

        const fullName = profile?.full_name || "Líder";
        const username = profile?.username || "usuario";
        const firstName = fullName.trim().split(" ")[0];

        const userInfoEl = document.getElementById("user-info");
        if (userInfoEl) {
            userInfoEl.textContent = `Hola, ${fullName}. Estás conectado como @${username}.`;
        }

        // ¡AQUÍ INICIAMOS EL SALUDO DINÁMICO!
        initDynamicGreeting(firstName);

    } catch (err) {
        console.error("Error al cargar datos del usuario:", err);
        initDynamicGreeting();
    }
}

function truncateText(text, maxLength = 110) {
    if (!text || text.length <= maxLength) return text || "Sin descripción disponible.";
    return text.substring(0, text.lastIndexOf(" ", maxLength)) + "...";
}

function buildFavoriteCard(favorite) {
    const opportunity = favorite.opportunities;
    const organization = opportunity.organizations;
    const organizationName = organization?.name || "Organización no especificada";

    return `
        <div class="col-md-6 d-flex align-items-stretch">
            <div class="opportunity-card d-flex flex-column w-100">
                <div class="flex-grow-1">
                    <span class="opportunity-type">${opportunity.type || "Oportunidad"}</span>
                    <p class="organization-name mt-3 mb-1">${organizationName}</p>
                    <h3 class="mb-2">${opportunity.title}</h3>
                    <p class="text-secondary mb-3" style="font-size: 0.9rem;">
                        ${truncateText(opportunity.description)}
                    </p>
                </div>

                <div class="mt-auto pt-3" style="border-top: 1px solid var(--border);">
                    <div class="mb-2">
                        ${typeof getDeadlineBadge === "function" ? getDeadlineBadge(opportunity.deadline) : ""}
                    </div>

                    <div class="opportunity-meta mb-3">
                        <span>
                            <i class="ph ph-globe-hemisphere-west fs-6 me-1"></i>
                            ${opportunity.country || "Paraguay / Online"}
                        </span>
                    </div>

                    <a href="opportunity-detail.html?id=${opportunity.id}"
                       class="btn-primary-leady text-decoration-none w-100 text-center d-block">
                        Ver detalle guardado
                    </a>
                </div>
            </div>
        </div>
    `;
}

function getEmptyFavoritesState() {
    return `
        <div class="col-12 text-center py-4">
            <div class="p-4 rounded-3" style="background: var(--background-secondary); border: 1px dashed var(--border-2); max-width: 500px; margin: 0 auto;">
                <i class="ph ph-bookmark-simple text-secondary d-block mb-2" style="font-size: 2.5rem;"></i>
                <h4 class="mt-2 mb-1" style="color: var(--sol);">Aún no guardaste oportunidades</h4>
                <p class="text-secondary mb-3" style="font-size: 0.9rem;">
                    Cuando veas una beca o voluntariado de tu interés, presioná "Guardar oportunidad" para tenerla a mano acá.
                </p>
                <a href="opportunities.html" class="btn-secondary-leady text-decoration-none d-inline-block px-4 py-2">
                    Explorar convocatorias
                </a>
            </div>
        </div>
    `;
}

async function loadFavorites() {
    const container = document.getElementById("favorites-container");
    const favCountEl = document.getElementById("stat-favorites-count");
    if (!container) return;

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
        window.location.href = "login.html";
        return;
    }

    const user = sessionData.session.user;

    try {
        container.innerHTML = `
            <div class="col-12 text-center py-3">
                <span class="spinner-border spinner-border-sm text-warning me-2" role="status"></span>
                <span class="text-secondary">Cargando tus favoritos...</span>
            </div>
        `;

        const { data: favorites, error } = await supabaseClient
            .from("favorites")
            .select(`
                id,
                opportunities (
                    id,
                    title,
                    type,
                    description,
                    country,
                    deadline,
                    organizations (
                        name,
                        logo_url
                    )
                )
            `)
            .eq("user_id", user.id);

        if (error) throw error;

        if (favCountEl) favCountEl.textContent = favorites ? favorites.length : 0;

        if (!favorites || favorites.length === 0) {
            container.innerHTML = getEmptyFavoritesState();
            return;
        }

        container.innerHTML = favorites.map(buildFavoriteCard).join("");

    } catch (error) {
        console.error("Error cargando favoritos:", error);
        container.innerHTML = `<p class="text-danger">Ocurrió un error al cargar tus favoritos.</p>`;
    }
}

window.loadCurrentUser = loadCurrentUser;
window.loadFavorites = loadFavorites;

// Ejecutar cargas al iniciar
loadFavorites();