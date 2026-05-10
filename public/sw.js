self.addEventListener('install', () => {
    self.skipWAiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});