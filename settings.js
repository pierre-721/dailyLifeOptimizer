function applySettingsRuntime() {
  const s = state.settings;
  if (!s) return;

  document.documentElement.dataset.theme = s.theme;
  document.documentElement.dataset.glow = s.glow;

  // sons
  window.__SFX_ENABLED__ = !!s.sfx;
  window.__SFX_VOLUME__ = Number(s.sfx_volume ?? 0.6);

  // animations
  document.documentElement.dataset.anim = s.animations ? "on" : "off";

  // haptics
  window.__HAPTICS__ = !!s.haptics;
}

function applySettingsToUI() {
  const s = state.settings;
  if (!s) return;

  document.getElementById("setHunterName").value = s.hunter_name;
  document.getElementById("setClass").value = s.hunter_class;
  document.getElementById("setMode").value = s.mode;

  document.getElementById("setXpMultEnabled").checked = s.xp_multiplier_enabled;
  document.getElementById("setT3").value = s.mult_t3;
  document.getElementById("setT7").value = s.mult_t7;
  document.getElementById("setT14").value = s.mult_t14;
  document.getElementById("setT30").value = s.mult_t30;

  document.getElementById("setXpBase").value = s.xp_base;
  document.getElementById("setXpPerLevel").value = s.xp_per_level;

  document.getElementById("setStreakMode").value = s.streak_mode;
  document.getElementById("setGraceDays").value = s.grace_days;

  document.getElementById("setTheme").value = s.theme;
  document.getElementById("setGlow").value = s.glow;

  document.getElementById("setAnimations").checked = s.animations;
  document.getElementById("setSfx").checked = s.sfx;
  document.getElementById("setSfxVolume").value = s.sfx_volume;
  document.getElementById("setHaptics").checked = s.haptics;

  document.getElementById("setDevMode").checked = !!state.settings.dev_mode;
  document.getElementById("devActions").hidden = !state.settings.dev_mode;


  document.getElementById("profileReadOnly").textContent =
    `RANK ${state.profile.rank} • LEVEL ${state.profile.level} • XP ${state.profile.xp}`;
}


async function saveSettingsFromUI() {
  const payload = {
    user_id: state.user.id,
    hunter_name: document.getElementById("setHunterName").value.trim() || "HUNTER",
    hunter_class: document.getElementById("setClass").value,
    mode: document.getElementById("setMode").value,

    xp_multiplier_enabled: document.getElementById("setXpMultEnabled").checked,
    mult_t3: Number(document.getElementById("setT3").value),
    mult_t7: Number(document.getElementById("setT7").value),
    mult_t14: Number(document.getElementById("setT14").value),
    mult_t30: Number(document.getElementById("setT30").value),

    xp_base: Number(document.getElementById("setXpBase").value),
    xp_per_level: Number(document.getElementById("setXpPerLevel").value),

    streak_mode: document.getElementById("setStreakMode").value,
    grace_days: Number(document.getElementById("setGraceDays").value),

    theme: document.getElementById("setTheme").value,
    glow: document.getElementById("setGlow").value,
    animations: document.getElementById("setAnimations").checked,
    sfx: document.getElementById("setSfx").checked,
    sfx_volume: Number(document.getElementById("setSfxVolume").value),
    haptics: document.getElementById("setHaptics").checked,

    dev_mode: document.getElementById("setDevMode").checked,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await sb
    .from("dlo_settings")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;

  state.settings = data;
  applySettingsRuntime();
  applySettingsToUI();
  toast("SYSTEM: Settings saved");
}


async function exportAllData() {
  const [p, h, l, s, set] = await Promise.all([
    sb.from("dlo_profiles").select("*").single(),
    sb.from("dlo_habits").select("*"),
    sb.from("dlo_habit_logs").select("*"),
    sb.from("dlo_habit_streaks").select("*"),
    sb.from("dlo_settings").select("*").single()
  ]);

  if (p.error) throw p.error;
  if (h.error) throw h.error;
  if (l.error) throw l.error;
  if (s.error) throw s.error;
  if (set.error) throw set.error;

  return {
    exported_at: new Date().toISOString(),
    profile: p.data,
    habits: h.data,
    logs: l.data,
    streaks: s.data,
    settings: set.data
  };
}

function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


function applySettingsRuntime() {
  const s = state.settings;
  if (!s) return;

  document.documentElement.dataset.theme = s.theme || "SHADOW_BLUE";
  document.documentElement.dataset.glow = s.glow || "MED";
  document.documentElement.dataset.anim = s.animations ? "on" : "off";

  window.__SFX_ENABLED__ = !!s.sfx;
  window.__SFX_VOLUME__ = Number(s.sfx_volume ?? 0.6);
  window.__HAPTICS__ = !!s.haptics;
}


function bindImmersionLivePreview() {
  const ids = ["setTheme", "setGlow", "setAnimations", "setSfx", "setSfxVolume", "setHaptics"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      // preview local sans DB
      state.settings = {
        ...state.settings,
        theme: document.getElementById("setTheme").value,
        glow: document.getElementById("setGlow").value,
        animations: document.getElementById("setAnimations").checked,
        sfx: document.getElementById("setSfx").checked,
        sfx_volume: Number(document.getElementById("setSfxVolume").value),
        haptics: document.getElementById("setHaptics").checked,
      };
      applySettingsRuntime();
    });
  });
}


