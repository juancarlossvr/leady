console.log("register-wizard.js cargado");

const TOTAL_STEPS = 5;
const STEP_NAMES = {
    1: "Tu cuenta",
    2: "Sobre vos",
    3: "Académico",
    4: "Intereses e IA",
    5: "Confirmar"
};

let currentStep = 1;

// Listas curadas: vocabulario controlado que la IA de recomendaciones
// interpreta de forma consistente (evita "tecnologia" vs "Tecnología" vs "tech").
const LANGUAGE_SUGGESTIONS = [
    "Español", "Guaraní", "Inglés", "Portugués", "Alemán", "Francés", "Italiano", "Mandarín"
];

const INTEREST_SUGGESTIONS = [
    "Liderazgo", "Becas académicas", "Intercambios culturales", "Voluntariado",
    "Emprendimiento", "Tecnología", "Ciencia e investigación", "Arte y cultura",
    "Deportes", "Medio ambiente", "Oratoria y debate", "Robótica y programación",
    "Salud", "Derechos humanos", "Educación financiera"
];

// Estado acumulado de todo el wizard. Nada se manda a Supabase
// hasta el paso final, así evitamos registros a medias.
const wizardState = {
    email: "",
    password: "",
    full_name: "",
    username: "",
    birth_date: "",
    age: null,
    city: "",
    department: "",
    academic_level: "",
    academic_average: null,
    experience: "",
    languages: [],
    interests: []
};

// ===== Utilidades =====

function calcAge(birthDateStr) {
    if (!birthDateStr) return null;
    const today = new Date();
    const birth = new Date(birthDateStr);
    if (isNaN(birth.getTime())) return null;

    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

function showStepError(message) {
    // Reutilizamos un pequeño toast simple dentro del paso activo
    let el = document.getElementById("wizard-step-error");
    const activeStep = document.querySelector(".wizard-step.is-active");
    if (!el && activeStep) {
        el = document.createElement("p");
        el.id = "wizard-step-error";
        el.className = "api-status mt-2 text-danger";
        activeStep.appendChild(el);
    }
    if (el) el.textContent = message;
}

function clearStepError() {
    const el = document.getElementById("wizard-step-error");
    if (el) el.remove();
}

// ===== Chips (idiomas / intereses) =====
// Combina texto libre + una grilla de sugerencias predefinidas.
// Ambas fuentes escriben sobre el mismo array (targetArray), así que
// siempre queda una sola lista de verdad.
function setupTagSelector(inputId, boxId, suggestionsBoxId, suggestions, targetArray) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    const suggestionsBox = document.getElementById(suggestionsBoxId);

    function renderSuggestionState() {
        if (!suggestionsBox) return;
        suggestionsBox.querySelectorAll(".chip-suggestion").forEach(btn => {
            btn.classList.toggle("is-selected", targetArray.includes(btn.dataset.value));
        });
    }

    function renderChips() {
        box.querySelectorAll(".chip-pill").forEach(el => el.remove());
        targetArray.forEach((value, index) => {
            const pill = document.createElement("span");
            pill.className = "chip-pill";
            pill.innerHTML = `${value} <button type="button" aria-label="Quitar">×</button>`;
            pill.querySelector("button").addEventListener("click", () => {
                targetArray.splice(index, 1);
                renderChips();
            });
            box.insertBefore(pill, input);
        });
        renderSuggestionState();
    }

    function toggleSuggestion(value) {
        const idx = targetArray.indexOf(value);
        if (idx === -1) {
            targetArray.push(value);
        } else {
            targetArray.splice(idx, 1);
        }
        renderChips();
    }

    // Construir la grilla de sugerencias una sola vez
    if (suggestionsBox) {
        suggestionsBox.innerHTML = "";
        suggestions.forEach(value => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "chip-suggestion";
            btn.dataset.value = value;
            btn.textContent = value;
            btn.addEventListener("click", () => toggleSuggestion(value));
            suggestionsBox.appendChild(btn);
        });
    }

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const value = input.value.trim();
            if (value && !targetArray.includes(value)) {
                targetArray.push(value);
                renderChips();
            }
            input.value = "";
        } else if (e.key === "Backspace" && input.value === "" && targetArray.length > 0) {
            targetArray.pop();
            renderChips();
        }
    });

    box.addEventListener("click", () => input.focus());

    renderChips();
}

