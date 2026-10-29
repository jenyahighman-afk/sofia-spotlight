// What kind of day is it? ONE answer for Today, Play, the week strip and the Schedule (Build 4, Part A of the Oct 29 audit,
// which found Play calling a Thursday with an Acro make-up class a home day while Today said "Studio day · 15-min memory run").
// A home weekday (data/home-days.json) with nothing booked is a home day; a weekly class or a booked one-off date (a make-up
// class, a private) turns it into a studio day whose home plan is the short one — Monday's watch-and-picture or the 15-minute
// memory run (planToday.shortKind, plan15 rules.studioDays); any other day is a rest day. Everything here takes the date
// string, never the clock, so a test can pin a Thursday. Pure parts up top; the app-state versions at the bottom.
import { CLASSES, HOME_DAYS } from "./data.js";
import { studioDates } from "./store.js";
import { studioOn } from "./studio.js";
import { shortKind } from "./planToday.js";

export const weekdayOf = (date) => new Date(date + "T00:00:00").getDay();
// "watch" | "memory" (a studio day's home plan) | "home" | "rest" for `date`. `studioKind(date)` names the short plan on a
// studio day ("watch" on a Monday, "memory" otherwise).
export function dayKind(date, { classes = [], oneOffs = [], homeDays = {}, studioKind = () => "memory" } = {}){
  if (studioOn(date, classes, oneOffs).length) return studioKind(date) || "memory";
  return homeDays[weekdayOf(date)] ? "home" : "rest";
}
export const isHomeDay = (date, opts) => dayKind(date, opts) === "home";
// The "Home: …" line for a day's cell: the home plan's name on a home weekday, "15-min memory run" once a class or a booked
// date turns that weekday into a studio day, "" on any other day.
export function homeLine(date, opts = {}){ const hp = (opts.homeDays || {})[weekdayOf(date)]; if (!hp) return ""; return dayKind(date, opts) === "home" ? hp : "15-min memory run"; }

// ---- from the app's own state: the weekly classes, the booked dates, the plan's studio days ----
export const dayOpts = () => ({ classes: CLASSES, oneOffs: studioDates(), homeDays: HOME_DAYS, studioKind: shortKind });
export const dayKindNow = (date) => dayKind(date, dayOpts());
export const homeLineNow = (date) => homeLine(date, dayOpts());
