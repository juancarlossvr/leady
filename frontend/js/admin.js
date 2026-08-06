const API_URL = "https://api.leady.online";
let organizationsCache = [];

async function getToken() {
    const { data } = await supabaseClient.auth.getSession();
    return data.session?.access_token || null;
}

async function adminFetch(path, options = {}) {
    const token = await getToken();
    if (!token) {
        window.location.href = "login.html";
        return null;
    }

    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...(options.headers || {}),
        },
    });

    return res;
}

async function initAdmin() {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
        window.location.href = "login.html";
        return;
    }

    const res = await adminFetch("/admin/me");
    const checkingEl = document.getElementById("admin-checking");
    if (checkingEl) checkingEl.style.display = "none";

    if (res && res.ok) {
        const panelEl = document.getElementById("admin-panel");
        if (panelEl) panelEl.style.display = "block";
        loadOrganizations();
        loadOpportunities();
    } else {
        const deniedEl = document.getElementById("admin-denied");
        if (deniedEl) deniedEl.style.display = "block";
    }
}

function switchTab(tab) {
    document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".admin-section").forEach(s => s.style.display = "none");
    if (event && event.target) event.target.classList.add("active");
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) tabEl.style.display = "block";
}

function textToArray(text) {
    if (!text) return null;
    const arr = text.split(",").map(s => s.trim()).filter(s => s);
    return arr.length ? arr : null;
}

function numOrNull(val) {
    return val === "" || val === null ? null : Number(val);
}

