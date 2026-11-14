"use strict";
const fileInput=document.getElementById("file");
const importButton=document.getElementById("import");
const statusBox=document.getElementById("status");
function setStatus(message,kind=""){statusBox.textContent=message;statusBox.className=kind;}
const normHeader=value=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim().toLowerCase();
function normalizeReference(value){
 if(value===null||value===undefined||value==="")return "";
 let s=String(value).trim().replace(/^#/,"");
 if(/^\d+\.0$/.test(s))s=s.slice(0,-2);
 return s.replace(/\D/g,"");
}
function findHeaderRow(rows){
 for(let r=0;r<Math.min(rows.length,30);r++){
  const headers=(rows[r]||[]).map(normHeader);
  const code=headers.findIndex(x=>["codigo","codigo articulo","codigo de articulo"].includes(x));
  const ref=headers.findIndex(x=>["referencia","referencia articulo"].includes(x));
  const name=headers.findIndex(x=>["nombre","descripcion","descripcion del articulo"].includes(x));
  if(code>=0&&ref>=0)return {row:r,code,ref,name};
 }
 return null;
}
async function readRows(file){
 const buffer=await file.arrayBuffer();
 const workbook=XLSX.read(buffer,{type:"array",cellDates:false,raw:true});
 if(!workbook.SheetNames.length)throw new Error("El archivo no contiene hojas.");
 return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:true,defval:""});
}
async function importFile(file){
 if(!file)throw new Error("Selecciona primero el archivo exportado de Valery.");
 const rows=await readRows(file),header=findHeaderRow(rows);
 if(!header)throw new Error("No encontré los encabezados Código y Referencia en las primeras 30 filas.");
 const map=new Map();let valid=0,skipped=0,conflicts=0;
 for(let i=header.row+1;i<rows.length;i++){
  const row=rows[i]||[],code=String(row[header.code]??"").trim(),ref=normalizeReference(row[header.ref]);
  const name=header.name>=0?String(row[header.name]??"").trim():"";
  if(!code||!ref||(header.name>=0&&!name)){skipped++;continue;}
  if(!/^\d{5,}$/.test(ref)||code.length>100||/^(existencia|periodo|factura|descargo|cargo)/i.test(name)){skipped++;continue;}
  valid++;if(!map.has(ref))map.set(ref,new Set());map.get(ref).add(code);
 }
 if(!valid)throw new Error("No encontré artículos con Código, Referencia y Nombre válidos.");
 for(const codes of map.values())if(codes.size>1)conflicts++;
 const catalog={};for(const [id,codes] of map)catalog[id]=[...codes].sort();
 await chrome.storage.local.set({valeryCodeCatalog:catalog,valeryCodeCatalogMeta:{fileName:file.name,importedAt:new Date().toISOString(),records:valid,references:map.size,conflicts,skipped}});
 return {valid,references:map.size,conflicts,skipped};
}
async function showSaved(){
 const data=await chrome.storage.local.get(["valeryCodeCatalog","valeryCodeCatalogMeta"]),meta=data.valeryCodeCatalogMeta;
 if(!meta){setStatus("Todavía no has importado un catálogo.");return;}
 setStatus("Catálogo cargado.\nArchivo: "+meta.fileName+"\nArtículos válidos: "+meta.records+"\nReferencias: "+meta.references+"\nConflictos: "+meta.conflicts+"\nFilas omitidas: "+meta.skipped+"\nImportado: "+new Date(meta.importedAt).toLocaleString(),"ok");
}
importButton.addEventListener("click",async()=>{
 importButton.disabled=true;setStatus("Leyendo y validando el archivo…");
 try{const r=await importFile(fileInput.files[0]);setStatus("Importación completada.\nArtículos válidos: "+r.valid+"\nReferencias únicas: "+r.references+"\nReferencias con conflicto: "+r.conflicts+"\nFilas omitidas: "+r.skipped+"\nEl catálogo anterior fue actualizado.","ok");}
 catch(e){setStatus(e.message||String(e),"error");}finally{importButton.disabled=false;}
});
showSaved();
