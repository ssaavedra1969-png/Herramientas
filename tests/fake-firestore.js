'use strict';
/*
 * Firestore falso en memoria.
 *
 * Permite testear ESCRITURAS (POST/PUT/DELETE) de las rutas reales sin tocar
 * la base de producción. Se inyecta reemplazando el módulo `config/firebase.js`
 * en `require.cache` (ver `helpers.js`), de modo que las rutas se ejercitan
 * tal cual están escritas.
 *
 * Solo implementa la API que el proyecto usa hoy:
 *   db.collection / db.collectionGroup / db.doc / db.batch / db.runTransaction
 *   .where (==, !=, >, <, >=, <=, array-contains) / .orderBy / .limit
 *   .get() .add() .set() .update() .delete() .count()
 *   admin.firestore.FieldValue (delete / serverTimestamp / increment)
 *   rutas anidadas "a.b.c" y d.ref.parent.parent
 *
 * NO emula índices compuestos ni cursores: si una ruta los empieza a usar,
 * hay que agregarlos acá (y el test va a fallar avisando).
 */

function clone(o) {
  if (o === null || typeof o !== 'object') return o;
  if (o instanceof Date) return o;      // las fechas se preservan
  if (o instanceof Timestamp) return o; // los Timestamps también
  if (Array.isArray(o)) return o.map(clone);
  const r = {};
  for (const k of Object.keys(o)) r[k] = clone(o[k]);
  return r;
}

// ── FieldValue ───────────────────────────────────────────────────────────
class Timestamp {
  constructor(d) { this._d = d || new Date(); }
  toDate() { return this._d; }
  toString() { return this._d.toISOString(); }
}

const SENTINEL = Symbol('fv');
class FieldValueSentinel {
  constructor(kind, arg) { this[SENTINEL] = true; this.kind = kind; this.arg = arg; }
}

const FieldValue = {
  delete: () => new FieldValueSentinel('delete'),
  serverTimestamp: () => new FieldValueSentinel('serverTimestamp'),
  increment: (n) => new FieldValueSentinel('increment', n)
};

// ── helpers de rutas anidadas "a.b.c" ────────────────────────────────────
function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, dotted, val) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}
function delPath(obj, dotted) {
  const parts = dotted.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) return;
    cur = cur[parts[i]];
  }
  delete cur[parts[parts.length - 1]];
}

function applyWrite(data, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue; // Firestore real tira error; el filtro lo hace explícito
    if (v && v[SENTINEL] === true) {
      if (v.kind === 'delete') { delPath(data, k); continue; }
      if (v.kind === 'serverTimestamp') { setPath(data, k, new Timestamp()); continue; }
      if (v.kind === 'increment') {
        setPath(data, k, Number(getPath(data, k) || 0) + Number(v.arg || 1));
        continue;
      }
    }
    if (k.includes('.')) setPath(data, k, clone(v));
    else data[k] = clone(v);
  }
  return data;
}

class Snapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(fn, thisArg) { this.docs.forEach(fn, thisArg); }
  map(fn, thisArg) { return this.docs.map(fn, thisArg); }
}

class FakeDB {
  constructor() { this.store = new Map(); } // col -> Map(id -> data)

  collection(name) {
    if (!this.store.has(name)) this.store.set(name, new Map());
    return new CollectionRef(this, name);
  }

  // collectionGroup('elementos') -> junta todas las subcolecciones que terminen en 'elementos'
  collectionGroup(name) {
    const cg = new CollectionRef(this, '__CG__:' + name);
    cg._isGroup = true;
    return cg;
  }

  _map(name) {
    if (!this.store.has(name)) this.store.set(name, new Map());
    return this.store.get(name);
  }

  _newId() { this._seq = (this._seq || 0) + 1; return 'auto-' + this._seq; }

  batch() { return new FakeBatch(this); }

  async runTransaction(fn) {
    const db = this;
    const writes = [];
    const tx = {
      get: (ref) => ref.get(),
      set(ref, data) {
        writes.push(() => {
          const m = db._map(ref._col);
          m.set(ref._id, applyWrite(m.has(ref._id) ? clone(m.get(ref._id)) : {}, data));
        });
      },
      update(ref, data) {
        writes.push(() => {
          const m = db._map(ref._col);
          if (m.has(ref._id)) applyWrite(m.get(ref._id), data);
        });
      },
      delete(ref) { writes.push(() => db._map(ref._col).delete(ref._id)); }
    };
    const out = await fn(tx);
    writes.forEach((w) => w());
    return out;
  }
}

class DocRef {
  constructor(db, col, id) { this._db = db; this._col = col; this._id = id; this.id = id; }

  /* En Firestore real docRef.parent es la COLECCIÓN que contiene al doc, y
     docRef.parent.parent es el doc padre: centros/c1/elementos/e1 -> 'c1'.
     Devolver acá directamente el doc padre dejaba un nivel de más y el id
     salía 'centros'. */
  get parent() {
    return new CollectionRef(this._db, this._col);
  }

  async get() {
    const d = this._db._map(this._col).get(this._id);
    return { id: this._id, exists: d !== undefined, data: () => (d === undefined ? undefined : clone(d)) };
  }

  async set(data, opts) {
    const m = this._db._map(this._col);
    if (opts && opts.merge) {
      m.set(this._id, applyWrite(m.has(this._id) ? clone(m.get(this._id)) : {}, data));
    } else {
      m.set(this._id, clone(data));
    }
  }

