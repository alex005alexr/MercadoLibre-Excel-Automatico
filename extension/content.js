(() => {
  "use strict";

  if (window.__mlExcelHelperLoaded) return;
  window.__mlExcelHelperLoaded = true;

  const FIELD_NAMES = ["Precio", "Estado", "SKU", "Categoría", "En tu depósito"];
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (value) => (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  function isVisible(element) {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0;
  }

  function labelText(label) {
    return normalize(label?.innerText || label?.textContent || "");
  }

  function getControlFromLabel(label) {
    if (!label) return null;
    const direct = label.control || label.querySelector("input, select");
    if (direct) return direct;

    const forId = label.getAttribute("for");
    if (forId) return document.getElementById(forId);

    const parent = label.parentElement;
    return parent?.querySelector("input[type='checkbox'], input[type='radio']") || null;
  }

  function allLabels() {
    return [...document.querySelectorAll("label")].filter(isVisible);
  }

  function findLabel(matcher, root = document) {
    return [...root.querySelectorAll("label")].find((label) =>
      isVisible(label) && matcher(labelText(label))
    ) || null;
  }

  function clickControl(control) {
    if (!control || !isVisible(control)) return false;
    if (control.type === "checkbox" || control.type === "radio") {
      if (!control.checked) control.click();
      return control.checked;
    }
    control.click();
    return true;
  }

  function findSectionHeading(phrases) {
    const candidates = [...document.querySelectorAll(
      "h1,h2,h3,h4,h5,button,[role='button'],summary,legend,div,span"
    )].filter(isVisible);

    return candidates
      .filter((element) => {
        const text = normalize(element.innerText || element.textContent);
        return text && text.length < 180 &&
          phrases.some((phrase) => text.includes(normalize(phrase)));
      })
      .sort((a, b) => {
        const aLen = normalize(a.innerText || a.textContent).length;
        const bLen = normalize(b.innerText || b.textContent).length;
        return aLen - bLen;
      })[0] || null;
  }

  function sectionForHeading(heading) {
    if (!heading) return null;
    let current = heading;
    for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
      const controls = [...current.querySelectorAll("input,button,[role='checkbox']")];
      if (controls.length) return current;
    }
    return heading.parentElement;
  }

  async function openSection(phrases) {
    const heading = findSectionHeading(phrases);
    if (!heading) return { found: false, opened: false, section: null };

    let section = sectionForHeading(heading);
    const hasVisibleControls = () =>
      section && [...section.querySelectorAll("input,button,[role='checkbox']")].some(isVisible);

    if (!hasVisibleControls()) {
      const clickable = heading.closest("button,[role='button'],summary") || heading;
      clickable.click();
      await sleep(450);
      section = sectionForHeading(heading);
    }

    return { found: true, opened: !!hasVisibleControls(), section };
  }

  function selectNamedField(name) {
    const target = normalize(name);
    const label = findLabel((text) => text === target || text.startsWith(target + " "));
    if (!label) return { name, ok: false, reason: "No se encontró la etiqueta" };

    const control = getControlFromLabel(label);
    if (!control) return { name, ok: false, reason: "No se encontró su control" };

    const ok = clickControl(control);
    return { name, ok: ok && (control.type !== "checkbox" || control.checked),
      reason: ok ? "" : "No se pudo marcar" };
  }

  function selectAllCategoryOptions(section) {
    if (!section) return { ok: false, selected: 0, total: 0, reason: "Sección no localizada" };

    // La selección se limita al bloque identificado por el encabezado de categorías.
    const labels = [...section.querySelectorAll("label")].filter(isVisible);
    const candidates = labels
      .map((label) => ({ label, control: getControlFromLabel(label), text: labelText(label) }))
      .filter(({ control, text }) =>
        control?.type === "checkbox" &&
        text &&
        !/^(todas?|seleccionar todas?|ninguna|limpiar|buscar)$/.test(text)
      );

    if (!candidates.length) {
      return { ok: false, selected: 0, total: 0, reason: "No se encontraron casillas de categorías" };
    }

    let selected = 0;
    for (const item of candidates) {
      if (!item.control.checked) item.control.click();
      if (item.control.checked) selected++;
    }

    return {
      ok: selected === candidates.length,
      selected,
      total: candidates.length,
      reason: selected === candidates.length ? "" : "Algunas categorías no pudieron marcarse"
    };
  }

  function selectActiveOnly() {
    const label = findLabel((text) =>
      text === "activas" || text === "publicaciones activas" ||
      text === "solo activas" || text === "estado activas"
    );

    if (!label) return { ok: false, reason: "No se encontró el filtro exacto «Activas»" };

    const control = getControlFromLabel(label);
    if (!control || control.type !== "checkbox") {
      return { ok: false, reason: "El filtro «Activas» no parece ser una casilla" };
    }

    if (!control.checked) control.click();
    if (!control.checked) return { ok: false, reason: "No se pudo activar el filtro" };

    // Desmarca otros estados sólo si están claramente identificados como filtros de estado.
    const otherStates = ["inactivas", "pausadas", "sin stock"];
    for (const state of otherStates) {
      const otherLabel = findLabel((text) => text === state || text === "publicaciones " + state);
      const otherControl = getControlFromLabel(otherLabel);
      if (otherControl?.type === "checkbox" && otherControl.checked) otherControl.click();
    }

    return { ok: true, reason: "" };
  }

  function createPanel() {
    const panel = document.createElement("section");
    panel.id = "ml-excel-helper-panel";
    panel.innerHTML = `
      <div class="mlh-head">
        <strong>Preparar planilla de MercadoLibre</strong>
        <button type="button" class="mlh-min" aria-label="Contraer panel">−</button>
      </div>
      <div class="mlh-body">
        <p>Marca los campos y filtros acordados. No descarga la planilla.</p>
        <button type="button" class="mlh-run">Aplicar selección y comprobar</button>
        <div class="mlh-status" role="status" aria-live="polite">Listo para comprobar.</div>
        <ul class="mlh-report"></ul>
      </div>`;

    const style = document.createElement("style");
    style.textContent = `
      #ml-excel-helper-panel{position:fixed;z-index:2147483647;right:18px;bottom:18px;width:330px;max-width:calc(100vw - 36px);background:#fff;color:#222;border:1px solid #bbb;border-radius:12px;box-shadow:0 4px 22px #0003;font:14px/1.4 Arial,sans-serif}
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

    panel.querySelector(".mlh-run").addEventListener("click", async () => {
      const button = panel.querySelector(".mlh-run");
      const status = panel.querySelector(".mlh-status");
      const report = panel.querySelector(".mlh-report");
      button.disabled = true;
      status.textContent = "Comprobando controles…";
      report.replaceChildren();

      const add = (text, ok) => {
        const li = document.createElement("li");
        li.textContent = (ok ? "✓ " : "⚠ ") + text;
        li.style.color = ok ? "#18753c" : "#a15c00";
        report.append(li);
      };

      try {
        const fieldsSection = await openSection(["datos que vas a modificar", "datos a modificar"]);
        if (!fieldsSection.found) add("No se localizó «Datos que vas a modificar».", false);
        else if (!fieldsSection.opened) add("Se encontró «Datos que vas a modificar», pero no se pudieron mostrar sus controles.", false);

        for (const name of FIELD_NAMES) {
          const result = selectNamedField(name);
          add(name + (result.ok ? " seleccionado" : ": " + result.reason), result.ok);
        }

        const categoriesSection = await openSection([
          "publicaciones que quieres incluir en la planilla",
          "categorías que quieres incluir",
          "categorias que quieres incluir"
        ]);
        if (!categoriesSection.found) {
          add("No se localizó la sección de categorías.", false);
        } else {
          const result = selectAllCategoryOptions(categoriesSection.section);
          add(result.ok
            ? "Categorías seleccionadas: " + result.selected + "/" + result.total
            : "Categorías: " + result.reason + " (" + result.selected + "/" + result.total + ")", result.ok);
        }

        const active = selectActiveOnly();
        add(active.ok ? "Filtro «Activas» seleccionado; otros estados reconocidos desmarcados."
          : "Filtro de publicaciones activas: " + active.reason, active.ok);

        add("No se descargó ningún archivo ni se modificaron precios o cantidades.", true);
        status.textContent = "Comprobación terminada. Revisa los avisos.";
      } catch (error) {
        status.textContent = "La comprobación encontró un error.";
        add("Error: " + (error?.message || String(error)), false);
      } finally {
        button.disabled = false;
      }
    });

    return panel;
  }

  function init() {
    if (!document.getElementById("ml-excel-helper-panel")) createPanel();
  }

  init();
  const observer = new MutationObserver(() => {
    if (!document.getElementById("ml-excel-helper-panel")) init();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();