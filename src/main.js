import './style.css';
import * as THREE from 'three';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { hideLoader, showLoader, showToast } from './ui/hud.js';
import { Hud } from './ui/hud.js';
import {
  TEAMS,
  SPORTS,
  SCHOOL,
  CAMPUS_FACTS,
  POLL_CATEGORIES,
  squadFor,
  teamById,
  SQUADS,
} from './data/seroma.js';
import { FootballGame } from './games/football.js';
import { BasketballGame } from './games/basketball.js';
import { SwimmingGame } from './games/swimming.js';

const app = {
  stage: document.getElementById('stage'),
  ui: document.getElementById('ui'),
  hud: document.getElementById('hud'),
  game: null,
  hudUI: null,
  input: null,
  sport: 'football',
  mode: 'match',
  homeTeam: 'gaucho',
  awayTeam: 'theos',
  homePlayer: null,
  awayPlayer: null,
  history: [],
};

/* ------------------------------- navigation ------------------------------- */
function show(screenId) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  const el = document.getElementById(screenId);
  if (el) el.classList.add('active');
  app.ui.classList.remove('hidden');
}
function showHud() {
  app.ui.classList.add('hidden');
  app.hud.classList.remove('hidden');
}
function hideHud() {
  app.hud.classList.add('hidden');
}
function toast(msg) {
  showToast(msg);
}

/* --------------------------------- home ---------------------------------- */
function buildHome() {
  const cards = document.getElementById('sportCards');
  cards.innerHTML = '';
  SPORTS.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'sport-card';
    b.innerHTML = `
      <img src="./${s.photo}" alt="${s.photoAlt || s.name + ' at Seroma'}" loading="lazy" />
      <div class="sport-scrim"></div>
      <div class="sport-inner">
        <div class="icon">${s.icon}</div>
        <h3>${s.name}</h3>
        <p>${s.tagline}</p>
        <p style="opacity:.8;margin-top:4px">${s.blurb}</p>
        <div class="go">PLAY ${s.name.toUpperCase()} →</div>
      </div>`;
    b.onclick = () => openPlayers(s.id);
    cards.appendChild(b);
  });

  const facts = document.getElementById('campusFacts');
  facts.innerHTML = CAMPUS_FACTS.map(
    (f) => `<div class="fact"><b>${f.title}</b><span>${f.body}</span></div>`
  ).join('');

  const clubs = document.getElementById('clubList');
  clubs.innerHTML = TEAMS.map(
    (t) =>
      `<div class="club"><i style="background:${t.colors.primary}"></i>${t.name}<span style="opacity:.5;font-weight:500"> · ${(SQUADS[t.id] || []).length}</span></div>`
  ).join('');

  const awards = document.getElementById('awardsBoard');
  awards.innerHTML = POLL_CATEGORIES.map((cat) => {
    const max = Math.max(...cat.nominees.map((n) => n.votes));
    const sorted = cat.nominees.slice().sort((a, b) => b.votes - a.votes);
    const lead = sorted[0];
    const items = sorted
      .slice(0, 5)
      .map((n) => {
        const team = TEAMS.find((t) => t.name === n.team);
        const col = team ? team.colors.primary : '#f2c14e';
        return `<div class="nominee ${n === lead ? 'lead' : ''}">
          <span class="nm">${n.name}</span>
          <span class="tm">${n.team}</span>
          <div class="bar-track"><i style="width:${Math.round((n.votes / max) * 100)}%;background:${col}"></i></div>
        </div>`;
      })
      .join('');
    return `<div class="award"><h4>${cat.title}</h4>${items}</div>`;
  }).join('');

  document.getElementById('pollLink').href = SCHOOL.poll;
  document.getElementById('year').textContent = new Date().getFullYear();
}

/* ----------------------------- player picker ----------------------------- */
const ROLE_LABELS = ['Forward', 'Winger', 'Midfielder', 'Defender', 'Goalkeeper'];

function openPlayers(sport) {
  app.sport = sport;
  document.body.dataset.sport = sport;
  app.awayTeam = TEAMS.find((t) => t.id !== app.homeTeam)?.id || 'theos';
  const meta = SPORTS.find((s) => s.id === sport);
  document.getElementById('playersTitle').textContent = `Choose your ${sport === 'swimming' ? 'swimmer' : sport === 'basketball' ? 'baller' : 'player'}`;
  document.getElementById('playersSub').textContent = `${meta.name} · ${meta.venue} · Seroma League`;
  document.getElementById('startMatch').textContent =
    sport === 'swimming' ? 'DIVE IN' : sport === 'basketball' ? 'TIP OFF' : 'KICK OFF';
  const modeRow = document.getElementById('modeToggle');
  if (modeRow) modeRow.classList.toggle('hidden', sport === 'swimming');
  buildPlayerPicker();
  show('screen-players');
}

