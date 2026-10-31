// What kind of day is it? ONE answer for Today, Play, the week strip and the Schedule (Build 4, Part A of the Oct 29 audit,
// which found Play calling a Thursday with an Acro make-up class a home day while Today said "Studio day · memory run").
// A home weekday (data/home-days.json) with nothing booked is a home day; a weekly class or a booked one-off date (a make-up
// class, a private) turns it into a studio day whose home plan is the short one — Monday's watch-and-picture or the 
// memory run (planToday.shortKind, plan15 rules.studioDays); any other day is a rest day. Everything here takes the date
// string, never the clock, so a test can pin a Thursday. Pure parts up top; the app-state versions at the bottom.
import { CLASSES, HOME_DAYS } from "./data.js";
import { studioDates } from "./store.js";
import { studioOn } from "./studio.js";
import { shortKind } from "./planToday.js";
import { closures } from "./store.js";
import { sessionRules, activePlan, showDay } from "./season15.js";

export const weekdayOf = (date) => new Date(date + "T00:00:00").getDay();
// "watch" | "memory" (a studio day's home plan) | "home" | "rest" for `date`. `studioKind(date)` names the short plan on a
// studio day ("watch" on a Monday, "memory" otherwise).
// "show" on show day (1.58.0, Jenya: no home practice that day); during a studio closure the weekly class days are home days
// (Jenya: full home sessions on her usual class days).
export function dayKind(date, { classes = [], oneOffs = [], homeDays = {}, studioKind = () => "memory", closed = [], showDayOf = () => "" } = {}){
  if (showDayOf(date) === date) return "show";
  if (studioOn(date, classes, oneOffs, closed).length) return studioKind(date) || "memory";
  const wd = weekdayOf(date); if (homeDays[wd]) return "home";
  return (closed || []).some(e => date >= e.start && date <= (e.end || e.start)) && (classes || []).some(c => c.day === wd) ? "home" : "rest";
}
export const isHomeDay = (date, opts) => dayKind(date, opts) === "home";
// The "Home: …" line for a day's cell: the home plan's name on a home weekday, "memory run" once a class or a booked
// date turns that weekday into a studio day, "" on any other day.
// A light week or the night before a home day is the memory run too (`isShort`, 1.58.0); show day says so; a break day is home practice.
export function homeLine(date, opts = {}){ const k = dayKind(date, opts); if (k === "show") return "Show day ★"; const hp = (opts.homeDays || {})[weekdayOf(date)];
  if (k === "home") return opts.isShort && opts.isShort(date) ? "memory run" : hp || "Home practice";
  return hp ? "memory run" : ""; }

// ---- from the app's own state: the weekly classes, the booked dates, the plan's studio days ----
export const dayOpts = () => ({ classes: CLASSES, oneOffs: studioDates(), homeDays: HOME_DAYS, studioKind: shortKind, closed: closures(), showDayOf: (d) => { const p = activePlan(d); return p ? showDay(p) : ""; }, isShort: (d) => !!sessionRules(d).short });
export const dayKindNow = (date) => dayKind(date, dayOpts());
export const homeLineNow = (date) => homeLine(date, dayOpts());