// ===== Validación por paso =====

function validateStep(step) {
    clearStepError();

    if (step === 1) {
        const email = document.getElementById("w-email").value.trim();
        const password = document.getElementById("w-password").value;
        const confirm = document.getElementById("w-password-confirm").value;

        if (!email || !email.includes("@")) {
            showStepError("Ingresá un correo válido.");
            return false;
        }
        if (!password || password.length < 6) {
            showStepError("La contraseña debe tener al menos 6 caracteres.");
            return false;
        }
        if (password !== confirm) {
            showStepError("Las contraseñas no coinciden.");
            return false;
        }

        wizardState.email = email;
        wizardState.password = password;
        return true;
    }

    if (step === 2) {
        const fullName = document.getElementById("w-full-name").value.trim();
        const username = document.getElementById("w-username").value.trim();
        const birthDate = document.getElementById("w-birth-date").value;
        const city = document.getElementById("w-city").value.trim();
        const department = document.getElementById("w-department").value.trim();

        if (!fullName) {
            showStepError("Contanos tu nombre y apellido.");
            return false;
        }
        if (!username) {
            showStepError("Elegí un nombre de usuario.");
            return false;
        }
        if (!birthDate) {
            showStepError("Ingresá tu fecha de nacimiento.");
            return false;
        }

        const age = calcAge(birthDate);
        if (age === null || age < 13 || age > 25) {
            showStepError("Leady está pensado para jóvenes de 13 a 25 años. Revisá tu fecha de nacimiento.");
            return false;
        }

        wizardState.full_name = fullName;
        wizardState.username = username;
        wizardState.birth_date = birthDate;
        wizardState.age = age;
        wizardState.city = city;
        wizardState.department = department;
        return true;
    }

    if (step === 3) {
        const academicLevel = document.getElementById("w-academic-level").value;
        const academicAverageRaw = document.getElementById("w-academic-average").value;

        if (!academicLevel) {
            showStepError("Seleccioná tu nivel académico.");
            return false;
        }

        wizardState.academic_level = academicLevel;
        wizardState.academic_average = academicAverageRaw
            ? Number(academicAverageRaw.replace(",", "."))
            : null;
        return true;
    }

    if (step === 4) {
        wizardState.experience = document.getElementById("w-experience").value.trim();
        // languages e interests ya se van guardando en wizardState.languages / .interests
        // mediante los chips, no hace falta releerlos acá.
        return true;
    }

    return true;
}

// ===== Navegación =====

function updateProgressUI() {
    const pct = (currentStep / TOTAL_STEPS) * 100;
    document.getElementById("wizard-progress-fill").style.width = pct + "%";
    document.getElementById("wizard-step-number").textContent = currentStep;
    document.getElementById("wizard-step-name").textContent = STEP_NAMES[currentStep];

    const track = document.getElementById("wizard-track");
    track.style.transform = `translateX(-${(currentStep - 1) * (100 / TOTAL_STEPS)}%)`;

    document.querySelectorAll(".wizard-step").forEach(stepEl => {
        stepEl.classList.toggle("is-active", Number(stepEl.dataset.step) === currentStep);
    });

    const backBtn = document.getElementById("wizard-back-btn");
    backBtn.classList.toggle("is-visible", currentStep > 1);

    const nextBtn = document.getElementById("wizard-next-btn");
    if (currentStep === TOTAL_STEPS) {
        nextBtn.innerHTML = '<i class="ph ph-check-circle me-1"></i> Crear mi cuenta';
    } else {
        nextBtn.innerHTML = 'Siguiente <i class="ph ph-arrow-right ms-1"></i>';
    }

    if (currentStep === TOTAL_STEPS) {
        renderSummary();
    }
}

function wizardNext() {
    if (!validateStep(currentStep)) return;

    if (currentStep === TOTAL_STEPS) {
        finishRegistration();
        return;
    }

    currentStep++;
    updateProgressUI();
}

