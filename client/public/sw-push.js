self.addEventListener("push", function (event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      if (data.type === "done") {
        for (var i = 0; i < clientList.length; i++) {
          if (clientList[i].focused || clientList[i].visibilityState === "visible") {
            return;
          }
        }
      }

      var title = data.title || "Lattice";
      var options = {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.type + "-" + (data.sessionId || "general"),
        data: {
          type: data.type,
          sessionId: data.sessionId,
          projectSlug: data.projectSlug,
        },
      };

      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.includes(self.location.origin)) {
          clientList[i].focus();
          return;
        }
      }
      return self.clients.openWindow("/");
    })
  );
});
