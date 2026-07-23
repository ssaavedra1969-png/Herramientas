(function() {
  if (window.__DEV_READ_ONLY !== true) return;

  console.warn('[DEV READ-ONLY] Firestore write operations are disabled');

  function noop(name) {
    return function() {
      console.warn('[DEV READ-ONLY] Blocked:', name, arguments);
      if (name === 'add' || name === 'set') {
        return Promise.resolve({ id: 'readonly-blocked-' + Date.now() });
      }
      if (name === 'update' || name === 'delete') {
        return Promise.resolve();
      }
      return Promise.resolve();
    };
  }

  function patchCollectionRef(CollectionRef) {
    if (CollectionRef.__readonlyPatched) return;
    CollectionRef.__readonlyPatched = true;

    const origDoc = CollectionRef.prototype.doc;
    CollectionRef.prototype.doc = function() {
      const docRef = origDoc.apply(this, arguments);
      patchDocumentRef(docRef.constructor);
      return docRef;
    };

    const origAdd = CollectionRef.prototype.add;
    CollectionRef.prototype.add = function() {
      console.warn('[DEV READ-ONLY] Blocked Firestore.add()');
      return Promise.resolve({ id: 'readonly-blocked-' + Date.now() });
    };

    const origWhere = CollectionRef.prototype.where;
    const origOrderBy = CollectionRef.prototype.orderBy;
    const origLimit = CollectionRef.prototype.limit;

    if (origWhere) {
      CollectionRef.prototype.where = function() {
        const ref = origWhere.apply(this, arguments);
        patchQuery(ref);
        return ref;
      };
    }
    if (origOrderBy) {
      CollectionRef.prototype.orderBy = function() {
        const ref = origOrderBy.apply(this, arguments);
        patchQuery(ref);
        return ref;
      };
    }
    if (origLimit) {
      CollectionRef.prototype.limit = function() {
        const ref = origLimit.apply(this, arguments);
        patchQuery(ref);
        return ref;
      };
    }
  }

  function patchDocumentRef(DocRef) {
    if (DocRef.__readonlyPatched) return;
    DocRef.__readonlyPatched = true;

    DocRef.prototype.set = function() {
      console.warn('[DEV READ-ONLY] Blocked Firestore.set()');
      return Promise.resolve();
    };
    DocRef.prototype.update = function() {
      console.warn('[DEV READ-ONLY] Blocked Firestore.update()');
      return Promise.resolve();
    };
    DocRef.prototype.delete = function() {
      console.warn('[DEV READ-ONLY] Blocked Firestore.delete()');
      return Promise.resolve();
    };
    DocRef.prototype.collection = function() {
      const ref = arguments[0];
      const colRef = DocRef.prototype.__proto__.collection
        ? DocRef.prototype.__proto__.collection.apply(this, arguments)
        : null;
      if (colRef && colRef.__proto__ && colRef.__proto__.add) {
        patchCollectionRef(colRef.constructor);
      }
      return colRef;
    };
  }

  function patchQuery(q) {
    if (q.__readonlyPatched) return;
    q.__readonlyPatched = true;

    if (q.get && typeof q.get === 'function') {
      const origGet = q.get.bind(q);
      q.get = origGet;
    }
    const origWhere = q.where;
    const origOrderBy = q.orderBy;
    const origLimit = q.limit;
    const origLimitToLast = q.limitToLast;

    if (origWhere) q.where = function() { const r = origWhere.apply(this, arguments); patchQuery(r); return r; };
    if (origOrderBy) q.orderBy = function() { const r = origOrderBy.apply(this, arguments); patchQuery(r); return r; };
    if (origLimit) q.limit = function() { const r = origLimit.apply(this, arguments); patchQuery(r); return r; };
    if (origLimitToLast) q.limitToLast = function() { const r = origLimitToLast.apply(this, arguments); patchQuery(r); return r; };
  }

  if (typeof firebase !== 'undefined' && firebase.firestore) {
    const _origCollection = firebase.firestore.Firestore.prototype.collection;
    firebase.firestore.Firestore.prototype.collection = function() {
      const colRef = _origCollection.apply(this, arguments);
      patchCollectionRef(colRef.constructor);
      return colRef;
    };

    firebase.firestore.Firestore.prototype.batch = function() {
      return {
        set: function() { console.warn('[DEV READ-ONLY] Blocked batch.set()'); },
        update: function() { console.warn('[DEV READ-ONLY] Blocked batch.update()'); },
        delete: function() { console.warn('[DEV READ-ONLY] Blocked batch.delete()'); },
        commit: function() { return Promise.resolve(); }
      };
    };

    firebase.firestore.Firestore.prototype.runTransaction = function(fn) {
      const fakeTransaction = {
        get: function(ref) {
          return ref.get();
        },
        set: function() { console.warn('[DEV READ-ONLY] Blocked transaction.set()'); return fakeTransaction; },
        update: function() { console.warn('[DEV READ-ONLY] Blocked transaction.update()'); return fakeTransaction; },
        delete: function() { console.warn('[DEV READ-ONLY] Blocked transaction.delete()'); return fakeTransaction; }
      };
      return fn(fakeTransaction);
    };
  }
})();