function buildModeToggle() {
  const modes = document.querySelectorAll('#modeToggle .mode-btn');
  const note = document.getElementById('modeNote');
  const notes = {
    match: 'Full match. Crowd in, clock running, opponents pressing.',
    practice: 'Practice: no clock, a keeper you can beat, great for learning the controls.',
  };
  modes.forEach((b) => {
    b.classList.toggle('on', b.dataset.mode === app.mode);
    b.onclick = () => {
      app.mode = b.dataset.mode;
      audio.click();
      buildModeToggle();
    };
  });
  if (note) note.textContent = notes[app.mode];
}

function buildPlayerPicker() {
  buildModeToggle();
  const picker = document.getElementById('teamPicker');
  picker.innerHTML = '';
  TEAMS.forEach((t) => {
    const chip = document.createElement('button');
    chip.className = 'chip' + (t.id === app.homeTeam ? ' on' : '');
    chip.innerHTML = `<i style="background:${t.colors.primary}"></i>${t.name}`;
    chip.onclick = () => {
      app.homeTeam = t.id;
      const others = TEAMS.filter((x) => x.id !== t.id);
      app.awayTeam = others[Math.floor(Math.random() * others.length)].id;
      app.homePlayer = null;
      app.awayPlayer = null;
      audio.click();
      buildPlayerPicker();
    };
    picker.appendChild(chip);
  });

  const grid = document.getElementById('squadGrid');
  grid.innerHTML = '';
  const squad = squadFor(app.homeTeam, 5);
  if (!app.homePlayer || !squad.includes(app.homePlayer)) app.homePlayer = squad[0];
  squad.forEach((name, i) => {
    const card = document.createElement('button');
    card.className = 'player-card' + (name === app.homePlayer ? ' on' : '');
    card.innerHTML = `
      ${name === app.homePlayer ? '<span class="badge">YOU</span>' : ''}
      <div class="pc-top">
        <span class="num">${i + 1}</span>
      </div>
      <div class="pname">${name}</div>
      <div class="role">${ROLE_LABELS[i % ROLE_LABELS.length]}</div>`;
    card.onclick = () => {
      app.homePlayer = name;
      audio.click();
      buildPlayerPicker();
    };
    grid.appendChild(card);
  });

  const away = teamById(app.awayTeam);
  const awaySquad = squadFor(away.id, 5);
  if (!app.awayPlayer || !awaySquad.includes(app.awayPlayer))
    app.awayPlayer = awaySquad[Math.floor(Math.random() * awaySquad.length)];

  const team = teamById(app.homeTeam);
  const sel = document.getElementById('selectionSummary');
  sel.innerHTML = `<span>${team.name} · ${team.coach}</span><b>${app.homePlayer}</b>vs ${away.name} · ${away.coach}`;
}

/* -------------------------------- gameplay -------------------------------- */
function startGame() {
  showLoader();
  hideHud();
  teardownGame();
  const sport = app.sport;
  const opts = {
    homeTeam: app.homeTeam,
    awayTeam: app.awayTeam,
    homePlayer: app.homePlayer,
    awayPlayer: app.awayPlayer,
    practice: app.mode === 'practice',
    onEvent: (e) => app.hudUI?.onEvent(e),
    onEnd: (r) => finishGame(r),
  };
  let game;
  try {
    if (sport === 'football') game = new FootballGame(app.stage, opts);
    else if (sport === 'basketball') game = new BasketballGame(app.stage, opts);
    else game = new SwimmingGame(app.stage, opts);
  } catch (err) {
    console.error(err);
    hideLoader();
    show('screen-players');
    toast('Could not start the 3D game on this device.');
    return;
  }
  app.game = game;
  const input = new Input(game.canvas);
  app.input = input;
  game.attachInput(input);

  Promise.resolve(game.init())
    .then(() => {
      hideLoader();
      showHud();
      app.hudUI = new Hud(app.hud, {
        sport,
        onAction: (a) => input.action(a),
        onKickDown: () => input.pressKick(),
        onKickUp: () => input.releaseKick(),
        onPause: () => pauseGame(),
        onStroke: () => input.action('kickDown'),
        getTouchStick: () => input.stickVis,
      });
      app.hudUI.reset();
      input.resetPresses();
      input.enabled = true;
      game.start();
      audio.unlock();
      document.body.dataset.sport = sport;
    })
    .catch((err) => {
      console.error(err);
      hideLoader();
      show('screen-players');
      toast('The pitch failed to load. Try again.');
    });
}

function teardownGame() {
  hideHud();
  if (app.hudUI) {
    app.hudUI.destroy();
    app.hudUI = null;
  }
  if (app.game) {
    try {
      app.game.destroy();
    } catch (e) {
      console.error(e);
    }
    app.game = null;
  }
  if (app.input) {
    app.input.destroy();
    app.input = null;
  }
  app.stage.innerHTML = '';
}

