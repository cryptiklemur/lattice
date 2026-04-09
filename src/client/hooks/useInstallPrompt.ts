import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(function () {
    return localStorage.getItem("lattice-install-dismissed") === "1";
  });

  useEffect(function () {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return function () {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  function install() {
    if (!promptEvent) return;
    promptEvent.prompt();
    promptEvent.userChoice.then(function (choice) {
      if (choice.outcome === "dismissed") {
        setDismissed(true);
        localStorage.setItem("lattice-install-dismissed", "1");
      }
      setPromptEvent(null);
    });
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("lattice-install-dismissed", "1");
    setPromptEvent(null);
  }

  const canInstall = !!promptEvent && !isInstalled && !dismissed;

  return { canInstall: canInstall, install: install, dismiss: dismiss };
}
