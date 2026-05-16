const PEOPLE = ["Abdullah", "Zulaqarnain", "Huzefa", "Taqi", "Ali", "Mumtaz"];
const ADMIN_PIN = "7860";
const STORAGE_KEY = "cooler-duty-state-v1";
const CHANNEL_KEY = "cooler-duty-channel-v1";
const TIME_ZONE_LABEL = "Asia/Karachi";

const SCHEDULE = {
  0: { day: "Sunday", person: "Mumtaz" },
  1: { day: "Monday", person: null, off: true },
  2: { day: "Tuesday", person: "Abdullah" },
  3: { day: "Wednesday", person: "Zulaqarnain" },
  4: { day: "Thursday", person: "Huzefa" },
  5: { day: "Friday", person: "Taqi" },
  6: { day: "Saturday", person: "Ali" },
};

const dom = {
  personSelect: document.querySelector("#personSelect"),
  soundToggle: document.querySelector("#soundToggle"),
  installBtn: document.querySelector("#installBtn"),
  connectionStatus: document.querySelector("#connectionStatus"),
  dateLabel: document.querySelector("#dateLabel"),
  clockLabel: document.querySelector("#clockLabel"),
  turnStatus: document.querySelector("#turnStatus"),
  turnWindow: document.querySelector("#turnWindow"),
  timerRing: document.querySelector("#timerRing"),
  countdownLabel: document.querySelector("#countdownLabel"),
  turnDayLabel: document.querySelector("#turnDayLabel"),
  currentPerson: document.querySelector("#currentPerson"),
  turnNote: document.querySelector("#turnNote"),
  dayProgress: document.querySelector("#dayProgress"),
  myStatusDot: document.querySelector("#myStatusDot"),
  waterFill: document.querySelector("#waterFill"),
  waterPercent: document.querySelector("#waterPercent"),
  waterLevel: document.querySelector("#waterLevel"),
  statusSelect: document.querySelector("#statusSelect"),
  checkinNote: document.querySelector("#checkinNote"),
  markFilled: document.querySelector("#markFilled"),
  sendSos: document.querySelector("#sendSos"),
  swapTarget: document.querySelector("#swapTarget"),
  swapReason: document.querySelector("#swapReason"),
  requestSwap: document.querySelector("#requestSwap"),
  scheduleGrid: document.querySelector("#scheduleGrid"),
  messageList: document.querySelector("#messageList"),
  clearSeen: document.querySelector("#clearSeen"),
  adminState: document.querySelector("#adminState"),
  adminLock: document.querySelector("#adminLock"),
  adminControls: document.querySelector("#adminControls"),
  adminPin: document.querySelector("#adminPin"),
  unlockAdmin: document.querySelector("#unlockAdmin"),
  adminMessage: document.querySelector("#adminMessage"),
  templateRow: document.querySelector("#templateRow"),
  sendBroadcast: document.querySelector("#sendBroadcast"),
  sendAlarm: document.querySelector("#sendAlarm"),
  swapList: document.querySelector("#swapList"),
  statusGrid: document.querySelector("#statusGrid"),
  scoreGrid: document.querySelector("#scoreGrid"),
  alarmOverlay: document.querySelector("#alarmOverlay"),
  alarmTitle: document.querySelector("#alarmTitle"),
  alarmText: document.querySelector("#alarmText"),
  ackAlarm: document.querySelector("#ackAlarm"),
  toast: document.querySelector("#toast"),
};

const defaultState = {
  messages: [],
  checkins: {},
  statuses: Object.fromEntries(PEOPLE.map((person) => [person, "Ready"])),
  waterLevel: 72,
  swapRequests: [],
  activeAlarm: null,
  updatedAt: Date.now(),
};

let state = loadState();
let selectedPerson = localStorage.getItem("cooler-duty-person") || PEOPLE[0];
let adminUnlocked = sessionStorage.getItem("cooler-duty-admin") === "true";
let remoteWriter = null;
let usingRemote = false;
let applyingRemote = false;
let toastTimer = null;
let deferredInstallPrompt = null;
let audioContext = null;
let alarmLoop = null;

const channel = "BroadcastChannel" in window ? new BroadcastChannel(CHANNEL_KEY) : null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return normalizeState(saved);
  } catch (error) {
    return normalizeState(null);
  }
}

