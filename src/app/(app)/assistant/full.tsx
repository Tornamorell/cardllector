"use client";

import { HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { suggestionsFor } from "@/lib/assistant/page";
import { cn } from "@/lib/utils";
import { ChatView } from "./chat-view";
import { ThreadList } from "./thread-list";
import { useAssistant } from "./use-assistant";

/** /assistant: the conversations on the left, the open one on the right (D37). */
export function AssistantFull({ userId, initialThreadId }: { userId: string; initialThreadId: string | null }) {
  const a = useAssistant(userId, { active: true, initialThreadId });
  const [showList, setShowList] = useState(false);
  const { refreshThreads } = a;

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  return (
    <div className="grid gap-4 md:grid-cols-[15rem_minmax(0,1fr)]">
      <ThreadList
        className={cn("md:flex md:h-[calc(100dvh-10rem)]", showList ? "flex" : "hidden")}
        threads={a.threads}
        currentId={a.threadId}
        onOpen={(id) => {
          void a.open(id);
          setShowList(false);
        }}
        onNew={() => {
          void a.open(null);
          setShowList(false);
        }}
        onRemove={(id) => void a.remove(id)}
      />
      <div
        className={cn(
          "bg-card flex h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-14rem)] min-h-96 flex-col rounded-2xl border md:h-[calc(100dvh-10rem)]",
          showList && "hidden md:flex",
        )}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{a.title ?? "Nueva conversación"}</p>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={() => setShowList(true)}>
            <HistoryIcon />
            Conversaciones
          </Button>
        </div>
        <ChatView a={a} path={null} suggestions={suggestionsFor(null)} />
      </div>
    </div>
  );
}
