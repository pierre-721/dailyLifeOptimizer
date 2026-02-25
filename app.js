const sb = window.supabaseClient;

const audioLevelUp = new Audio('./sounds/solo_leveling_menu_pop.mp3');
const audio = new Audio('./sounds/solo_leveling_counter.mp3');

const els = {
  btnSync: document.getElementById("btnSync"),
  rankBadge: document.getElementById("rankBadge"),
  levelValue: document.getElementById("levelValue"),
  xpValue: document.getElementById("xpValue"),
  streakValue: document.getElementById("streakValue"),
  xpMetaText: document.getElementById("xpMetaText"),
  xpFill: document.getElementById("xpFill"),
  todayText: document.getElementById("todayText"),
  systemNote: document.getElementById("systemNote"),

  fixedHabitList : document.getElementById("fixedHabitList"),
  customHabitList : document.getElementById("customHabitList"),
  dailyTimer : document.getElementById("dailyTimer"),
  btnNewSide : document.getElementById("btnNewSide"),


  modalOverlay: document.getElementById("modalOverlay"),
  habitTitle: document.getElementById("habitTitle"),
  habitDifficulty: document.getElementById("habitDifficulty"),
  btnCancel: document.getElementById("btnCancel"),
  btnCreate: document.getElementById("btnCreate"),

  toastHost: document.getElementById("toastHost"),

  statsView : document.getElementById("statsView"),
  btnRefreshStats : document.getElementById("btnRefreshStats"),
  weekXpBars : document.getElementById("weekXpBars"),
  heatmap : document.getElementById("heatmap"),
  heatmapHint : document.getElementById("heatmapHint"),
  topQuests : document.getElementById("topQuests"),

  settingsView: document.getElementById("settingsView"),
};

const state = {
  user: null,
  profile: { level: 1, xp: 0, rank: "E" },
  habits: [],
  logsToday: new Map(),
};

const xpNeeded = (level) => 100 + (level - 1) * 25;

function scaledTarget(habit, level){
  const base = habit.base_target ?? 0;
  const step = habit.target_step ?? 0;
  const every = habit.target_step_levels ?? 4;
  if (!step) return base;
  const tier = Math.floor((level - 1) / every);
  return base + tier * step;
}

function scaledXP(habit, level){
  const base = habit.base_xp ?? habit.xp_reward ?? 0;
  const step = habit.xp_step ?? 0;
  const every = habit.xp_step_levels ?? 4;
  if (!step) return base;
  const tier = Math.floor((level - 1) / every);
  return base + tier * step;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  els.toastHost.appendChild(t);
  setTimeout(() => t.remove(), 3400);
}

function computeRank(level) {
  if (level >= 100) return "S";
  if (level >= 68) return "A";
  if (level >= 48) return "B";
  if (level >= 30) return "C";
  if (level >= 15) return "D";
  return "E";
}


function msToMidnight() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0); // minuit prochain
  return next - now;
}

