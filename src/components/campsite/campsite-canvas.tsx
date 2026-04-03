"use client";

/**
 * CampsiteCanvas — react-konva interactive 2D canvas for campsite element placement.
 * Must be loaded via dynamic(() => import(...), { ssr: false }) in parent.
 */

import { useRef, useCallback, useState, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Text, Group } from "react-konva";
import type Konva from "konva";
import {
  useCampsiteStore,
  type CampElement,
  type ElementType,
  ELEMENT_PALETTE,
} from "@/stores/campsite-store";

const GRID_SIZE = 50;

// Snap a coordinate to the nearest grid cell
function snapToGrid(val: number): number {
  return Math.round(val / GRID_SIZE) * GRID_SIZE;
}

// Size & colour mapping per element type — sizes are multiples of GRID_SIZE
const G = GRID_SIZE;
const TYPE_CONFIG: Record<
  ElementType,
  { fill: string; w: number; h: number; shape: "rect" | "circle" }
> = {
  tent:      { fill: "#8B5E3C", w: G * 2, h: G * 2, shape: "rect" },   // 2×2 squares
  campfire:  { fill: "#FF6600", w: G,     h: G,     shape: "circle" },  // 1×1 square
  character: { fill: "#4A90D9", w: G,     h: G,     shape: "circle" },  // 1×1 square
  trap:      { fill: "#CC3333", w: G,     h: G,     shape: "rect" },    // 1×1 square
  bedroll:   { fill: "#6B8E23", w: G * 2, h: G,     shape: "rect" },   // 2×1 rectangle
  marker:    { fill: "#CCCCCC", w: G,     h: G,     shape: "circle" },  // 1×1 square
};

function ElementShape({ el }: { el: CampElement }) {
  const { selectedId, select, updateElement } = useCampsiteStore();
  const cfg = TYPE_CONFIG[el.type];
  const isSelected = selectedId === el.id;

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Stop event from bubbling to Stage's onDragEnd
      e.cancelBubble = true;
      updateElement(el.id, {
        x: snapToGrid(e.target.x()),
        y: snapToGrid(e.target.y()),
      });
    },
    [el.id, updateElement],
  );

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Stop event from bubbling to Stage click handler
      e.cancelBubble = true;
      select(el.id);
    },
    [el.id, select],
  );

  const emoji =
    ELEMENT_PALETTE.find((p) => p.type === el.type)?.emoji ?? "📍";

  return (
    <Group
      x={el.x}
      y={el.y}
      draggable
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      onTap={handleClick}
    >
      {/* Selection ring */}
      {isSelected && (
        <Rect
          x={-3}
          y={-3}
          width={cfg.w + 6}
          height={cfg.h + 6}
          stroke="#FFD700"
          strokeWidth={2}
          dash={[4, 2]}
          cornerRadius={cfg.shape === "circle" ? cfg.w : 4}
        />
      )}

      {/* Shape */}
      {cfg.shape === "rect" ? (
        <Rect
          width={cfg.w}
          height={cfg.h}
          fill={cfg.fill}
          cornerRadius={4}
          opacity={0.85}
        />
      ) : (
        <Circle
          x={cfg.w / 2}
          y={cfg.h / 2}
          radius={cfg.w / 2 - 2}
          fill={cfg.fill}
          opacity={0.85}
        />
      )}

      {/* Emoji label */}
      <Text
        text={emoji}
        fontSize={Math.min(cfg.w, cfg.h) * 0.5}
        x={cfg.w / 2 - Math.min(cfg.w, cfg.h) * 0.25}
        y={cfg.h / 2 - Math.min(cfg.w, cfg.h) * 0.25}
      />

      {/* Name label */}
      <Text
        text={el.label}
        fontSize={11}
        fill="#fff"
        x={0}
        y={cfg.h + 2}
        width={cfg.w}
        align="center"
      />
    </Group>
  );
}

export default function CampsiteCanvas() {
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 500 });
  const { elements, stageX, stageY, scale, setViewport, select } =
    useCampsiteStore();

  // Resize canvas to fit container
  useEffect(() => {
    function updateSize() {
      if (containerRef.current) {
        const w = containerRef.current.offsetWidth;
        setStageSize({ width: w, height: Math.max(300, Math.min(500, w * 0.6)) });
      }
    }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const scaleBy = 1.08;
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY > 0 ? -1 : 1;
      const newScale = Math.min(
        3,
        Math.max(0.25, direction > 0 ? oldScale * scaleBy : oldScale / scaleBy),
      );

      setViewport(
        pointer.x - mousePointTo.x * newScale,
        pointer.y - mousePointTo.y * newScale,
        newScale,
      );
    },
    [setViewport],
  );

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      // Only update viewport when the Stage itself is dragged, not child elements
      if (e.target !== e.target.getStage()) return;
      setViewport(e.target.x(), e.target.y(), scale);
    },
    [scale, setViewport],
  );

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
      // Deselect when clicking empty canvas
      if (e.target === e.target.getStage()) {
        select(null);
      }
    },
    [select],
  );

  return (
    <div ref={containerRef} className="w-full">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        x={stageX}
        y={stageY}
        scaleX={scale}
        scaleY={scale}
        draggable
        onWheel={handleWheel}
        onDragEnd={handleDragEnd}
        onClick={handleStageClick}
        onTap={handleStageClick}
        style={{ cursor: "grab" }}
        className="rounded-md border bg-[#1a1e2e]"
    >
      <Layer>
        {/* Grid lines */}
        {Array.from({ length: 40 }).map((_, i) => (
          <Rect
            key={`gv-${i}`}
            x={i * GRID_SIZE}
            y={0}
            width={1}
            height={2000}
            fill="rgba(255,255,255,0.07)"
          />
        ))}
        {Array.from({ length: 40 }).map((_, i) => (
          <Rect
            key={`gh-${i}`}
            x={0}
            y={i * GRID_SIZE}
            width={2000}
            height={1}
            fill="rgba(255,255,255,0.07)"
          />
        ))}

        {/* Elements */}
        {elements.map((el) => (
          <ElementShape key={el.id} el={el} />
        ))}
      </Layer>
    </Stage>
    </div>
  );
}
