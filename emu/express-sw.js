// A tiny Express look-alike for service workers.
//
// GitHub Pages can only serve files, so each server-side challenge keeps its
// original Express routes in a sw.js next to its index.html:
//
//     importScripts("../../emu/express-sw.js", "env.js");
//     const app = express();
//     app.post("/note", (req, res) => { ... });   // unchanged from app.js
//
// The service worker answers requests for those routes inside the visitor's
// browser. Anything without a route falls through to the static files, the
// same way express.static('.') did.

self.__ENV = self.__ENV || {};
self.process = { env: self.__ENV };
self.__dirname = "";
self.path = {
  join: (...parts) => parts.join("/").replace(/\/+/g, "/"),
  dirname: (p) => p.replace(/\/[^/]*$/, ""),
};
self.fileURLToPath = (u) => u;

const SCOPE = new URL(self.registration.scope).pathname; // e.g. /challenges/post-it/
let lastClientUserAgent = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "user-agent") lastClientUserAgent = e.data.value;
});

// Keeps a value across service worker restarts (browsers stop idle workers),
// like a variable in a long-running server process.
self.persist = async function (key, init) {
  const cache = await caches.open("emu-state");
  const hit = await cache.match("/__state/" + key);
  if (hit) return hit.json();
  const value = init();
  await cache.put("/__state/" + key, new Response(JSON.stringify(value)));
  return value;
};

function compile(pattern) {
  const keys = [];
  const re = pattern.replace(/\/:(\w+)/g, (_, k) => (keys.push(k), "/([^/]+)"));
  return { re: new RegExp("^" + re + "/?$"), keys };
}

function express() {
  const routes = [];
  const waits = [];
  let parseJson = false;

  const add = (method) => (pattern, handler) => {
    routes.push({ method, handler, ...compile(pattern) });
    return app;
  };

  const app = {
    get: add("GET"),
    post: add("POST"),
    put: add("PUT"),
    patch: add("PATCH"),
    delete: add("DELETE"),
    head: add("HEAD"),
    all: add("*"),
    use(mw) {
      if (mw && mw.__json) parseJson = true;
      return app;
    },
    ready(promise) {
      waits.push(promise);
      return app;
    },
    listen(port, cb) {
      if (typeof port === "function") port();
      else if (typeof cb === "function") cb();
    },
  };

  function find(method, path) {
    // Express answers HEAD with the GET route when there is no HEAD route.
    const tries = method === "HEAD" ? ["HEAD", "GET"] : [method];
    for (const m of tries) {
      for (const r of routes) {
        if (r.method !== m && r.method !== "*") continue;
        const match = r.re.exec(path);
        if (match) {
          const params = {};
          r.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
          return { route: r, params };
        }
      }
    }
    return null;
  }

  self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;
    let rel;
    if (url.pathname.startsWith(SCOPE)) rel = "/" + url.pathname.slice(SCOPE.length);
    else if (url.pathname + "/" === SCOPE) rel = "/";
    else return;
    if (rel === "/index.html") rel = "/";
    const found = find(event.request.method, rel);
    if (!found) return; // static file, served by GitHub Pages
    event.respondWith(handle(event, url, rel, found));
  });

  async function handle(event, url, rel, { route, params }) {
    await Promise.all(waits);
    const request = event.request;
    const headers = {};
    request.headers.forEach((v, k) => (headers[k] = v));
    // Browsers add User-Agent after the service worker, so fall back to the
    // page's navigator.userAgent (which DevTools can override).
    if (!headers["user-agent"]) headers["user-agent"] = lastClientUserAgent || self.navigator.userAgent;

    let body = {};
    if (parseJson && /application\/json/i.test(headers["content-type"] || "")) {
      const raw = await request.text();
      if (raw.trim()) {
        try {
          body = JSON.parse(raw);
        } catch (err) {
          return expressError(400, "SyntaxError: " + err.message);
        }
        if (body === null || typeof body !== "object") {
          return expressError(400, "SyntaxError: Unexpected token in JSON");
        }
      }
    }

    const query = Object.fromEntries(url.searchParams);
    const req = { method: request.method, path: rel, url: rel + url.search, params, query, headers, body,
      get: (h) => headers[h.toLowerCase()] };

    return new Promise((resolve, reject) => {
      const out = new Headers({ "X-Powered-By": "Express" });
      let status = 200;
      const finish = (payload, type) => {
        if (!out.has("Content-Type") && type) out.set("Content-Type", type);
        resolve(new Response(request.method === "HEAD" ? null : payload, { status, headers: out }));
      };
      const res = {
        status(code) { status = code; return res; },
        setHeader(k, v) { out.set(k, v); return res; },
        set(k, v) { out.set(k, v); return res; },
        header(k, v) { out.set(k, v); return res; },
        send(payload) {
          if (payload !== null && typeof payload === "object") return res.json(payload);
          finish(payload === undefined ? "" : String(payload), "text/html; charset=utf-8");
        },
        json(obj) { finish(JSON.stringify(obj), "application/json; charset=utf-8"); },
        sendStatus(code) { status = code; finish(String(code)); },
        end(payload) { finish(payload ?? ""); },
        async sendFile(file) {
          try {
            const r = await fetch(SCOPE + String(file).replace(/^\/+/, ""));
            r.headers.forEach((v, k) => out.has(k) || out.set(k, v));
            status = r.status;
            finish(await r.arrayBuffer());
          } catch (err) {
            reject(err);
          }
        },
      };
      try {
        const r = route.handler(req, res);
        if (r && r.catch) r.catch(() => resolve(expressError(500, "Internal Server Error")));
      } catch (err) {
        resolve(expressError(500, String(err)));
      }
    });
  }

  return app;
}

function expressError(status, message) {
  const html = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Error</title>\n</head>\n<body>\n<pre>${message.replace(/[<>&]/g, (c) => `&#${c.charCodeAt(0)};`)}</pre>\n</body>\n</html>\n`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "X-Powered-By": "Express" } });
}

express.json = () => Object.assign(() => {}, { __json: true });
express.static = () => () => {};
self.express = express;