function formatHMS(ms){
  const s = Math.max(0, Math.floor(ms/1000));
  const hh = String(Math.floor(s/3600)).padStart(2,"0");
  const mm = String(Math.floor((s%3600)/60)).padStart(2,"0");
  const ss = String(s%60).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

let _timerId = null;
function startDailyTimer(){
  if (_timerId) clearInterval(_timerId);

  const tick = async () => {
    const ms = msToMidnight();
    els.dailyTimer.textContent = formatHMS(ms);

    // Si on passe minuit (ou très proche), on refresh + on applique pénalités
    if (ms < 900) { // <0.9s
      await applyDailyPenaltiesIfNeeded();
      await refreshAll();
      render();
    }
  };

  tick();
  _timerId = setInterval(tick, 1000);
}

function buildHabitItem(h, lvl) {
  const done = state.logsToday.get(h.id) === true;

  const streak = state.streaksByHabit.get(h.id);
  const cur = streak?.current_streak ?? 0;
  const best = streak?.best_streak ?? 0;

  const item = document.createElement("div");
  item.className = "habitItem";
  if (done) item.classList.add("questCompleted");

  const left = document.createElement("div");
  left.className = "habitLeft";

  const right = document.createElement("div");
  right.className = "habitRight";

  const check = document.createElement("div");
  check.className = "check" + (done ? " on" : "");
  check.innerHTML = done ? "✓" : "";
  check.title = "Toggle";
  check.style.cursor = "pointer";
  check.addEventListener("click", () => toggleHabitToday(h));

  const text = document.createElement("div");
  text.className = "habitText";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = h.title;

  const meta = document.createElement("div");
  meta.className = "meta";

  if (h.kind === "fixed") {
    const target = scaledTarget(h, lvl);
    const reward = scaledXP(h, lvl);
    meta.textContent = `OBJECTIF ${target} ${h.metric ?? ""} • REWARD +${reward} XP`;
  } else {
    meta.textContent = `DIFFICULTY ${h.difficulty} • REWARD +${h.xp_reward} XP`;
  }

  text.appendChild(title);
  text.appendChild(meta);

  left.appendChild(check);
  left.appendChild(text);

  const badge1 = document.createElement("div");
  badge1.className = "badge " + (done ? "good" : "warn");
  badge1.textContent = done ? "COMPLETED" : "PENDING";

  const mult =
    cur >= 30 ? 1.35 :
    cur >= 14 ? 1.20 :
    cur >= 7  ? 1.10 :
    cur >= 3  ? 1.05 : 1.00;

  //const badge2 = document.createElement("div");
  //badge2.className = "badge";
  //badge2.textContent = mult > 1
  //  ? `STREAK ${cur} • x${mult.toFixed(2)}`
  //  : `STREAK ${cur} • BEST ${best}`;

  right.appendChild(badge1);
  //right.appendChild(badge2);

  item.appendChild(left);
  item.appendChild(right);

  return item;
}


function render() {
  const { level, xp } = state.profile;
  const need = xpNeeded(level);
  const pct = Math.min(100, Math.round((xp / need) * 100));

  els.levelValue.textContent = level;
  els.xpValue.textContent = xp;
  els.rankBadge.textContent = state.profile.rank;
  els.xpMetaText.textContent = `${xp} / ${need}`;
  els.xpFill.style.width = `${pct}%`;
  els.todayText.textContent = todayISO();

  // streak simple: nombre de quêtes cochées aujourd’hui (MVP)
  const doneToday = [...state.logsToday.values()].filter(Boolean).length;
  els.streakValue.textContent = doneToday;

  // split fixed vs custom
  els.fixedHabitList.innerHTML = "";
  els.customHabitList.innerHTML = "";

  const fixed = state.habits.filter(h => h.kind === "fixed");
  const custom = state.habits.filter(h => h.kind !== "fixed");

  for (const h of fixed) {
    els.fixedHabitList.appendChild(buildHabitItem(h, level));
  }

  for (const h of custom) {
    els.customHabitList.appendChild(buildHabitItem(h, level));
  }
}


/*
function render() {

  const { level, xp } = state.profile;
  const need = xpNeeded(level);
  const pct = Math.min(100, Math.round((xp / need) * 100));

  els.levelValue.textContent = level;
  els.xpValue.textContent = xp;
  els.rankBadge.textContent = state.profile.rank;
  els.xpMetaText.textContent = `${xp} / ${need}`;
  els.xpFill.style.width = `${pct}%`;
  els.todayText.textContent = todayISO();

  // streak simple: nombre de quêtes cochées aujourd’hui (MVP)
  const doneToday = [...state.logsToday.values()].filter(Boolean).length;
  els.streakValue.textContent = doneToday;

  els.fixedHabitList.innerHTML = "";
  els.customHabitList.innerHTML = "";
  
  const fixed = state.habits.filter(h => h.kind === "fixed");
  const custom = state.habits.filter(h => h.kind !== "fixed");
  for (const h of fixed) {
    els.fixedHabitList.appendChild(buildHabitItem(h));
  }
  for (const h of custom) {
    els.customHabitList.appendChild(buildHabitItem(h));
  }

  // habits list
  els.customHabitList.innerHTML = "";
  const lvl = state.profile.level; // une fois, pas dans la boucle

  for (const h of state.habits) {
    
    const done = state.logsToday.get(h.id) === true;

    const streak = state.streaksByHabit.get(h.id);
    const cur = streak?.current_streak ?? 0;
    const best = streak?.best_streak ?? 0;

    const item = document.createElement("div");
    item.className = "habitItem";

    const left = document.createElement("div");
    left.className = "habitLeft";

    const right = document.createElement("div");
    right.className = "habitRight";

    const check = document.createElement("div");
    check.className = "check" + (done ? " on" : "");
    check.innerHTML = done ? "✓" : "";
    check.title = "Toggle";
    check.style.cursor = "pointer";
    check.addEventListener("click", () => toggleHabitToday(h));

    const text = document.createElement("div");
    text.className = "habitText";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = h.title;

    const meta = document.createElement("div");
    meta.className = "meta";

    if (h.kind === "fixed") {
      const target = scaledTarget(h, lvl);
      const reward = scaledXP(h, lvl);
      meta.textContent = `OBJECTIF ${target} ${h.metric ?? ""} • REWARD +${reward} XP`;
    } else {
      meta.textContent = `DIFFICULTY ${h.difficulty} • REWARD +${h.xp_reward} XP`;
    }

    text.appendChild(title);
    text.appendChild(meta);

    left.appendChild(check);
    left.appendChild(text);

    const badge1 = document.createElement("div");
    badge1.className = "badge " + (done ? "good" : "warn");
    badge1.textContent = done ? "COMPLETED" : "PENDING";

    const mult =
      cur >= 30 ? 1.35 :
      cur >= 14 ? 1.20 :
      cur >= 7  ? 1.10 :
      cur >= 3  ? 1.05 : 1.00;

    const badge2 = document.createElement("div");
    badge2.className = "badge";
    badge2.textContent = mult > 1
      ? `STREAK ${cur} • x${mult.toFixed(2)}`
      : `STREAK ${cur} • BEST ${best}`;

    if (done) item.classList.add("questCompleted");

    right.appendChild(badge1);
    right.appendChild(badge2);

    item.appendChild(left);
    item.appendChild(right);

    els.habitList.appendChild(item);
  }
}
*/
async function ensureAnonymousSession() {
  // Si session déjà présente -> ok
  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData?.session?.user) {
    state.user = sessionData.session.user;
    return;
  }

  // Sinon créer un user anonyme
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  state.user = data.user;

  toast("SYSTEM: Anonymous session created.");
}

