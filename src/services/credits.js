import fs from 'node:fs';
import path from 'node:path';

export class CreditManager {
  constructor({ storagePath, defaultCredits = 3, adminIds = [] }) {
    this.storagePath = storagePath;
    this.defaultCredits = defaultCredits;
    this.adminIds = new Set(adminIds.map(String));
    this.data = this.loadData();
  }

  loadData() {
    if (!fs.existsSync(this.storagePath)) {
      return {};
    }
    try {
      return JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
    } catch {
      return {};
    }
  }

  saveData() {
    const dir = path.dirname(this.storagePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storagePath, JSON.stringify(this.data, null, 2));
  }

  isAdmin(userId) {
    return this.adminIds.has(String(userId));
  }

  getCredits(userId) {
    const id = String(userId);
    if (this.isAdmin(id)) {
      return Infinity;
    }
    if (typeof this.data[id] === 'number') {
      return this.data[id];
    }
    // New user default credits
    this.data[id] = this.defaultCredits;
    this.saveData();
    return this.data[id];
  }

  consumeCredit(userId) {
    const id = String(userId);
    if (this.isAdmin(id)) {
      return { success: true, remaining: Infinity };
    }
    const current = this.getCredits(id);
    if (current <= 0) {
      return { success: false, remaining: 0 };
    }
    this.data[id] = current - 1;
    this.saveData();
    return { success: true, remaining: this.data[id] };
  }

  addCredits(targetUserId, amount) {
    const id = String(targetUserId);
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      throw new Error('Jumlah credit harus berupa angka positif.');
    }
    const current = typeof this.data[id] === 'number' ? this.data[id] : this.defaultCredits;
    this.data[id] = current + amt;
    this.saveData();
    return this.data[id];
  }

  setCredits(targetUserId, amount) {
    const id = String(targetUserId);
    const amt = Number(amount);
    if (isNaN(amt) || amt < 0) {
      throw new Error('Jumlah credit harus berupa angka >= 0.');
    }
    this.data[id] = amt;
    this.saveData();
    return this.data[id];
  }
}
