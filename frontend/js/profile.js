const ALL_BADGES = [
    { code: "pionero", title: "Pionero", description: "Perfil completado al 100%", icon: "ph-user-check", color: "var(--sol)" },
    { code: "explorador", title: "Explorador", description: "Guardó al menos 3 oportunidades", icon: "ph-bookmark-simple", color: "var(--gua-claro)" },
    { code: "comunitario", title: "Comunitario", description: "Publicó en La Plaza", icon: "ph-chat-circle-text", color: "var(--selva)" },
    { code: "aguyje", title: "Aguyjé", description: "Participó activamente en la comunidad", icon: "ph-thumbs-up", color: "var(--ceibo)" }
];

let cropperInstance = null;
let selectedFileExt = "jpg";

function textToArray(text) {
    if (!text) return [];
    return text.split(",").map(item => item.trim()).filter(item => item.length > 0);
}

function getInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
}

// 1. Selección de archivo y apertura del Modal con Cropper
function handleAvatarSelect(event) {
    const file = event.target.files[0];
    const status = document.getElementById("avatar-upload-status");

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        if (status) {
            status.textContent = "La imagen es muy pesada. Máximo 5 MB.";
            status.className = "api-status mt-2 text-danger";
        }
        return;
    }

    selectedFileExt = file.name.split('.').pop() || "jpg";

    const reader = new FileReader();
    reader.onload = function (e) {
        const imageTarget = document.getElementById("crop-image-target");
        imageTarget.src = e.target.result;

        const cropModalEl = document.getElementById("cropAvatarModal");
        const cropModal = bootstrap.Modal.getOrCreateInstance(cropModalEl);
        cropModal.show();

        // Inicializar Cropper cuando el modal esté visible
        cropModalEl.addEventListener('shown.bs.modal', function () {
            if (cropperInstance) cropperInstance.destroy();
            cropperInstance = new Cropper(imageTarget, {
                aspectRatio: 1, // Cuadrado perfecto (1:1)
                viewMode: 1,
                autoCropArea: 0.9,
                background: false
            });
        }, { once: true });
    };

    reader.readAsDataURL(file);
    event.target.value = ""; // Limpiar input para permitir seleccionar la misma foto
}

// 2. Recortar la foto y subirla a Supabase Storage
async function saveCroppedAvatar() {
    if (!cropperInstance) return;

    const status = document.getElementById("avatar-upload-status");
    if (status) {
        status.textContent = "Procesando y subiendo foto...";
        status.className = "api-status mt-2 text-warning";
    }

    // Obtener imagen recortada en canvas
    const canvas = cropperInstance.getCroppedCanvas({
        width: 400,
        height: 400
    });

    canvas.toBlob(async (blob) => {
        if (!blob) return;

        // Cerrar modal de recorte
        const cropModalEl = document.getElementById("cropAvatarModal");
        const modal = bootstrap.Modal.getInstance(cropModalEl);
        if (modal) modal.hide();

        try {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            if (!sessionData.session) return;
            const userId = sessionData.session.user.id;

            const filePath = `${userId}/avatar_${Date.now()}.${selectedFileExt}`;

            // Subir Blob a Storage
            const { error: uploadError } = await supabaseClient
                .storage
                .from('avatars')
                .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

            if (uploadError) throw new Error(`Storage: ${uploadError.message}`);

            // Obtener URL Pública
            const { data: publicUrlData } = supabaseClient
                .storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl = publicUrlData.publicUrl;

            // Actualizar URL en la tabla
            const { error: profileError } = await supabaseClient
                .from('users_profiles')
                .update({ avatar_url: avatarUrl })
                .eq('id', userId);

            if (profileError) throw new Error(`Base de Datos: ${profileError.message}`);

            if (status) {
                status.textContent = "¡Foto de perfil actualizada!";
                status.className = "api-status mt-2 text-success";
            }

            // Recargar perfil inmediatamente
            loadProfile();

        } catch (error) {
            console.error("Error al guardar avatar:", error);
            if (status) {
                status.textContent = `Falló: ${error.message}`;
                status.className = "api-status mt-2 text-danger";
            }
        }
    }, 'image/jpeg', 0.9);
}

