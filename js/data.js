// Season content lives in data/*.json. loadData() fills these live bindings once at boot;
// every other module imports them by name and reads them after boot.
export let DEFAULT_DANCES=[], DEFAULT_EVENTS=[], CLASSES=[], HOME_DAYS={}, PRACTICE_ITEMS=[], PHASES=[], PACKS={}, AERIAL=[], SEASON={};
export let STYLES={}, MOVES=[], BASE={}, ARMS={};
export let AVATAR_DEFAULT={}, AV_OPTS={};
export let JE_FLAWS=[], JE_MOVES=[];
export let TF_FORMS={}, TF_PATS={}, TF_MOVES=[], TF_DANCERS=[];
export let CD_SCENES=[];
export let SPARKLE={icons:[],party:[]};
export let SKILLS={states:[],styles:{}};
export let PRACTICE_POOL={slots:[],runs:[]}, EXERCISES={};

// A pose = every joint from BASE, overridden by the keyframe. Same helper the games always used.
export const P=(o={})=>Object.assign({},BASE,o);

// moves.json stores each keyframe as { arms: "up"|"second"|"low"|"first", ...jointOverrides }.
// Expand to the full joint set the animation code expects.
export function expandMoves(json){
  const base=json.base, arms=json.arms;
  return json.moves.map(m=>({ ...m, k:m.k.map(kf=>{ const {arms:a,...rest}=kf; if(a&&!arms[a]) throw new Error(`Unknown arm preset "${a}" in move ${m.id}`); return Object.assign({},base,a?arms[a]:{},rest); }) }));
}

export const DATA_FILES=["dances","events","classes","home-days","practice-items","phases","packs","aerial","season","styles","moves","avatar-options","oops","trio","compday","sparkle","skills","practice-pool","exercises"];

export async function loadData(base="./data/"){
  const got={};
  await Promise.all(DATA_FILES.map(async f=>{ const r=await fetch(base+f+".json",{cache:"no-cache"}); if(!r.ok) throw new Error("Could not load data/"+f+".json ("+r.status+")"); got[f]=await r.json(); }));
  applyData(got);
  return got;
}

// Split out so the tests can feed JSON straight in.
export function applyData(got){
  DEFAULT_DANCES=got.dances; DEFAULT_EVENTS=got.events; CLASSES=got.classes; HOME_DAYS=got["home-days"]; PRACTICE_ITEMS=got["practice-items"]; PHASES=got.phases; PACKS=got.packs; AERIAL=got.aerial; SEASON=got.season;
  STYLES=got.styles; BASE=got.moves.base; ARMS=got.moves.arms; MOVES=expandMoves(got.moves);
  AVATAR_DEFAULT=got["avatar-options"].default; AV_OPTS=got["avatar-options"].options;
  JE_FLAWS=got.oops.flaws; JE_MOVES=got.oops.moves;
  TF_FORMS=got.trio.forms; TF_PATS=got.trio.patterns; TF_MOVES=got.trio.moves; TF_DANCERS=got.trio.dancers;
  CD_SCENES=got.compday;
  SPARKLE=got.sparkle;
  SKILLS=got.skills||{states:[],styles:{}};
  PRACTICE_POOL=got["practice-pool"]||{slots:[],runs:[]}; EXERCISES=got.exercises||{};
}
