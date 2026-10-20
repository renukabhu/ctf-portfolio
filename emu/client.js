// Loaded by challenge pages whose backend was ported to a service worker (sw.js).
// It registers that worker and makes requests from the page or the DevTools
// console reach it, so `fetch("/note", ...)` behaves like it did against the
// original server.
(function () {
  if (!("serviceWorker" in navigator)) {
    console.warn("[portfolio] This browser has no service workers, so this challenge's backend can't run.");
    return;
  }

  const base = new URL("./", location.href).pathname; // the challenge's "server root"

  const ready = navigator.serviceWorker
    .register(base + "sw.js", { scope: base })
    .then(() => navigator.serviceWorker.ready)
    .then(() =>
      navigator.serviceWorker.controller ||
      new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }))
    )
    .then(() => {
      navigator.serviceWorker.controller.postMessage({ type: "user-agent", value: navigator.userAgent });
    });

  // The original server lived at the domain root; here it lives at `base`.
  function rebase(url) {
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//") && !url.startsWith(base)) {
      return base + url.slice(1);
    }
    return url;
  }

  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    await ready;
    if (typeof input === "string" || input instanceof URL) input = rebase(String(input));
    return realFetch(input, init);
  };

  const realOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    return realOpen.call(this, method, rebase(String(url)), ...rest);
  };

  ready.then(() =>
    console.log(
      "%c[portfolio]%c This challenge's server runs in your browser. Send requests from this console, e.g. fetch(\"/path\", {...}). curl can't reach it.",
      "color:#0a7;font-weight:bold",
      ""
    )
  );
})();