function normalizeState(input) {
  const next = { ...clone(defaultState), ...(input || {}) };
  next.messages = Array.isArray(next.messages) ? next.messages.slice(0, 40) : [];
  next.checkins = next.checkins && typeof next.checkins === "object" ? next.checkins : {};
  next.statuses = { ...defaultState.statuses, ...(next.statuses || {}) };
  next.swapRequests = Array.isArray(next.swapRequests) ? next.swapRequests.slice(0, 20) : [];
  next.waterLevel = Number.isFinite(Number(next.waterLevel)) ? Number(next.waterLevel) : 72;
  return next;
}

function persistState(source = "local") {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!applyingRemote && remoteWriter) {
    remoteWriter(state).catch(() => showToast("Live sync failed. Local copy is still saved."));
  }
  if (source !== "channel" && channel) {
    channel.postMessage({ type: "state", state });
  }
}

function commit(mutator) {
  const draft = clone(state);
  mutator(draft);
  draft.messages = (draft.messages || []).slice(0, 40);
  draft.swapRequests = (draft.swapRequests || []).slice(0, 20);
  draft.updatedAt = Date.now();
  state = normalizeState(draft);
  persistState();
  render();
}

function applyIncoming(nextState, source) {
  const normalized = normalizeState(nextState);
  if ((normalized.updatedAt || 0) < (state.updatedAt || 0)) return;
  state = normalized;
  applyingRemote = source === "remote";
  persistState(source);
  applyingRemote = false;
  render();
}

