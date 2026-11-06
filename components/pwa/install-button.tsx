"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallButton() {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  if (!promptEvent) return null;

  async function install() {
    const currentPrompt: InstallPromptEvent | null = promptEvent;
    if (!currentPrompt) return;
    setFailed(false);
    try {
      await currentPrompt.prompt();
      await currentPrompt.userChoice;
      setPromptEvent(null);
    } catch { setFailed(true); }
  }

  return <><button type="button" onClick={install} className="mt-4 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">{t("ui.installDirect")}</button>{failed && <p role="alert">{t("ui.installError")}</p>}</>;
}
