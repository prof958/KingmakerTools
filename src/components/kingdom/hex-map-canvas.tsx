"use client";

/**
 * HexMapCanvas — the Stolen Lands map sheet with a hex overlay.
 *
 * Must be loaded via dynamic(() => import(...), { ssr: false }); Konva needs a
 * DOM. The sheet image is drawn at its native size inside a scaled group, so
 * every hex polygon can be positioned with the pixel geometry measured off the
 * printed sheet rather than a re-derived approximation.
 *
 * Only touched hexes get a fill. An untouched map should read as the printed
 * map it is, with the party's progress painted on top of it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Image as KonvaImage, Group, Circle } from "react-konva";
import type Konva from "konva";
import { hexAt, hexCenter, hexPoints, sheetHexes, type Axial } from "@/lib/hex";
import type { MapSheet } from "@/lib/map-sheets";
import type { HexData } from "./types";

/** Fill and stroke per hex state. Unclaimed hexes are left bare. */
const STATE_STYLE: Record<string, { fill: string; stroke: string; width: number }> = {
  CLAIMED: { fill: "rgba(52, 211, 153, 0.28)", stroke: "#34d399", width: 4 },
  RECONNOITERED: { fill: "rgba(56, 189, 248, 0.16)", stroke: "#38bdf8", width: 3 },
};

const WORK_SITE_COLOR: Record<string, string> = {
  farmland: "#facc15",
  lumber: "#4ade80",
  mine: "#a78bfa",
  quarry: "#f97316",
};

/** Pixels of movement before a pointer gesture counts as a pan, not a click. */
const DRAG_THRESHOLD = 4;

const MIN_SCALE = 0.15;
const MAX_SCALE = 2;

function useSheetImage(src: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    setImage(null);
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImage(img);
    return () => {
      img.onload = null;
    };
  }, [src]);
  return image;
}

export function HexMapCanvas({
  sheet,
  hexes,
  selected,
  onSelect,
}: {
  sheet: MapSheet;
  /** Touched hexes on this sheet, keyed "q,r". */
  hexes: Map<string, HexData>;
  selected: Axial | null;
  onSelect: (hex: Axial) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Where a pan began, so a click that merely twitched still counts as a click.
  const dragOriginRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [view, setView] = useState({ scale: 0.45, x: 0, y: 0 });
  const [hovered, setHovered] = useState<Axial | null>(null);
  const image = useSheetImage(sheet.file);

  const grid = useMemo(() => sheetHexes(sheet.hex), [sheet]);

  // Track the container so the stage fills whatever width it is given.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width } = entry.contentRect;
      setSize({ width, height: Math.max(420, Math.round(width * 0.7)) });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Fit the sheet to the stage whenever either changes.
  useEffect(() => {
    const scale = Math.min(size.width / sheet.width, size.height / sheet.height);
    setView({
      scale,
      x: (size.width - sheet.width * scale) / 2,
      y: (size.height - sheet.height * scale) / 2,
    });
  }, [sheet, size]);

  /** Pointer position in sheet pixels, undoing the current pan and zoom. */
  const toSheetPoint = useCallback(
    (stage: Konva.Stage) => {
      const pointer = stage.getPointerPosition();
      if (!pointer) return null;
      return {
        x: (pointer.x - view.x) / view.scale,
        y: (pointer.y - view.y) / view.scale,
      };
    },
    [view],
  );

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return;

    setView((current) => {
      const next = Math.min(
        MAX_SCALE,
        Math.max(MIN_SCALE, current.scale * (e.evt.deltaY > 0 ? 0.9 : 1.1)),
      );
      // Keep the point under the cursor fixed while zooming.
      const sheetX = (pointer.x - current.x) / current.scale;
      const sheetY = (pointer.y - current.y) / current.scale;
      return {
        scale: next,
        x: pointer.x - sheetX * next,
        y: pointer.y - sheetY * next,
      };
    });
  }, []);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Konva fires a click at the end of a pan; ignore that one, or every drag
      // would also select whichever hex the pointer happened to land on. The
      // threshold matters: a plain click still reports a pixel or two of
      // movement, and treating that as a pan swallows the selection entirely.
      if (draggedRef.current) {
        draggedRef.current = false;
        return;
      }
      const stage = e.target.getStage();
      if (!stage) return;
      const point = toSheetPoint(stage);
      if (!point) return;
      const hex = hexAt(point, sheet.hex);
      if (grid.some((h) => h.q === hex.q && h.r === hex.r)) onSelect(hex);
    },
    [grid, onSelect, sheet, toSheetPoint],
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      const stage = e.target.getStage();
      if (!stage) return;
      const point = toSheetPoint(stage);
      if (!point) return;
      const hex = hexAt(point, sheet.hex);
      setHovered(grid.some((h) => h.q === hex.q && h.r === hex.r) ? hex : null);
    },
    [grid, sheet, toSheetPoint],
  );

  return (
    <div ref={containerRef} className="w-full overflow-hidden rounded-xl border bg-card">
      <Stage
        width={size.width}
        height={size.height}
        onWheel={handleWheel}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        draggable
        x={view.x}
        y={view.y}
        scaleX={view.scale}
        scaleY={view.scale}
        // The stage's position is controlled, so it has to follow the drag on
        // every frame. Syncing only at the end lets any re-render mid-drag
        // (hover tracking causes one) snap the map back to where it started.
        onDragStart={(e) => {
          dragOriginRef.current = { x: e.target.x(), y: e.target.y() };
          draggedRef.current = false;
        }}
        onDragMove={(e) => {
          const origin = dragOriginRef.current;
          if (origin) {
            const moved = Math.hypot(e.target.x() - origin.x, e.target.y() - origin.y);
            if (moved > DRAG_THRESHOLD) draggedRef.current = true;
          }
          setView((v) => ({ ...v, x: e.target.x(), y: e.target.y() }));
        }}
        style={{ cursor: hovered ? "pointer" : "grab" }}
      >
        <Layer listening={false}>
          {image && <KonvaImage image={image} width={sheet.width} height={sheet.height} />}
        </Layer>

        <Layer listening={false}>
          {grid.map((hex) => {
            const key = `${hex.q},${hex.r}`;
            const data = hexes.get(key);
            const style = data ? STATE_STYLE[data.state] : undefined;
            const isSelected = selected?.q === hex.q && selected?.r === hex.r;
            const isHovered = hovered?.q === hex.q && hovered?.r === hex.r;

            // Unclaimed, unhovered, unselected hexes draw nothing at all, so the
            // printed map stays readable underneath the overlay.
            if (!style && !isSelected && !isHovered && !data?.workSite) return null;

            const points = hexPoints(hex, sheet.hex);
            const centre = hexCenter(hex, sheet.hex);
            return (
              <Group key={key}>
                <Line
                  points={points}
                  closed
                  fill={style?.fill ?? (isHovered ? "rgba(255,255,255,0.10)" : undefined)}
                  stroke={isSelected ? "#fbbf24" : style?.stroke}
                  strokeWidth={isSelected ? 6 : (style?.width ?? 0)}
                />
                {data?.workSite && (
                  <Circle
                    x={centre.x}
                    y={centre.y}
                    radius={18}
                    fill={WORK_SITE_COLOR[data.workSite] ?? "#e5e7eb"}
                    stroke="rgba(0,0,0,0.5)"
                    strokeWidth={3}
                  />
                )}
                {data?.fortified && (
                  <Line
                    points={points}
                    closed
                    stroke="#f87171"
                    strokeWidth={3}
                    dash={[14, 10]}
                  />
                )}
              </Group>
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