// ============================================================
// OPORTUNIDADES
// ============================================================
async function loadOpportunities() {
    const container = document.getElementById("opp-list");
    if (!container) return;

    container.innerHTML = `<p class="text-secondary"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Cargando convocatorias...</p>`;

    const res = await adminFetch("/admin/opportunities");
    if (!res || !res.ok) {
        container.innerHTML = "<p class='text-danger'>Error cargando oportunidades desde el backend.</p>";
        return;
    }
    const opps = await res.json();

    if (!opps.length) {
        container.innerHTML = "<p class='text-secondary'>No hay oportunidades cargadas en el sistema.</p>";
        return;
    }

    container.innerHTML = opps.map(o => {
        let statusClass = "admin-status-closed";
        if (o.status === "open") statusClass = "admin-status-open";

        return `
            <div class="admin-row">
                <div class="admin-row-info">
                    <strong>${o.title}</strong>
                    <span class="admin-row-meta mt-1 d-block">
                        <span class="text-light">${o.type}</span> · 
                        ${o.organizations?.name || "Sin org"} · 
                        Vence: ${o.deadline || "Permanente"} · 
                        <span class="admin-status ${statusClass} ms-1">${o.status.toUpperCase()}</span>
                    </span>
                </div>
                <div class="admin-row-actions">
                    <button class="admin-btn-edit" title="Editar" onclick='editOpportunity(${JSON.stringify(o).replace(/'/g, "&#39;")})'>
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="admin-btn-delete" title="Eliminar" onclick="deleteOpportunity('${o.id}', '${o.title.replace(/'/g, "")}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join("");
}

async function saveOpportunity(event) {
    event.preventDefault();
    const msg = document.getElementById("opp-status-msg");
    msg.textContent = "Guardando en base de datos...";
    msg.className = "api-status mt-3 text-warning";

    const id = document.getElementById("opp-id").value;
    const body = {
        title: document.getElementById("opp-title").value,
        type: document.getElementById("opp-type").value,
        description: document.getElementById("opp-description").value || null,
        organization_id: document.getElementById("opp-org").value,
        min_age: numOrNull(document.getElementById("opp-min-age").value),
        max_age: numOrNull(document.getElementById("opp-max-age").value),
        required_academic_level: document.getElementById("opp-academic-level").value || null,
        required_languages: textToArray(document.getElementById("opp-languages").value),
        city: document.getElementById("opp-city").value || null,
        department: document.getElementById("opp-department").value || null,
        modality: document.getElementById("opp-modality").value || null,
        cost: document.getElementById("opp-cost").value || null,
        benefits: document.getElementById("opp-benefits").value || null,
        deadline: document.getElementById("opp-deadline").value || null,
        official_url: document.getElementById("opp-url").value || null,
        status: document.getElementById("opp-status").value,
    };

    const path = id ? `/admin/opportunities/${id}` : "/admin/opportunities";
    const method = id ? "PUT" : "POST";

    const res = await adminFetch(path, { method, body: JSON.stringify(body) });

    if (res && res.ok) {
        msg.textContent = id ? "¡Oportunidad actualizada con éxito!" : "¡Oportunidad creada y publicada!";
        msg.className = "api-status mt-3 text-success";
        resetOppForm();
        loadOpportunities();
    } else {
        msg.textContent = "Hubo un error al guardar. Verificá los campos obligatorios (*).";
        msg.className = "api-status mt-3 text-danger";
    }
}

function editOpportunity(o) {
    document.getElementById("opp-form-title").textContent = "Editar oportunidad";
    document.getElementById("opp-id").value = o.id;
    document.getElementById("opp-title").value = o.title || "";
    document.getElementById("opp-type").value = o.type || "Otro";
    document.getElementById("opp-description").value = o.description || "";
    document.getElementById("opp-org").value = o.organization_id || "";
    document.getElementById("opp-min-age").value = o.min_age ?? "";
    document.getElementById("opp-max-age").value = o.max_age ?? "";
    document.getElementById("opp-academic-level").value = o.required_academic_level || "";
    document.getElementById("opp-languages").value = (o.required_languages || []).join(", ");
    document.getElementById("opp-city").value = o.city || "";
    document.getElementById("opp-department").value = o.department || "";
    document.getElementById("opp-modality").value = o.modality || "";
    document.getElementById("opp-cost").value = o.cost || "";
    document.getElementById("opp-benefits").value = o.benefits || "";
    document.getElementById("opp-deadline").value = o.deadline || "";
    document.getElementById("opp-url").value = o.official_url || "";
    document.getElementById("opp-status").value = o.status || "open";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteOpportunity(id, title) {
    if (!confirm(`¿Eliminar definitivamente "${title}"? Esta acción no se puede deshacer.`)) return;
    const res = await adminFetch(`/admin/opportunities/${id}`, { method: "DELETE" });
    if (res && res.ok) loadOpportunities();
}

function resetOppForm() {
    document.getElementById("opp-form-title").textContent = "Nueva oportunidad";
    document.getElementById("opp-id").value = "";
    document.querySelectorAll("#tab-opportunities input, #tab-opportunities textarea").forEach(el => el.value = "");
    document.getElementById("opp-type").value = "Beca internacional";
    document.getElementById("opp-status").value = "open";
    const msg = document.getElementById("opp-status-msg");
    if (msg) msg.textContent = "";
}

// ============================================================
// ORGANIZACIONES
// ============================================================
async function loadOrganizations() {
    const res = await adminFetch("/admin/organizations");
    if (!res || !res.ok) return;
    organizationsCache = await res.json();

    const select = document.getElementById("opp-org");
    if (select) {
        select.innerHTML = organizationsCache
            .map(o => `<option value="${o.id}">${o.name}</option>`)
            .join("");
    }

    const container = document.getElementById("org-list");
    if (!container) return;

    if (!organizationsCache.length) {
        container.innerHTML = "<p class='text-secondary'>No hay organizaciones registradas.</p>";
        return;
    }

    container.innerHTML = organizationsCache.map(o => `
        <div class="admin-row">
            <div class="admin-row-info">
                <strong>${o.name}</strong>
                <span class="admin-row-meta mt-1 d-block">
                    ${o.instagram_url ? '<i class="bi bi-instagram me-1"></i>Instagram · ' : ""}
                    ${o.website_url ? '<i class="bi bi-globe me-1"></i>Web · ' : ""}
                    ${o.contact_email || "Sin email registrado"}
                </span>
            </div>
            <div class="admin-row-actions">
                <button class="admin-btn-edit" title="Editar" onclick='editOrganization(${JSON.stringify(o).replace(/'/g, "&#39;")})'>
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="admin-btn-delete" title="Eliminar" onclick="deleteOrganization('${o.id}', '${o.name.replace(/'/g, "")}')">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        </div>
    `).join("");
}

async function saveOrganization(event) {
    event.preventDefault();
    const msg = document.getElementById("org-status-msg");
    msg.textContent = "Guardando organización...";
    msg.className = "api-status mt-3 text-warning";

    const id = document.getElementById("org-id").value;
    const body = {
        name: document.getElementById("org-name").value,
        description: document.getElementById("org-description").value || null,
        website_url: document.getElementById("org-website").value || null,
        instagram_url: document.getElementById("org-instagram").value || null,
        contact_email: document.getElementById("org-email").value || null,
        logo_url: document.getElementById("org-logo").value || null,
        city: document.getElementById("org-city").value || null,
        department: document.getElementById("org-department").value || null,
    };

    const path = id ? `/admin/organizations/${id}` : "/admin/organizations";
    const method = id ? "PUT" : "POST";

    const res = await adminFetch(path, { method, body: JSON.stringify(body) });

    if (res && res.ok) {
        msg.textContent = id ? "¡Organización actualizada!" : "¡Organización creada con éxito!";
        msg.className = "api-status mt-3 text-success";
        resetOrgForm();
        loadOrganizations();
    } else {
        msg.textContent = "Error al guardar. Verificá que el nombre no esté vacío.";
        msg.className = "api-status mt-3 text-danger";
    }
}

function editOrganization(o) {
    document.getElementById("org-form-title").textContent = "Editar organización";
    document.getElementById("org-id").value = o.id;
    document.getElementById("org-name").value = o.name || "";
    document.getElementById("org-description").value = o.description || "";
    document.getElementById("org-website").value = o.website_url || "";
    document.getElementById("org-instagram").value = o.instagram_url || "";
    document.getElementById("org-email").value = o.contact_email || "";
    document.getElementById("org-logo").value = o.logo_url || "";
    document.getElementById("org-city").value = o.city || "";
    document.getElementById("org-department").value = o.department || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteOrganization(id, name) {
    if (!confirm(`¿Eliminar "${name}"? Se eliminarán también todas sus convocatorias vinculadas.`)) return;
    const res = await adminFetch(`/admin/organizations/${id}`, { method: "DELETE" });
    if (res && res.ok) loadOrganizations();
}

function resetOrgForm() {
    document.getElementById("org-form-title").textContent = "Nueva organización";
    document.getElementById("org-id").value = "";
    document.querySelectorAll("#tab-organizations input, #tab-organizations textarea").forEach(el => el.value = "");
    const msg = document.getElementById("org-status-msg");
    if (msg) msg.textContent = "";
}

window.switchTab = switchTab;
window.saveOpportunity = saveOpportunity;
window.editOpportunity = editOpportunity;
window.deleteOpportunity = deleteOpportunity;
window.resetOppForm = resetOppForm;
window.saveOrganization = saveOrganization;
window.editOrganization = editOrganization;
window.deleteOrganization = deleteOrganization;
window.resetOrgForm = resetOrgForm;

initAdmin();