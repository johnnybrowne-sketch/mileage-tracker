import { Bot, Maximize2, Move, X } from "lucide-react";
import { useEffect, useState } from "react";

const DEFAULT_SIZE = { width: 390, height: 540 };
const MIN_SIZE = { width: 330, height: 420 };
const EDGE_GAP = 16;
const LAUNCHER_GAP = 92;

export default function JohnnyChatShell({
  isOpen,
  setIsOpen,
  title = "Johnny Assistant",
  launcherClassName = "",
  closeAriaLabel = "Close Johnny assistant",
  sendArea,
  children,
}) {
  const [layout, setLayout] = useState(getDefaultLayout);

  useEffect(() => {
    function keepInsideViewport() {
      setLayout((current) => clampLayout(current));
    }

    window.addEventListener("resize", keepInsideViewport);
    return () => window.removeEventListener("resize", keepInsideViewport);
  }, []);

  function startDrag(event) {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startPosition = layout.position;

    function handlePointerMove(moveEvent) {
      const nextPosition = {
        x: startPosition.x + moveEvent.clientX - startX,
        y: startPosition.y + moveEvent.clientY - startY,
      };

      setLayout((current) =>
        clampLayout({
          ...current,
          position: nextPosition,
        })
      );
    }

    function stopDrag() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopDrag);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopDrag);
  }

  function startResize(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = layout.size;

    function handlePointerMove(moveEvent) {
      const nextSize = {
        width: startSize.width + moveEvent.clientX - startX,
        height: startSize.height + moveEvent.clientY - startY,
      };

      setLayout((current) =>
        clampLayout({
          ...current,
          size: nextSize,
        })
      );
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  return (
    <>
      {isOpen && (
        <div
          className="fixed z-50 flex flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-400/30 ring-1 ring-slate-200"
          style={{
            left: layout.position.x,
            top: layout.position.y,
            width: layout.size.width,
            height: layout.size.height,
          }}
        >
          <div
            onPointerDown={startDrag}
            className="prosper-hero-gradient flex cursor-move touch-none items-center justify-between gap-4 p-4 text-white"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-2xl bg-white/15 p-3">
                <Bot size={22} />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black">{title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-white/75">
                  <Move size={12} />
                  Drag header to move
                </p>
              </div>
            </div>

            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="rounded-xl bg-white/10 p-2 transition hover:bg-white/20"
              aria-label={closeAriaLabel}
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          {sendArea}

          <button
            type="button"
            onPointerDown={startResize}
            className="absolute bottom-[88px] right-3 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition hover:bg-blue-50 hover:text-blue-700"
            aria-label="Resize Johnny assistant"
            title="Drag to resize"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={
          "fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-full px-5 py-4 text-sm font-black text-white shadow-2xl shadow-blue-300 transition hover:-translate-y-0.5 " +
          launcherClassName
        }
      >
        <Bot size={22} />
        {isOpen ? "Close Help" : "Need Help?"}
      </button>
    </>
  );
}

function getDefaultLayout() {
  if (typeof window === "undefined") {
    return {
      position: { x: EDGE_GAP, y: EDGE_GAP },
      size: DEFAULT_SIZE,
    };
  }

  const size = {
    width: Math.min(DEFAULT_SIZE.width, window.innerWidth - EDGE_GAP * 2),
    height: Math.min(DEFAULT_SIZE.height, window.innerHeight - LAUNCHER_GAP),
  };

  return clampLayout({
    position: {
      x: window.innerWidth - size.width - EDGE_GAP,
      y: window.innerHeight - size.height - LAUNCHER_GAP,
    },
    size,
  });
}

function clampLayout(layout) {
  if (typeof window === "undefined") return layout;

  const maxWidth = Math.max(MIN_SIZE.width, window.innerWidth - EDGE_GAP * 2);
  const maxHeight = Math.max(MIN_SIZE.height, window.innerHeight - LAUNCHER_GAP);
  const size = {
    width: Math.max(MIN_SIZE.width, Math.min(layout.size.width, maxWidth)),
    height: Math.max(MIN_SIZE.height, Math.min(layout.size.height, maxHeight)),
  };

  const maxX = Math.max(EDGE_GAP, window.innerWidth - size.width - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - size.height - EDGE_GAP);

  return {
    size,
    position: {
      x: Math.max(EDGE_GAP, Math.min(layout.position.x, maxX)),
      y: Math.max(EDGE_GAP, Math.min(layout.position.y, maxY)),
    },
  };
}
