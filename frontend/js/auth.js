console.log("Auth.js cargado");

const SUPABASE_URL = "https://jsvpvtzfylyvwvqgndmo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzdnB2dHpmeWx5dnd2cWduZG1vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDMyMTYsImV4cCI6MjA5MzY3OTIxNn0.kKC4AOQ0Y9V86sPBWgMW83-Xri6Abj0TDtXUKC65BIM"; // <-- pegá tu anon key (la pública de Supabase)

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== PROTECCIÓN DE PÁGINAS =====
// Llamar protectPage() al inicio de cualquier página que requiera sesión.
// Si no hay sesión, redirige a login. Devuelve el usuario si está logueado.
async function protectPage() {
    const { data: sessionData } = await supabaseClient.auth.getSession();

    if (!sessionData.session) {
        window.location.href = "login.html";
        return null;
    }

    return sessionData.session.user;
}

// ===== REGISTRO =====
async function registerUser() {
    const fullName = document.getElementById("full_name").value;
    const username = document.getElementById("username").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const status = document.getElementById("register-status");

    status.textContent = "Creando cuenta...";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password
        });

        if (error) {
            status.textContent = error.message;
            return;
        }

        const user = data.user;

        // Creamos el perfil con datos mínimos. El resto lo completa el usuario en profile.html
        const { error: profileError } = await supabaseClient
            .from("users_profiles")
            .insert([
                {
                    id: user.id,
                    full_name: fullName,
                    username: username
                }
            ]);

        if (profileError) {
            status.textContent = profileError.message;
            return;
        }

        status.textContent = "Cuenta creada. Redirigiendo para completar tu perfil...";

        // Llevamos al usuario a completar su perfil (clave para las recomendaciones)
        setTimeout(() => {
            window.location.href = "profile.html";
        }, 1500);

    } catch (err) {
        console.error(err);
        status.textContent = "Error inesperado.";
    }
}

// ===== LOGIN =====
async function loginUser() {
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const status = document.getElementById("login-status");

    status.textContent = "Iniciando sesión...";

    const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        status.textContent = error.message;
        return;
    }

    status.textContent = "Inicio de sesión correcto.";
    window.location.href = "dashboard.html";
}

// ===== CARGAR USUARIO ACTUAL (para el dashboard) =====
async function loadCurrentUser() {
    const userInfo = document.getElementById("user-info");

    if (!userInfo) return;

    const { data: sessionData } = await supabaseClient.auth.getSession();

    if (!sessionData.session) {
        window.location.href = "login.html";
        return;
    }

    const user = sessionData.session.user;

    const { data: profile, error } = await supabaseClient
        .from("users_profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    if (error) {
        userInfo.textContent = "No se pudo cargar tu perfil.";
        return;
    }

    userInfo.textContent = `Hola, ${profile.full_name}. Estás conectado como @${profile.username}.`;
}

// ===== LOGOUT =====
async function logoutUser() {
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
}

window.protectPage = protectPage;
window.registerUser = registerUser;
window.loginUser = loginUser;
window.logoutUser = logoutUser;

console.log("Fin auth.js");