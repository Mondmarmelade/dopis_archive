import React, { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { selectedEmailUid, emailsList } from "../stores/mailStore";
import PostalMime from "postal-mime";
import DOMPurify from "dompurify";
import { Trash2 } from "lucide-react";
import { Button } from "./ui/button";

const EmailDetail = ({ folder = "inbox" }) => {
  const uid = useStore(selectedEmailUid);
  const [emailData, setEmailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTrash = async () => {
    if (!uid) return;

    // Optimistically update the UI
    const currentEmails = emailsList.get();
    const currentIndex = currentEmails.findIndex((e) => e.uid === uid);
    
    let nextUid = null;
    if (currentIndex !== -1 && currentEmails.length > 1) {
      if (currentIndex < currentEmails.length - 1) {
        nextUid = currentEmails[currentIndex + 1].uid;
      } else {
        nextUid = currentEmails[currentIndex - 1].uid;
      }
    }
    
    const newEmails = currentEmails.filter((e) => e.uid !== uid);
    emailsList.set(newEmails);
    selectedEmailUid.set(nextUid);

    try {
      const response = await fetch(`/api/email?uid=${uid}&folder=${folder}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        console.error("Failed to move email to trash");
        // Revert on failure
        emailsList.set(currentEmails);
        selectedEmailUid.set(uid);
      }
    } catch (error) {
      console.error("Error moving to trash:", error);
      // Revert on failure
      emailsList.set(currentEmails);
      selectedEmailUid.set(uid);
    }
  };

  useEffect(() => {
    if (!uid) {
      setEmailData(null);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/email?uid=${uid}&folder=${folder}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to fetch email");
        return response.json();
      })
      .then(async (data) => {
        // Parse the raw MIME source
        const parser = new PostalMime();
        const parsedEmail = await parser.parse(data.content);
        setEmailData(parsedEmail);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error detailing email:", err);
        setError(err.message);
        setLoading(false);
      });
  }, [uid, folder]);

  if (!uid) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-zinc-50/30">
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <h3 className="text-lg font-medium text-zinc-600">
            No message selected
          </h3>
          <p className="text-sm text-zinc-400">
            Select an email from the list to read it
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-muted-foreground animate-pulse">
        Loading email...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-destructive">Error loading email: {error}</div>
    );
  }

  if (!emailData) {
    return null;
  }

  const rawHtml = typeof (emailData.html || emailData.text) === "string" 
    ? (emailData.html || emailData.text) 
    : String(emailData.html || emailData.text || "");

  const contentHtml = emailData.html
    ? DOMPurify.sanitize(rawHtml)
    : DOMPurify.sanitize(rawHtml).replace(/\n/g, "<br>");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8 text-foreground">
      <div className="mb-4 border-b border-border pb-4 relative">
        <div className="flex items-start justify-between">
          <h1 className="mb-4 text-2xl font-bold pr-4">{String(emailData.subject || "No Subject")}</h1>
          <div className="flex items-center gap-2">
            {folder !== "trash" && (
              <Button
                variant="outline"
                size="icon"
                onClick={handleTrash}
                disabled={loading}
                title="Move to Trash"
                className="shrink-0"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">From:</strong>{" "}
          {emailData.from?.name
            ? `${emailData.from.name} <${emailData.from.address || ''}>`
            : emailData.from?.address || String(emailData.from || 'Unknown')}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">To:</strong>{" "}
          {Array.isArray(emailData.to)
            ? emailData.to.map((t) => (t?.name ? `${t.name} <${t.address || ''}>` : t?.address)).join(", ")
            : emailData.to?.address || String(emailData.to || 'Unknown')}
        </div>
      </div>

      <div
        className="email-body flex-1 overflow-x-auto [&_table]:max-w-full"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </div>
  );
};

export default EmailDetail;
