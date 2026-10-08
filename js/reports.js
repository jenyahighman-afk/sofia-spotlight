// "Something went wrong? Tap to send a report": captures the last error on this phone and writes a report Mom can read in Grown-ups.
import { $, $$, esc, toast, uid, expose } from "./util.js";
import { S, storeSet, storeDel } from "./store.js";

const last = { error: "", at: 0, page: "" };
export function noteError(e, where){ last.error = String((e && (e.stack || e.message)) || e || "").slice(0, 600); last.at = Date.now(); last.page = where || currentPage(); }
export function currentPage(){ const p = $$("section.page.on")[0]; return p ? p.id.replace(/^p-/, "") : ""; }

export function installErrorCapture(){
  window.addEventListener("error", ev => noteError(ev.error || ev.message));
  window.addEventListener("unhandledrejection", ev => noteError(ev.reason));
}

// Wrap a render so one broken screen never takes the others down: the section shows what to do instead of staying blank.
export function guard(sectionId, fn){
  return () => {
    const sec = $("#p-" + sectionId); const box = sec && sec.querySelector(".err-state");
    try { fn(); if (box) box.hidden = true; }
    catch (e) {
      console.error("render failed:", sectionId, e); noteError(e, sectionId);
      if (sec) { let b = box; if (!b) { b = document.createElement("div"); b.className = "card err-state"; sec.prepend(b); }
        b.hidden = false; b.innerHTML = `<h3>This screen hit a snag</h3><p class="small">Close the app and open it again. If it keeps happening, tap below so Mom gets the details.</p><button class="btn sm coral" onclick="sendReport('${sectionId}')">Send a report</button>`; }
    }
  };
}

// Small footer link on every screen.
export function installReportLinks(){
  $$("section.page").forEach(sec => { if (sec.querySelector(".report-link")) return; const f = document.createElement("p"); f.className = "report-link small muted noprint"; f.innerHTML = `Something went wrong? <a href="#" onclick="sendReport('${sec.id.replace(/^p-/, "")}');return false">Tap to send a report</a>`; sec.appendChild(f); });
}

export async function sendReport(page){
  const note = prompt("What happened? (optional)") ; if (note === null) return;
  const id = uid();
  try {
    await storeSet("reports", id, { page: page || currentPage(), note: String(note || "").slice(0, 300), error: last.error, errorAt: last.at || 0, version: self.APP_VERSION || "", ua: navigator.userAgent.slice(0, 200), online: navigator.onLine, width: window.innerWidth, at: new Date().toISOString() });
    toast("Sent ✓", 2000);
  } catch (e) { console.warn(e); toast("Couldn't send it — try again when you're online", 2500); }
}
export function renderReports(){
  const el = $("#reportList"); if (!el) return;
  const list = Object.entries(S.reports).sort((a, b) => (b[1].at || "").localeCompare(a[1].at || ""));
  el.innerHTML = list.length ? list.map(([id, r]) => `<div class="card"><div class="row"><span class="chip violet">${esc(r.page || "?")}</span><span class="small muted grow">${esc((r.at || "").replace("T", " ").slice(0, 16))} · v${esc(r.version || "?")}${r.online === false ? " · offline" : ""}</span><button class="del" onclick="delReport('${id}')">✕</button></div>${r.note ? `<p class="small">${esc(r.note)}</p>` : ""}${r.error ? `<pre class="small err-pre">${esc(r.error)}</pre>` : `<p class="small muted">No error was captured on that phone.</p>`}</div>`).join("") : `<p class="muted small">No reports. Good sign.</p>`;
}
async function delReport(id){ await storeDel("reports", id); }
expose({ sendReport, delReport });
