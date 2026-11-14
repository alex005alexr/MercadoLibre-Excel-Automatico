(() => {
"use strict";
if (window.__valeryCodeFinderLoaded) return;
window.__valeryCodeFinderLoaded = true;

const SELECTOR = "span.sc-copyable-element__text";
const normalizeId = value => String(value ?? "").replace(/^\s*#/, "").replace(/\D/g, "");
let catalog = new Map();

const css = ":host{all:initial;display:inline-flex;vertical-align:middle;margin-left:7px}" +
".vcf button{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;padding:3px;border:1px solid #d7dce0;border-radius:6px;background:#fff;cursor:pointer}" +
".vcf button:hover{background:#f5f7f8;border-color:#9aa4ad}" +
".vcf button:focus-visible{outline:2px solid #3483fa;outline-offset:2px}" +
".vcf img{display:block;width:19px;height:19px;object-fit:contain}" +
".vcf button[data-copied='true']{border-color:#16834a;background:#eefaf2}";

function getCode(id) {
 const entries = catalog.get(id);
 return entries && entries.length === 1 ? entries[0] : null;
}

function renderId(node) {
 if (!(node instanceof HTMLElement) || !node.isConnected) return;
 const id = normalizeId(node.textContent);
 if (!/^\d{5,}$/.test(id)) return;

 const next = node.nextElementSibling;
 if (node.dataset.vcfProcessed === id && next?.hasAttribute("data-vcf-widget")) return;
 if (next?.hasAttribute("data-vcf-widget")) next.remove();
 node.dataset.vcfProcessed = id;

 const code = getCode(id);
 // No se muestra nada cuando no hay coincidencia única.
 if (!code) return;

 const host = document.createElement("span");
 host.setAttribute("data-vcf-widget", "");
 host.setAttribute("data-vcf-widget-for", id);
 const shadow = host.attachShadow({ mode: "open" });
 const style = document.createElement("style");
 style.textContent = css;

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
 button.addEventListener("click", async () => {
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
 node.after(host);
}

async function loadCatalog() {
 const saved = await chrome.storage.local.get(["valeryCodeCatalog"]);
 const raw = saved.valeryCodeCatalog;
 catalog = new Map();
 if (raw && typeof raw === "object" && !Array.isArray(raw)) {
  for (const [key, value] of Object.entries(raw)) {
   const id = normalizeId(key);
   const codes = Array.isArray(value) ? value.map(x => String(x).trim()).filter(Boolean) : [];
   if (id && codes.length) catalog.set(id, [...new Set(codes)]);
  }
 }
}

function scan(root = document) {
 if (root.matches?.(SELECTOR)) renderId(root);
 root.querySelectorAll?.(SELECTOR).forEach(renderId);
}

loadCatalog().then(() => {
 scan();
 const observer = new MutationObserver(records => {
  for (const record of records) {
   for (const added of record.addedNodes) {
    if (added.nodeType === Node.ELEMENT_NODE) scan(added);
    else if (added.nodeType === Node.TEXT_NODE) {
     const target = added.parentElement?.closest(SELECTOR);
     if (target) renderId(target);
    }
   }
   if (record.type === "characterData") {
    const target = record.target.parentElement?.closest(SELECTOR);
    if (target) renderId(target);
   }
  }
 });
 observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

 chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.valeryCodeCatalog) {
   loadCatalog().then(() => {
    document.querySelectorAll(SELECTOR).forEach(node => {
     node.dataset.vcfProcessed = "";
     const widget = node.nextElementSibling;
     if (widget?.hasAttribute("data-vcf-widget")) widget.remove();
     renderId(node);
    });
   });
  }
 });
}).catch(() => scan());
})();