function wizardBack() {
    if (currentStep === 1) return;
    clearStepError();
    currentStep--;
    updateProgressUI();
}

// ===== Resumen final =====

function renderSummary() {
    const container = document.getElementById("wizard-summary");
    const rows = [
        ["Correo", wizardState.email],
        ["Nombre", wizardState.full_name],
        ["Usuario", "@" + wizardState.username],
        ["Fecha de nacimiento", wizardState.birth_date],
        ["Edad", wizardState.age ? wizardState.age + " años" : "-"],
        ["Ciudad", wizardState.city || "-"],
        ["Departamento", wizardState.department || "-"],
        ["Nivel académico", wizardState.academic_level || "-"],
        ["Promedio", wizardState.academic_average || "-"],
        ["Idiomas", wizardState.languages.join(", ") || "-"],
        ["Intereses", wizardState.interests.join(", ") || "-"]
    ];

    container.innerHTML = rows.map(([label, value]) => `
        <div class="summary-row">
            <span>${label}</span>
            <span>${value}</span>
        </div>
    `).join("");
}

// ===== Envío final: crea la cuenta y el perfil completo en un solo paso =====

async function finishRegistration() {
    const status = document.getElementById("register-status");
    const nextBtn = document.getElementById("wizard-next-btn");

    nextBtn.disabled = true;
    status.className = "api-status mb-0 text-warning";
    status.textContent = "Creando tu cuenta...";

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: wizardState.email,
            password: wizardState.password
        });

        if (error) {
            status.className = "api-status mb-0 text-danger";
            status.textContent = error.message;
            nextBtn.disabled = false;
            return;
        }

        const user = data.user;

        const { error: profileError } = await supabaseClient
            .from("users_profiles")
            .insert([{
                id: user.id,
                full_name: wizardState.full_name,
                username: wizardState.username,
                birth_date: wizardState.birth_date,
                age: wizardState.age,
                city: wizardState.city,
                department: wizardState.department,
                academic_level: wizardState.academic_level,
                academic_average: wizardState.academic_average,
                experience: wizardState.experience,
                languages: wizardState.languages
            }]);

        if (profileError) {
            status.className = "api-status mb-0 text-danger";
            status.textContent = `Tu cuenta se creó, pero hubo un problema guardando tu perfil: ${profileError.message}. Iniciá sesión y completalo desde "Editar perfil".`;
            nextBtn.disabled = false;
            return;
        }

        if (wizardState.interests.length > 0) {
            await supabaseClient.from("user_interests").insert(
                wizardState.interests.map(interest => ({ user_id: user.id, interest }))
            );
        }

        status.className = "api-status mb-0 text-success";
        status.textContent = "¡Cuenta creada! Redirigiendo...";

        setTimeout(() => {
            window.location.href = "dashboard.html";
        }, 1200);

    } catch (err) {
        console.error(err);
        status.className = "api-status mb-0 text-danger";
        status.textContent = "Ocurrió un error inesperado. Probá de nuevo.";
        nextBtn.disabled = false;
    }
}

// ===== Init =====

document.addEventListener("DOMContentLoaded", () => {
    setupTagSelector("w-languages-input", "w-languages-box", "w-languages-suggestions", LANGUAGE_SUGGESTIONS, wizardState.languages);
    setupTagSelector("w-interests-input", "w-interests-box", "w-interests-suggestions", INTEREST_SUGGESTIONS, wizardState.interests);

    document.getElementById("w-birth-date").addEventListener("change", (e) => {
        const age = calcAge(e.target.value);
        const preview = document.getElementById("wizard-age-preview");
        preview.textContent = age !== null ? `Edad calculada: ${age} años` : "";
    });

    // Enter en cualquier input de texto avanza al siguiente paso
    // (excepto en los inputs de chips, que ya manejan su propio Enter)
    document.querySelectorAll('.wizard-step input:not([id$="-input"])').forEach(input => {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                wizardNext();
            }
        });
    });

    updateProgressUI();
});

window.wizardNext = wizardNext;
window.wizardBack = wizardBack;