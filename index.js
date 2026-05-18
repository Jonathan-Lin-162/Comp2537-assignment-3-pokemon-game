const DIFFICULTIES = {
  easy: { pairs: 6, time: 30 },
  medium: { pairs: 12, time: 60 },
  hard: { pairs: 16, time: 120 },
};

// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════
let state = {
  gameActive: false,
  flipped: [], // cards currently face-up (not matched)
  matched: 0,
  clicks: 0,
  totalPairs: 0,
  timeLeft: 0,
  timerInterval: null,
  isLocked: false, // prevent flipping during animation
  powerupUsed: false,
  peekTimeout: null,
  peekInterval: null,
};

const grid = document.getElementById("card-grid");
const statsBar = document.getElementById("stats-bar");
const idleMsg = document.getElementById("idle-msg");
const loadingEl = document.getElementById("loading");
const overlay = document.getElementById("overlay");
const overlayBox = document.getElementById("overlay-box");
const overlayEmoji = document.getElementById("overlay-emoji");
const overlayTitle = document.getElementById("overlay-title");
const overlaySub = document.getElementById("overlay-sub");
const peekBar = document.getElementById("peek-bar");
const peekCount = document.getElementById("peek-count");
const chipTimer = document.getElementById("chip-timer");

const statTime = document.getElementById("stat-time");
const statClicks = document.getElementById("stat-clicks");
const statMatched = document.getElementById("stat-matched");
const statLeft = document.getElementById("stat-left");
const statTotal = document.getElementById("stat-total");

const btnStart = document.getElementById("btn-start");
const btnReset = document.getElementById("btn-reset");
const btnPowerup = document.getElementById("btn-powerup");
const btnTheme = document.getElementById("btn-theme");
const diffSelect = document.getElementById("difficulty");

let isDark = true;
btnTheme.addEventListener("click", () => {
  isDark = !isDark;
  document.body.setAttribute("data-theme", isDark ? "dark" : "light");
  btnTheme.textContent = isDark ? "Dark" : "Light";
});

let allPokemon = null;
async function fetchAllPokemon() {
  if (allPokemon) return allPokemon;
  const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=1500");
  const data = await res.json();
  allPokemon = data.results;
  return allPokemon;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchRandomPokemon(count) {
  const all = await fetchAllPokemon();
  const pool = shuffle(all).slice(0, count);

  const details = await Promise.all(
    pool.map((p) => {
      return fetch(p.url)
        .then((r) => r.json())
        .catch(() => null);
    }),
  );

  return details
    .filter((d) => d && d.sprites?.other?.["official-artwork"]?.front_default)
    .map((d) => ({
      id: d.id,
      name: d.name,
      img: d.sprites.other["official-artwork"].front_default,
    }));
}

async function startGame() {
  stopTimer();
  hideOverlay();
  resetState();

  const diff = DIFFICULTIES[diffSelect.value];
  state.totalPairs = diff.pairs;
  state.timeLeft = diff.time;

  idleMsg.style.display = "none";
  grid.innerHTML = "";
  loadingEl.classList.add("show");
  statsBar.style.display = "none";
  btnPowerup.disabled = true;
  state.powerupUsed = false;

  let pokemon;
  try {
    pokemon = await fetchRandomPokemon(diff.pairs + 5);
    pokemon = pokemon.slice(0, diff.pairs);
  } catch (e) {
    loadingEl.classList.remove("show");
    console.log(e);
    alert("Failed to fetch pokemon. Please check your connection.");
    idleMsg.style.display = "";
    return;
  }

  const cards = shuffle([...pokemon, ...pokemon]);

  loadingEl.classList.remove("show");
  statsBar.style.display = "flex";
  state.gameActive = true;
  btnPowerup.disabled = false;

  updateStats();
  renderCards(cards);
  startTimer();
}

function resetState() {
  state.gameActive = false;
  state.flipped = [];
  state.matched = 0;
  state.clicks = 0;
  state.totalPairs = 0;
  state.timeLeft = 0;
  state.isLocked = false;
  state.powerupUsed = false;
  clearPeek();
}

function resetGame() {
  stopTimer();
  hideOverlay();
  resetState();
  grid.innerHTML = "";
  statsBar.style.display = "none";
  btnPowerup.disabled = true;
  idleMsg.style.display = "";
}

function renderCards(cards) {
  grid.innerHTML = "";
  cards.forEach((poke, idx) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = poke.id;
    card.dataset.name = poke.name;
    card.innerHTML = `
        <img class="back_face" src="back.webp" alt="" />
        <img class="front_face" src="${poke.img}" alt="${poke.name}"/>
      `;
    card.addEventListener("click", () => onCardClick(card));
    grid.appendChild(card);
  });
}

