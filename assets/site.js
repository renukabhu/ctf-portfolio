// Renders challenges.json. To add a challenge, run tools/add_challenge.py
// (see README.md); nothing in this file needs to change.

// How flags appear on cards: "reveal" (behind a toggle), "open" (always shown),
// or "checker" (players can check a guess, the flag is never printed).
const FLAG_MODE = "reveal";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const inlineCode = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

function decode(b64, key = "post-it") {
  const s = atob(b64);
  let o = "";
  for (let i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  return decodeURIComponent(escape(o));
}

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
const solved = new Set(store.get("solved") || []);

function card(c) {
  const node = document.getElementById("card").content.firstElementChild.cloneNode(true);
  node.dataset.category = c.category;
  node.dataset.search = [c.name, c.category, c.description, ...c.events.map((e) => e.group + " " + e.term)].join(" ").toLowerCase();
  node.querySelector(".card-title").textContent = c.name;
  node.querySelector(".points").textContent = c.points ? `${c.points} pts` : "";
  if (solved.has(c.slug)) node.classList.add("solved");

  const tags = node.querySelector(".tags");
  const tag = (text, cls = "") => tags.insertAdjacentHTML("beforeend", `<span class="badge ${cls}">${esc(text)}</span>`);
  tag(c.category, `badge-${c.category}`);
  c.events.forEach((e) => tag(`${e.group} · ${e.term}`));
  if (c.in_browser_backend) tag("in-browser backend", "badge-backend");

  node.querySelector(".desc").textContent = c.description.replace(/\s*(Site:\s*)?\{\{\s*link\s*\}\}\s*/g, "\n").trim();

  const actions = node.querySelector(".actions");
  if (c.play) actions.insertAdjacentHTML("beforeend", `<a class="btn btn-primary" href="${esc(c.play)}" target="_blank" rel="noopener">Play ↗</a>`);
  c.files.forEach((f) => {
    const name = f.split("/").slice(2).join("/");
    actions.insertAdjacentHTML("beforeend", `<a class="btn" href="${esc(f)}" download>${esc(name)} ↓</a>`);
  });

  const flag = decode(c.flag);
  const form = node.querySelector(".checker");
  const out = form.querySelector(".result");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const ok = form.flag.value.trim() === flag;
    out.textContent = ok ? "Correct!" : "Not quite.";
    out.className = "result " + (ok ? "ok" : "no");
    if (ok) {
      solved.add(c.slug);
      store.set("solved", [...solved]);
      node.classList.add("solved");
    }
  });

  const reveal = node.querySelector(".reveal");
  if (FLAG_MODE === "checker") {
    reveal.remove();
  } else {
    node.querySelector(".flag").textContent = flag;
    node.querySelector(".solution").innerHTML = c.solution ? `<p>${inlineCode(c.solution)}</p>` : "";
    const files = node.querySelector(".solve-files");
    Object.entries(c.solve_files || {}).forEach(([name, body]) => {
      files.insertAdjacentHTML("beforeend", `<div class="label">Original ${esc(name)}</div><pre>${esc(body.trimEnd())}</pre>`);
    });
    if (FLAG_MODE === "open") {
      reveal.open = true;
      reveal.querySelector("summary").textContent = "Flag & solution";
    }
  }
  return node;
}

async function main() {
  const challenges = await (await fetch("challenges.json")).json();
  const grid = document.getElementById("grid");
  challenges.forEach((c) => grid.appendChild(card(c)));

  const terms = new Set(challenges.flatMap((c) => c.events.map((e) => e.term)));
  const categories = [...new Set(challenges.map((c) => c.category))].sort();
  document.getElementById("stats").innerHTML = [
    [challenges.length, "challenges"],
    [categories.length, categories.length === 1 ? "category" : "categories"],
    [terms.size, "quarters"],
  ].map(([n, label]) => `<div><dt>${label}</dt><dd>${n}</dd></div>`).join("");

  let category = "all";
  const search = document.getElementById("search");
  const filters = document.getElementById("filters");
  ["all", ...categories].forEach((cat) => {
    const count = cat === "all" ? challenges.length : challenges.filter((c) => c.category === cat).length;
    filters.insertAdjacentHTML("beforeend",
      `<button class="chip" data-cat="${esc(cat)}" aria-pressed="${cat === "all"}">${esc(cat)} <span>${count}</span></button>`);
  });

  function apply() {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    grid.querySelectorAll(".card").forEach((el) => {
      const hit = (category === "all" || el.dataset.category === category) && (!q || el.dataset.search.includes(q));
      el.hidden = !hit;
      shown += hit;
    });
    document.getElementById("empty").hidden = shown > 0;
  }
  filters.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    category = b.dataset.cat;
    filters.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", x === b));
    apply();
  });
  search.addEventListener("input", apply);
}

main();
