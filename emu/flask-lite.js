// Just enough Flask + Flask-SQLAlchemy to run the flag-store apps in the page.
//
// Each port.js reads like its app.py: same seed data, same checks, same raw
// SQL string. The database is real: SQLite (sql.js) or PostgreSQL (PGlite),
// both compiled to WebAssembly, so injections behave exactly as they did on
// the original server.

const here = new URL(".", import.meta.url);

// ---- responses -------------------------------------------------------------

const FLASK_500 =
  '<!doctype html>\n<html lang=en>\n<title>500 Internal Server Error</title>\n<h1>Internal Server Error</h1>\n' +
  "<p>The server encountered an internal error and was unable to complete your request. " +
  "Either the server is overloaded or there is an error in the application.</p>\n";

export class Response {
  constructor(body, status = 200) {
    this.body = body;
    this.status = status;
  }
}
export const InternalServerError = () => new Response(FLASK_500, 500);

// Show a response the way the browser would after a real form POST.
function show(response) {
  const r = response instanceof Response ? response : new Response(...(Array.isArray(response) ? response : [response]));
  document.open();
  document.write(r.body);
  document.close();
}

// ---- templates (the subset of Jinja the flag-store templates use) -----------

const esc = (v) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&#34;", "'": "&#39;" })[c]);

function renderJinja(src, ctx) {
  const tokens = src.split(/({%.*?%}|{{.*?}})/s);
  let i = 0;
  const lookup = (name, scope) => name.trim().split(".").reduce((o, k) => (o == null ? undefined : o[k]), scope);
  const truthy = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v));

  function block(scope, stops) {
    let out = "";
    while (i < tokens.length) {
      const t = tokens[i];
      const tag = t.match(/^{%\s*(\w+)(.*?)\s*%}$/s);
      if (tag && stops.includes(tag[1])) return { out, stop: tag[1] };
      i++;
      if (tag && tag[1] === "if") {
        const cond = truthy(lookup(tag[2], scope));
        const a = block(scope, ["else", "endif"]);
        let b = { out: "" };
        if (a.stop === "else") { i++; b = block(scope, ["endif"]); }
        i++;
        out += cond ? a.out : b.out;
      } else if (tag && tag[1] === "for") {
        const [, v, list] = tag[2].match(/^\s*(\w+)\s+in\s+(.+)$/);
        const start = i;
        let body = "";
        const items = lookup(list, scope) || [];
        if (!items.length) { block(scope, ["endfor"]); }
        for (const item of items) {
          i = start;
          body += block({ ...scope, [v]: item }, ["endfor"]).out;
        }
        i++;
        out += body;
      } else if (/^{{.*}}$/s.test(t)) {
        const v = lookup(t.slice(2, -2), scope);
        out += v == null ? "" : esc(v);
      } else {
        out += t;
      }
    }
    return { out };
  }
  return block(ctx, []).out;
}

export async function render_template(name, ctx = {}) {
  const src = await (await fetch(new URL("templates/" + name, location.href))).text();
  return renderJinja(src, ctx);
}

// ---- request / session / routing -----------------------------------------

export const request = { method: "GET", form: {} };
export const session = {};
const routes = {};

export function Flask() {
  return {
    config: {},
    route(path, { methods = ["GET"] } = {}) {
      return (fn) => (routes[path] = { fn, methods });
    },
  };
}
export const url_for = (name) => name;
export const redirect = (name) => ({ redirect: name });

async function dispatch(path) {
  const route = routes[path];
  if (!route) return InternalServerError(); // url_for('login') has no route in the original
  let r;
  try {
    r = await route.fn();
  } catch (err) {
    return InternalServerError();
  }
  if (r && r.redirect) {
    request.method = "GET";
    request.form = {};
    return dispatch("/" + r.redirect);
  }
  return r;
}

// Take over the login form: a submit becomes a POST to "/" handled here.
// The listener goes in right away so an early submit waits for the database
// instead of hitting GitHub Pages (which rejects POSTs).
let started;
const ready = new Promise((resolve) => (started = resolve));
document.addEventListener(
  "submit",
  async (e) => {
    e.preventDefault();
    await ready;
    request.method = "POST";
    request.form = Object.fromEntries(new FormData(e.target));
    show(await dispatch("/"));
  },
  true
);
export const run = () => started();

// ---- SQLAlchemy ------------------------------------------------------------

// text(): SQLAlchemy treats ":name" as a bind parameter, and executing without
// a value for it raises. Reproduce that so payloads fail the same way.
export function text(sql) {
  if (/(?<![:\w\\]):(\w+)(?!:)/.test(sql)) throw new Error("A value is required for bind parameter");
  return sql.replace(/\\:/g, ":");
}

export async function sqlite() {
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = new URL("../vendor/sql.js/sql-wasm.js", here);
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  const SQL = await window.initSqlJs({ locateFile: (f) => new URL("../vendor/sql.js/" + f, here).href });
  const db = new SQL.Database();
  return {
    run: (sql, params = []) => db.run(sql, params),
    // Python's sqlite3 refuses a second statement before running anything.
    async fetchone(sql) {
      // (sql.js frees each statement on the iterator's next step, so read the
      // row first; a SELECT has no side effects to undo.)
      const it = db.iterateStatements(sql);
      const first = it.next();
      if (first.done) return null;
      const row = first.value.step() ? first.value.getAsObject() : null;
      if (!it.next().done) throw new Error("You can only execute one statement at a time.");
      return row;
    },
    async get(table, id) {
      const stmt = db.prepare(`SELECT * FROM "${table}" WHERE id = ?`, [id]);
      const row = stmt.step() ? stmt.getAsObject() : null;
      stmt.free();
      if (row && typeof row.flags_ordered === "string") row.flags_ordered = JSON.parse(row.flags_ordered);
      return row;
    },
  };
}

export async function postgres() {
  const { PGlite } = await import(new URL("../vendor/pglite/index.js", here).href);
  const pg = new PGlite();
  await pg.waitReady;
  return {
    run: (sql, params = []) => pg.query(sql, params),
    exec: (sql) => pg.exec(sql),
    // psycopg2 runs every statement and returns the last one's rows. Nothing
    // is committed, so the request's transaction is rolled back afterwards.
    async fetchone(sql) {
      await pg.exec("BEGIN");
      try {
        const results = await pg.exec(sql);
        const last = results[results.length - 1];
        if (!last || !last.fields.length) throw new Error("no results to fetch");
        return last.rows[0] ?? null;
      } finally {
        await pg.exec("ROLLBACK").catch(() => {});
      }
    },
    async get(table, id) {
      const r = await pg.query(`SELECT * FROM "${table}" WHERE id = $1`, [id]);
      return r.rows[0] ?? null;
    },
  };
}

// Values the original kept out of the provided source (passwords, flags) are
// stored lightly encoded so they don't show up in view-source at a glance.
export function secret(b64, key = "post-it") {
  const s = atob(b64);
  let o = "";
  for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return decodeURIComponent(escape(o));
}
