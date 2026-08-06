// ============================================================
// utils.js — funciones compartidas por varias páginas de Leady
// Cargar ANTES de opportunities.js / recommendations.js / dashboard.js
// ============================================================

/**
 * Devuelve el HTML de un badge de vigencia según la fecha límite.
 * - Sin fecha    → "Fecha no confirmada"
 * - Vencida      → "Cerrada"
 * - <= 7 días    → "¡Últimos días!"
 * - <= 30 días   → "Cierra pronto"
 * - > 30 días    → fecha normal
 */
function getDeadlineBadge(deadline) {
    if (!deadline) {
        return `<span class="deadline-badge unconfirmed">
                    <i class="bi bi-question-circle"></i> Fecha no confirmada
                </span>`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dl = new Date(deadline + "T00:00:00");

    const diffDays = Math.ceil((dl - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return `<span class="deadline-badge closed">
                    <i class="bi bi-x-circle"></i> Cerrada
                </span>`;
    }

    if (diffDays <= 7) {
        return `<span class="deadline-badge urgent">
                    <i class="bi bi-fire"></i> ¡Últimos días! Cierra ${formatDate(deadline)}
                </span>`;
    }

    if (diffDays <= 30) {
        return `<span class="deadline-badge soon">
                    <i class="bi bi-clock-fill"></i> Cierra ${formatDate(deadline)}
                </span>`;
    }

    return `<span class="deadline-badge ok">
                <i class="bi bi-calendar-check"></i> Cierra ${formatDate(deadline)}
            </span>`;
}

/** Formatea "2026-04-30" → "30 abr 2026" */
function formatDate(dateStr) {
    const meses = ["ene", "feb", "mar", "abr", "may", "jun",
                   "jul", "ago", "sep", "oct", "nov", "dic"];
    const d = new Date(dateStr + "T00:00:00");
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// Tipos que consideramos "fijos" (permanentes, sin fecha límite)
const FIXED_TYPES = ["Membresía", "Membresia", "Permanente"];

function isFixedOpportunity(type) {
    return FIXED_TYPES.includes(type);
}

/**
 * Para oportunidades fijas: muestra "Abierto todo el año" + contacto de la org.
 * 'org' es el objeto organización (con instagram_url, website_url, contact_email).
 */
function getFixedBadge(org) {
    let contacts = "";

    if (org?.instagram_url) {
        contacts += `<a href="${org.instagram_url}" target="_blank" class="contact-link">
                        <i class="bi bi-instagram"></i>
                     </a>`;
    }
    if (org?.website_url) {
        contacts += `<a href="${org.website_url}" target="_blank" class="contact-link">
                        <i class="bi bi-globe"></i>
                     </a>`;
    }
    if (org?.contact_email) {
        contacts += `<a href="mailto:${org.contact_email}" class="contact-link">
                        <i class="bi bi-envelope"></i>
                     </a>`;
    }

    return `<div class="fixed-badge-wrap">
                <span class="deadline-badge fixed">
                    <i class="bi bi-infinity"></i> Abierto todo el año
                </span>
                ${contacts ? `<span class="contact-links">${contacts}</span>` : ""}
            </div>`;
}

/**
 * Decide qué badge mostrar según el tipo de oportunidad.
 * Si es fija → contacto. Si es temporal → fecha.
 */
function getOpportunityBadge(opportunity, org) {
    if (isFixedOpportunity(opportunity.type)) {
        return getFixedBadge(org);
    }
    return getDeadlineBadge(opportunity.deadline);
}

// Registro automático de la PWA (Service Worker)
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js")
            .then((registration) => {
                console.log("PWA: Service Worker registrado con éxito. Alcance:", registration.scope);
            })
            .catch((error) => {
                console.error("PWA: Error al registrar el Service Worker:", error);
            });
    });
}