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
        className="border-border text-muted-foreground hover:bg-accent inline-flex size-8 items-center justify-center rounded-lg border transition-colors"
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          className="border-border bg-card absolute right-0 z-10 mt-1 min-w-32 rounded-lg border py-1 shadow-sm"
        >
          <a
            role="menuitem"
            href={`/entries/${entryId}/edit`}
            className="text-foreground hover:bg-accent block px-3 py-2 text-sm transition-colors"
            onClick={() => {
              setOpen(false);
            }}
          >
            Edit
          </a>
          <form method="POST" action={`/api/entries/${entryId}/delete`}>
            <button
              type="submit"
              role="menuitem"
              className="text-destructive hover:bg-destructive/10 block w-full px-3 py-2 text-left text-sm transition-colors"
              onClick={(event) => {
                if (!confirm("Delete this entry?")) {
                  event.preventDefault();
                }
              }}
            >
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