function getTurnInfo(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  const dayIndex = now.getDay();
  const today = SCHEDULE[dayIndex];
  const elapsed = Math.max(0, now.getTime() - start.getTime());
  const duration = end.getTime() - start.getTime();
  const remaining = Math.max(0, end.getTime() - now.getTime());
  const dateKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    ...today,
    dayIndex,
    dateKey,
    start,
    end,
    elapsed,
    duration,
    remaining,
    progress: Math.min(1, elapsed / duration),
  };
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatClock(date) {
  return date.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatDate(date) {
  return date.toLocaleDateString("en-PK", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value) {
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeMessage(kind, text, extra = {}) {
  return {
    id: uid(kind),
    kind,
    text: text.trim(),
    from: extra.from || "Admin",
    target: extra.target || "all",
    createdAt: Date.now(),
    seenBy: [],
    ...extra,
  };
}

function addMessage(draft, message) {
  draft.messages.unshift(message);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => dom.toast.classList.remove("is-visible"), 2600);
}

function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function render() {
  renderIdentity();
  renderTime();
  renderWater();
  renderSchedule();
  renderMessages();
  renderAdmin();
  renderStatus();
  renderScoreboard();
  renderAlarm();
  updateIcons();
}

function renderIdentity() {
  const personOptions = PEOPLE.map(
    (person) => `<option value="${person}" ${person === selectedPerson ? "selected" : ""}>${person}</option>`,
  ).join("");
  dom.personSelect.innerHTML = personOptions;
  dom.swapTarget.innerHTML = PEOPLE.filter((person) => person !== selectedPerson)
    .map((person) => `<option value="${person}">${person}</option>`)
    .join("");
  dom.statusSelect.value = state.statuses[selectedPerson] || "Ready";
  dom.myStatusDot.textContent = state.statuses[selectedPerson] || "Ready";
}

function renderTime() {
  const now = new Date();
  const turn = getTurnInfo(now);
  const completed = Boolean(state.checkins[turn.dateKey]);

  dom.dateLabel.textContent = `${formatDate(now)} - ${TIME_ZONE_LABEL}`;
  dom.clockLabel.textContent = formatClock(now);
  dom.turnDayLabel.textContent = turn.day;
  dom.countdownLabel.textContent = formatDuration(turn.remaining);
  dom.timerRing.style.setProperty("--degrees", `${Math.round(turn.progress * 360)}deg`);
  dom.dayProgress.style.width = `${Math.round(turn.progress * 100)}%`;
  dom.turnWindow.textContent = "12:00 AM to next 12:00 AM";

  if (turn.off) {
    dom.turnStatus.textContent = "Off Day";
    dom.currentPerson.textContent = "All Off";
    dom.turnNote.textContent = "No cooler duty today. Next turn starts after midnight.";
  } else {
    dom.turnStatus.textContent = completed ? "Filled" : "Active Turn";
    dom.currentPerson.textContent = turn.person;
    dom.turnNote.textContent = completed
      ? `${state.checkins[turn.dateKey].by} checked in at ${formatTime(state.checkins[turn.dateKey].time)}.`
      : `${turn.person} owns the cooler until midnight.`;
  }

  const canFill = !turn.off && (selectedPerson === turn.person || adminUnlocked);
  dom.markFilled.disabled = !canFill;
  dom.markFilled.querySelector("span").textContent = completed ? "Update Check-in" : "Mark Filled";
}

function renderWater() {
  const level = Math.max(0, Math.min(100, Number(state.waterLevel) || 0));
  dom.waterLevel.value = String(level);
  dom.waterFill.style.height = `${level}%`;
  dom.waterPercent.textContent = `${level}%`;
  dom.waterFill.style.background = level < 25 ? "#e85d5d" : level < 55 ? "#f59e0b" : "#35c6d4";
}

function renderSchedule() {
  const turn = getTurnInfo();
  const order = [1, 2, 3, 4, 5, 6, 0];
  dom.scheduleGrid.innerHTML = order
    .map((dayIndex) => {
      const item = SCHEDULE[dayIndex];
      const active = dayIndex === turn.dayIndex;
      const label = item.off ? "Shared rest day" : "12 AM duty";
      return `
        <div class="day-card ${active ? "is-active" : ""} ${item.off ? "is-off" : ""}">
          <span>${item.day}</span>
          <strong>${item.person || "All Off"}</strong>
          <span>${label}</span>
        </div>
      `;
    })
    .join("");
}

function renderMessages() {
  const visibleMessages = state.messages.filter((message) => {
    if ((message.seenBy || []).includes(selectedPerson)) return false;
    if (message.kind === "alarm") return message.target === selectedPerson || adminUnlocked;
    return message.target === "all" || message.target === selectedPerson || adminUnlocked;
  });

  if (!visibleMessages.length) {
    dom.messageList.innerHTML = '<div class="empty-state">No room updates yet.</div>';
    return;
  }

  dom.messageList.innerHTML = visibleMessages
    .map((message) => {
      const isAlert = message.kind === "sos" || message.kind === "alarm";
      return `
        <article class="message-item ${isAlert ? "is-alert" : ""}">
          <div class="message-meta">
            <span>${escapeHtml(message.from)} - ${escapeHtml(message.kind.toUpperCase())}</span>
            <span>${formatTime(message.createdAt)}</span>
          </div>
          <p>${escapeHtml(message.text)}</p>
        </article>
      `;
    })
    .join("");
}

function renderAdmin() {
  dom.adminState.textContent = adminUnlocked ? "Unlocked" : "Locked";
  dom.adminLock.classList.toggle("hidden", adminUnlocked);
  dom.adminControls.classList.toggle("hidden", !adminUnlocked);

  const pendingSwaps = state.swapRequests.filter((request) => request.status === "pending");
  if (!adminUnlocked) return;
  if (!pendingSwaps.length) {
    dom.swapList.innerHTML = '<div class="empty-state">No pending swaps.</div>';
    return;
  }

  dom.swapList.innerHTML = pendingSwaps
    .map(
      (request) => `
        <div class="swap-item">
          <strong>${escapeHtml(request.from)} -> ${escapeHtml(request.to)}</strong>
          <p>${escapeHtml(request.reason || "No reason added.")}</p>
          <button class="secondary-btn approve-swap" type="button" data-swap-id="${request.id}">
            <i data-lucide="check" aria-hidden="true"></i>
            <span>Approve</span>
          </button>
        </div>
      `,
    )
    .join("");
}

function renderStatus() {
  dom.statusGrid.innerHTML = PEOPLE.map((person) => {
    const status = state.statuses[person] || "Ready";
    return `
      <div class="status-card">
        <strong>${person}</strong>
        <span>${escapeHtml(status)}</span>
      </div>
    `;
  }).join("");
}

function renderScoreboard() {
  const counts = Object.values(state.checkins).reduce((acc, item) => {
    acc[item.person] = (acc[item.person] || 0) + 1;
    return acc;
  }, {});

  dom.scoreGrid.innerHTML = PEOPLE.map((person) => {
    const count = counts[person] || 0;
    return `
      <div class="score-card">
        <strong>${person}</strong>
        <span>${count} filled</span>
      </div>
    `;
  }).join("");
}

function renderAlarm() {
  const alarm = state.activeAlarm;
  const isExpired = alarm && alarm.expiresAt < Date.now();
  const acknowledged = alarm?.acknowledgedBy?.includes(selectedPerson);
  const shouldShow = alarm && !isExpired && alarm.target === selectedPerson && !acknowledged;

  dom.alarmOverlay.classList.toggle("hidden", !shouldShow);
  if (shouldShow) {
    dom.alarmTitle.textContent = `${selectedPerson}, cooler turn is calling`;
    dom.alarmText.textContent = alarm.text || "Please fill the cooler now.";
    startAlarmLoop();
  } else {
    stopAlarmLoop();
  }
}

function startAlarmLoop() {
  if (alarmLoop) return;
  playAlarmTone();
  alarmLoop = window.setInterval(playAlarmTone, 4200);
}

function stopAlarmLoop() {
  if (!alarmLoop) return;
  window.clearInterval(alarmLoop);
  alarmLoop = null;
}

function playAlarmTone() {
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(740, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(980, audioContext.currentTime + 0.16);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.16, audioContext.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.45);
}

function sendBroadcast() {
  const text = dom.adminMessage.value.trim();
  if (!text) {
    showToast("Write a reminder first.");
    return;
  }
  commit((draft) => {
    addMessage(draft, makeMessage("reminder", text));
  });
  dom.adminMessage.value = "";
  showToast("Reminder sent to everyone.");
}

function sendTurnAlarm() {
  const turn = getTurnInfo();
  if (turn.off || !turn.person) {
    showToast("Today is off day. No turn alarm sent.");
    return;
  }
  const text = dom.adminMessage.value.trim() || "Please fill the cooler now.";
  const alarm = {
    id: uid("alarm"),
    target: turn.person,
    text,
    createdAt: Date.now(),
    expiresAt: Date.now() + 15 * 60 * 1000,
    acknowledgedBy: [],
  };
  commit((draft) => {
    draft.activeAlarm = alarm;
    addMessage(
      draft,
      makeMessage("alarm", `Private alarm sent to ${turn.person}.`, {
        target: turn.person,
      }),
    );
  });
  showToast(`Alarm sent to ${turn.person}.`);
}

function markFilled() {
  const turn = getTurnInfo();
  if (turn.off || !turn.person) {
    showToast("Today is off day.");
    return;
  }
  const note = dom.checkinNote.value.trim();
  commit((draft) => {
    draft.checkins[turn.dateKey] = {
      person: turn.person,
      by: selectedPerson,
      time: Date.now(),
      note,
      waterLevel: draft.waterLevel,
    };
    addMessage(
      draft,
      makeMessage("check-in", `${selectedPerson} marked ${turn.person}'s cooler duty as filled.`, {
        from: selectedPerson,
      }),
    );
  });
  dom.checkinNote.value = "";
  showToast("Cooler check-in saved.");
}

function sendSos() {
  const turn = getTurnInfo();
  const targetText = turn.person ? `${turn.person}'s turn` : "off day";
  commit((draft) => {
    addMessage(
      draft,
      makeMessage("sos", `${selectedPerson} needs backup for ${targetText}. Cooler level is ${draft.waterLevel}%.`, {
        from: selectedPerson,
      }),
    );
  });
  showToast("SOS posted to the room board.");
}

function requestSwap() {
  const to = dom.swapTarget.value;
  const reason = dom.swapReason.value.trim();
  if (!to || to === selectedPerson) {
    showToast("Choose a different roommate.");
    return;
  }
  const request = {
    id: uid("swap"),
    from: selectedPerson,
    to,
    reason,
    status: "pending",
    createdAt: Date.now(),
  };
  commit((draft) => {
    draft.swapRequests.unshift(request);
    addMessage(
      draft,
      makeMessage("swap", `${selectedPerson} requested a duty swap with ${to}.`, {
        from: selectedPerson,
      }),
    );
  });
  dom.swapReason.value = "";
  showToast("Swap request posted.");
}

function approveSwap(id) {
  commit((draft) => {
    const request = draft.swapRequests.find((item) => item.id === id);
    if (!request) return;
    request.status = "approved";
    request.approvedAt = Date.now();
    addMessage(
      draft,
      makeMessage("swap", `Admin approved ${request.from}'s swap with ${request.to}.`, {
        from: "Admin",
      }),
    );
  });
  showToast("Swap approved.");
}

function clearSeen() {
  commit((draft) => {
    draft.messages = draft.messages.map((message) => {
      const seenBy = new Set(message.seenBy || []);
      seenBy.add(selectedPerson);
      return { ...message, seenBy: [...seenBy] };
    });
  });
  showToast("Updates marked as seen.");
}

async function enableSound() {
  try {
    audioContext = audioContext || new AudioContext();
    await audioContext.resume();
    dom.soundToggle.classList.add("ghost");
    showToast("Alarm sound enabled.");
  } catch (error) {
    showToast("Sound could not start in this browser.");
  }
}

function bindEvents() {
  dom.personSelect.addEventListener("change", (event) => {
    selectedPerson = event.target.value;
    localStorage.setItem("cooler-duty-person", selectedPerson);
    render();
  });

  dom.soundToggle.addEventListener("click", enableSound);

  dom.waterLevel.addEventListener("input", (event) => {
    const level = Number(event.target.value);
    state.waterLevel = level;
    renderWater();
  });

  dom.waterLevel.addEventListener("change", (event) => {
    commit((draft) => {
      draft.waterLevel = Number(event.target.value);
    });
  });

  dom.statusSelect.addEventListener("change", (event) => {
    commit((draft) => {
      draft.statuses[selectedPerson] = event.target.value;
    });
  });

  dom.markFilled.addEventListener("click", markFilled);
  dom.sendSos.addEventListener("click", sendSos);
  dom.requestSwap.addEventListener("click", requestSwap);
  dom.clearSeen.addEventListener("click", clearSeen);

  dom.unlockAdmin.addEventListener("click", () => {
    if (dom.adminPin.value.trim() !== ADMIN_PIN) {
      showToast("Wrong admin PIN.");
      return;
    }
    adminUnlocked = true;
    sessionStorage.setItem("cooler-duty-admin", "true");
    dom.adminPin.value = "";
    render();
    showToast("Admin unlocked.");
  });

  dom.templateRow.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-template]");
    if (!button) return;
    dom.adminMessage.value = button.dataset.template;
  });

  dom.sendBroadcast.addEventListener("click", sendBroadcast);
  dom.sendAlarm.addEventListener("click", sendTurnAlarm);

  dom.swapList.addEventListener("click", (event) => {
    const button = event.target.closest(".approve-swap");
    if (!button) return;
    approveSwap(button.dataset.swapId);
  });

  dom.ackAlarm.addEventListener("click", () => {
    commit((draft) => {
      if (!draft.activeAlarm) return;
      const seen = new Set(draft.activeAlarm.acknowledgedBy || []);
      seen.add(selectedPerson);
      draft.activeAlarm.acknowledgedBy = [...seen];
      addMessage(
        draft,
        makeMessage("alarm", `${selectedPerson} acknowledged the turn alarm.`, {
          from: selectedPerson,
          target: "all",
        }),
      );
    });
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    dom.installBtn.classList.remove("hidden");
  });

  dom.installBtn.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    dom.installBtn.classList.add("hidden");
  });

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      applyIncoming(JSON.parse(event.newValue), "storage");
    } catch (error) {
      // Ignore broken cross-tab payloads.
    }
  });

  if (channel) {
    channel.addEventListener("message", (event) => {
      if (event.data?.type === "state") {
        applyIncoming(event.data.state, "channel");
      }
    });
  }
}

async function initRemoteSync() {
  const config = window.firebaseConfig || {};
  if (!config.apiKey || !config.databaseURL) {
    dom.connectionStatus.textContent = "Local demo mode";
    return;
  }

  try {
    const appModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
    const dbModule = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");
    const app = appModule.initializeApp(config);
    const database = dbModule.getDatabase(app);
    const stateRef = dbModule.ref(database, "hostelCooler/main");
    remoteWriter = (value) => dbModule.set(stateRef, value);
    dbModule.onValue(stateRef, (snapshot) => {
      const value = snapshot.val();
      if (value) {
        usingRemote = true;
        dom.connectionStatus.textContent = "Firebase live sync";
        applyIncoming(value, "remote");
      } else {
        remoteWriter(state);
      }
    });
  } catch (error) {
    usingRemote = false;
    dom.connectionStatus.textContent = "Local demo mode";
    showToast("Firebase sync is not connected.");
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // The app still works without offline cache.
  });
}

function startClock() {
  window.setInterval(() => {
    renderTime();
    renderAlarm();
  }, 1000);
}

bindEvents();
render();
initRemoteSync();
registerServiceWorker();
startClock();
