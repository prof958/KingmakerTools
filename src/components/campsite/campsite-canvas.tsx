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

// Size & colour mapping per element type
const TYPE_CONFIG: Record<
  ElementType,
  { fill: string; w: number; h: number; shape: "rect" | "circle" }
> = {
  tent: { fill: "#8B5E3C", w: 60, h: 50, shape: "rect" },
  campfire: { fill: "#FF6600", w: 18, h: 18, shape: "circle" },
  character: { fill: "#4A90D9", w: 16, h: 16, shape: "circle" },
  trap: { fill: "#CC3333", w: 30, h: 30, shape: "rect" },
  bedroll: { fill: "#6B8E23", w: 40, h: 20, shape: "rect" },
  marker: { fill: "#CCCCCC", w: 10, h: 10, shape: "circle" },
};

function ElementShape({ el }: { el: CampElement }) {
  const { selectedId, select, updateElement } = useCampsiteStore();
  const cfg = TYPE_CONFIG[el.type];
  const isSelected = selectedId === el.id;

  const handleDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      updateElement(el.id, {
        x: Math.round(e.target.x()),
        y: Math.round(e.target.y()),
      });
    },
    [el.id, updateElement],
  );

  const handleClick = useCallback(() => {
    select(el.id);
  }, [el.id, select]);

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
      {isSelected && cfg.shape === "rect" && (
        <Rect
          x={-4}
          y={-4}
          width={cfg.w + 8}
          height={cfg.h + 8}
          stroke="#FFD700"
          strokeWidth={2}
          dash={[4, 2]}
          cornerRadius={4}
        />
      )}
      {isSelected && cfg.shape === "circle" && (
        <Circle
          x={cfg.w}
          y={cfg.h}
          radius={cfg.w + 6}
          stroke="#FFD700"
          strokeWidth={2}
          dash={[4, 2]}
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
          x={cfg.w}
          y={cfg.h}
          radius={cfg.w}
          fill={cfg.fill}
          opacity={0.85}
        />
      )}

      {/* Emoji label */}
      <Text
        text={emoji}
        fontSize={cfg.shape === "rect" ? 20 : 14}
        x={cfg.shape === "rect" ? cfg.w / 2 - 10 : cfg.w - 7}
        y={cfg.shape === "rect" ? cfg.h / 2 - 10 : cfg.h - 7}
      />

      {/* Name label */}
      <Text
        text={el.label}
        fontSize={10}
        fill="#fff"
        x={cfg.shape === "rect" ? 0 : -cfg.w}
        y={cfg.shape === "rect" ? cfg.h + 2 : cfg.h + cfg.w + 4}
        width={cfg.shape === "rect" ? cfg.w : cfg.w * 3}
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
      className="rounded-md border bg-[#1a1e2e]"
    >
      <Layer>
        {/* Grid lines */}
        {Array.from({ length: 20 }).map((_, i) => (
          <Rect
            key={`gv-${i}`}
            x={i * 50}
            y={0}
            width={1}
            height={1000}
            fill="rgba(255,255,255,0.05)"
          />
        ))}
        {Array.from({ length: 20 }).map((_, i) => (
          <Rect
            key={`gh-${i}`}
            x={0}
            y={i * 50}
            width={1000}
            height={1}
            fill="rgba(255,255,255,0.05)"
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