async function loadProfile() {
  const uid = state.user.id;

  const { data, error } = await sb
    .from("dlo_profiles")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    // Create default profile
    const base = { user_id: uid, level: 1, xp: 0, rank: "E" };
    const { error: insErr } = await sb.from("dlo_profiles").insert(base);
    if (insErr) throw insErr;
    state.profile = { level: 1, xp: 0, rank: "E" };
  } else {
    state.profile = { level: data.level, xp: data.xp, rank: data.rank };
  }
}

async function loadHabits() {
  const { data, error } = await sb
    .from("dlo_habits")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.habits = data ?? [];
}

async function loadTodayLogs() {
  const day = todayISO();
  const { data, error } = await sb
    .from("dlo_habit_logs")
    .select("habit_id, completed")
    .eq("day", day);

  if (error) throw error;

  state.logsToday = new Map();
  for (const row of data ?? []) {
    state.logsToday.set(row.habit_id, row.completed);
  }
}

async function loadStreaks() {
  const { data, error } = await sb
    .from("dlo_habit_streaks")
    .select("habit_id,current_streak,best_streak,last_completed_day");

  if (error) throw error;

  state.streaksByHabit = new Map();
  for (const s of data ?? []) {
    state.streaksByHabit.set(s.habit_id, s);
  }
}


async function addHabit(title, difficulty) {
  const diff = Math.max(1, Math.min(5, Number(difficulty) || 1));
  const reward = 8 + diff * 6; // simple formule

  const { error } = await sb.from("dlo_habits").insert({
    user_id: state.user.id,
    title,
    difficulty: diff,
    xp_reward: reward,
    kind: "custom"
  });

  if (error) throw error;
  toast(`SYSTEM: New quest added (+${reward} XP reward).`);
}

async function applyXP(delta) {
  let { level, xp } = state.profile;
  xp += delta;

  while (xp >= xpNeeded(level)) {
    xp -= xpNeeded(level);
    level += 1;
    toast(`SYSTEM: LEVEL UP → ${level}`);
  }

  const rank = computeRank(level);

  state.profile = { level, xp, rank };

  const { error } = await sb
    .from("dlo_profiles")
    .update({ level, xp, rank, updated_at: new Date().toISOString() })
    .eq("user_id", state.user.id);

  if (error) throw error;
}