function onCardClick(card) {
  if (!state.gameActive) return;
  if (state.isLocked) return;
  if (card.classList.contains("flipped")) return;
  if (card.classList.contains("matched")) return;

  state.clicks++;
  updateStats();

  card.classList.add("flipped");
  state.flipped.push(card);

  if (state.flipped.length == 2) {
    state.isLocked = true;
    checkMatch();
  }
}

function checkMatch() {
  const [a, b] = state.flipped;
  const match = a.dataset.id === b.dataset.id;

  if (match) {
    a.classList.add("matched");
    b.classList.add("matched");

    state.matched++;
    state.flipped = [];
    state.isLocked = false;
    updateStats();

    if (state.matched == state.totalPairs) {
      setTimeout(winGame, 400);
    }
  } else {
    setTimeout(() => {
      a.classList.remove("flipped");
      b.classList.remove("flipped");
      state.flipped = [];
      state.isLocked = false;
    }, 1000);
  }
}

function startTimer() {
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 10) chipTimer.classList.add("warning");
    if (state.timeLeft <= 0) loseGame();
  }, 1000);
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  chipTimer.classList.remove("warning");
}

function updateTimerDisplay() {
  const m = Math.floor(state.timeLeft / 60);
  const s = state.timeLeft % 60;
  statTime.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function winGame() {
  stopTimer();
  state.gameActive = false;
  lockAllCards();
  overlayBox.className = "overlay-box win";
  overlayEmoji.textContent = "🏆";
  overlayTitle.textContent = "YOU WIN!";
  overlaySub.textContent = `Matched all ${state.totalPairs} pairs in ${state.clicks} clicks!`;
  showOverlay();
}

function loseGame() {
  stopTimer();
  state.gameActive = false;
  lockAllCards();
  // Reveal all unmatched cards briefly
  document
    .querySelectorAll(".card:not(.matched)")
    .forEach((c) => c.classList.add("flipped"));
  overlayBox.className = "overlay-box";
  overlayEmoji.textContent = "💀";
  overlayTitle.textContent = "GAME OVER";
  overlaySub.textContent = `Time ran out! You matched ${state.matched} of ${state.totalPairs} pairs.`;
  showOverlay();
}

function lockAllCards() {
  document.querySelectorAll(".card").forEach((c) => c.classList.add("locked"));
  btnPowerup.disabled = true;
}

btnPowerup.addEventListener("click", () => {
  if (!state.gameActive || state.powerupUsed) return;
  state.powerupUsed = true;
  btnPowerup.disabled = true;
  usePeekPowerup();
});

function usePeekPowerup() {
  const unmatched = document.querySelectorAll(".card:not(.matched)");
  unmatched.forEach((c) => c.classList.add("peek"));
  state.isLocked = true;
  state.flipped = [];

  let seconds = 3;
  peekCount.textContent = seconds;
  peekBar.classList.add("show");

  state.peekInterval = setInterval(() => {
    seconds--;
    peekCount.textContent = seconds;
  }, 1000);

  state.peekTimeout = setTimeout(() => {
    clearPeek();
    unmatched.forEach((c) => {
      c.classList.remove("peek");
      c.classList.remove("flipped");
    });
    state.isLocked = false;
  }, 3000);
}

function clearPeek() {
  clearTimeout(state.peekTimeout);
  clearInterval(state.peekInterval);
  peekBar.classList.remove("show");
}

function updateStats() {
  statClicks.textContent = state.clicks;
  statMatched.textContent = state.matched;
  statLeft.textContent = state.totalPairs - state.matched;
  statTotal.textContent = state.totalPairs;
}

function showOverlay() {
  overlay.classList.add("show");
}

function hideOverlay() {
  overlay.classList.remove("show");
}

btnStart.addEventListener("click", startGame);
btnReset.addEventListener("click", resetGame);

document.getElementById("overlay-play-again").addEventListener("click", () => {
  hideOverlay();
  startGame();
});
document.getElementById("overlay-change").addEventListener("click", () => {
  hideOverlay();
  resetGame();
});
