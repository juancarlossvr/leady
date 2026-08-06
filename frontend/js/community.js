let currentFilter = 'all';
let cachedPosts = [];

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return "Hace un momento";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Hace ${days} d`;
}

function getInitials(name) {
    if (!name) return "L";
    return name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() || "")
        .join("");
}

async function unlockBadge(badgeCode) {
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        if (!sessionData.session) return;
        const userId = sessionData.session.user.id;

        await supabaseClient
            .from("user_badges")
            .insert([{ user_id: userId, badge_code: badgeCode }]);
    } catch (e) {
        // Ignorar duplicados
    }
}

async function loadPosts() {
    const container = document.getElementById("community-posts-container");
    if (!container) return;

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const currentUserId = sessionData.session?.user?.id;

        const { data: posts, error } = await supabaseClient
            .from("community_posts")
            .select(`
                *,
                users_profiles (full_name, username),
                post_likes (user_id),
                post_comments (
                    id,
                    content,
                    created_at,
                    user_id,
                    users_profiles (full_name, username)
                )
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        cachedPosts = posts || [];
        renderPosts(currentUserId);

    } catch (error) {
        console.error("Error cargando publicaciones:", error);
        container.innerHTML = `
            <div class="p-4 rounded text-center my-3" style="background: rgba(224, 81, 47, 0.1); border: 1px solid var(--ceibo);">
                <i class="ph ph-warning-octagon text-danger fs-3"></i>
                <p class="text-white mt-2 mb-0">No se pudieron cargar los mensajes de la comunidad.</p>
                <small class="text-secondary">${error.message}</small>
            </div>
        `;
    }
}

