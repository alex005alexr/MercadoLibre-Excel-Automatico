"use strict";

const AUTO_URL = "https://vendedores.mercadolibre.com.ve/publicaciones/edicion-en-excel/download";
const TIMEOUT_ALARM = "mlh-auto-download-timeout";
const MAX_RUN_AGE = 5 * 60 * 1000;

async function getRun() {
  const data = await chrome.storage.local.get("mlhAutoRun");
  return data.mlhAutoRun || null;
}
async function saveRun(run) {
  await chrome.storage.local.set({ mlhAutoRun: run });
}
async function notify(title, message, success) {
  try {
    await chrome.notifications.create("mlh-" + Date.now(), {
      type: "basic",
      iconUrl: chrome.runtime.getURL("icon.png"),
      title,
      message,
      priority: 2
    });
  } catch (_) {}
  await chrome.action.setBadgeText({ text: success ? "OK" : "!" });
  await chrome.action.setBadgeBackgroundColor({ color: success ? "#168447" : "#c0392b" });
}
async function failRun(message) {
  const run = await getRun();
  if (!run) return;
  await chrome.alarms.clear(TIMEOUT_ALARM);
  await chrome.storage.local.remove("mlhAutoRun");
  await notify("MercadoLibre: descarga no completada", message + " La pestaña quedó abierta para revisar el problema.", false);
}
async function finishRun() {
  const run = await getRun();
  if (!run) return;
  await chrome.alarms.clear(TIMEOUT_ALARM);
  await chrome.storage.local.remove("mlhAutoRun");
  try { await chrome.tabs.remove(run.tabId); } catch (_) {}
  await notify("MercadoLibre: Excel descargado", "La descarga terminó correctamente. Se cerró únicamente la pestaña automática.", true);
}
async function registerAutoTab(tabId, url) {
  let parsed;
  try { parsed = new URL(url); } catch (_) { return; }
  if (parsed.origin + parsed.pathname !== AUTO_URL || parsed.searchParams.get("mlh_auto") !== "1") return;

  const current = await getRun();
  if (current && current.tabId === tabId) return;
  if (current && Date.now() - current.startedAt < MAX_RUN_AGE) {
    if (current.tabId !== tabId) {
      try { await chrome.tabs.remove(tabId); } catch (_) {}
    }
    return;
  }
  const run = { tabId, startedAt: Date.now(), downloadId: null, state: "preparing" };
  await saveRun(run);
  await chrome.alarms.create(TIMEOUT_ALARM, { delayInMinutes: 3 });
  await chrome.action.setBadgeText({ text: "..." });
  await chrome.action.setBadgeBackgroundColor({ color: "#b7791f" });
  // Si Chrome ya tenía otras pestañas, devolver el foco a la que estaba activa.
  try {
    const tab = await chrome.tabs.get(tabId);
    const peers = await chrome.tabs.query({ windowId: tab.windowId });
    if (peers.some(peer => peer.id !== tabId && peer.active)) await chrome.tabs.update(tabId, { active: false });
  } catch (_) {}
}

let registrationQueue = Promise.resolve();
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  const url = changeInfo.url || tab.url;
  if (url) registrationQueue = registrationQueue.then(() => registerAutoTab(tabId, url)).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!message || !sender.tab || !sender.tab.id) return;
  (async () => {
    // Registrar también desde el primer mensaje del content script. Así evitamos
    // una carrera si la página empieza a descargar antes de que tabs.onUpdated
    // haya terminado de guardar la pestaña automática.
    if (message.type === "mlh-auto-started" && sender.tab.url) {
      await registerAutoTab(sender.tab.id, sender.tab.url);
    }
    const run = await getRun();
    if (!run || run.tabId !== sender.tab.id) return;
    if (message.type === "mlh-auto-started") {
      await saveRun({ ...run, state: "preparing" });
    } else if (message.type === "mlh-auto-download-clicked") {
      await saveRun({ ...run, state: "downloading", downloadRequestedAt: Date.now() });
    } else if (message.type === "mlh-auto-failed") {
      await failRun(message.message || "MercadoLibre no permitió completar el proceso.");
    }
  })().catch(() => {});
});

chrome.downloads.onCreated.addListener(async item => {
  const run = await getRun();
  if (!run || run.downloadId) return;
  const created = Date.parse(item.startTime || "") || Date.now();
  if (created < run.startedAt - 5000) return;

  // Chrome informa tabId en el DownloadItem: es la correlación más segura
  // y no depende de que referrer venga informado (puede variar si MercadoLibre
  // genera el archivo mediante una URL blob).
  const initiatedByAutoTab = Number.isInteger(item.tabId) && item.tabId === run.tabId;
  const excelFile = /\\.(xlsx?|csv)(?:$|[?#])/i.test(item.filename || "");
  if (!initiatedByAutoTab || !excelFile) return;

  await saveRun({ ...run, downloadId: item.id, state: "downloading" });
});

chrome.downloads.onChanged.addListener(async delta => {
  if (!delta.state) return;
  const run = await getRun();
  if (!run || run.downloadId !== delta.id) return;
  if (delta.state.current === "complete") {
    await finishRun();
  } else if (delta.state.current === "interrupted") {
    await failRun("Chrome interrumpió la descarga del archivo.");
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name !== TIMEOUT_ALARM) return;
  const run = await getRun();
  if (run) await failRun("Se agotó el tiempo de espera y no se confirmó una descarga completa.");
});

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.action.setBadgeText({ text: "" });
});
