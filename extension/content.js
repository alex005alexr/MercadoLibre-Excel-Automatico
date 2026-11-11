(() => {
  "use strict";
  if (window.__mlExcelHelperLoaded) return;
  window.__mlExcelHelperLoaded = true;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => (value || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();

  const isVisible = el => {
    if (!el || !el.isConnected) return false;
    const s = getComputedStyle(el);
    return s.display !== "none" && s.visibility !== "hidden" && el.getClientRects().length > 0;
  };
  const textOf = el => normalize(el?.innerText || el?.textContent || "");

  function controlFor(label) {
    if (!label) return null;
    if (label.control) return label.control;
    const nested = label.querySelector("input");
    if (nested) return nested;
    const id = label.getAttribute("for");
    if (id) return document.getElementById(id);
    return label.parentElement?.querySelector("input[type=checkbox],input[type=radio]") || null;
  }

  function labels(root = document) {
    return [...root.querySelectorAll("label")].filter(isVisible);
  }

  function exactLabel(name, root = document) {
    const wanted = normalize(name);
    return labels(root).find(label => textOf(label) === wanted) || null;
  }

  function setCheckbox(label, wantedState) {
    const control = controlFor(label);
    if (!control || control.type !== "checkbox") {
      return { ok: false, reason: "No se encontró una casilla verificable" };
    }
    if (control.checked !== wantedState) {
      // Click sobre la etiqueta para respetar los eventos de componentes controlados.
      label.click();
    }
    return {
      ok: control.checked === wantedState,
      reason: control.checked === wantedState ? "" : "El sitio no confirmó el cambio"
    };
  }

  function findHeading(phrases) {
    const selectors = "h1,h2,h3,h4,h5,button,[role=button],summary,legend,div,span";
    return [...document.querySelectorAll(selectors)]
      .filter(isVisible)
      .filter(el => {
        const t = textOf(el);
        return t && t.length < 160 && phrases.some(p => t.includes(normalize(p)));
      })
      .sort((a,b) => textOf(a).length - textOf(b).length)[0] || null;
  }

  async function ensureSectionVisible(phrases) {
    const heading = findHeading(phrases);
    if (!heading) return { found: false, section: null };

    const clickable = heading.closest("button,[role=button],summary") || heading;
    // Busca un contenedor cercano que contenga etiquetas de formulario visibles.
    let section = heading;
    for (let i = 0; i < 7 && section.parentElement; i++) {
      section = section.parentElement;
      if (labels(section).length) break;
    }

    if (!labels(section).length) {
      clickable.click();
      await sleep(500);
      section = heading.parentElement || heading;
      for (let i = 0; i < 7 && section.parentElement && !labels(section).length; i++) {
        section = section.parentElement;
      }
    }
    return { found: true, section };
  }

  function applyFields() {
    const desired = [
      ["Precio", true],
      ["Estado", true],
      ["SKU", true],
      ["Categoría", true],
      ["En tu depósito", true],
      ["Forma de entrega y costo de envío", false],
      ["Tipo de publicación", false],
      ["Condición", false]
    ];

    return desired.map(([name, state]) => {
      const label = exactLabel(name);
      if (!label) return { name, ok: false, reason: "No se encontró la opción exacta" };
      const result = setCheckbox(label, state);
      return { name, state, ...result };
    });
  }

  async function applyAllCategories() {
    const sectionInfo = await ensureSectionVisible([
      "publicaciones que quieres incluir en la planilla",
      "publicaciones que quieres incluir",
      "categorías que quieres incluir",
      "categorias que quieres incluir"
    ]);
    if (!sectionInfo.found) {
      return { ok: false, message: "No se localizó el apartado de categorías." };
    }

    // Busca la casilla «Todas» dentro del bloque de categorías, no marca categorías individuales.
    let section = sectionInfo.section;
    let allLabel = exactLabel("Todas", section);
    for (let i = 0; !allLabel && i < 5 && section.parentElement; i++) {
      section = section.parentElement;
      allLabel = exactLabel("Todas", section);
    }
    if (!allLabel) {
      return { ok: false, message: "No se encontró la casilla «Todas» en categorías." };
    }
    const result = setCheckbox(allLabel, true);
    return {
      ok: result.ok,
      message: result.ok ? "Solo se marcó «Todas»; no se seleccionaron categorías individuales."
        : "Se encontró «Todas», pero no se pudo confirmar su selección."
    };
  }

  function applyActiveFilter() {
    const label = labels().find(l => [
      "activas", "publicaciones activas", "solo activas"
    ].includes(textOf(l)));
    if (!label) return { ok: false, message: "No se localizó el filtro exacto «Activas»." };
    const result = setCheckbox(label, true);
    return { ok: result.ok, message: result.ok
      ? "Filtro «Activas» seleccionado."
      : "No se pudo confirmar el filtro «Activas»." };
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = "ml-excel-helper-panel";
    panel.innerHTML = `
      <div class="mlh-head"><strong>Preparar planilla de MercadoLibre</strong>
        <button type="button" class="mlh-min" aria-label="Contraer panel">−</button></div>
      <div class="mlh-body">
        <p>La selección se aplica automáticamente al abrir esta página. Puedes repetir la comprobación.</p>
        <button type="button" class="mlh-run">Aplicar selección nuevamente</button>
        <div class="mlh-status" role="status" aria-live="polite">Esperando que MercadoLibre cargue los controles…</div>
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
      #ml-excel-helper-panel.mlh-collapsed .mlh-body{display:none}
    `;
    document.documentElement.append(style, panel);

    panel.querySelector(".mlh-min").addEventListener("click", () => {
      panel.classList.toggle("mlh-collapsed");
      panel.querySelector(".mlh-min").textContent =
        panel.classList.contains("mlh-collapsed") ? "+" : "−";
    });

    panel.querySelector(".mlh-run").addEventListener("click", runSelection);
    return panel;
  }

  async function runSelection() {
    const panel = document.getElementById("ml-excel-helper-panel");
    if (!panel) return;
    const button = panel.querySelector(".mlh-run");
    const status = panel.querySelector(".mlh-status");
    const report = panel.querySelector(".mlh-report");
    button.disabled = true;
    status.textContent = "Aplicando y verificando selección…";
    report.replaceChildren();

    const add = (message, ok) => {
      const li = document.createElement("li");
      li.textContent = (ok ? "✓ " : "⚠ ") + message;
      li.style.color = ok ? "#18753c" : "#a15c00";
      report.append(li);
    };

    try {
      const section = await ensureSectionVisible(["datos que vas a modificar", "datos a modificar"]);
      if (!section.found) add("No se localizó «Datos que vas a modificar».", false);

      for (const result of applyFields()) {
        const action = result.state ? "marcado" : "desmarcado";
        add(result.name + (result.ok ? " " + action : ": " + result.reason), result.ok);
      }

      const categories = await applyAllCategories();
      add(categories.message, categories.ok);

      const active = applyActiveFilter();
      add(active.message, active.ok);

      add("No se descargó la planilla ni se modificaron precios, cantidades o filtros de envío.", true);
      status.textContent = "Proceso terminado. Revisa los avisos.";
    } catch (error) {
      status.textContent = "No se pudo completar toda la selección.";
      add("Error: " + (error?.message || String(error)), false);
    } finally {
      button.disabled = false;
    }
  }

  function init() {
    if (!document.getElementById("ml-excel-helper-panel")) createPanel();
    // Espera la carga de los controles dinámicos de MercadoLibre y aplica automáticamente.
    let attempts = 0;
    const autoApply = async () => {
      if (attempts >= 8) return;
      attempts++;
      const hasLabels = labels().length > 0;
      if (!hasLabels) {
        await sleep(900);
        return autoApply();
      }
      await sleep(500);
      await runSelection();
    };
    autoApply();
  }

  init();
  const observer = new MutationObserver(() => {
    if (!document.getElementById("ml-excel-helper-panel")) init();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();