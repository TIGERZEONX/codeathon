import { v4 as uuidv4 } from 'uuid';

export class BaseRepository {
  constructor(name, mongooseModel = null) {
    this.name = name;
    this.mongooseModel = mongooseModel;
    this.items = new Map(); // id -> item
  }

  async find(query = {}) {
    const list = Array.from(this.items.values());
    return list.filter((item) => {
      for (const [key, val] of Object.entries(query)) {
        if (Array.isArray(val)) {
          if (!val.includes(item[key])) return false;
        } else if (typeof val === 'object' && val !== null) {
          if (val.$in && !val.$in.includes(item[key])) return false;
          if (val.$ne && item[key] === val.$ne) return false;
          if (val.$regex && !new RegExp(val.$regex, val.$options || 'i').test(item[key])) return false;
        } else if (item[key] !== val) {
          return false;
        }
      }
      return true;
    });
  }

  async findOne(query = {}) {
    const matches = await this.find(query);
    return matches.length > 0 ? { ...matches[0] } : null;
  }

  async findById(id) {
    if (!id) return null;
    const item = this.items.get(String(id));
    return item ? { ...item } : null;
  }

  async create(data) {
    const id = data.id || data._id || uuidv4();
    const now = new Date().toISOString();
    const item = {
      ...data,
      id: String(id),
      _id: String(id),
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
    this.items.set(String(id), item);
    return { ...item };
  }

  async update(id, updates) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      id: String(id),
      _id: String(id),
      updatedAt: new Date().toISOString(),
    };
    this.items.set(String(id), updated);
    return { ...updated };
  }

  async delete(id) {
    if (!id) return false;
    return this.items.delete(String(id));
  }

  async count(query = {}) {
    const matches = await this.find(query);
    return matches.length;
  }

  async clear() {
    this.items.clear();
  }
}
