import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import EmailList from "./EmailList";
import EmailDetail from "./EmailDetail";
import { useEffect } from "react";
import { selectedEmailUid } from "../stores/mailStore";

export default function MailSplitView({ folder = "inbox" }) {
  useEffect(() => {
    // Reset selected email when switching folders
    selectedEmailUid.set(null);
  }, [folder]);

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full w-full">
      <ResizablePanel defaultSize="30%" minSize="20%" maxSize="50%">
        <aside className="w-full h-full overflow-x-hidden bg-zinc-50">
          <EmailList folder={folder} />
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="75%">
        <section className="w-full h-full overflow-y-auto bg-white shadow-inner">
          <EmailDetail folder={folder} />
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
