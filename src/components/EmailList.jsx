import React, { useState, useEffect } from "react";
import EmailListItem from "./EmailListItem";

const EmailList = ({ folder = "inbox" }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetch(`/api/emails?folder=${folder}&page=1`)
      .then((response) => response.json())
      .then((data) => {
        setEmails(data.msgs || []);
        setHasMore(data.hasMore);
        setLoading(false);
      });
  }, [folder]);

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    fetch(`/api/emails?folder=${folder}&page=${nextPage}`)
      .then((response) => response.json())
      .then((data) => {
        setEmails((prev) => [...prev, ...(data.msgs || [])]);
        setHasMore(data.hasMore);
        setPage(nextPage);
        setLoadingMore(false);
      });
  };

  if (loading)
    return <div className="p-4 text-sm text-zinc-500">Loading emails...</div>;

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden flex flex-col">
      {emails.map((element) => {
        return <EmailListItem key={element.seq} element={element} />;
      })}
      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="p-4 bg-zinc-100 hover:bg-zinc-200 text-sm w-full transition-colors text-zinc-700"
        >
          {loadingMore ? "Loading..." : "Load More"}
        </button>
      )}
    </div>
  );
};

export default EmailList;
