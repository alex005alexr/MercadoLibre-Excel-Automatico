"use strict";

const NATIVE_HOST = "com.repuestos.ml_excel_scheduler";
const startup = document.getElementById("startup");
const newTime = document.getElementById("newTime");
const list = document.getElementById("scheduleList");
const statusBox = document.getElementById("status");
const saveButton = document.getElementById("save");
let schedules = [];

function status(message, kind = "") {
  statusBox.textContent = message;
  statusBox.className = kind;
}
function validTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function render() {
  list.replaceChildren();
  schedules.forEach((time, index) => {
    const row = document.createElement("div");
    row.className = "schedule";
    const input = document.createElement("input");
    input.type = "time";
    input.value = time;
    input.setAttribute("aria-label", "Horario " + (index + 1));
    input.addEventListener("change", () => {
      if (!validTime(input.value)) return;
      schedules[index] = input.value;
      schedules = [...new Set(schedules)].sort();
      render();
    });
    const label = document.createElement("span");
    label.textContent = "Todos los días";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.textContent = "Eliminar";
    remove.addEventListener("click", () => {
      schedules.splice(index, 1);
      render();
    });
    row.append(input, label, remove);
    list.append(row);
  });
  if (!schedules.length) {
    const empty = document.createElement("div");
    empty.className = "hint";
    empty.textContent = "No hay horarios diarios configurados.";
    list.append(empty);
  }
}

async function nativeRequest(payload) {
  return chrome.runtime.sendNativeMessage(NATIVE_HOST, payload);
}
async function load() {
  try {
    const response = await nativeRequest({ action: "getConfig" });
    if (!response || !response.success) throw new Error(response?.error || "Respuesta no válida del programador.");
    startup.checked = response.config.startup !== false;
    schedules = Array.isArray(response.config.schedules) ? response.config.schedules : ["12:00"];
    schedules = [...new Set(schedules.filter(validTime))].sort();
    render();
    status("Programador de Windows conectado. Configura los horarios y pulsa Guardar.", "ok");
  } catch (error) {
    status("No se pudo conectar con el programador de Windows. Ejecuta primero Instalar-Automatizacion.ps1 y vuelve a abrir esta pantalla.\nDetalle: " + (error?.message || error), "error");
    saveButton.disabled = true;
  }
}
document.getElementById("addTime").addEventListener("click", () => {
  const value = newTime.value;
  if (!validTime(value)) return status("Selecciona una hora válida.", "error");
  if (schedules.includes(value)) return status("Ese horario ya está agregado.", "error");
  schedules.push(value);
  schedules.sort();
  render();
  status("Horario agregado. Pulsa Guardar programación para aplicarlo.");
});
saveButton.addEventListener("click", async () => {
  saveButton.disabled = true;
  status("Guardando tareas programadas en Windows…");
  try {
    const response = await nativeRequest({ action: "saveConfig", config: { startup: startup.checked, schedules } });
    if (!response || !response.success) throw new Error(response?.error || "Windows no confirmó la programación.");
    status("Programación guardada correctamente. Windows ejecutará las descargas según estos horarios.", "ok");
  } catch (error) {
    status("No se pudo guardar la programación.\nDetalle: " + (error?.message || error), "error");
  } finally {
    saveButton.disabled = false;
  }
});
load();