// Renderizar la foto de perfil en el círculo del HTML
function renderAvatar(avatarUrl, fullName) {
    const container = document.getElementById("profile-avatar-container");
    if (!container) return;

    if (avatarUrl && avatarUrl.trim() !== "") {
        container.innerHTML = `<img src="${avatarUrl}" alt="Foto de perfil" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        container.innerHTML = `<span id="profile-avatar-text">${getInitials(fullName)}</span>`;
    }
}

async function loadBadges(userId) {
    const container = document.getElementById("badges-container");
    const statBadges = document.getElementById("stat-badges");
    if (!container) return;

    try {
        const { data: userBadges } = await supabaseClient
            .from("user_badges")
            .select("badge_code")
            .eq("user_id", userId);

        const unlockedCodes = new Set((userBadges || []).map(b => b.badge_code));
        if (statBadges) statBadges.textContent = `${unlockedCodes.size} / ${ALL_BADGES.length}`;

        container.innerHTML = ALL_BADGES.map(badge => {
            const isUnlocked = unlockedCodes.has(badge.code);
            const opacityClass = isUnlocked ? "opacity-100" : "opacity-30";
            const statusLabel = isUnlocked 
                ? `<span class="badge bg-success bg-opacity-25 text-success style-sm mt-1"><i class="ph ph-check me-1"></i>Desbloqueada</span>`
                : `<span class="badge bg-secondary bg-opacity-25 text-secondary style-sm mt-1"><i class="ph ph-lock-key me-1"></i>Bloqueada</span>`;

            return `
                <div class="col-6 col-sm-6">
                    <div class="p-3 rounded-3 h-100 d-flex flex-column align-items-center text-center ${opacityClass}" 
                         style="background: var(--surface-2); border: 1px solid var(--border);">
                        <div class="rounded-circle d-grid place-items-center mb-2" 
                             style="width: 44px; height: 44px; background: rgba(255,255,255,0.05); color: ${isUnlocked ? badge.color : 'var(--border-2)'}; font-size: 1.4rem;">
                            <i class="ph ${badge.icon}"></i>
                        </div>
                        <strong class="text-white fs-6 mb-1">${badge.title}</strong>
                        <small class="text-secondary mb-2" style="font-size: 0.75rem; line-height: 1.2;">${badge.description}</small>
                        <div class="mt-auto">${statusLabel}</div>
                    </div>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Error cargando insignias:", err);
    }
}

async function loadUserStats(userId) {
    try {
        const [favsRes, postsRes, likesRes] = await Promise.all([
            supabaseClient.from("favorites").select("id", { count: 'exact' }).eq("user_id", userId),
            supabaseClient.from("community_posts").select("id", { count: 'exact' }).eq("user_id", userId),
            supabaseClient.from("post_likes").select("id", { count: 'exact' }).eq("user_id", userId)
        ]);

        if (document.getElementById("stat-favorites")) document.getElementById("stat-favorites").textContent = favsRes.count || 0;
        if (document.getElementById("stat-posts")) document.getElementById("stat-posts").textContent = postsRes.count || 0;
        if (document.getElementById("stat-likes")) document.getElementById("stat-likes").textContent = likesRes.count || 0;

        if ((favsRes.count || 0) >= 3) {
            await supabaseClient.from("user_badges").insert([{ user_id: userId, badge_code: "explorador" }]).catch(() => {});
        }
    } catch (err) {
        console.error("Error cargando estadísticas:", err);
    }
}

