// ============================================================
// SERVICE WORKER: lets the app open with no internet
// ============================================================
//
// A service worker is a small script the browser runs in the background.
// This one saves a copy of the app on the device, so it still opens offline.
// Your tasks are stored on the device too, so everything keeps working.

// When you change any app file, change this number (v1 -> v2).
// That tells phones to throw away the old saved copy and download the new one.
const CACHE_NAME = "todo-app-v3";

// The Supabase library (loaded from the internet by index.html).
// We save a copy too, so the app can still sync after you reopen it offline.
// This address must match the script tag in index.html exactly.
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3";

// The files saved the first time someone opens the app.
const APP_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png"
];

// Install: save the app files.
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_FILES).then(function () {
          // Nice to have, but not essential: if this fails, the app still installs.
          return cache.add(new Request(SUPABASE_JS, { mode: "cors" })).catch(function () {});
        });
      })
      .then(function () { return self.skipWaiting(); }) // start working right away
  );
});

// Activate: delete saved copies from older versions.
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(
          names
            .filter(function (name) { return name !== CACHE_NAME; })
            .map(function (name) { return caches.delete(name); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

// Fetch: runs every time the app asks for a file.
self.addEventListener("fetch", function (event) {
  const request = event.request;

  // Only handle normal file requests for this app, plus the Supabase library.
  // Everything else (including calls to your database) goes straight to the internet.
  if (request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin && request.url !== SUPABASE_JS) return;

  // Opening the app: try the internet first so updates show up.
  // If there is no internet, use the saved copy.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put("./index.html", copy); });
          }
          return response;
        })
        .catch(function () {
          return caches.match("./index.html");
        })
    );
    return;
  }

  // Everything else (icons and so on): show the saved copy instantly,
  // and quietly fetch a fresh one for next time.
  event.respondWith(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(request, { ignoreVary: true }).then(function (saved) {
        const fresh = fetch(request)
          .then(function (response) {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(function () { return saved; });
        return saved || fresh;
      });
    })
  );
});
