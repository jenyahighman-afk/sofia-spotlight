// The bunny's voice: the phone's own text-to-speech (no recordings, nothing sent anywhere), tuned to sound friendly.
// It picks the nicest voice the phone has (Premium / Enhanced English voices first, the robotic novelty and old
// "Eloquence" voices last), talks a little slower and a little higher than normal, one sentence at a time with small
// pauses, after a tiny "boing". "🎙️" cycles through the best few voices on this phone; the choice is kept per phone.
// iPhone note: Safari speech follows the Silent setting, so a phone in Silent mode stays quiet; the bubble says so.
// Pure parts up top (tested in Node).
const KEY = "spotlight:voice";
export const RATE = 0.9, PITCH = 1.2;
// Voices that sound like robots or sound effects (Apple's novelty and Eloquence voices).
const ROBOTIC = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|junior|ralph|fred|kathy|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|hysterical|deranged|pipe organ)\b/i;
const NICE = /\b(samantha|ava|allison|susan|zoe|nicky|evan|karen|moira|tessa|serena|kate|fiona|catherine|martha|siri)\b/i;
export function voiceScore(v){
  if (!v || !/^en([-_]|$)/i.test(v.lang || "")) return -1;
  let s = 10; const n = String(v.name || "");
  if (ROBOTIC.test(n)) return 0; // usable only when the phone has nothing else
  if (/premium|enhanced|neural|natural/i.test(n) || /premium|enhanced/i.test(v.voiceURI || "")) s += 40;
  if (NICE.test(n)) s += 20;
  if (/^en[-_]US/i.test(v.lang)) s += 6; else if (/^en[-_](GB|AU|IE|NZ|CA)/i.test(v.lang)) s += 4;
  if (v.localService) s += 3;
  return s;
}
// The best few English voices on this phone, best first (robotic ones only when there is nothing else).
export function bestVoices(voices, n = 4){
  const ok = (voices || []).map(v => [v, voiceScore(v)]).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1]);
  const good = ok.filter(([, s]) => s > 0); return (good.length ? good : ok).slice(0, n).map(([v]) => v);
}
// Words a voice can read: emoji and symbols out, *actions* kept as words, ranges and dashes said out loud.
export function speechText(t){
  return String(t || "")
    .replace(/(\d)\s*[–-]\s*(\d)/g, "$1 to $2").replace(/[“”"]/g, "").replace(/&/g, " and ").replace(/[*_]/g, "").replace(/…|\.\.\./g, ", ")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, " ")
    .replace(/[▶›‹◉○◔★✓✅·•]/g, " ").replace(/\s+([,.!?])/g, "$1").replace(/\s{2,}/g, " ").trim();
}
// One sentence at a time sounds much less robotic than one long string.
export function sentences(t){ return (String(t || "").match(/[^.!?]+[.!?]*/g) || []).map(s => s.trim()).filter(s => /[a-z0-9]/i.test(s)); }

// ---------- speaking (browser only) ----------
let list = [];
const synth = () => (typeof speechSynthesis !== "undefined" ? speechSynthesis : null);
function load(){ const s = synth(); if (!s) return []; try { list = bestVoices(s.getVoices()); } catch (e) { list = []; } return list; }
if (synth()) try { synth().addEventListener("voiceschanged", load); } catch (e) {}
const saved = () => { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } };
export function currentVoice(){ if (!list.length) load(); return list.find(v => v.name === saved()) || list[0] || null; }
// Next of the best voices; returns its name (for a toast).
export function nextVoice(){ if (!list.length) load(); if (!list.length) return ""; const i = list.findIndex(v => v.name === (currentVoice() || {}).name); const v = list[(i + 1) % list.length]; try { localStorage.setItem(KEY, v.name); } catch (e) {} return v.name.replace(/\s*\(.*\)$/, ""); }
export const canSpeak = () => !!synth() && typeof SpeechSynthesisUtterance !== "undefined";
// A tiny two-note "boing" before the bunny talks (Web Audio; silent where it isn't available).
let ctx = null;
function boing(){
  try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return 0; ctx = ctx || new AC(); if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine";
    o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.12); o.frequency.exponentialRampToValueAtTime(760, t + 0.22);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.28); return 300;
  } catch (e) { return 0; }
}
export function stopSpeaking(){ const s = synth(); if (s) try { s.cancel(); } catch (e) {} }
// Speak in the bunny voice. Must start from a tap (iPhone rule).
export function speakBunny(text){
  const s = synth(); if (!canSpeak()) return false; stopSpeaking(); const parts = sentences(speechText(text)); if (!parts.length) return false;
  const v = currentVoice(); const wait = boing();
  const say = (i) => { if (i >= parts.length) return; const u = new SpeechSynthesisUtterance(parts[i]); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = "en-US"; u.rate = RATE; u.pitch = PITCH; u.onend = () => setTimeout(() => say(i + 1), 180); try { s.speak(u); } catch (e) {} };
  // iPhone only lets speech start from a tap: an empty utterance now unlocks it (as js/runcheck.js does), the words follow the boing.
  try { s.speak(new SpeechSynthesisUtterance("")); } catch (e) {}
  if (wait) setTimeout(() => say(0), wait); else say(0);
  return true;
}
