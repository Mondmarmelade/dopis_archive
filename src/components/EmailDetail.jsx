import React, { useEffect, useState } from "react";
import { useStore } from "@nanostores/react";
import { selectedEmailSeq } from "../stores/mailStore";
import PostalMime from "postal-mime";
import DOMPurify from "dompurify";

const EmailDetail = ({ folder = "inbox" }) => {
  const seq = useStore(selectedEmailSeq);
  const [emailData, setEmailData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!seq) return;

    setLoading(true);
    setError(null);

    fetch(`/api/email?seq=${seq}&folder=${folder}`)
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
  }, [seq, folder]);

  if (!seq) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 bg-zinc-50/30">
        <div className="flex flex-col items-center justify-center text-center gap-2">
          <h3 className="text-lg font-medium text-zinc-600">No message selected</h3>
          <p className="text-sm text-zinc-400">Select an email from the list to read it</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="p-8 text-muted-foreground animate-pulse">Loading email...</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-destructive">
        Error loading email: {error}
      </div>
    );
  }

  if (!emailData) {
    return null;
  }

  // Use HTML if available, fallback to text
  const contentHtml = emailData.html
    ? DOMPurify.sanitize(emailData.html)
    : DOMPurify.sanitize(emailData.text).replace(/\n/g, "<br>");

  return (
    <div className="flex h-full flex-col overflow-y-auto p-8 text-foreground">
      <div className="mb-4 border-b border-border pb-4">
        <h1 className="mb-4 text-2xl font-bold">{emailData.subject}</h1>
        <div className="text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">From:</strong>{" "}
          {emailData.from?.name
            ? `${emailData.from.name} <${emailData.from.address}>`
            : emailData.from?.address}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          <strong className="font-semibold text-foreground">To:</strong>{" "}
          {emailData.to
            ?.map((t) => (t.name ? `${t.name} <${t.address}>` : t.address))
            .join(", ")}
        </div>
      </div>

      <div
        className="email-body prose prose-slate dark:prose-invert max-w-none flex-1"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </div>
  );
};

export default EmailDetail;
