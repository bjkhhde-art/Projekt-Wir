(function () {
  const API = "http://localhost:8991";

  function makeQueryBuilder(table) {
    const base = `${API}/t/${table}`;
    let pendingOp = null; // { type: "update"|"delete", payload }
    const filters = {};

    const builder = {
      select() { return builder; },
      neq() { return builder; },
      order() { return builder; },
      limit() { return builder; },

      eq(field, value) {
        filters[field] = value;
        return builder;
      },

      async maybeSingle() {
        const res = await fetch(`${base}/latest`);
        const data = await res.json();
        return { data, error: null };
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
            const query = filters.version !== undefined ? `?version=${filters.version}` : "";
            const res = await fetch(`${base}/games/${filters.id}${query}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(pendingOp.payload)
            });
            const data = await res.json();
            return { data, error: null };
          }
          if (pendingOp && pendingOp.type === "delete") {
            await fetch(`${base}/games/${filters.id}`, { method: "DELETE" });
            return { data: null, error: null };
          }
          return { data: [], error: null };
        };
        return run().then(resolve, reject);
      }
    };
    return builder;
  }

  window.supabase = {
    createClient() {
      return {
        from(table) { return makeQueryBuilder(table); },
        channel() {
          let table = null;
          let lastSeen = null;
          const chan = {
            on(_event, opts, callback) {
              table = opts.table;
              chan._callback = callback;
              return chan;
            },
            subscribe() {
              setInterval(async () => {
                try {
                  const res = await fetch(`${API}/t/${table}/latest`);
                  const serialized = JSON.stringify(await res.json());
                  if (serialized !== lastSeen) {
                    lastSeen = serialized;
                    if (chan._callback) chan._callback();
                  }
                } catch (e) { /* ignore */ }
              }, 300);
              return chan;
            }
          };
          return chan;
        },
        functions: {
          async invoke(name, options) {
            (window.__mockInvocations = window.__mockInvocations || []).push({ name, body: options && options.body });
            return { data: null, error: null };
          }
        }
      };
    }
  };
})();
