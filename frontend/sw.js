const CACHE_NAME = "leady-cache-v2";
const STATIC_ASSETS = [
    "./",
    "./index.html",
    "./register.html",
    "./dashboard.html",
    "./opportunities.html",
    "./community.html",
    "./profile.html",
    "./css/styles.css",
    "./js/navbar.js",
    "./js/utils.js",
    "./js/auth.js",
    "./assets/img/leady-logo.png"
];

// 1. Instalación: Guardar archivos base en caché
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log("Service Worker: Guardando archivos estáticos en caché");
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 2. Activación: Limpiar cachés viejas si cambiamos la versión
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log("Service Worker: Limpiando caché antigua", cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. Interceptación de peticiones (Fetch)
self.addEventListener("fetch", (event) => {
    const requestUrl = new URL(event.request.url);

    // Estrategia Network-First para API de FastAPI o Supabase
    if (requestUrl.href.includes("127.0.0.1:8000") || requestUrl.href.includes("supabase.co")) {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // Si no hay internet, devolvemos una respuesta fallida controlada
                    return new Response(
                        JSON.stringify({ error: "Sin conexión a internet" }),
                        { headers: { "Content-Type": "application/json" } }
                    );
                })
        );
        return;
    }

    // Estrategia Stale-While-Revalidate para HTML, CSS, JS e imágenes
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Si falla la red y tampoco había una versión en caché,
                // devolvemos una Response válida en vez de undefined.
                return new Response(
                    "Recurso no disponible sin conexión",
                    { status: 503, statusText: "Service Unavailable", headers: { "Content-Type": "text/plain" } }
                );
            });

            // Devolvemos la caché al instante si existe, o esperamos a la red
            return cachedResponse || fetchPromise;
        })
    );
});