// ===== Main App =====

let residents = [];
let locations = [];
let events = [];
let currentTab = 'home';
let currentResident = null;

// ===== TAB SWITCHING =====
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab)?.classList.add('active');
  document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add('active');

  if (tab === 'home') renderHomeTab();
  if (tab === 'updates') renderUpdatesTab();
  if (tab === 'activity') renderActivityTab();
  if (tab === 'dms') renderDmsTab();
}

function handleTabTap(tab) {
  if (tab === 'windows' && currentResident) {
    closeRoom();
    return;
  }
  if (tab !== currentTab) {
    switchTab(tab);
  } else {
    const section = document.getElementById('tab-' + tab);
    if (section && section.scrollTop > 8) {
      section.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

// ===== GRID RENDERING =====
function renderGrid() {
  const grid = document.getElementById('windowGrid');
  if (!residents.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.3);font-size:14px">no residents yet</div>';
    return;
  }

  grid.innerHTML = residents.map((r, idx) => {
    const color = moodColor(r.mood);
    const gradient = moodGradient(r.mood);
    return `<div class="window-cell" onclick="openRoom(residents[${idx}])" style="background:${gradient};border:1px solid ${color}22;">
      <div class="resident-card">
        <div class="resident-emoji">${r.avatar || '🤖'}</div>
        <div class="resident-card-name">${esc(r.name)}</div>
        <div class="resident-location"><i class="ph ph-map-pin" style="font-size:10px"></i> ${esc(r.location || 'Unknown')}</div>
        <div class="resident-mood-row">
          <span class="mood-dot" style="background:${color}"></span>
          <span class="mood-label">${esc(r.mood || 'neutral')}</span>
        </div>
        <div class="energy-bar-wrap">
          <div class="energy-bar" style="width:${energyPercent(r.energy)}%;background:${color}"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('worldCount').textContent = residents.length + ' residents';
}

// ===== TICKER =====
function renderTicker(items) {
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  if (!items.length) {
    track.innerHTML = '<div class="ticker-item"><span class="t-action">waiting for activity…</span></div>';
    return;
  }
  const html = items.slice(0, 20).map(item => {
    return `<div class="ticker-item">
      <span class="t-time">${shortTime(item.created_at)}</span>
      <span class="t-emoji">${item.resident_avatar || '📋'}</span>
      <span class="t-name">${esc(item.resident_name || 'Someone')}</span>
      <span class="t-action">${esc(item.data?.message || item.description || item.event_type || '')}</span>
    </div>`;
  }).join('');
  track.innerHTML = html + html; // duplicate for seamless scroll
  track.style.animationDuration = (items.length * 3) + 's';
}

// ===== UPDATES TAB =====
function renderUpdatesTab() {
  const list = document.getElementById('updatesList');
  if (!events.length) {
    list.innerHTML = '<div style="padding:60px 20px;text-align:center;color:rgba(255,255,255,0.3)">No updates yet</div>';
    return;
  }

  list.innerHTML = events.map((item, i) => {
    const isLast = i === events.length - 1;
    const color = moodColor('neutral');
    const name = item.resident_name || 'Unknown';
    const initial = name.charAt(0).toUpperCase();
    const avatarHtml = item.resident_avatar
      ? `<div class="rui-avatar-placeholder" style="font-size:20px">${item.resident_avatar}</div>`
      : `<div class="rui-avatar-placeholder" style="background:${color}22;color:${color}">${initial}</div>`;

    const msgText = item.event_type === 'talk' && item.data?.dialogue
      ? item.data.dialogue
      : item.data?.message || item.description || item.event_type || '';

    return `<div class="room-update-item">
      <div class="rui-icon-col">
        ${avatarHtml}
        ${!isLast ? '<div class="rui-line"></div>' : ''}
      </div>
      <div class="rui-body">
        <div class="rui-top">
          <span class="rui-name">${esc(name)}</span>
          <span class="rui-time">· ${timeAgo(item.created_at)}</span>
          <span class="rui-type">${esc(item.event_type || '')}</span>
        </div>
        <div class="rui-text" style="white-space:pre-line">${esc(msgText)}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== HOME TAB =====
async function renderHomeTab() {
  const me = residents[0];
  if (!me) {
    document.getElementById('homeEmpty').style.display = '';
    document.getElementById('homeContent').style.display = 'none';
    return;
  }

  document.getElementById('homeEmpty').style.display = 'none';
  document.getElementById('homeContent').style.display = 'block';

  // Hero
  document.getElementById('homeEmoji').textContent = me.avatar || '🤖';
  document.getElementById('homeHeroName').textContent = me.name || '';
  document.getElementById('homeLocation').textContent = me.location || 'Unknown';
  document.getElementById('homeMood').textContent = me.mood || 'neutral';
  document.getElementById('homeMood').style.color = moodColor(me.mood);
  document.getElementById('homeEnergy').style.width = energyPercent(me.energy) + '%';
  document.getElementById('homeEnergy').style.background = moodColor(me.mood);
  document.getElementById('homeBio').textContent = me.personality || '';
  document.getElementById('homeBackstory').textContent = me.backstory || '';

  // Chat button
  document.getElementById('homeChatBtn').onclick = () => openDmChat(me);

  // Load recent events for this resident
  try {
    const allEvents = await API.getEvents(20);
    const myEvents = allEvents.filter(e => e.resident_name === me.name);
    const feedEl = document.getElementById('homeFeed');
    if (myEvents.length) {
      feedEl.innerHTML = myEvents.map(ev => `<div class="home-feed-item">
        <span class="home-feed-time">${timeAgo(ev.created_at)}</span>
        <span class="home-feed-text">${esc(ev.data?.message || ev.description || ev.event_type)}</span>
      </div>`).join('');
    } else {
      feedEl.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px">No activity yet</div>';
    }
  } catch (e) {
    console.error('Failed to load home feed:', e);
  }

  // Load memories
  try {
    const memories = await API.getMemories(me.id);
    const memEl = document.getElementById('homeMemories');
    if (memories.length) {
      memEl.innerHTML = memories.slice(0, 5).map(m =>
        `<div class="memory-item">• ${esc(m.content || m.description || '')}</div>`
      ).join('');
    } else {
      memEl.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:12px">No memories yet</div>';
    }
  } catch (e) {}
}

// ===== ACTIVITY TAB =====
function renderActivityTab() {
  const list = document.getElementById('activityList');
  if (!events.length) {
    list.innerHTML = `<div class="activity-empty">
      <div class="activity-empty-icon"><i class="ph ph-bell-simple"></i></div>
      <div class="activity-empty-text">No activity yet</div>
    </div>`;
    return;
  }

  list.innerHTML = events.slice(0, 30).map((ev, i) => {
    const name = ev.resident_name || 'Unknown';
    const avatar = ev.resident_avatar || '🤖';
    return `${i > 0 ? '<div class="activity-divider"></div>' : ''}
    <div class="activity-row">
      <div class="activity-avatar-wrap">
        <div class="activity-avatar-placeholder">${avatar}</div>
      </div>
      <div class="activity-body">
        <div class="activity-text"><strong>${esc(name)}</strong> ${esc(ev.data?.message || ev.description || ev.event_type || '')}</div>
        <div class="activity-time">${timeAgo(ev.created_at)}</div>
      </div>
    </div>`;
  }).join('');
}

// ===== DMs TAB =====
function renderDmsTab() {
  const el = document.getElementById('dmsList');
  if (!residents.length) {
    el.innerHTML = '<div class="dms-empty">No residents to chat with</div>';
    return;
  }

  el.innerHTML = residents.map((r, i) => {
    return `<div class="dm-row" onclick="openDmChat(residents[${i}])">
      <div class="dm-avatar"><div class="dm-avatar-emoji">${r.avatar || '🤖'}</div></div>
      <div class="dm-body">
        <div class="dm-top">
          <div class="dm-name">${esc(r.name)}</div>
          <div class="dm-time">${r.mood || ''}</div>
        </div>
        <div class="dm-preview">${esc(r.personality || 'Say hello!')}</div>
      </div>
    </div>${i < residents.length - 1 ? '<div class="dm-divider"></div>' : ''}`;
  }).join('');
}

// ===== ROOM VIEW =====
async function openRoom(resident) {
  currentResident = resident;
  const roomEl = document.getElementById('room');

  document.getElementById('roomEmoji').textContent = resident.avatar || '🤖';
  document.getElementById('roomName').textContent = resident.name;
  document.getElementById('roomBio').textContent = resident.personality || '';
  document.getElementById('roomLocation').textContent = resident.location || 'Unknown';
  document.getElementById('roomMood').textContent = resident.mood || 'neutral';
  document.getElementById('roomMood').style.color = moodColor(resident.mood);
  document.getElementById('roomEnergyBar').style.width = energyPercent(resident.energy) + '%';
  document.getElementById('roomEnergyBar').style.background = moodColor(resident.mood);
  document.getElementById('roomBackstory').textContent = resident.backstory || '';

  // Chat button
  document.getElementById('roomChatBtn').onclick = () => openDmChat(resident);

  roomEl.style.display = 'block';

  // Load room updates
  const updatesEl = document.getElementById('roomUpdatesList');
  updatesEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,0.3)">loading…</div>';

  try {
    const allEvents = await API.getEvents(30);
    const roomEvents = allEvents.filter(e => e.resident_name === resident.name);
    if (roomEvents.length) {
      updatesEl.innerHTML = roomEvents.map(ev => `<div class="room-update-item" style="padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.04)">
        <div class="rui-body">
          <div class="rui-top">
            <span class="rui-time">${timeAgo(ev.created_at)}</span>
            <span class="rui-type">${esc(ev.event_type || '')}</span>
          </div>
          <div class="rui-text">${esc((ev.data?.message || ev.description || ''))}</div>
        </div>
      </div>`).join('');
    } else {
      updatesEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,0.3)">no updates yet</div>';
    }
  } catch (e) {
    updatesEl.innerHTML = '<div style="padding:40px 20px;text-align:center;color:rgba(255,255,255,0.3)">failed to load</div>';
  }

  // Load memories
  const memEl = document.getElementById('roomMemories');
  try {
    const memories = await API.getMemories(resident.id);
    if (memories.length) {
      memEl.innerHTML = '<div style="padding:12px 20px;font-size:11px;color:rgba(255,255,255,0.35);letter-spacing:1px;text-transform:uppercase">Memories</div>' +
        memories.map(m => `<div style="padding:6px 20px;font-size:13px;color:rgba(255,255,255,0.7)">• ${esc(m.content || m.description || '')}</div>`).join('');
    } else {
      memEl.innerHTML = '';
    }
  } catch (e) {
    memEl.innerHTML = '';
  }
}

function closeRoom() {
  document.getElementById('room').style.display = 'none';
  currentResident = null;
}

// ===== INITIALIZATION =====
async function init() {
  try {
    const [res, locs, evts] = await Promise.all([
      API.getResidents(),
      API.getLocations().catch(() => []),
      API.getEvents(50).catch(() => []),
    ]);

    residents = res || [];
    locations = locs || [];
    events = evts || [];

    renderGrid();
    renderTicker(events);
    renderHomeTab();
    renderUpdatesTab();

    // Update status
    try {
      const status = await API.getVillageStatus();
      document.getElementById('worldCount').textContent =
        `${status.residents || residents.length} residents`;
    } catch (e) {}

  } catch (e) {
    console.error('Failed to initialize:', e);
    document.getElementById('windowGrid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.3);font-size:14px">Failed to connect to API</div>';
  }
}

// Reload data when phone wakes up / tab becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    init();
  }
});

// Auto-refresh every 30 seconds
setInterval(async () => {
  try {
    const [res, evts] = await Promise.all([
      API.getResidents(),
      API.getEvents(50),
    ]);
    residents = res || residents;
    events = evts || events;
    renderGrid();
    renderTicker(events);
    if (currentTab === 'updates') renderUpdatesTab();
    if (currentTab === 'activity') renderActivityTab();
  } catch (e) {}
}, 30000);

// Start
init();
