self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Neuer Liebesbrief 💌";
  const options = {
    body: data.body || "Du hast eine neue Nachricht bekommen.",
    icon: "favicon.svg",
    badge: "favicon.svg",
    data: { url: data.url || "liebesbriefe.html" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || "liebesbriefe.html";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      const existing = clientList.find(client => client.url.includes(targetUrl));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
