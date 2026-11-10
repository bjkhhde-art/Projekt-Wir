/* Mochi, part 6 of 6: live updates and start. */

/* ---------- realtime + init ---------- */

supabaseClient
  .channel("pet_state_changes")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "pet_state" }, payload => {
    const row = payload && payload.new;
    if (!row || !row.id) {
      loadPetState();
      return;
    }
    if (petState && (row.version || 0) < (petState.version || 0)) return;
    petState = row;
    render();
    if (!shopModal.classList.contains("hidden")) renderShop();
    if (!seedModal.classList.contains("hidden")) renderSeedList();
  })
  .subscribe();

supabaseClient
  .channel("mochi_messages_changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "mochi_messages" }, () => {
    loadInbox();
  })
  .subscribe();

supabaseClient
  .channel("battery_changes_for_mochi")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cuddle_batteries" }, () => {
    loadBatteryAvg();
  })
  .subscribe();

render();
loadPetState().then(() => loadInbox()).then(() => setTimeout(greet, 900));
loadBatteryAvg();
joinTogether();
scheduleChatter();
setInterval(render, 60000);
