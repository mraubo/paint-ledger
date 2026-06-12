import { MoreVertical } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

interface EntryListActionsMenuProps {
  entryId: string;
}

export default function EntryListActionsMenu({ entryId }: EntryListActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label="Entry actions"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-white/20 text-blue-100/80 transition-colors hover:bg-white/10"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-10 mt-1 min-w-32 rounded-lg border border-white/10 bg-slate-900/95 py-1 shadow-lg backdrop-blur-xl"
        >
          <a
            role="menuitem"
            href={`/entries/${entryId}/edit`}
            className="block px-3 py-2 text-sm text-blue-100/90 transition-colors hover:bg-white/10"
            onClick={() => {
              setOpen(false);
            }}
          >
            Edit
          </a>
          <form
            method="POST"
            action={`/api/entries/${entryId}/delete`}
            onSubmit={(event) => {
              if (!confirm("Delete this entry?")) {
                event.preventDefault();
                return;
              }
              setOpen(false);
            }}
          >
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-sm text-red-200/90 transition-colors hover:bg-red-900/20"
            >
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
