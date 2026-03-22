// ===== DM Chat =====

let currentDmResident = null;
let dmMessages = [];
let dmMode = 'stranger'; // 'stranger' or 'owner'

function openDmChat(resident) {
  currentDmResident = resident;
  dmMessages = [];
  dmMode = 'stranger';
  updateModeButtons();

  const chatEl = document.getElementById('dmChat');
  const nameEl = document.getElementById('dmChatName');
  const avatarEl = document.getElementById('dmChatAvatar');
  const msgsEl = document.getElementById('dmMessages');

  nameEl.textContent = resident.name || '';
  avatarEl.textContent = resident.avatar || '🤖';
  document.getElementById('dmChatStatus').textContent = resident.mood || 'online';

  msgsEl.innerHTML = `<div style="text-align:center;opacity:0.4;padding:24px;font-size:13px">
    Say hi to ${esc(resident.name)}!
  </div>`;

  chatEl.classList.add('active');
}

function closeDmChat() {
  document.getElementById('dmChat').classList.remove('active');
  currentDmResident = null;
}

function setDmMode(mode) {
  dmMode = mode;
  dmMessages = [];
  updateModeButtons();
  // Clear chat and show fresh greeting
  const msgsEl = document.getElementById('dmMessages');
  const label = mode === 'owner' ? '🔑 Owner mode' : '🌍 Stranger mode';
  msgsEl.innerHTML = `<div style="text-align:center;opacity:0.4;padding:24px;font-size:13px">
    ${label} — ${esc(currentDmResident?.name || 'Agent')}
  </div>`;
}

function updateModeButtons() {
  const strangerBtn = document.getElementById('dmModeStranger');
  const ownerBtn = document.getElementById('dmModeOwner');
  if (strangerBtn) strangerBtn.classList.toggle('active', dmMode === 'stranger');
  if (ownerBtn) ownerBtn.classList.toggle('active', dmMode === 'owner');
}

function appendMessage(role, text) {
  const msgsEl = document.getElementById('dmMessages');
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const side = role === 'me' ? 'from-me' : 'from-them';
  msgsEl.innerHTML += `<div class="msg ${side}">
    <div class="msg-bubble">${esc(text)}</div>
    <div class="msg-time">${time}</div>
  </div>`;
  scrollToBottom(msgsEl);
}

async function sendDm() {
  const input = document.getElementById('dmInput');
  const text = input.value.trim();
  if (!text || !currentDmResident) return;

  input.value = '';
  appendMessage('me', text);

  // Show typing indicator
  const typingEl = document.getElementById('typingIndicator');
  if (typingEl) typingEl.classList.add('visible');

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const data = await API.chat(currentDmResident.id, text, dmMode);
      if (typingEl) typingEl.classList.remove('visible');
      appendMessage('them', data.reply || '...');
      return;
    } catch (e) {
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      if (typingEl) typingEl.classList.remove('visible');
      appendMessage('them', '⚠️ Connection lost, please try again');
    }
  }
}

// Wire up enter key
document.getElementById('dmInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); sendDm(); }
});
