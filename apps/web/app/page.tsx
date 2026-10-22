import { Suspense } from "react";
import { Chat } from "@/components/chat/chat";
import { isDemoMode, isDryRun } from "@sponsor-engine/core";

export const dynamic = "force-dynamic";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <Chat testMode={isDemoMode() || isDryRun()} />
    </Suspense>
  );
}
