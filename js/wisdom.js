// 💬 A dancer's tip for the day (1.78.0, Jenya Nov 14: "Add professional dancer's wisdom and advice that goes along with the
// stage of the dance season she is in at the moment. Make advice easy to understand for 9 year old."). One short line a
// day, chosen by the part of the season the plan says she is in (the plan's own phases: Own it, Clean it, Perform it, Rest
// up, then the spring's comp weeks). The lines are the app's own words: plain versions of what dancers and teachers pass
// on in the studio. None is a quote from a named person, so none carries a name. They show on Today and ride along with
// the daily reminder (js/remind.js sends the next weeks' lines to the worker). Pure (tested in Node).
import { activePlan, weekOf } from "./season15.js";

export const TIPS = {
  own: [
    "Know it so well you could dance it in the kitchen.",
    "Say the steps out loud. If you can say it, you can dance it.",
    "Small pieces first. Then glue them together.",
    "Dance it in your head before you dance it with your feet.",
    "Stuck on a step? Go back two steps and run at it again.",
    "Every dancer forgets steps. The good ones go and look them up.",
  ],
  clean: [
    "Slow is how clean happens. Do it slow, then do it right.",
    "Fix one thing at a time. One is plenty.",
    "A correction is a present. Say thank you, then use it.",
    "Film it, watch it, try again. Your eyes are a good teacher.",
    "Count the music out loud. Your feet will listen.",
    "Finish every move, all the way to your fingertips and toes.",
    "Fast and slow, sharp and soft: the mix is what makes people watch.",
    "The beat is your friend. Land on it, don't race it.",
  ],
  perform: [
    "Your face dances too.",
    "Pick a place to look. Eyes up, not at the floor.",
    "Dance it like someone you love is watching.",
    "Hold the ending until the music is all gone.",
    "Big breath in, long breath out. Then go.",
    "Run it twice. The second time is where you get strong.",
    "A wobble is not the end. Keep dancing and nobody minds.",
    "Tell the story. The steps are just how you tell it.",
  ],
  rest: [
    "Rest is part of training. Sleep makes the steps stick.",
    "Nothing new now. Trust what you practiced.",
    "Picture your dance going just the way you want.",
    "You did the work. Now enjoy it.",
  ],
  comp: [
    "Butterflies mean you care. Breathe, smile, go.",
    "Dance for you, not for the trophy.",
    "After a show: one thing you loved, one thing to grow.",
    "Cheer loud for your friends. Good teammates make good dancers.",
    "Warm up the same way every time. Your body likes to know what's coming.",
    "The judges' notes are free lessons. Pick one and work on it.",
    "One show does not say who you are. Keep going.",
    "Water, a snack, and sleep: that's dancer fuel.",
  ],
  auditions: [
    "Watch closely, then try. Being brave counts more than being perfect.",
    "Mess up? Smile and jump back in. They are watching how you keep going.",
    "Clean basics show more than big tricks.",
    "Listen first. The dancer who listens learns it fastest.",
  ],
};
// The plan's phase names → a set of tips. Anything else in the spring is comp season.
const PHASE_SET = { "Own it": "own", "Clean it": "clean", "Perform it": "perform", "Rest up": "rest", "Auditions": "auditions" };
const dayNo = (date) => Math.round(new Date(date + "T00:00:00").getTime() / 86400000);
// Which set a date is in: by the plan's phase for that week; before the plan "own", after it or between "comp". Pure.
export function tipSet(date, plan = activePlan(date)){
  const wk = weekOf(date, plan), name = wk && wk.phase ? wk.phase.n : "";
  if (PHASE_SET[name]) return PHASE_SET[name]; if (name) return "comp";
  return plan && plan.start && date < plan.start ? "own" : "comp";
}
// The day's tip: the set's lines in turn, one a day. Pure.
export function tipFor(date, plan = activePlan(date)){ const list = TIPS[tipSet(date, plan)] || TIPS.clean; return list[((dayNo(date) % list.length) + list.length) % list.length]; }
// What the daily reminder says on a date: [title, body]. A home day asks for the solo and the trio; a class day still
// welcomes one dance after class; the tip follows. kind = "home" | "studio". Pure.
export function reminderMsg(date, kind = "home", plan = activePlan(date)){
  const tip = tipFor(date, plan);
  return kind === "studio" ? ["Class day 🏫", `After class, got a chance at home? One run of your solo. 💬 ${tip}`] : ["Dance time 🎵", `Solo once, trio once: about 5 minutes. 💬 ${tip}`];
}
// The next `span` days' messages, for the worker: { "YYYY-MM-DD": [title, body] }. kindOf(date) = "home" | "studio" | "off". Pure.
export function reminderMsgs(from, span, kindOf, shift){ const out = {}; for (let i = 0; i < span; i++) { const d = shift(from, i), k = kindOf(d); if (k === "off") continue; out[d] = reminderMsg(d, k); } return out; }