function bindDevModeUI() {
  const devToggle = document.getElementById("setDevMode");
  const devActions = document.getElementById("devActions");
  if (!devToggle || !devActions) return;

  devToggle.addEventListener("change", () => {
    devActions.hidden = !devToggle.checked;
  });
}



async function loadSettings() {
  // crée si absent
  await sb.from("dlo_settings").upsert({ user_id: state.user.id }, { onConflict: "user_id" });

  const { data, error } = await sb
    .from("dlo_settings")
    .select("*")
    .single();

  if (error) throw error;

  state.settings = data;
  applySettingsToUI();
  applySettingsRuntime();
  bindImmersionLivePreview();
  bindDevModeUI();
  toast("SYSTEM: Settings saved");
}


function bindDevActions() {
  const b100 = document.getElementById("btnAdd100Xp");
  const b500 = document.getElementById("btnAdd500Xp");
  const bLvl = document.getElementById("btnForceLevelUp");
  const bSim = document.getElementById("btnSimulate7Days");
  const bReset = document.getElementById("btnResetToday");

  if (b100) b100.addEventListener("click", () => devAddXp(100).catch(console.error));
  if (b500) b500.addEventListener("click", () => devAddXp(500).catch(console.error));
  if (bLvl) bLvl.addEventListener("click", () => devForceLevelUp().catch(console.error));
  if (bSim) bSim.addEventListener("click", () => devSimulate7Days().catch(console.error));
  if (bReset) bReset.addEventListener("click", () => devResetTodayLocal());
}



async function devAddXp(amount) {
  // Mise à jour DB
  const current = state.profile?.xp ?? 0;

  const { data, error } = await sb
    .from("dlo_profiles")
    .update({ xp: current + amount, updated_at: new Date().toISOString() })
    .eq("user_id", state.user.id)
    .select()
    .single();

  if (error) throw error;

  // Mise à jour state + UI
  state.profile.level = data.level;
  state.profile.xp = data.xp;
  state.profile.rank = data.rank;

  toast(`SYSTEM: DEV +${amount} XP`);
  render();
}

async function devForceLevelUp() {
  // Stratégie simple: ajouter assez d'XP pour garantir au moins 1 level-up
  const level = state.profile?.level ?? 1;
  const xp = state.profile?.xp ?? 0;

  // formule actuelle: need = 100 + (level - 1) * 25
  const need = 100 + (level - 1) * 25;
  const add = Math.max(need - xp + 1, 1);

  await devAddXp(add);
  showLevelUp(level, level + 1);
}

function devResetTodayLocal() {
  // Reset seulement côté UI locale (utile pour tests)
  const day = todayISO();
  // option: vider logsToday (si vous utilisez Map habitId->bool)
  state.logsToday = new Map();
  toast(`SYSTEM: DEV reset local for ${day}`);
  render();
}

async function devSimulate7Days() {
  // Simule 7 jours en cochant 1ère habitude (si existe) via RPC
  const first = state.habits?.[0];
  if (!first) { toast("SYSTEM: No habit"); return; }

  const start = new Date();
  // on coche 7 jours en arrière -> aujourd’hui
  for (let i = 6; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);

    const { error } = await sb.rpc("dlo_toggle_quest_v2", {
      p_habit_id: first.id,
      p_day: day,
      p_completed: true
    });

    if (error) {
      console.error(error);
      toast("SYSTEM: DEV simulate failed");
      return;
    }
  }

  toast("SYSTEM: DEV simulated 7 days");
  //await syncAll();
  await loadHabits(); await loadProfile(); await loadStreaks(); // si vous avez une fonction de resync (habits/logs/streaks/profile)
  render();
}



