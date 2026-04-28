import React, { useState, useEffect } from "react";
import EmailListItem from "./EmailListItem";

const EmailList = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/emails")
      .then((response) => response.json())
      .then((data) => {
        setEmails(data.msgs);
        setLoading(false);
      });
  }, []);

  if (loading)
    return <div className="p-4 text-sm text-zinc-500">Loading emails...</div>;

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col">
      {emails.map((element) => {
        return <EmailListItem key={element.seq} element={element} />;
      })}
    </div>
  );
};

export default EmailList;
