import { useRef, useCallback } from "react";
import PropTypes from "prop-types";
import styled from "styled-components";

const CanvasOuter = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  aspect-ratio: 16 / 9;
  background: #f8f9fa;
  border: 2px dashed #adb5bd;
  border-radius: 4px;
  user-select: none;
  touch-action: none;
`;

const CanvasLabel = styled.span`
  position: absolute;
  top: 0.25rem;
  left: 0.5rem;
  font-size: 0.7rem;
  color: #6c757d;
  pointer-events: none;
`;

const Rect = styled.div`
  position: absolute;
  background: rgba(13, 110, 253, 0.18);
  border: 2px solid #0d6efd;
  cursor: move;
  box-sizing: border-box;
`;

const RectLabel = styled.span`
  position: absolute;
  top: 0.15rem;
  left: 0.35rem;
  font-size: 0.7rem;
  color: #0d6efd;
  pointer-events: none;
`;

const HANDLE_SIZE_PX = 12;

const Handle = styled.div`
  position: absolute;
  width: ${HANDLE_SIZE_PX}px;
  height: ${HANDLE_SIZE_PX}px;
  background: #ffffff;
  border: 2px solid #0d6efd;
  border-radius: 2px;
  z-index: 1;
  box-sizing: border-box;
`;

const HANDLES = [
  {
    mode: "n",
    style: {
      top: 0,
      left: "50%",
      transform: "translate(-50%, -50%)",
      cursor: "ns-resize",
    },
  },
  {
    mode: "s",
    style: {
      bottom: 0,
      left: "50%",
      transform: "translate(-50%, 50%)",
      cursor: "ns-resize",
    },
  },
  {
    mode: "e",
    style: {
      top: "50%",
      right: 0,
      transform: "translate(50%, -50%)",
      cursor: "ew-resize",
    },
  },
  {
    mode: "w",
    style: {
      top: "50%",
      left: 0,
      transform: "translate(-50%, -50%)",
      cursor: "ew-resize",
    },
  },
  {
    mode: "nw",
    style: {
      top: 0,
      left: 0,
      transform: "translate(-50%, -50%)",
      cursor: "nwse-resize",
    },
  },
  {
    mode: "ne",
    style: {
      top: 0,
      right: 0,
      transform: "translate(50%, -50%)",
      cursor: "nesw-resize",
    },
  },
  {
    mode: "sw",
    style: {
      bottom: 0,
      left: 0,
      transform: "translate(-50%, 50%)",
      cursor: "nesw-resize",
    },
  },
  {
    mode: "se",
    style: {
      bottom: 0,
      right: 0,
      transform: "translate(50%, 50%)",
      cursor: "nwse-resize",
    },
  },
];

function clamp(n, min, max) {
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

export function computeNextPosition(mode, start, dx, dy, minW, minH) {
  const next = { ...start };
  if (mode === "body") {
    next.leftPct = clamp(start.leftPct + dx, 0, 100 - start.widthPct);
    next.topPct = clamp(start.topPct + dy, 0, 100 - start.heightPct);
    return next;
  }
  if (mode.includes("e")) {
    next.widthPct = clamp(start.widthPct + dx, minW, 100 - start.leftPct);
  }
  if (mode.includes("w")) {
    const newLeft = clamp(
      start.leftPct + dx,
      0,
      start.leftPct + start.widthPct - minW,
    );
    next.widthPct = start.widthPct + (start.leftPct - newLeft);
    next.leftPct = newLeft;
  }
  if (mode.includes("s")) {
    next.heightPct = clamp(start.heightPct + dy, minH, 100 - start.topPct);
  }
  if (mode.includes("n")) {
    const newTop = clamp(
      start.topPct + dy,
      0,
      start.topPct + start.heightPct - minH,
    );
    next.heightPct = start.heightPct + (start.topPct - newTop);
    next.topPct = newTop;
  }
  return next;
}

const PreviewCanvas = ({
  value,
  onChange,
  minWidthPct,
  minHeightPct,
  disabled,
}) => {
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const handlePointerDown = useCallback(
    (mode) => (e) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = canvas.getBoundingClientRect();
      dragRef.current = {
        mode,
        canvasWidth: rect.width || 1,
        canvasHeight: rect.height || 1,
        startX: e.clientX,
        startY: e.clientY,
        startValue: { ...value },
      };
      if (e.target.setPointerCapture) {
        try {
          e.target.setPointerCapture(e.pointerId);
        } catch {
          // Some test environments throw on setPointerCapture; safe to ignore.
        }
      }
    },
    [value, disabled],
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dxPct = ((e.clientX - drag.startX) / drag.canvasWidth) * 100;
      const dyPct = ((e.clientY - drag.startY) / drag.canvasHeight) * 100;
      const next = computeNextPosition(
        drag.mode,
        drag.startValue,
        dxPct,
        dyPct,
        minWidthPct,
        minHeightPct,
      );
      onChange(next);
    },
    [onChange, minWidthPct, minHeightPct],
  );

  const handlePointerUp = useCallback((e) => {
    if (!dragRef.current) return;
    if (e.target.releasePointerCapture) {
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer was already released; safe to ignore.
      }
    }
    dragRef.current = null;
  }, []);

  const rectStyle = {
    left: `${value.leftPct}%`,
    top: `${value.topPct}%`,
    width: `${value.widthPct}%`,
    height: `${value.heightPct}%`,
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <CanvasOuter
      ref={canvasRef}
      data-testid="popup-preview-canvas"
      aria-label="Popup Position Preview"
      role="application"
    >
      <CanvasLabel>Viewport</CanvasLabel>
      <Rect
        data-testid="popup-preview-rect"
        aria-label="Popup Position Rectangle"
        style={rectStyle}
        onPointerDown={handlePointerDown("body")}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <RectLabel>Popup area</RectLabel>
        {!disabled &&
          HANDLES.map((h) => (
            <Handle
              key={h.mode}
              role="slider"
              aria-label={`Resize ${h.mode}`}
              data-testid={`popup-preview-handle-${h.mode}`}
              style={h.style}
              onPointerDown={handlePointerDown(h.mode)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            />
          ))}
      </Rect>
    </CanvasOuter>
  );
};

PreviewCanvas.propTypes = {
  value: PropTypes.shape({
    leftPct: PropTypes.number.isRequired,
    topPct: PropTypes.number.isRequired,
    widthPct: PropTypes.number.isRequired,
    heightPct: PropTypes.number.isRequired,
  }).isRequired,
  onChange: PropTypes.func.isRequired,
  minWidthPct: PropTypes.number,
  minHeightPct: PropTypes.number,
  disabled: PropTypes.bool,
};

PreviewCanvas.defaultProps = {
  minWidthPct: 20,
  minHeightPct: 20,
  disabled: false,
};

export default PreviewCanvas;
