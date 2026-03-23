"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
}

interface MentionItem {
  id: string;
  firstName: string;
  lastName: string;
  profilePhoto: string | null;
}

interface Props {
  items: MentionItem[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef<any, Props>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((prev) => (prev + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        if (items[selectedIndex]) {
          const item = items[selectedIndex];
          command({ id: item.id, label: `${item.firstName} ${item.lastName}` });
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-52 overflow-y-auto min-w-[200px]">
      {items.map((item, index) => (
        <button
          key={item.id}
          onClick={() => command({ id: item.id, label: `${item.firstName} ${item.lastName}` })}
          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
            index === selectedIndex ? "bg-[#7C3AED]/10 text-[#7C3AED]" : "hover:bg-gray-50 text-gray-800"
          }`}
        >
          {item.profilePhoto ? (
            <img src={item.profilePhoto} alt="" className="w-6 h-6 rounded-md object-cover flex-shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-md bg-[#7C3AED] flex items-center justify-center text-white text-[9px] font-semibold flex-shrink-0">
              {getInitials(item.firstName, item.lastName)}
            </div>
          )}
          <span>{item.firstName} {item.lastName}</span>
        </button>
      ))}
    </div>
  );
});

MentionList.displayName = "MentionList";
