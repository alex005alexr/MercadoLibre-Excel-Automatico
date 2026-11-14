(() => {
"use strict";
if (window.__valeryCodeFinderLoaded) return;
window.__valeryCodeFinderLoaded = true;

const LIST_ID_SELECTOR = "span.sc-copyable-element__text";
const PRODUCT_SUBTITLE_SELECTOR = "span.ui-pdp-subtitle";
const normalizeId = value => String(value ?? "").replace(/^\s*#/, "").replace(/\D/g, "");
let catalog = new Map();

function getCode(id) {
 const entries = catalog.get(id);
 return entries && entries.length === 1 ? entries[0] : null;
}

function createButton(id, large = false) {
 const code = getCode(id);
 if (!code) return null;

 const host = document.createElement("span");
 host.setAttribute("data-vcf-widget", "");
 host.setAttribute("data-vcf-widget-for", id);
 const shadow = host.attachShadow({ mode: "open" });
 const style = document.createElement("style");
 style.textContent =
  ":host{all:initial;display:inline-flex;vertical-align:middle;margin-left:8px}" +
  ".vcf button{display:inline-flex;align-items:center;justify-content:center;" +
  "width:" + (large ? "34px" : "27px") + ";height:" + (large ? "34px" : "27px") +
  ";padding:3px;border:1px solid #d7dce0;border-radius:6px;background:#fff;cursor:pointer}" +
  ".vcf button:hover{background:#f5f7f8;border-color:#9aa4ad}" +
  ".vcf button:focus-visible{outline:2px solid #3483fa;outline-offset:2px}" +
  ".vcf img{display:block;width:" + (large ? "24px" : "19px") +
  ";height:" + (large ? "24px" : "19px") + ";object-fit:contain}" +
  ".vcf button[data-copied='true']{border-color:#16834a;background:#eefaf2}";

 const wrap = document.createElement("span");
 wrap.className = "vcf";
 const button = document.createElement("button");
 button.type = "button";
 button.title = "Copiar código de Valery";
 button.setAttribute("aria-label", "Copiar código de Valery");
 const logo = document.createElement("img");
 logo.src = chrome.runtime.getURL("valery-logo.svg");
 logo.alt = "Valery";
 logo.draggable = false;
 button.append(logo);

 button.addEventListener("click", async event => {
  event.preventDefault();
  event.stopPropagation();
  try {
   await navigator.clipboard.writeText(code);
   button.dataset.copied = "true";
   button.title = "Código de Valery copiado";
   button.setAttribute("aria-label", "Código de Valery copiado");
   window.setTimeout(() => {
    if (!button.isConnected) return;
    delete button.dataset.copied;
    button.title = "Copiar código de Valery";
    button.setAttribute("aria-label", "Copiar código de Valery");
   }, 1100);
  } catch (_) {
   button.title = "No se pudo copiar";
  }
 });

 wrap.append(button);
 shadow.append(style, wrap);
 return host;
}

function renderListingId(node) {
 if (!(node instanceof HTMLElement) || !node.isConnected) return;
 const id = normalizeId(node.textContent);
 if (!/^\d{5,}$/.test(id)) return;

 // El ID y el icono nativo están dentro de este span. El botón Valery
 // se inserta después del span completo, nunca dentro del control de ML.
 const copyControl = node.closest(".sc-copyable-element") || node.parentElement;
 if (!copyControl || !copyControl.parentElement) return;
 const existing = copyControl.nextElementSibling;
 if (existing?.matches('[data-vcf-widget][data-vcf-placement="listing"]') &&
     existing.getAttribute("data-vcf-widget-for") === id) return;
 if (existing?.matches('[data-vcf-widget][data-vcf-placement="listing"]')) existing.remove();

 const host = createButton(id, false);
 if (!host) return;
 host.dataset.vcfPlacement = "listing";
 copyControl.after(host);
}

function getProductIdFromUrl() {
 const match = location.pathname.match(/MLV-?(\d+)/i);
 return match ? normalizeId(match[1]) : null;
}

function renderProductPage() {
 if (!/\barticulo\.mercadolibre\.com\.ve$/i.test(location.hostname)) return;
 const subtitle = document.querySelector(PRODUCT_SUBTITLE_SELECTOR);
 if (!subtitle || !subtitle.parentElement) return;
 const id = getProductIdFromUrl();
 if (!id || !/^\d{5,}$/.test(id)) return;

 const existing = subtitle.nextElementSibling;
 if (existing?.matches('[data-vcf-widget][data-vcf-placement="product"]') &&
     existing.getAttribute("data-vcf-widget-for") === id) return;
 if (existing?.matches('[data-vcf-widget][data-vcf-placement="product"]')) existing.remove();

 const host = createButton(id, true);
 if (!host) return;
 host.dataset.vcfPlacement = "product";
 subtitle.after(host);
}

function scan(root = document) {
 if (root.matches?.(LIST_ID_SELECTOR)) renderListingId(root);
 root.querySelectorAll?.(LIST_ID_SELECTOR).forEach(renderListingId);
 if (root.matches?.(PRODUCT_SUBTITLE_SELECTOR)) renderProductPage();
 if (root.querySelector?.(PRODUCT_SUBTITLE_SELECTOR)) renderProductPage();
}

async function loadCatalog() {
 const saved = await chrome.storage.local.get(["valeryCodeCatalog"]);
 const raw = saved.valeryCodeCatalog;
 catalog = new Map();
 if (raw && typeof raw === "object" && !Array.isArray(raw)) {
  for (const [key, value] of Object.entries(raw)) {
   const id = normalizeId(key);
   const codes = Array.isArray(value) ? [...new Set(value.map(x => String(x).trim()).filter(Boolean))] : [];
   if (id && codes.length) catalog.set(id, codes);
  }
 }
}

loadCatalog().then(() => {
 scan();
 const observer = new MutationObserver(records => {
  for (const record of records) {
   for (const added of record.addedNodes) {
    if (added.nodeType === Node.ELEMENT_NODE) scan(added);
    else if (added.nodeType === Node.TEXT_NODE) {
     const target = added.parentElement?.closest(LIST_ID_SELECTOR);
     if (target) renderListingId(target);
    }
   }
   if (record.type === "characterData") {
    const target = record.target.parentElement?.closest(LIST_ID_SELECTOR);
    if (target) renderListingId(target);
   }
  }
  renderProductPage();
 });
 observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

 chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.valeryCodeCatalog) {
   loadCatalog().then(() => {
    document.querySelectorAll("[data-vcf-widget]").forEach(widget => widget.remove());
    document.querySelectorAll(LIST_ID_SELECTOR).forEach(node => renderListingId(node));
    renderProductPage();
   });
  }
 });

 // MercadoLibre puede navegar entre publicaciones sin recargar el documento.
 window.addEventListener("popstate", renderProductPage);
}).catch(() => scan());
})();