let hudLoop = null;
function startHudLoop() {
  cancelAnimationFrame(hudLoop);
  const tick = () => {
    if (app.game && app.hudUI) {
      try {
        app.hudUI.update(app.game.getHUD());
      } catch (e) {
        /* ignore transient teardown errors */
      }
    }
    hudLoop = requestAnimationFrame(tick);
  };
  hudLoop = requestAnimationFrame(tick);
}

function pauseGame() {
  if (!app.game || app.game.finished) return;
  app.game.setPaused(true);
  if (app.input) app.input.enabled = false;
  show('screen-pause');
}
function resumeGame() {
  if (!app.game) return;
  app.game.setPaused(false);
  if (app.input) {
    app.input.enabled = true;
    app.input.keys.clear();
    app.input.setMove(0, 0);
  }
  showHud();
}

function finishGame(result) {
  setTimeout(() => {
    hideHud();
    if (app.hudUI) app.hudUI.destroy();
    app.hudUI = null;
    renderResult(result);
    show('screen-result');
  }, 900);
}

function renderResult(r) {
  const sport = app.sport;
  const title = document.getElementById('resultTitle');
  const kicker = document.getElementById('resultKicker');
  const score = document.getElementById('resultScore');
  const stats = document.getElementById('resultStats');
  const home = teamById(app.homeTeam);
  const away = teamById(app.awayTeam);

  if (sport === 'football') {
    kicker.textContent = 'FULL TIME · SEROMA LEAGUE';
    title.textContent = r.result === 'win' ? 'Victory!' : r.result === 'draw' ? 'Honours even' : 'Defeat';
    score.textContent = `${r.home} – ${r.away}`;
    stats.innerHTML = [
      ['Goals', r.stats.goals],
      ['Shots', r.stats.shots],
      ['Passes', r.stats.passes],
      ['Tackles', r.stats.tackles],
      ['Distance', Math.round(r.stats.distance) + ' m'],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
  } else if (sport === 'basketball') {
    kicker.textContent = 'FINAL BUZZER · SEROMA COURT';
    title.textContent = r.result === 'win' ? 'Bucket!' : r.result === 'draw' ? 'Tied up' : 'Rim out';
    score.textContent = `${r.score} – ${r.oppScore}`;
    stats.innerHTML = [
      ['Your points', r.score],
      ['Best run', r.best],
      ['Opponent', r.oppScore],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
  } else {
    kicker.textContent = 'RACE COMPLETE · SEROMA AQUATICS';
    title.textContent = r.result === 'win' ? 'Gold for you!' : r.position === 2 ? 'Silver lane' : 'Touched out';
    score.textContent = `P${r.position} · ${r.time.toFixed(2)}s`;
    stats.innerHTML = [
      ['Position', 'P' + r.position],
      ['Perfect strokes', r.perfect],
      ['Strokes', r.strokes],
      ['Time', r.time.toFixed(2) + 's'],
    ]
      .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`)
      .join('');
  }
  app.lastResult = r;
}

/* --------------------------------- wiring -------------------------------- */
function bind() {
  document.getElementById('playNow').onclick = () => {
    audio.unlock();
    audio.click();
    openPlayers(app.sport || 'football');
  };
  document.getElementById('howBtn').onclick = () => {
    audio.click();
    show('screen-how');
  };
  document.querySelectorAll('[data-back]').forEach((b) => {
    b.onclick = () => {
      audio.click();
      show('screen-home');
    };
  });
  document.getElementById('startMatch').onclick = () => {
    audio.unlock();
    audio.click();
    startGame();
    startHudLoop();
  };
  document.getElementById('rematch').onclick = () => {
    audio.click();
    startGame();
    startHudLoop();
  };
  document.getElementById('toMenu').onclick = () => {
    audio.click();
    teardownGame();
    show('screen-home');
  };
  document.getElementById('resume').onclick = () => {
    audio.click();
    resumeGame();
  };
  document.getElementById('quitMatch').onclick = () => {
    audio.click();
    teardownGame();
    show('screen-home');
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && app.game && !app.game.finished) pauseGame();
  });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && app.game && !app.game.finished) {
      const paused = app.game.paused;
      if (paused) resumeGame();
      else pauseGame();
    }
  });
}

/* ---------------------------------- boot --------------------------------- */
function boot() {
  buildHome();
  bind();
  show('screen-home');
  // warm the menu image
  const img = new Image();
  img.src = './img/hero.jpg';
  if (!window.WebGLRenderingContext) {
    toast('This device does not support WebGL, so the 3D games cannot run.');
  }
  document.getElementById('loader').classList.add('hidden');
}

boot();