async function toggleHabitToday(habit) {
  const day = todayISO();
  const currently = state.logsToday.get(habit.id) === true;
  const previousLevel = state.profile.level;
  const next = !currently;
  const oldLevel = state.profile.level;

  const { data, error } = await sb.rpc("dlo_toggle_quest_v3", {
    p_habit_id: habit.id,
    p_day: day,
    p_completed: next
  });

  if (error) {
    console.error(error);
    toast("SYSTEM: RPC ERROR");
    return;
  }

  const row = data?.[0];

  if (!row) {
    toast("SYSTEM: No data returned");
    return;
  }

  // Met à jour états locaux
  state.logsToday.set(habit.id, next);

  // 🔹 Mise à jour profil
  state.profile.level = row.o_level;
  state.profile.xp    = row.o_xp;
  state.profile.rank  = row.o_rank;

  if (row.o_level > previousLevel) {
    showLevelUp(previousLevel, row.o_level);
  }

  // Met à jour streak cache
  state.streaksByHabit.set(habit.id, {
    habit_id: habit.id,
    current_streak: row.o_current_streak,
    best_streak: row.o_best_streak,
    last_completed_day: next ? day : null
  });

  // 🔹 XP bonus info
  const base = row.o_xp_base;
  const mult = Number(row.o_xp_mult);
  const gain = row.o_xp_gain;

  if (next) {
    if (gain > base) {
      toast(`SYSTEM: +${gain} XP (base ${base} • x${mult.toFixed(2)})`);
      playSfx("complete");
      vibrate(12);
    } else {
      toast(`SYSTEM: +${gain} XP`);
      playSfx("complete");
      vibrate(12);
    }
  } else {
    toast(`SYSTEM: Quest reverted`);
  }

  render();
}


function openModal() {
  els.modalOverlay.hidden = false;
  els.habitTitle.value = "";
  els.habitDifficulty.value = habitDifficulty.value;
  setTimeout(() => els.habitTitle.focus(), 0);
}
function closeModal() {
  els.modalOverlay.hidden = true;
  els.habitTitle.value = "";
  els.habitDifficulty.value = habitDifficulty.value;
}


async function refreshAll() {
  await loadProfile();
  await loadHabits();
  await loadTodayLogs();
  await loadStreaks();
  els.systemNote.textContent = "SYSTEM: Ready.";
  render();
}

function bindModalEvents() {
  els.btnNewSide.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  });

  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) {
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!els.modalOverlay.hidden && e.key === "Escape") {
      e.preventDefault();
      closeModal();
    }
  });
}

//---------------------ECRAN STATS----------------------//

function startOfWeek(d){ // Monday
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0..Sun=6
  x.setDate(x.getDate() - day);
  x.setHours(0,0,0,0);
  return x;
}
function isoDate(d){
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}
function daysBetween(a,b){
  const da = new Date(a); da.setHours(0,0,0,0);
  const db = new Date(b); db.setHours(0,0,0,0);
  return Math.round((db-da)/(24*3600*1000));
}


async function loadStatsData() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 83); // 12 semaines ~ 84 jours

  const { data, error } = await sb
    .from("dlo_habit_logs")
    .select("day, habit_id, completed, xp_gain")
    .gte("day", isoDate(from))
    .lte("day", isoDate(today));

  if (error) throw error;

  // On garde uniquement les complétés avec xp_gain
  return (data ?? []).filter(r => r.completed === true && typeof r.xp_gain === "number");
}


