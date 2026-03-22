// ===== API Layer =====
const API = {
  base: APP_CONFIG.API_BASE || '/village/api',

  async _fetch(path, opts = {}) {
    const url = this.base + path;
    const maxRetries = opts.method === 'POST' ? 1 : 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json', ...opts.headers },
          ...opts,
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        return res.json();
      } catch (e) {
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        throw e;
      }
    }
  },

  async getResidents() {
    return this._fetch('/residents');
  },

  async getResident(id) {
    return this._fetch(`/residents/${id}`);
  },

  async getLocations() {
    return this._fetch('/locations');
  },

  async getEvents(limit = 50) {
    return this._fetch(`/events?limit=${limit}`);
  },

  async getMemories(residentId) {
    return this._fetch(`/residents/${residentId}/memories`);
  },

  async getConversations() {
    return this._fetch('/conversations');
  },

  async getConversationMessages(conversationId) {
    return this._fetch(`/conversations/${conversationId}/messages`);
  },

  async sendMessage(residentId, message, visitorType = 'stranger') {
    return this._fetch(`/residents/${residentId}/message`, {
      method: 'POST',
      body: JSON.stringify({ message, visitor_name: 'Visitor', visitor_type: visitorType }),
    });
  },

  async chat(residentId, message, visitorType = 'stranger') {
    return this._fetch(`/residents/${residentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, visitor_type: visitorType }),
    });
  },

  async getFeed(limit = 50) {
    return this._fetch(`/feed?limit=${limit}`);
  },

  async getVillageStatus() {
    return this._fetch('/village/status');
  },
};
