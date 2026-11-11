(() => {
  "use strict";
  if (window.__mlExcelHelperLoaded) return;
  window.__mlExcelHelperLoaded = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const norm = value => (value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length > 0;
  };
  const txt = el => norm(el?.innerText || el?.textContent || "");
  const labels = (root = document) => [...root.querySelectorAll("label")].filter(visible);

  function controlFor(label) {
    if (!label) return null;
    if (label.control) return label.control;
    const nested = label.querySelector("input");
    if (nested) return nested;
    const id = label.getAttribute("for");
    if (id) return document.getElementById(id);
    return label.parentElement?.querySelector("input[type=checkbox],input[type=radio]") || null;
  }
  function findLabel(name, root = document) {
    const wanted = norm(name);
    return labels(root).find(label => {
      const t = txt(label);
      return t === wanted || t.startsWith(wanted + " ") || t.startsWith(wanted + ":");
    }) || null;
  }
  function setCheck(label, wanted) {
    const input = controlFor(label);
    if (!input || input.type !== "checkbox") return { ok: false, reason: "No se encontró una casilla verificable" };
    if (input.checked !== wanted) label.click();
    return { ok: input.checked === wanted, reason: input.checked === wanted ? "" : "MercadoLibre no confirmó el cambio" };
  }
  function findHeading(phrases) {
    const selector = "h1,h2,h3,h4,h5,button,[role=button],summary,legend,div,span";
    return [...document.querySelectorAll(selector)].filter(visible)
      .filter(el => {
        const t = txt(el);
        return t && t.length < 180 && phrases.some(p => t.includes(norm(p)));
      })
      .sort((a, b) => txt(a).length - txt(b).length)[0] || null;
  }
  function accordionInfo(phrases) {
    const heading = findHeading(phrases);
    if (!heading) return null;

    // Buscar la tarjeta de ESTA lista, no un contenedor superior que también
    // incluya los controles de la primera lista.
    let card = null;
    let node = heading;
    for (let depth = 0; depth < 9 && node; depth++, node = node.parentElement) {
      const text = txt(node);
      const hasChevron = !!node.querySelector("svg,[class*='chevron'],[class*='arrow']");
      if (text.length < 500 && phrases.some(p => text.includes(norm(p))) && hasChevron) {
        card = node;
        break;
      }
    }

    const semanticControl = heading.closest("button,[role=button],summary,[aria-expanded]");
    // En la segunda tarjeta se comprobó que el propio texto del encabezado
    // despliega el acordeón. Hacer clic directamente sobre ese texto evita
    // pulsar un contenedor exterior que no activa el control.
    const isPublicationsList = phrases.some(p => norm(p).includes("publicaciones que quieres incluir"));
    let clickable = isPublicationsList ? heading : (semanticControl || card || heading);

    const scope = card || clickable.parentElement || heading.parentElement;
    const expandedAttr = clickable.getAttribute?.("aria-expanded");
    const stateAttr = clickable.getAttribute?.("data-state") || card?.getAttribute?.("data-state");
    let isOpen;
    if (expandedAttr === "true" || stateAttr === "open") isOpen = true;
    else if (expandedAttr === "false" || stateAttr === "closed") isOpen = false;
    else {
      const ownInputs = [...scope.querySelectorAll("input,select,[role=checkbox]")];
      isOpen = ownInputs.some(visible);
    }
    return { heading, wrapper: scope, clickable, isOpen };
  }
  async function waitAccordionState(phrases, open, timeout = 3500) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const info = accordionInfo(phrases);
      if (info && info.isOpen === open) return info;
      await sleep(150);
    }
    return accordionInfo(phrases);
  }
  async function setAccordion(phrases, open) {
    const key = phrases.map(norm).join("|");
    window.__mlhOpenedAccordions = window.__mlhOpenedAccordions || new Set();
    let info = accordionInfo(phrases);
    if (!info) return { ok: false, message: "No se encontró el encabezado de esta lista." };
    if (!open) return { ok: false, message: "Esta extensión solo abre listas; no las cierra." };

    // La inspección de inputs no refleja correctamente el estado visual de
    // estos acordeones de MercadoLibre. Recordar el clic realizado durante
    // esta carga de página y no volver a pulsar el encabezado (lo cerraría).
    if (!window.__mlhOpenedAccordions.has(key)) {
      info.clickable.click();
      await sleep(900);
      window.__mlhOpenedAccordions.add(key);
    } else {
      await sleep(250);
    }
    info = accordionInfo(phrases) || info;
    return { ok: true, message: "Se pulsó el encabezado y se esperó a que apareciera su contenido." };
  }

  function applyFieldOptions() {
    const options = [
      ["Precio", true], ["Estado", true], ["SKU", true], ["Categoría", true],
      ["En tu depósito", true], ["Forma de entrega y costo de envío", false],
      ["Tipo de publicación", false], ["Condición", false]
    ];
    return options.map(([name, wanted]) => {
      const label = findLabel(name);
      if (!label) return { name, wanted, ok: false, reason: "No se encontró en la primera lista" };
      return { name, wanted, ...setCheck(label, wanted) };
    });
  }

  function applyCategoryAndActive() {
    const results = [];
    const allLabel = findLabel("Todas");
    if (!allLabel) results.push({ ok: false, message: "No se encontró la opción «Todas» en la segunda lista." });
    else {
      const result = setCheck(allLabel, true);
      results.push({ ok: result.ok, message: result.ok
        ? "Categorías: únicamente «Todas» quedó seleccionada."
        : "No se pudo confirmar la selección de «Todas»." });
    }

    const activeLabel = labels().find(label => ["activas", "publicaciones activas", "solo activas"].includes(txt(label)));
    if (!activeLabel) results.push({ ok: false, message: "No se encontró el filtro «Activas» en la segunda lista." });
    else {
      const result = setCheck(activeLabel, true);
      results.push({ ok: result.ok, message: result.ok
        ? "Publicaciones: filtro «Activas» seleccionado."
        : "No se pudo confirmar el filtro «Activas»." });
    }
    return results;
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = "ml-excel-helper-panel";
    panel.innerHTML = `
      <div class="mlh-head"><strong>Preparar planilla de MercadoLibre</strong>
        <button type="button" class="mlh-min" aria-label="Contraer panel">−</button></div>
      <div class="mlh-body">
        <p>La extensión procesa las dos listas una después de la otra.</p>
        <button type="button" class="mlh-run">Repetir selección</button>
        <div class="mlh-status" role="status" aria-live="polite">Esperando la página…</div>
        <ul class="mlh-report"></ul>
      </div>`;
    const style = document.createElement("style");
    style.textContent = `
      #ml-excel-helper-panel{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:350px;max-width:calc(100vw - 36px);background:#fff;color:#222;border:1px solid #bbb;border-radius:12px;box-shadow:0 4px 22px #0003;font:14px/1.4 Arial,sans-serif}
      #ml-excel-helper-panel .mlh-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 14px;background:#f3f5f7;border-radius:12px 12px 0 0}
      #ml-excel-helper-panel button{cursor:pointer;border:0;border-radius:7px;padding:9px 12px}
      #ml-excel-helper-panel .mlh-min{font-size:20px;padding:0 8px;background:transparent}
      #ml-excel-helper-panel .mlh-body{padding:12px 14px}
      #ml-excel-helper-panel .mlh-body p{margin:0 0 10px;color:#555}
      #ml-excel-helper-panel .mlh-run{width:100%;background:#3483fa;color:white;font-weight:600}
      #ml-excel-helper-panel .mlh-run:disabled{opacity:.6;cursor:wait}
      #ml-excel-helper-panel .mlh-status{margin-top:10px;font-weight:600}
      #ml-excel-helper-panel .mlh-report{margin:7px 0 0;padding-left:20px;max-height:220px;overflow:auto}
      #ml-excel-helper-panel .mlh-report li{margin:4px 0}
      #ml-excel-helper-panel.mlh-collapsed .mlh-body{display:none}`;
    document.documentElement.append(style, panel);
    panel.querySelector(".mlh-min").addEventListener("click", () => {
      panel.classList.toggle("mlh-collapsed");
      panel.querySelector(".mlh-min").textContent = panel.classList.contains("mlh-collapsed") ? "+" : "−";
    });
    panel.querySelector(".mlh-run").addEventListener("click", runSelection);
  }

  async function runSelection() {
    const panel = document.getElementById("ml-excel-helper-panel");
    if (!panel) return;
    const button = panel.querySelector(".mlh-run");
    const status = panel.querySelector(".mlh-status");
    const report = panel.querySelector(".mlh-report");
    button.disabled = true;
    status.textContent = "Procesando primera lista…";
    report.replaceChildren();
    const add = (message, ok) => {
      const li = document.createElement("li");
      li.textContent = (ok ? "✓ " : "⚠ ") + message;
      li.style.color = ok ? "#18753c" : "#a15c00";
      report.append(li);
    };
    try {
      // Primera lista: abrir, esperar a que termine de desplegarse y aplicar los campos.
      // Se deja abierta mientras se despliega la segunda lista.
      const firstPhrases = ["datos que vas a modificar", "datos a modificar"];
      const firstOpen = await setAccordion(firstPhrases, true);
      add("Primera lista: " + firstOpen.message, firstOpen.ok);
      if (firstOpen.ok) {
        for (const result of applyFieldOptions()) {
          add(result.name + (result.ok ? (result.wanted ? " marcado" : " desmarcado") : ": " + result.reason), result.ok);
        }
      } else add("Se omitieron los campos de la primera lista porque no se pudo abrir.", false);

      // Pausa entre aperturas: MercadoLibre no permite desplegarlas en el mismo instante.
      status.textContent = "Esperando para abrir la segunda lista…";
      await sleep(650);
      const secondOpen = await setAccordion([
        "publicaciones que quieres incluir en la planilla",
        "publicaciones que quieres incluir",
        "categorías y publicaciones", "categorias y publicaciones"
      ], true);
      add("Segunda lista: " + secondOpen.message, secondOpen.ok);
      if (secondOpen.ok) {
        for (const result of applyCategoryAndActive()) add(result.message, result.ok);
      } else add("Se omitieron «Todas» y «Activas» porque no se pudo abrir la segunda lista.", false);

      // Comprobar que ambas listas continúen desplegadas.
      const firstStillOpen = accordionInfo(firstPhrases)?.isOpen === true;
      const secondStillOpen = accordionInfo([
        "publicaciones que quieres incluir en la planilla",
        "publicaciones que quieres incluir",
        "categorías y publicaciones", "categorias y publicaciones"
      ])?.isOpen === true;
      add("Primera lista permanece abierta.", firstStillOpen);
      add("Segunda lista permanece abierta.", secondStillOpen);
      add("No se descargó ningún archivo ni se modificaron precios o cantidades.", true);
      status.textContent = "Proceso terminado. Revisa los avisos.";
    } catch (error) {
      status.textContent = "No se pudo completar la selección.";
      add("Error: " + (error?.message || String(error)), false);
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    if (!document.getElementById("ml-excel-helper-panel")) createPanel();
    let tries = 0;
    const attempt = async () => {
      if (tries++ >= 12) return;
      await sleep(700);
      if (!findHeading(["datos que vas a modificar", "datos a modificar"])) return attempt();
      await runSelection();
    };
    attempt();
  }
  init();
  const observer = new MutationObserver(() => {
    if (!document.getElementById("ml-excel-helper-panel")) init();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();