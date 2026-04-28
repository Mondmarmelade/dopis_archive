import React from "react";
import { useStore } from "@nanostores/react";
import { selectedEmailSeq } from "../stores/mailStore";

const EmailListItem = ({ element }) => {
  const selectedSeq = useStore(selectedEmailSeq);
  const isSelected = selectedSeq === element.seq;

  const from = element.envelope.from[0];
  const senderName = from.name !== "" ? from.name : from.address;
  const domain = from.address.split("@")[1];

  return (
    <div
      onClick={() => selectedEmailSeq.set(element.seq)}
      className={`shrink-0 flex items-center gap-3 px-4 py-3 border-b border-zinc-100 cursor-pointer overflow-hidden transition-colors ${
        isSelected ? "bg-zinc-100" : "hover:bg-zinc-50 bg-white"
      }`}
    >
      <img
        className="w-8 h-8 rounded-full object-cover shrink-0"
        src={`https://img.logo.dev/${domain}?token=pk_c9vsTZFXTmm9jB_Ace1d2w`}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
        alt=""
      />
      <div className="flex flex-col overflow-hidden min-w-0">
        <span className="text-sm font-medium text-zinc-900 truncate">
          {senderName}
        </span>
        <span className="text-xs text-zinc-500 truncate">
          {element.envelope.subject}
        </span>
      </div>
    </div>
  );
};

export default EmailListItem;
