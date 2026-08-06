const API_URL = "https://api.leady.online";

async function probarBackend() {
    const statusText = document.getElementById("api-status");

    try {
        statusText.textContent = "Conectando con Leady API...";

        const respuesta = await fetch(`${API_URL}/health`);
        const datos = await respuesta.json();

        statusText.textContent = `Backend conectado: ${datos.status}`;
    } catch (error) {
        statusText.textContent = "No se pudo conectar con el backend.";
        console.error(error);
    }
}