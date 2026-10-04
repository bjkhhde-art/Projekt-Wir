(function () {
  const API = "http://localhost:8991";
  /* game tables keep their original, simpler semantics (maybeSingle = newest row) */
  const isGameTable = table => table.endsWith("_games");

  function matches(row, filters) {
    return filters.every(([op, field, value]) => {
      if (op === "eq") return row[field] === value;
      if (op === "neq") return row[field] !== value;
      if (op === "is") return value === null ? row[field] == null : row[field] === value;
      if (op === "in") return value.includes(row[field]);
      return true;
    });
  }

  function makeQueryBuilder(table) {
    const base = `${API}/t/${table}`;
    let pendingOp = null; // { type: "update"|"delete", payload }
    const filters = [];
    let ordering = null;
    let max = null;

    const idFilter = () => (filters.find(([op, field]) => op === "eq" && field === "id") || [])[2];
    const versionFilter = () => (filters.find(([op, field]) => op === "eq" && field === "version") || [])[2];

    async function selectRows() {
      const res = await fetch(`${base}/dump`);
      let rows = (await res.json()).filter(row => matches(row, filters));
      if (ordering) {
        const { field, ascending } = ordering;
        rows.sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * (ascending ? 1 : -1));
      }
      if (max !== null) rows = rows.slice(0, max);
      return rows;
    }

    const builder = {
      select() { return builder; },
      neq(field, value) { filters.push(["neq", field, value]); return builder; },
      is(field, value) { filters.push(["is", field, value]); return builder; },
      in(field, values) { filters.push(["in", field, values]); return builder; },
      order(field, options) { ordering = { field, ascending: !options || options.ascending !== false }; return builder; },
      limit(n) { max = n; return builder; },

      eq(field, value) {
        filters.push(["eq", field, value]);
        return builder;
      },

      async maybeSingle() {
        if (isGameTable(table)) {
          const res = await fetch(`${base}/latest`);
          return { data: await res.json(), error: null };
        }
        const rows = await selectRows();
        return { data: rows[0] || null, error: null };
      },

      async insert(payload) {
        const res = await fetch(`${base}/games`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        return { data, error: null };
      },

      update(payload) {
        pendingOp = { type: "update", payload };
        return builder;
      },

      delete() {
        pendingOp = { type: "delete" };
        return builder;
      },

      /* settings-style writes are only recorded so tests can inspect them */
      async upsert(payload) {
        (window.__mockUpserts = window.__mockUpserts || []).push({ table, payload });
        return { data: null, error: null };
      },

      then(resolve, reject) {
        const run = async () => {
          if (pendingOp && pendingOp.type === "update") {
            const version = versionFilter();
            const query = version !== undefined ? `?version=${version}` : "";
            const res = await fetch(`${base}/games/${encodeURIComponent(idFilter())}${query}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pendingOp.payload)
            });
            const data = await res.json();
            return { data, error: null };
          }
          if (pendingOp && pendingOp.type === "delete") {
            await fetch(`${base}/games/${encodeURIComponent(idFilter())}`, { method: "DELETE" });
            return { data: null, error: null };
          }
          if (isGameTable(table)) return { data: [], error: null };
          return { data: await selectRows(), error: null };
        };
        return run().then(resolve, reject);
      }
    };
    return builder;
  }

  /* realtime: postgres changes are emulated by polling the newest row; presence and broadcast
     go through the fake backend so two browser contexts can see each other */
  function makeChannel(name, options) {
    const presenceKey = options && options.config && options.config.presence && options.config.presence.key;
    const handlers = { postgres: [], presence: [], broadcast: {} };
    let presenceState = {};
    let lastBroadcastId = 0;
    let tracked = null;
    const timers = [];

    const chan = {
      on(type, opts, callback) {
        if (type === "postgres_changes") handlers.postgres.push({ table: opts.table, callback, lastSeen: null });
        if (type === "presence") handlers.presence.push(callback);
        if (type === "broadcast") (handlers.broadcast[opts.event] = handlers.broadcast[opts.event] || []).push(callback);
        return chan;
      },

      subscribe(statusCallback) {
        handlers.postgres.forEach(h => {
          timers.push(setInterval(async () => {
            try {
              const res = await fetch(`${API}/t/${h.table}/latest`);
              const row = await res.json();
              /* like real realtime, a change to any row counts – game tables only care about the newest game */
              const watched = h.table.endsWith("_games") ? row : await (await fetch(`${API}/t/${h.table}/dump`)).json();
              const serialized = JSON.stringify(watched);
              if (serialized !== h.lastSeen) {
                h.lastSeen = serialized;
                h.callback({ new: row, eventType: "UPDATE" });
              }
            } catch (e) { /* ignore */ }
          }, 300));
        });

        if (handlers.presence.length || Object.keys(handlers.broadcast).length) {
          timers.push(setInterval(async () => {
            try {
              if (tracked) {
                await fetch(`${API}/rt/presence/${name}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: presenceKey, meta: tracked })
                });
              }
              const res = await fetch(`${API}/rt/presence/${name}`);
              const next = await res.json();
              if (JSON.stringify(next) !== JSON.stringify(presenceState)) {
                presenceState = next;
                handlers.presence.forEach(cb => cb());
              }

              const bRes = await fetch(`${API}/rt/broadcast/${name}?after=${lastBroadcastId}`);
              const messages = await bRes.json();
              messages.forEach(msg => {
                lastBroadcastId = Math.max(lastBroadcastId, msg.id);
                if (msg.sender === presenceKey) return;
                (handlers.broadcast[msg.event] || []).forEach(cb => cb({ event: msg.event, payload: msg.payload }));
              });
            } catch (e) { /* ignore */ }
          }, 300));

          /* skip broadcasts that happened before this page subscribed */
          fetch(`${API}/rt/broadcast/${name}?after=0`).then(r => r.json()).then(all => {
            all.forEach(msg => { lastBroadcastId = Math.max(lastBroadcastId, msg.id); });
          }).catch(() => {});
        }

        if (statusCallback) setTimeout(() => statusCallback("SUBSCRIBED"), 50);
        return chan;
      },

      async track(meta) {
        tracked = meta;
        return "ok";
      },

      presenceState() {
        return presenceState;
      },

      async send(message) {
        await fetch(`${API}/rt/broadcast/${name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: message.event, payload: message.payload, sender: presenceKey })
        });
        return "ok";
      },

      unsubscribe() {
        timers.forEach(clearInterval);
      }
    };
    return chan;
  }

  window.supabase = {
    createClient() {
      return {
        from(table) { return makeQueryBuilder(table); },
        channel(name, options) { return makeChannel(name, options); },
        removeChannel(chan) { if (chan && chan.unsubscribe) chan.unsubscribe(); },
        /* uploads are only recorded; the public URL points at a picture the test site serves */
        storage: {
          from(bucket) {
            return {
              async upload(name, file, options) {
                (window.__mockUploads = window.__mockUploads || []).push({ bucket, name, size: file.size, type: file.type, options });
                return { data: { path: name }, error: null };
              },
              getPublicUrl(name) {
                return { data: { publicUrl: "/icons/icon-512.png?upload=" + encodeURIComponent(name) } };
              }
            };
          }
        },
        functions: {
          async invoke(name, options) {
            (window.__mockInvocations = window.__mockInvocations || []).push({ name, body: options && options.body });
            /* a test can answer a function: window.__mockFunctionResponses[name] = body => data */
            const answer = window.__mockFunctionResponses && window.__mockFunctionResponses[name];
            if (answer) return { data: await answer(options && options.body), error: null };
            return { data: null, error: null };
          }
        }
      };
    }
  };
})();
