// streaks.js — Cálculo automático de rachas diarias
async function updateDailyStreak() {
    if (typeof supabaseClient === "undefined") return;

    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (!sessionData.session) return;

    const userId = sessionData.session.user.id;
    const todayStr = new Date().toISOString().split('T')[0];

    try {
        const { data: profile } = await supabaseClient
            .from("users_profiles")
            .select("current_streak, last_active_date")
            .eq("id", userId)
            .maybeSingle();

        if (!profile) return;

        const lastActive = profile.last_active_date;
        let currentStreak = profile.current_streak || 1;

        if (!lastActive) {
            // Primer ingreso registrado
            await supabaseClient
                .from("users_profiles")
                .update({ current_streak: 1, last_active_date: todayStr })
                .eq("id", userId);
            return;
        }

        const lastDate = new Date(lastActive);
        const todayDate = new Date(todayStr);

        // Diferencia en días entre la última visita y hoy
        const diffTime = Math.abs(todayDate - lastDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            // Ingresó el día consecutivo -> Sumar racha
            currentStreak += 1;
            await supabaseClient
                .from("users_profiles")
                .update({ current_streak: currentStreak, last_active_date: todayStr })
                .eq("id", userId);

        } else if (diffDays > 1) {
            // Perdió la racha -> Reiniciar a 1
            currentStreak = 1;
            await supabaseClient
                .from("users_profiles")
                .update({ current_streak: 1, last_active_date: todayStr })
                .eq("id", userId);
        }
        // Si diffDays === 0, ingresó el mismo día, no se modifica nada.

    } catch (err) {
        console.error("Error al actualizar la racha:", err);
    }
}

// Iniciar verificación al cargar
updateDailyStreak();