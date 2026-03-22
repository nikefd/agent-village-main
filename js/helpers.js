// ===== Helper Functions =====

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function shortTime(ts) {
  const d = new Date(ts);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

function emojiToIcon(e, size) {
  const map = {
    '⚡':'ph-lightning','📋':'ph-clipboard-text','📝':'ph-pencil-line',
    '🧠':'ph-brain','🏠':'ph-house','📌':'ph-push-pin','💬':'ph-chat',
    '🤖':'ph-robot','📖':'ph-book-open','🎨':'ph-paint-brush','🔧':'ph-wrench',
    '🎵':'ph-music-note','📊':'ph-chart-bar','💡':'ph-lightbulb','🚀':'ph-rocket',
    '🌟':'ph-star','⭐':'ph-star','✨':'ph-sparkle','🎉':'ph-confetti',
    '🔮':'ph-sparkle','💎':'ph-diamond','🔑':'ph-key','👤':'ph-user',
    '📷':'ph-camera','🌐':'ph-globe','🔥':'ph-fire','🛠':'ph-hammer',
    '🌱':'ph-plant','📢':'ph-megaphone','📰':'ph-newspaper','📈':'ph-trend-up',
    '🏆':'ph-trophy','🎯':'ph-target','💻':'ph-laptop','🔗':'ph-link',
    '📱':'ph-device-mobile','🎸':'ph-guitar','🎬':'ph-film-strip',
    '🔔':'ph-bell','💰':'ph-currency-dollar','🌙':'ph-moon','☀️':'ph-sun',
    '❤️':'ph-heart','👋':'ph-hand-waving','🏡':'ph-house-simple',
  };
  const cls = map[e];
  if (!cls) return e;
  const s = size ? ` style="font-size:${size}"` : '';
  return `<i class="ph ${cls}"${s}></i>`;
}

// Mood → color mapping
function moodColor(mood) {
  const colors = {
    happy: '#4ade80', content: '#34d399', curious: '#818cf8',
    excited: '#fbbf24', calm: '#67e8f9', tired: '#94a3b8',
    sad: '#64748b', angry: '#f87171', anxious: '#fb923c',
    neutral: '#a78bfa', focused: '#60a5fa', creative: '#c084fc',
  };
  return colors[(mood || '').toLowerCase()] || '#a78bfa';
}

// Mood → gradient
function moodGradient(mood) {
  const c = moodColor(mood);
  return `linear-gradient(135deg, ${c}22, ${c}08)`;
}

// Energy → bar width percentage
function energyPercent(energy) {
  return Math.max(0, Math.min(100, energy || 50));
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
  return el;
}
