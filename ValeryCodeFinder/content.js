(() => {
"use strict";
if (window.__valeryCodeFinderLoaded) return;
window.__valeryCodeFinderLoaded = true;
const SELECTOR = "span.sc-copyable-element__text";
const normalizeId = value => String(value ?? "").replace(/^\s*#/, "").replace(/\D/g, "");
let catalog = new Map();

const css = ":host{all:initial;display:inline-flex;vertical-align:middle;margin-left:7px;font-family:Arial,sans-serif}" +
".vcf{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font:600 12px/1.2 Arial,sans-serif;color:#263238}" +
".vcf button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid #d7dce0;border-radius:6px;background:#fff;padding:3px 6px;cursor:pointer;color:#263238;font:600 12px Arial,sans-serif}" +
".vcf button:hover{background:#f5f7f8;border-color:#9aa4ad}.vcf img{width:17px;height:17px;object-fit:contain;border-radius:4px}" +
".vcf .code{color:#146c43}.vcf .none{color:#8a5a00;font-weight:600}.vcf .conflict{color:#b42318;font-weight:700}" +
".vcf button:focus-visible{outline:2px solid #3483fa;outline-offset:2px}";

function lookup(id) {
 const entries=catalog.get(id);
 if(!entries||!entries.length)return {kind:"none"};
 if(entries.length>1)return {kind:"conflict",codes:entries};
 return {kind:"match",code:entries[0]};
}
function renderId(node) {
 if(!(node instanceof HTMLElement)||!node.isConnected)return;
 const id=normalizeId(node.textContent);
 if(!/^\d{5,}$/.test(id))return;
 const next=node.nextElementSibling;
 if(node.dataset.vcfProcessed===id&&next?.hasAttribute("data-vcf-widget"))return;
 node.dataset.vcfProcessed=id;
 const host=document.createElement("span");
 host.setAttribute("data-vcf-widget","");
 host.setAttribute("data-vcf-widget-for",id);
 const shadow=host.attachShadow({mode:"open"});
 const style=document.createElement("style");style.textContent=css;
 const wrap=document.createElement("span");wrap.className="vcf";
 const result=lookup(id);
 if(result.kind==="match"){
  const button=document.createElement("button");button.type="button";
  button.title="Copiar código de Valery: "+result.code;
  const logo=document.createElement("img");logo.src=chrome.runtime.getURL("valery-logo.svg");logo.alt="Valery";
  const label=document.createElement("span");label.textContent="Valery: "+result.code;label.className="code";
  button.append(logo,label);
  button.addEventListener("click",async()=>{
   try{await navigator.clipboard.writeText(result.code);label.textContent="¡Copiado!";setTimeout(()=>{if(label.isConnected)label.textContent="Valery: "+result.code;},1100);}
   catch(_){label.textContent="No se pudo copiar";}
  });
  wrap.append(button);
 } else if(result.kind==="conflict"){
  const label=document.createElement("span");label.className="conflict";
  label.textContent="Valery: conflicto ("+result.codes.join(", ")+")";
  label.title="Esta referencia está asociada a varios códigos. No se copia ninguno automáticamente.";
  wrap.append(label);
 } else {
  const label=document.createElement("span");label.className="none";label.textContent="Valery: Sin código";wrap.append(label);
 }
 shadow.append(style,wrap);node.after(host);
}
async function loadCatalog(){
 const saved=await chrome.storage.local.get(["valeryCodeCatalog"]),raw=saved.valeryCodeCatalog;
 catalog=new Map();
 if(raw&&typeof raw==="object"&&!Array.isArray(raw)){
  for(const [key,value] of Object.entries(raw)){
   const id=normalizeId(key),codes=Array.isArray(value)?value.map(x=>String(x).trim()).filter(Boolean):[];
   if(id&&codes.length)catalog.set(id,[...new Set(codes)]);
  }
 }
}
function scan(root=document){
 if(root.matches?.(SELECTOR))renderId(root);
 root.querySelectorAll?.(SELECTOR).forEach(renderId);
}
loadCatalog().then(()=>{
 scan();
 const observer=new MutationObserver(records=>{
  for(const record of records){
   for(const added of record.addedNodes)if(added.nodeType===Node.ELEMENT_NODE)scan(added);
   if(record.type==="characterData"){
    const target=record.target.parentElement?.closest(SELECTOR);if(target)renderId(target);
   }
  }
 });
 observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==="local"&&changes.valeryCodeCatalog)loadCatalog().then(()=>scan());
 });
}).catch(()=>scan());
})();