function renderPosts(currentUserId) {
    const container = document.getElementById("community-posts-container");
    if (!container) return;

    let filtered = cachedPosts;
    if (currentFilter !== 'all') {
        filtered = cachedPosts.filter(p => p.category === currentFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="p-5 rounded text-center" style="background: var(--surface); border: 1px dashed var(--border);">
                <i class="ph ph-chat-circle-dots text-secondary" style="font-size: 2.5rem;"></i>
                <h4 class="mt-2 mb-1 text-white">Todavía no hay publicaciones</h4>
                <p class="text-secondary mb-0">Sé el primero en hacer una pregunta o compartir un consejo en la comunidad.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(post => buildPostCard(post, currentUserId)).join("");
}

function buildPostCard(post, currentUserId) {
    const authorName = post.users_profiles?.full_name || post.users_profiles?.username || "Usuario de Leady";
    const likes = post.post_likes || [];
    const hasLiked = likes.some(l => l.user_id === currentUserId);
    const comments = post.post_comments || [];

    let badgeClass = "badge-leady";
    let iconClass = "ph-chat-circle-text";

    if (post.category === "Duda") {
        badgeClass = "deadline-badge soon";
        iconClass = "ph-question";
    } else if (post.category === "Consejo") {
        badgeClass = "deadline-badge ok";
        iconClass = "ph-lightbulb";
    } else if (post.category === "Experiencia") {
        badgeClass = "deadline-badge urgent";
        iconClass = "ph-star";
    }

    const commentsHtml = comments.map(c => `
        <div class="p-2 rounded mb-2" style="background: var(--surface-2); border: 1px solid var(--border);">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <strong style="font-size: 0.82rem; color: var(--gua-claro);">${c.users_profiles?.full_name || 'Anónimo'}</strong>
                <small class="text-secondary" style="font-size: 0.7rem;">${timeAgo(c.created_at)}</small>
            </div>
            <p class="m-0 text-light" style="font-size: 0.88rem;">${c.content}</p>
        </div>
    `).join("");

    return `
        <div class="detail-card p-4">
            <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                    <span class="${badgeClass} mb-2 d-inline-block">
                        <i class="ph ${iconClass} me-1"></i>${post.category}
                    </span>
                    <h3 class="m-0" style="font-size: 1.25rem;">${post.title}</h3>
                </div>
                <small class="text-secondary flex-shrink-0" style="font-size: 0.78rem;">${timeAgo(post.created_at)}</small>
            </div>

            <p class="text-light mb-3" style="line-height: 1.55; white-space: pre-line;">${post.content}</p>

            <div class="d-flex align-items-center justify-content-between pt-2 border-top border-secondary border-opacity-25" style="border-color: var(--border) !important;">
                <span class="text-secondary" style="font-size: 0.82rem;">
                    Por <strong class="text-white">${authorName}</strong>
                </span>

                <div class="d-flex gap-2">
                    <button class="btn-secondary-leady py-1 px-3 style-sm d-flex align-items-center gap-1 ${hasLiked ? 'text-warning border-warning' : ''}" 
                            onclick="toggleAguyje('${post.id}', ${hasLiked})">
                        <i class="ph ${hasLiked ? 'ph-thumbs-up-fill text-warning' : 'ph-thumbs-up'}"></i>
                        <span>Aguyjé (${likes.length})</span>
                    </button>

                    <button class="btn-secondary-leady py-1 px-3 style-sm d-flex align-items-center gap-1" 
                            onclick="toggleCommentsDisplay('${post.id}')">
                        <i class="ph ph-chat-circle-dots me-1"></i>
                        <span>${comments.length}</span>
                    </button>
                </div>
            </div>

            <div id="comments-box-${post.id}" class="mt-3 pt-3 border-top" style="display: none; border-color: var(--border) !important;">
                <div class="mb-3">
                    ${commentsHtml.length > 0 ? commentsHtml : '<p class="text-secondary small mb-2">Aún no hay comentarios. Sé el primero en responder.</p>'}
                </div>

                <div class="d-flex gap-2">
                    <input type="text" id="input-comment-${post.id}" class="form-control form-control-sm" placeholder="Escribí un comentario o respuesta...">
                    <button class="btn-primary-leady py-1 px-3 style-sm flex-shrink-0" onclick="submitComment('${post.id}')">Comentar</button>
                </div>
            </div>
        </div>
    `;
}

async function createPost(event) {
    event.preventDefault();
    const status = document.getElementById("post-status");
    status.textContent = "Publicando...";
    status.className = "api-status mt-2 text-warning";

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;
    const user = sessionData.session.user;

    const category = document.getElementById("post-category").value;
    const title = document.getElementById("post-title").value;
    const content = document.getElementById("post-content").value;

    const { error } = await supabaseClient
        .from("community_posts")
        .insert([{ user_id: user.id, category, title, content }]);

    if (error) {
        console.error(error);
        status.textContent = "Error al publicar. Revisá los datos.";
        status.className = "api-status mt-2 text-danger";
        return;
    }

    await unlockBadge("comunitario");

    status.textContent = "¡Publicado en La Plaza!";
    status.className = "api-status mt-2 text-success";

    document.getElementById("post-title").value = "";
    document.getElementById("post-content").value = "";

    loadPosts();
}

async function toggleAguyje(postId, hasLiked) {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;
    const userId = sessionData.session.user.id;

    if (hasLiked) {
        await supabaseClient.from("post_likes").delete().eq("post_id", postId).eq("user_id", userId);
    } else {
        await supabaseClient.from("post_likes").insert([{ post_id: postId, user_id: userId }]);
        await unlockBadge("aguyje");
    }

    loadPosts();
}

function toggleCommentsDisplay(postId) {
    const box = document.getElementById(`comments-box-${postId}`);
    if (box) {
        box.style.display = box.style.display === "none" ? "block" : "none";
    }
}

async function submitComment(postId) {
    const input = document.getElementById(`input-comment-${postId}`);
    if (!input || !input.value.trim()) return;

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;
    const userId = sessionData.session.user.id;

    await supabaseClient
        .from("post_comments")
        .insert([{ post_id: postId, user_id: userId, content: input.value.trim() }]);

    input.value = "";
    loadPosts();
}

function filterCategory(cat, btn) {
    currentFilter = cat;
    document.querySelectorAll("#category-filters button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const { data: sessionData } = supabaseClient.auth.getSession();
    sessionData.then(res => renderPosts(res.data.session?.user?.id));
}

window.loadPosts = loadPosts;
window.createPost = createPost;
window.toggleAguyje = toggleAguyje;
window.toggleCommentsDisplay = toggleCommentsDisplay;
window.submitComment = submitComment;
window.filterCategory = filterCategory;