  async update(data) {
    const m = this._db._map(this._col);
    if (!m.has(this._id)) throw new Error('5 NOT_FOUND: no doc to update');
    applyWrite(m.get(this._id), data);
  }

  async delete() { this._db._map(this._col).delete(this._id); }

  // OJO: el subPath es obligatorio. docRef.collection('elementos') ->
  // 'centros/{id}/elementos'. Sin el argumento devuelve el path del doc mismo.
  collection(sub) {
    return new CollectionRef(this._db, this._col + '/' + this._id + (sub ? '/' + sub : ''));
  }
}

class CollectionRef {
  constructor(db, col) {
    this._db = db; this._col = col; this._where = []; this._order = []; this._limit = null;
  }

  doc(id) { return new DocRef(this._db, this._col, id); }

  // collectionRef.parent es el doc padre; null en una colección raíz.
  get parent() {
    const parts = this._col.split('/');
    if (parts.length < 2) return null;
    parts.pop();
    const id = parts.pop();
    return new DocRef(this._db, parts.join('/'), id);
  }

  where(f, op, v) {
    const n = new CollectionRef(this._db, this._col);
    n._where = this._where.concat([[f, op, v]]); n._order = this._order; n._limit = this._limit;
    return n;
  }

  orderBy(f, d) {
    const n = new CollectionRef(this._db, this._col);
    n._where = this._where; n._order = this._order.concat([[f, d || 'asc']]); n._limit = this._limit;
    return n;
  }

  limit(n) {
    const c = new CollectionRef(this._db, this._col);
    c._where = this._where; c._order = this._order; c._limit = n;
    return c;
  }

  _match(data) {
    return this._where.every(([f, op, v]) => {
      const cur = getPath(data, f);
      switch (op) {
        case '==': return cur === v;
        case '!=': return cur !== v;
        case '>': return cur > v;
        case '<': return cur < v;
        case '>=': return cur >= v;
        case '<=': return cur <= v;
        case 'array-contains': return Array.isArray(cur) && cur.includes(v);
        case 'in': return Array.isArray(v) && v.includes(cur);
        case 'not-in': return Array.isArray(v) && !v.includes(cur);
        case 'array-contains-any': return Array.isArray(cur) && cur.some((x) => v.includes(x));
        default: throw new Error('operador no soportado en el fake: ' + op);
      }
    });
  }

  _rows() {
    if (this._isGroup) {
      const target = this._col.slice('__CG__:'.length);
      const rows = [];
      for (const [col, m] of this._db.store) {
        if (col.split('/').pop() !== target) continue;
        for (const [id, d] of m.entries()) {
          if (this._match(d)) rows.push({ id, d, col });
        }
      }
      return rows;
    }
    let rows = [...this._db._map(this._col).entries()]
      .map(([id, d]) => ({ id, d, col: this._col }))
      .filter((r) => this._match(r.d));

    for (let i = this._order.length - 1; i >= 0; i--) {
      const [f, dir] = this._order[i];
      rows.sort((a, b) => {
        const av = getPath(a.d, f), bv = getPath(b.d, f);
        if (av === bv) return 0;
        if (av === undefined || av === null) return 1;
        if (bv === undefined || bv === null) return -1;
        return (av < bv ? -1 : 1) * (dir === 'desc' ? -1 : 1);
      });
    }
    if (this._limit != null) rows = rows.slice(0, this._limit);
    return rows;
  }

  async get() {
    return new Snapshot(this._rows().map((r) => ({
      id: r.id,
      exists: true,
      data: () => clone(r.d),
      ref: new DocRef(this._db, r.col, r.id)
    })));
  }

  async count() { const c = await this.get(); return { data: () => ({ count: c.size }) }; }

  async add(data) {
    const id = this._db._newId();
    await this.doc(id).set(data);
    return new DocRef(this._db, this._col, id);
  }
}

class FakeBatch {
  constructor(db) { this.db = db; this.ops = []; }
  set(ref, data, opts) { this.ops.push(() => ref.set(data, opts)); return this; }
  update(ref, data) { this.ops.push(() => ref.update(data)); return this; }
  delete(ref) { this.ops.push(() => ref.delete()); return this; }
  // un commit aplica SOLO los refs del lote
  async commit() { for (const op of this.ops) await op(); this.ops = []; }
}

function makeFake() {
  const db = new FakeDB();
  const admin = { firestore: { FieldValue, Timestamp } };
  const users = {
    testAdmin: { uid: 'u-admin', email: 'admin@local.dev', role: 'Admin' },
    testUser: { uid: 'u-user', email: 'user@local.dev', role: 'Usuario' }
  };
  const auth = {
    async verifyIdToken(token) {
      const k = String(token || '').replace(/^test-/, '');
      if (!users[k]) throw new Error('token invalido');
      return { uid: users[k].uid, email: users[k].email };
    },
    async verifySessionCookie() { throw new Error('sin sesion en tests'); }
  };

  return {
    db, admin, auth,
    clientConfig: { devReadOnly: false, env: 'test' },

    // siembra un doc: fake.seed('users', 'u-admin', { role: 'Admin' })
    seed(col, id, data) { this.db._map(col).set(id, clone(data)); },

    // lee una colección para asertar sobre lo que se escribió
    dump(col) { return [...this.db._map(col).entries()].map(([id, d]) => ({ id, ...clone(d) })); }
  };
}

module.exports = { makeFake, Timestamp, FieldValue };
