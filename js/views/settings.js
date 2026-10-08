// Settings screen: family code + QR, sync status, backup export/import, updates, leave family space.
import { $, esc, toast } from "../util.js";
import { renderModeRow } from "../mode.js";
import { sync, onStatus, leaveFamily } from "../sync.js";
import { joinLink, prettyCode, renderQR } from "../family.js";
import { exportBackup, importBackup } from "../backup.js";
import { showPage } from "../nav.js";
import { openGrownups } from "../grownups.js";

let qrFor = null;
function renderStatus(){
  const s = sync; let text, dot;
  if (!s.online) { text = "Offline — changes are saved on this phone and sync when you're back online"; dot = "off"; }
  else if (s.error) { text = "Sync problem: " + s.error; dot = "err"; }
  else if (s.pending) { text = "Saving…"; dot = "busy"; }
  else if (s.lastSync) { text = "Online · synced " + new Date(s.lastSync).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); dot = "ok"; }
  else { text = "Online · loading from the cloud…"; dot = "busy"; }
  $("#syncStatus").innerHTML = `<span class="dot ${dot}"></span>${esc(text)}`;
}
function renderSettings(){
  const id = sync.familyId || "";
  $("#setCode").textContent = id ? prettyCode(id) : "—";
  if (id && qrFor !== id) { qrFor = id; renderQR($("#setQR"), joinLink(id)); }
  $("#setVersion").textContent = "v" + (self.APP_VERSION || "?") + " · media: " + (sync.familyId ? "cloud" : "—");
  renderStatus(); renderModeRow();
}
export function initSettings(){
  $("#openSettings").onclick = () => { renderSettings(); openGrownups("settings"); };
  $("#settingsBack").onclick = () => showPage("grownups");
  onStatus(renderStatus);
  $("#setCopy").onclick = async () => { try { await navigator.clipboard.writeText(sync.familyId); toast("Code copied"); } catch (e) { toast("Copy didn't work — write it down"); } };
  $("#setShare").onclick = async () => { const link = joinLink(sync.familyId); if (navigator.share) { try { await navigator.share({ title: "Sofia's Spotlight", text: "Join our family space: " + sync.familyId, url: link }); } catch (e) {} } else { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch (e) {} } };
  $("#setExport").onclick = async () => {
    const b = $("#setExport"); b.disabled = true; const label = b.textContent;
    try { toast("Packing the backup…", 4000); const r = await exportBackup((i, n) => { b.textContent = `Packing media ${i}/${n}…`; }); toast(`Backup ready · ${r.docs} records · ${r.media} media file${r.media === 1 ? "" : "s"}${r.missing ? ` · ${r.missing} skipped (Storage CORS not set, see README)` : ""}`, r.missing ? 6000 : 4000); }
    catch (e) { console.error(e); toast("Backup failed: " + (e.message || e), 3500); }
    b.disabled = false; b.textContent = label;
  };
  $("#setImportFile").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; ev.target.value = ""; if (!f) return;
    if (!confirm("Import this backup into the current family space? Records that are newer in the backup replace the ones here.")) return;
    try { toast("Importing…", 6000); const r = await importBackup(f); toast(`Imported · ${r.added} added, ${r.updated} updated, ${r.skipped} already up to date${r.uploaded ? ", " + r.uploaded + " media re-uploaded" : ""}${r.failed ? ", " + r.failed + " failed" : ""}`, 5000); }
    catch (e) { console.error(e); toast("Import failed: " + (e.message || e), 3500); }
  });
  $("#setUpdate").onclick = async () => {
    try { const reg = await navigator.serviceWorker?.getRegistration(); if (!reg) return toast("Updates arrive automatically when the app is online."); await reg.update(); if (reg.waiting) { reg.waiting.postMessage({ type: "SKIP_WAITING" }); toast("Updating…"); setTimeout(() => location.reload(), 600); } else toast("You're on the latest version"); }
    catch (e) { toast("Couldn't check for updates right now"); }
  };
  $("#setLeave").onclick = async () => {
    if (!confirm("Leave this family space on this phone? Your data stays in the cloud; you can rejoin with the code.")) return;
    if (!confirm("Do you have the code written down? Without it the data can't be reached again.")) return;
    await leaveFamily();
  };
}
export { renderSettings };