async function renderStats() {
  const logs = await loadStatsData();

  // --- XP par jour (heatmap)
  const xpByDay = new Map(); // "YYYY-MM-DD" -> xp
  for (const r of logs) {
    xpByDay.set(r.day, (xpByDay.get(r.day) ?? 0) + r.xp_gain);
  }

  // --- Heatmap (84 jours)
  els.heatmap.innerHTML = "";
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 83);

  let totalXp = 0;
  let maxDayXp = 0;

  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = isoDate(d);
    const v = xpByDay.get(key) ?? 0;

    totalXp += v;
    if (v > maxDayXp) maxDayXp = v;
  }

  for (let i = 0; i < 84; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = isoDate(d);
    const v = xpByDay.get(key) ?? 0;

    // Niveau 0..5 relatif au max
    let lvl = 0;
    if (maxDayXp > 0) {
      const ratio = v / maxDayXp;
      lvl = ratio === 0 ? 0 : ratio < 0.2 ? 1 : ratio < 0.4 ? 2 : ratio < 0.6 ? 3 : ratio < 0.85 ? 4 : 5;
    }

    const cell = document.createElement("div");
    cell.className = "cell";
    if (lvl > 0) cell.dataset.l = String(lvl);
    cell.title = `${key} • ${v} XP`;
    els.heatmap.appendChild(cell);
  }

  els.heatmapHint.textContent = `Total 12 weeks: ${totalXp} XP • Max/day: ${maxDayXp} XP`;

  // --- XP par semaine (bar chart)
  const weekMap = new Map(); // weekStartISO -> xp
  for (const [day, xp] of xpByDay.entries()) {
    const ws = startOfWeek(day);
    const wkey = isoDate(ws);
    weekMap.set(wkey, (weekMap.get(wkey) ?? 0) + xp);
  }

  // dernières 12 semaines triées
  const weeks = [...weekMap.entries()]
    .sort((a,b) => a[0].localeCompare(b[0]))
    .slice(-12);

  const maxWeek = Math.max(1, ...weeks.map(w => w[1]));

  els.weekXpBars.innerHTML = "";
  for (const [wkey, xp] of weeks) {
    const col = document.createElement("div");
    col.className = "barCol";

    const bar = document.createElement("div");
    bar.className = "bar";

    const fill = document.createElement("div");
    fill.className = "barFill";
    fill.style.height = `${Math.round((xp / maxWeek) * 100)}%`;
    bar.appendChild(fill);

    const label = document.createElement("div");
    label.className = "barLabel";
    label.textContent = wkey.slice(5); // MM-DD

    const value = document.createElement("div");
    value.className = "barValue";
    value.textContent = xp;

    col.appendChild(bar);
    col.appendChild(label);
    col.appendChild(value);

    els.weekXpBars.appendChild(col);
  }

  // --- Top quests (XP total sur 12 semaines)
  const xpByHabit = new Map(); // habit_id -> xp
  for (const r of logs) {
    xpByHabit.set(r.habit_id, (xpByHabit.get(r.habit_id) ?? 0) + r.xp_gain);
  }

  const titleById = new Map(state.habits.map(h => [h.id, h.title]));

  const top = [...xpByHabit.entries()]
    .sort((a,b) => b[1]-a[1])
    .slice(0, 8);

  els.topQuests.innerHTML = "";
  for (const [hid, xp] of top) {
    const row = document.createElement("div");
    row.className = "topQuestRow";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = titleById.get(hid) ?? hid;

    const val = document.createElement("div");
    val.className = "val";
    val.textContent = `${xp} XP`;

    row.appendChild(name);
    row.appendChild(val);
    els.topQuests.appendChild(row);
  }
}

async function setView(view) {
  const navButtons = document.querySelectorAll(".navBtn");
  navButtons.forEach(b => b.classList.toggle("active", b.dataset.view === view));

  const dashboard = document.querySelector(".dashboard");

  // Hide all secondary views by default
  els.statsView.hidden = true;
  if (els.settingsView) els.settingsView.hidden = true;

  if (view === "dashboard") {
    dashboard.style.display = "";
    return;
  }

  if (view === "stats") {
    dashboard.style.display = "none";
    els.statsView.hidden = false;
    try { await renderStats(); } catch (e) { console.error(e); }
    return;
  }

  if (view === "settings") {
    dashboard.style.display = "none";
    if (!els.settingsView) {
      console.error("settingsView not found (missing #settingsView)");
      return;
    }
    els.settingsView.hidden = false;
    try { await loadSettings(); } catch (e) { console.error(e); }
    bindDevActions();
    return;
  }
}



//--------------------------------------------------------//

function spawnParticles(count = 18) {
  const host = document.getElementById("levelUpParticles");
  if (!host) return;

  host.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";

    // départ près du centre
    const x0 = (Math.random() * 40 - 20).toFixed(1) + "px";
    const y0 = (Math.random() * 20 - 10).toFixed(1) + "px";

    // arrivée en éventail
    const x1 = (Math.random() * 360 - 180).toFixed(1) + "px";
    const y1 = (Math.random() * -220 - 60).toFixed(1) + "px";

    p.style.setProperty("--x0", x0);
    p.style.setProperty("--y0", y0);
    p.style.setProperty("--x1", x1);
    p.style.setProperty("--y1", y1);

    p.style.left = "50%";
    p.style.top = "52%";

    p.style.animationDelay = (Math.random() * 120).toFixed(0) + "ms";

    host.appendChild(p);
  }
}

function showLevelUp(oldLevel, newLevel) {
  const overlay = document.getElementById("levelUpOverlay");
  const text = document.getElementById("levelUpText");
  if (!overlay || !text) return;

  text.textContent = `LEVEL ${oldLevel} → LEVEL ${newLevel}`;

  overlay.hidden = false;
  overlay.classList.add("shake");

  spawnParticles(22);
  audioLevelUp.play();
  vibrate([20, 30, 20]); // (iOS ignore parfois)

  setTimeout(() => overlay.classList.remove("shake"), 450);
  setTimeout(() => { overlay.hidden = true; }, 3500);
}