async function loadProfile() {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) {
        window.location.href = "login.html";
        return;
    }

    const user = sessionData.session.user;

    loadBadges(user.id);
    loadUserStats(user.id);

    const [profileResult, interestsResult] = await Promise.all([
        supabaseClient.from("users_profiles").select("*").eq("id", user.id).maybeSingle(),
        supabaseClient.from("user_interests").select("interest").eq("user_id", user.id)
    ]);

    const { data: profile } = profileResult;
    if (!profile) return;

    // AHORA SÍ LLAMAMOS A RENDERAVATAR PARA DIBUJAR LA FOTO EN PANTALLA
    renderAvatar(profile.avatar_url, profile.full_name);

    // Rellenar Vista Social
    if (document.getElementById("view-full-name")) document.getElementById("view-full-name").textContent = profile.full_name || "Usuario de Leady";
    if (document.getElementById("view-username")) document.getElementById("view-username").textContent = `@${profile.username || 'usuario'}`;
    if (document.getElementById("view-academic-level")) document.getElementById("view-academic-level").innerHTML = `<i class="ph ph-graduation-cap me-1"></i> ${profile.academic_level || "Estudiante"}`;
    if (document.getElementById("view-location")) document.getElementById("view-location").innerHTML = `<i class="ph ph-map-pin me-1 text-warning"></i> ${profile.city || "Paraguay"}${profile.department ? ', ' + profile.department : ''}`;
    if (document.getElementById("view-age")) document.getElementById("view-age").innerHTML = `<i class="ph ph-identification-card me-1 text-warning"></i> ${profile.age ? profile.age + ' años' : 'Edad no especificada'}`;
    if (document.getElementById("view-average")) document.getElementById("view-average").innerHTML = `<i class="ph ph-chart-bar me-1 text-warning"></i> Promedio: ${profile.academic_average || 'N/A'}`;
    if (document.getElementById("view-experience")) document.getElementById("view-experience").textContent = profile.experience || "Aún no especificaste tu biografía o trayectoria.";

    // Renderizar Tags de Idiomas
    const langContainer = document.getElementById("view-languages-tags");
    if (langContainer && profile.languages && profile.languages.length > 0) {
        langContainer.innerHTML = profile.languages.map(l => `<span class="badge bg-secondary bg-opacity-25 text-light px-3 py-2 fw-normal">${l}</span>`).join("");
    }

    // Renderizar Tags de Intereses
    const { data: interests } = interestsResult;
    const intContainer = document.getElementById("view-interests-tags");
    if (intContainer && interests && interests.length > 0) {
        intContainer.innerHTML = interests.map(i => `<span class="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-3 py-2 fw-normal">${i.interest}</span>`).join("");
    }

    // Pre-llenar Formulario dentro del Modal
    if (document.getElementById("profile-full-name")) document.getElementById("profile-full-name").value = profile.full_name || "";
    if (document.getElementById("profile-username")) document.getElementById("profile-username").value = profile.username || "";
    if (document.getElementById("profile-birth-date")) document.getElementById("profile-birth-date").value = profile.birth_date || "";
    if (document.getElementById("profile-age")) document.getElementById("profile-age").value = profile.age || "";
    if (document.getElementById("profile-city")) document.getElementById("profile-city").value = profile.city || "";
    if (document.getElementById("profile-department")) document.getElementById("profile-department").value = profile.department || "";
    if (document.getElementById("profile-academic-level")) document.getElementById("profile-academic-level").value = profile.academic_level || "";
    if (document.getElementById("profile-academic-average")) document.getElementById("profile-academic-average").value = profile.academic_average || "";
    if (document.getElementById("profile-experience")) document.getElementById("profile-experience").value = profile.experience || "";
    if (document.getElementById("profile-languages")) document.getElementById("profile-languages").value = profile.languages ? profile.languages.join(", ") : "";
    if (interests && document.getElementById("profile-interests")) document.getElementById("profile-interests").value = interests.map(item => item.interest).join(", ");
}

async function updateProfile(event) {
    event.preventDefault();

    const status = document.getElementById("profile-status");
    if (status) {
        status.textContent = "Guardando cambios...";
        status.className = "api-status mt-3 text-warning";
    }

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;
    const user = sessionData.session.user;

    const fullName = document.getElementById("profile-full-name")?.value || "";
    const username = document.getElementById("profile-username")?.value || "";
    const birthDate = document.getElementById("profile-birth-date")?.value || null;
    const ageVal = document.getElementById("profile-age")?.value;
    const age = ageVal ? Number(ageVal) : null;
    const city = document.getElementById("profile-city")?.value || "";
    const department = document.getElementById("profile-department")?.value || "";
    const academicLevel = document.getElementById("profile-academic-level")?.value || "";
    const academicAverageValue = document.getElementById("profile-academic-average")?.value;
    const academicAverage = academicAverageValue ? Number(academicAverageValue) : null;
    const experience = document.getElementById("profile-experience")?.value || "";
    const languages = textToArray(document.getElementById("profile-languages")?.value || "");
    const interests = textToArray(document.getElementById("profile-interests")?.value || "");

    const { error } = await supabaseClient
        .from("users_profiles")
        .upsert({
            id: user.id,
            full_name: fullName,
            username: username,
            birth_date: birthDate,
            age: age,
            city: city,
            department: department,
            academic_level: academicLevel,
            academic_average: academicAverage,
            experience: experience,
            languages: languages,
            updated_at: new Date().toISOString()
        });

    if (error) {
        console.error("Error al guardar:", error);
        if (status) {
            status.textContent = "Ocurrió un error al guardar los datos.";
            status.className = "api-status mt-3 text-danger";
        }
        return;
    }

    await supabaseClient.from("user_interests").delete().eq("user_id", user.id);
    if (interests.length > 0) {
        await supabaseClient.from("user_interests").insert(
            interests.map(interest => ({ user_id: user.id, interest }))
        );
    }

    await supabaseClient.from("user_badges").insert([{ user_id: user.id, badge_code: "pionero" }]).catch(() => {});

    if (status) {
        status.textContent = "¡Perfil actualizado!";
        status.className = "api-status mt-3 text-success";
    }

    setTimeout(() => {
        const modalEl = document.getElementById('editProfileModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        loadProfile();
    }, 800);
}

window.handleAvatarSelect = handleAvatarSelect;
window.saveCroppedAvatar = saveCroppedAvatar;
window.updateProfile = updateProfile;
window.loadProfile = loadProfile;