// navbar.js — Navegación con Avatar real, Racha Diaria (Phosphor Icons) y permisos Admin
async function buildNavbar() {
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf("/") + 1) || "index.html";

    let isLoggedIn = false;
    let userAvatarUrl = null;
    let userName = "";
    let userStreak = 1;

    if (typeof supabaseClient !== "undefined" && supabaseClient?.auth) {
        try {
            const { data } = await supabaseClient.auth.getSession();
            if (data.session) {
                isLoggedIn = true;
                const userId = data.session.user.id;

                // Cargar avatar, nombre y racha desde la base de datos
                const { data: profile } = await supabaseClient
                    .from("users_profiles")
                    .select("avatar_url, full_name, current_streak")
                    .eq("id", userId)
                    .maybeSingle();

                if (profile) {
                    userAvatarUrl = profile.avatar_url;
                    userName = profile.full_name || "Usuario";
                    userStreak = profile.current_streak || 1;
                }
            }
        } catch (error) {
            console.error("Navbar: error al verificar sesión", error);
        }
    }

    const loggedOutLinks = [
        { label: "Oportunidades", href: "opportunities.html" },
        { label: "Iniciar sesión", href: "login.html" },
        { label: "Crear cuenta", href: "register.html", primary: true }
    ];

    const loggedInLinks = [
        { label: "Dashboard", href: "dashboard.html" },
        { label: "Oportunidades", href: "opportunities.html" },
        { label: "La Plaza", href: "community.html" }
    ];

    const links = isLoggedIn ? [...loggedInLinks] : [...loggedOutLinks];

    if (isLoggedIn) {
        const isOwner = await checkIsOwner();
        if (isOwner) {
            links.push({ label: "<i class='ph ph-shield-check me-1'></i> Panel", href: "admin.html", owner: true });
        }
    }

    const linksHtml = links.map(link => {
        const isActive = link.href === currentPage ? "active" : "";
        let customClass = "";

        if (link.primary) customClass = "btn-primary-leady text-dark py-1 px-3";
        else if (link.owner) customClass = "nav-link-owner";

        return `
            <a href="${link.href}" class="nav-link-leady ${isActive} ${customClass}">
                ${link.label}
            </a>
        `;
    }).join("");

    // Avatar real o icono genérico
    const avatarBadgeHtml = userAvatarUrl
        ? `<img src="${userAvatarUrl}" alt="Avatar" class="rounded-circle" style="width: 30px; height: 30px; object-fit: cover; border: 1.5px solid var(--sol);">`
        : `<i class="ph ph-user-circle fs-4 text-warning"></i>`;

    // PÍLDORA DE RACHA ESTILIZADA (Diseño UI moderno con Phosphor Icons)
    const streakPillHtml = `
        <div class="streak-pill d-flex align-items-center gap-1.5 px-2.5 py-1 rounded-pill" 
             style="background: rgba(255, 183, 3, 0.1); border: 1px solid rgba(255, 183, 3, 0.25); cursor: help;" 
             title="Racha activa: ${userStreak} día${userStreak > 1 ? 's' : ''} consecutivo${userStreak > 1 ? 's' : ''} visitando Leady">
            <i class="ph-fill ph-fire text-warning fs-6"></i>
            <span class="fw-bold text-warning style-sm">${userStreak}</span>
        </div>
    `;

    const profileLinkHtml = isLoggedIn
        ? `
            <div class="d-flex align-items-center gap-3">
                ${streakPillHtml}
                <a href="profile.html" class="nav-link-leady d-flex align-items-center gap-2 ${currentPage === 'profile.html' ? 'active' : ''}">
                    ${avatarBadgeHtml}
                    <span>Mi perfil</span>
                </a>
            </div>
          `
        : "";

    const logoutHtml = isLoggedIn
        ? `<button class="nav-link-leady nav-logout" onclick="navbarLogout()"><i class="ph ph-sign-out me-1"></i> Salir</button>`
        : "";

    const navbarHtml = `
        <nav class="leady-navbar">
            <div class="leady-navbar-inner">
                <a href="${isLoggedIn ? "dashboard.html" : "index.html"}" class="leady-logo">
                    <img src="assets/img/leady-logo.png" alt="Leady" class="leady-logo-img">
                    <span>Leady</span>
                </a>

                <button class="leady-navbar-toggle" onclick="toggleMobileNav()" aria-label="Menú">
                    <i class="ph ph-list fs-3"></i>
                </button>

                <div class="leady-navbar-links" id="leady-navbar-links">
                    ${linksHtml}
                    ${profileLinkHtml}
                    ${logoutHtml}
                </div>
            </div>
        </nav>
    `;

    document.body.insertAdjacentHTML("afterbegin", navbarHtml);
}

async function checkIsOwner() {
    try {
        const { data } = await supabaseClient.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return false;

        const res = await fetch("https://api.leady.online/admin/me", {
            headers: { "Authorization": `Bearer ${token}` }
        });
        return res.ok;
    } catch (error) {
        return false;
    }
}

async function navbarLogout() {
    if (typeof supabaseClient !== "undefined" && supabaseClient?.auth) {
        await supabaseClient.auth.signOut();
    }
    window.location.href = "index.html";
}

function toggleMobileNav() {
    const links = document.getElementById("leady-navbar-links");
    if (links) {
        links.classList.toggle("open");
    }
}

window.navbarLogout = navbarLogout;
window.toggleMobileNav = toggleMobileNav;

buildNavbar();