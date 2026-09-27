// The family-space gate: first launch offers "Create family space" or "Join with code" (typed, pasted, scanned, or via a ?join= link).
import { $, esc, toast, loadScript } from "./util.js";
import { createFamily, joinFamily, markSeeded, startWatching, normalizeFamilyId, isValidFamilyId, friendlyError, sync } from "./sync.js";
import { seedFamily } from "./seed.js";

const QR_URL = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
const JSQR_URL = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

export function joinLink(id){ const u = new URL(location.href); u.search = ""; u.hash = ""; u.searchParams.set("join", id); return u.toString(); }
export const prettyCode = (id) => id.replace(/(.{4})(?=.)/g, "$1 ");
export function codeFromText(text){ const t = String(text || "").trim(); try { const u = new URL(t); const j = u.searchParams.get("join"); if (j) return normalizeFamilyId(j); } catch (e) {} return normalizeFamilyId(t); }

export async function renderQR(el, text){
  try { await loadScript(QR_URL); const qr = window.qrcode(0, "M"); qr.addData(text); qr.make(); el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }
  catch (e) { el.innerHTML = `<p class="small muted">QR code needs a connection the first time.</p>`; }
}

let scanner = null;
async function startScan(onCode){
  const box = $("#gateScanner"), video = $("#gateVideo"); box.hidden = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream; await video.play();
    const detector = ("BarcodeDetector" in window) ? new BarcodeDetector({ formats: ["qr_code"] }) : null;
    if (!detector) await loadScript(JSQR_URL);
    const cv = document.createElement("canvas"); const ctx = cv.getContext("2d", { willReadFrequently: true });
    scanner = { stream, on: true };
    const tick = async () => {
      if (!scanner || !scanner.on) return;
      try {
        let text = null;
        if (detector) { const codes = await detector.detect(video); if (codes.length) text = codes[0].rawValue; }
        else if (video.videoWidth) { cv.width = video.videoWidth; cv.height = video.videoHeight; ctx.drawImage(video, 0, 0); const img = ctx.getImageData(0, 0, cv.width, cv.height); const r = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" }); if (r) text = r.data; }
        if (text) { const code = codeFromText(text); if (isValidFamilyId(code)) { stopScan(); onCode(code); return; } }
      } catch (e) { console.warn(e); }
      setTimeout(tick, 250);
    };
    tick();
  } catch (e) { stopScan(); toast("Camera not available: " + (e.message || e), 3000); }
}
function stopScan(){ if (scanner) { scanner.on = false; scanner.stream.getTracks().forEach(t => t.stop()); scanner = null; } const v = $("#gateVideo"); if (v) v.srcObject = null; const b = $("#gateScanner"); if (b) b.hidden = true; }

function show(id){ ["gateHome", "gateJoin", "gateCreated", "gateBusy"].forEach(x => { $("#" + x).hidden = x !== id; }); $("#gateMsg").textContent = ""; }
const msg = (t, bad) => { const m = $("#gateMsg"); m.textContent = t; m.style.color = bad ? "#FF5C93" : ""; };

// Resolves with the family id once the person has created or joined a space.
export function showGate(prefillCode = ""){
  return new Promise(resolve => {
    const gate = $("#gate"); gate.hidden = false; document.body.classList.add("gated");
    const done = (id) => { stopScan(); gate.hidden = true; document.body.classList.remove("gated"); resolve(id); };
    show("gateHome");
    if (prefillCode) { show("gateJoin"); $("#gateCode").value = prettyCode(prefillCode); }

    $("#gateCreate").onclick = async () => {
      if (!sync.user) return msg("Not connected to Firebase yet — check the connection and reopen the app.", true);
      show("gateBusy"); $("#gateBusyText").textContent = "Creating your family space…";
      try {
        const id = await createFamily();
        startWatching(id);
        $("#gateBusyText").textContent = "Bringing over Sofia's saved dances, note, avatar and files…";
        const r = await seedFamily((n, total) => { $("#gateBusyText").textContent = `Bringing over Sofia's things… ${n}/${total}`; });
        await markSeeded(id);
        show("gateCreated"); $("#gateNewCode").textContent = prettyCode(id); $("#gateNewCode").dataset.code = id; renderQR($("#gateQR"), joinLink(id));
        if (r.errors.length) msg(`Set up, but ${r.errors.length} item(s) couldn't be copied: ${r.errors.join(", ")}`, true);
        $("#gateCopy").onclick = async () => { try { await navigator.clipboard.writeText(id); toast("Code copied"); } catch (e) { toast("Copy didn't work — write it down"); } };
        $("#gateShare").onclick = async () => { const link = joinLink(id); if (navigator.share) { try { await navigator.share({ title: "Sofia's Spotlight", text: "Join our family space: " + id, url: link }); } catch (e) {} } else { try { await navigator.clipboard.writeText(link); toast("Link copied"); } catch (e) {} } };
        $("#gateGo").onclick = () => done(id);
      } catch (e) { console.error(e); show("gateHome"); msg("Couldn't create the family space: " + friendlyError(e), true); }
    };
    $("#gateJoinBtn").onclick = () => { show("gateJoin"); $("#gateCode").focus(); };
    $("#gateBack").onclick = () => { stopScan(); show("gateHome"); };
    $("#gateCode").oninput = (e) => { const el = e.target; el.value = prettyCode(normalizeFamilyId(el.value).slice(0, 24)); };
    $("#gateCode").onpaste = (e) => { const t = (e.clipboardData || window.clipboardData).getData("text"); const c = codeFromText(t); if (c) { e.preventDefault(); $("#gateCode").value = prettyCode(c.slice(0, 24)); } };
    $("#gateScan").onclick = () => startScan(code => { $("#gateCode").value = prettyCode(code); $("#gateJoinGo").click(); });
    $("#gateJoinGo").onclick = async () => {
      const code = normalizeFamilyId($("#gateCode").value);
      if (!isValidFamilyId(code)) return msg("The code is 24 letters and numbers — check for a missing character.", true);
      if (!sync.user) return msg("Not connected to Firebase yet — check the connection and reopen the app.", true);
      show("gateBusy"); $("#gateBusyText").textContent = "Joining…";
      try { const id = await joinFamily(code); toast("Joined!"); done(id); }
      catch (e) { console.warn(e); show("gateJoin"); $("#gateCode").value = prettyCode(code); msg(friendlyError(e), true); }
    };
  });
}
