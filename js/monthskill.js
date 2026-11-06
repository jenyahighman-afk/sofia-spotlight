// ⭐ My skill this month (1.64.0, one of the four ideas Jenya picked on Nov 5): one skill she picked herself for the month.
// settings.monthSkills = { "YYYY-MM": skillId }: one per month; earlier months stay. Since 1.65.0 the card is gone: her own
// list on top of Skills (js/working.js, ⭐ My goals since 1.66.0) holds as many skills as she likes with the same Before and Now
// photos, and until she picks there it starts with this month's skill, so nothing she chose is lost. Pure.
import { todayStr } from "./util.js";
import { SKILLS } from "./data.js";
import { findSkill } from "./skills.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthKey = (date = todayStr()) => String(date).slice(0, 7);
export const monthName = (date = todayStr()) => MONTHS[+String(date).slice(5, 7) - 1] || "";
// The skill picked for the month of `date`, or null (nothing picked, or the skill is no longer on a list). Pure.
export function monthSkill(settings, date = todayStr(), ladder = SKILLS){
  const m = (settings || {}).monthSkills; const id = m && typeof m === "object" ? m[monthKey(date)] : ""; if (!id) return null;
  return findSkill(String(id), ladder) || null;
}