function vibrate(pattern) {
  if (!window.__HAPTICS__) return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch(_){} }
}

//---------------------------------------------------------------//

let audioCtx;

function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = AC ? new AC() : null;
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function beep({ freq = 440, dur = 0.08, type = "sine", gain = 0.06, slideTo = null }) {
  if (!window.__SFX_ENABLED__) return;
  const vol = (typeof window.__SFX_VOLUME__ === "number") ? window.__SFX_VOLUME__ : 0.6;
  gain = gain * vol;

  
  const ctx = ensureAudio();
  if (!ctx) return;

  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(ctx.destination);

  osc.start(t0);
  osc.stop(t0 + dur);
}

function playSfx(kind) {
  if (kind === "complete") {
    // petit “tick” futuriste (double beep)
    beep({ freq: 740, dur: 0.06, type: "triangle", gain: 0.05 });
    setTimeout(() => beep({ freq: 980, dur: 0.06, type: "triangle", gain: 0.05 }), 55);
  } else if (kind === "levelup") {
    // montée + “impact”
    beep({ freq: 520, slideTo: 1040, dur: 0.18, type: "sawtooth", gain: 0.04 });
    setTimeout(() => beep({ freq: 220, dur: 0.10, type: "sine", gain: 0.05 }), 170);
  }
}
//---------------------------------------------------------------//

async function applyDailyPenaltiesIfNeeded() {
  try {
    // hier (YYYY-MM-DD)
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const yesterday = d.toISOString().slice(0, 10);

    const { data, error } = await sb.rpc("dlo_apply_daily_penalties", {
      p_day: yesterday
    });

    if (error) {
      console.error("dlo_apply_daily_penalties error:", error);
      return;
    }

    const row = data?.[0];
    if (row && row.xp_penalty > 0) {
      toast(`SYSTEM: Daily penalty -${row.xp_penalty} XP`);
    }
  } catch (err) {
    console.error("applyDailyPenaltiesIfNeeded failed:", err);
  }
}

//-----------------------------------------------------------------//

async function main() {
  try {
    
    els.systemNote.textContent = "SYSTEM: Connecting…";

    await ensureAnonymousSession();
    await sb.rpc("dlo_seed_fixed_habits");
    await refreshAll();
    await applyDailyPenaltiesIfNeeded();
    startDailyTimer();

    document.querySelectorAll(".navBtn").forEach(btn => {
      btn.addEventListener("click", () => setView(btn.dataset.view));
    });

  //-------------BEGIN Settings---------------//

    document.getElementById("btnSaveSettings").addEventListener("click", async (e) => {
      e.preventDefault();
      try { await saveSettingsFromUI(); } catch (err) { console.error(err); toast("SYSTEM: Save failed"); }
    });
    
    document.getElementById("btnExport").addEventListener("click", async () => {
      const dump = await exportAllData();
      downloadJson(dump, "dlo_export.json");
    });

  //-------------END Settings---------------//

    els.btnRefreshStats.addEventListener("click", () => {
      renderStats().catch(console.error);
    });

    els.btnSync.addEventListener("click", async () => {
      toast("SYSTEM: Sync refresh…");
      await refreshAll();
    });

    els.btnNewSide.addEventListener("click", openModal);

    els.btnCreate.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const title = (els.habitTitle.value || "").trim();
        if (!title) return toast("SYSTEM: Quest name required.");
        
        els.btnCreate.disabled = true;
        
        try {
            closeModal();
            await addHabit(title, els.habitDifficulty.value);
            await refreshAll();
            bindModalEvents();
        } catch (err) {
            console.error(err);
            toast("SYSTEM: Error (voir console).");
        } finally {
            els.btnCreate.disabled = false;
        }
    });

    els.modalOverlay.addEventListener("click", (e) => {
      if (e.target === els.modalOverlay) closeModal();
    });

  } catch (e) {
    console.error(e);
    els.systemNote.textContent = "SYSTEM: ERROR — check console.";
    toast("SYSTEM: Error (voir console).");
  }
}

main();

document.addEventListener("click", (e) => {
  const cancelBtn = e.target.closest("#btnCancel");
  if (cancelBtn) {
    e.preventDefault();
    e.stopPropagation();
    console.log("CANCEL CLICK DETECTED");
    const overlay = document.getElementById("modalOverlay");
    if (overlay) overlay.hidden = true;
  }
});




