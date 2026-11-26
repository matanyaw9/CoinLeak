// Settings > About CoinLeak (spec 42 A): the version, three buttons that open
// fixed GitHub pages in the browser (F27, F28), the licence and the credits.

import { useEffect, useRef } from "react";
import { Bug, Download, Star, type LucideIcon } from "lucide-react";
import type { AppLink } from "@shared/types";
import { s } from "@/strings";
import { call } from "@/lib/api";
import { showFailure } from "@/lib/failure";
import { useAppInfo } from "@/lib/hooks";
import { useShot } from "@/lib/shot";
import { Card, Label } from "@/components/common/card";
import { Button } from "@/components/ui/button";

const a = s.about;

const LINKS: { link: AppLink; icon: LucideIcon; text: string; hint?: string }[] = [
  { link: "releases", icon: Download, text: a.updates, hint: a.updatesHint },
  { link: "feedback", icon: Bug, text: a.feedback, hint: a.feedbackHint },
  { link: "star", icon: Star, text: a.star },
];

/** Main holds the addresses; the window only names which page to open. */
async function openLink(link: AppLink): Promise<void> {
  try {
    await call("app:openLink", { link });
  } catch (e) {
    showFailure(e, a.failed);
  }
}

export function AboutSection() {
  const info = useAppInfo();
  const ref = useRef<HTMLDivElement>(null);
  const shot = useShot();

  // Demo screenshot aid: `?shot=about` scrolls here, once the cards above have loaded.
  useEffect(() => {
    if (shot !== "about") return;
    const id = setTimeout(() => ref.current?.scrollIntoView({ block: "end" }), 800);
    return () => clearTimeout(id);
  }, [shot]);

  return (
    <div ref={ref}>
      <AboutCard version={info.data?.version ?? ""} />
    </div>
  );
}

/** No hooks, so its test can press the buttons without a browser. */
export function AboutCard({ version }: { version: string }) {
  return (
    <Card className="p-7">
      <Label>{a.title}</Label>
      <p className="mt-2 text-sm font-medium">{a.version(version)}</p>
      <div className="mt-5 space-y-4">
        {LINKS.map(({ link, icon: Icon, text, hint }) => (
          <div key={link}>
            <Button variant="outline" size="sm" onClick={() => void openLink(link)}>
              <Icon />
              {text}
            </Button>
            {hint && <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>}
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-border pt-4 text-sm leading-relaxed text-muted-foreground">
        <p>{a.license}</p>
        <p>{s.settings.aboutBody}</p>
      </div>
    </Card>
  );
}
