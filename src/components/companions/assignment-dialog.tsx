"use client";

/**
 * AssignmentDialog — the "muster and send out" form, used for both creating a
 * new assignment and editing an existing one.
 *
 * The return date is entered as a *duration in days* rather than a date. In
 * play you say "they will be gone about ten days", not "they return on the
 * 20th"; the dialog does the calendar arithmetic and shows the date it lands
 * on, so nobody has to count Pharast on their fingers.
 */

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CalendarDays, MapPin } from "lucide-react";
import {
  MONTHS,
  addDays,
  daysBetween,
  daysInMonth,
  formatGolarionDate,
  monthName,
} from "@/lib/pf2e/calendar";
import {
  ASSIGNMENT_KINDS,
  ASSIGNMENT_KIND_META,
  type AssignmentKind,
} from "@/lib/companions";
import { CompanionAvatar, KIND_ICON } from "./shared";
import type { Assignment, CompanionLite, GolarionToday, LocationOption } from "./types";

const NO_PLACE = "__none__";
const DEFAULT_DURATION = 7;

export interface AssignmentDraft {
  kind: AssignmentKind;
  title: string;
  description: string | null;
  locationName: string | null;
  hexId: string | null;
  settlementId: string | null;
  departDay: number;
  departMonth: number;
  departYear: number;
  returnDay: number | null;
  returnMonth: number | null;
  returnYear: number | null;
  characterIds: string[];
}

interface FormProps {
  today: GolarionToday;
  /** Companions free to be sent — plus, when editing, this assignment's own. */
  available: CompanionLite[];
  locations: LocationOption[];
  existing?: Assignment | null;
  saving: boolean;
  onCancel: () => void;
  onSubmit: (draft: AssignmentDraft) => void;
}

export function AssignmentDialog({
  open,
  onOpenChange,
  ...form
}: FormProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {/* Mounted only while open, and keyed by what is being edited, so the
            form always starts from its props — no reset effect, and a
            cancelled edit cannot leak into the next "send someone out". */}
        {open && <AssignmentForm key={form.existing?.id ?? "new"} {...form} />}
      </DialogContent>
    </Dialog>
  );
}

function AssignmentForm({
  today,
  available,
  locations,
  existing,
  saving,
  onCancel,
  onSubmit,
}: FormProps) {
  const [kind, setKind] = useState<AssignmentKind>(existing?.kind ?? "QUEST");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [locationName, setLocationName] = useState(existing?.locationName ?? "");
  const [place, setPlace] = useState<string>(
    existing?.settlementId
      ? `settlement:${existing.settlementId}`
      : existing?.hexId
        ? `hex:${existing.hexId}`
        : NO_PLACE,
  );
  const [selected, setSelected] = useState<string[]>(
    existing?.members.map((m) => m.characterId) ?? [],
  );
  const [departDay, setDepartDay] = useState(existing?.departDay ?? today.day);
  const [departMonth, setDepartMonth] = useState(existing?.departMonth ?? today.month);
  const [departYear, setDepartYear] = useState(existing?.departYear ?? today.year);
  const [openEnded, setOpenEnded] = useState(
    existing ? existing.returnDay === null : false,
  );
  const [duration, setDuration] = useState(() => initialDuration(existing));

  const meta = ASSIGNMENT_KIND_META[kind];

  // Derived rather than clamped through an effect: picking Gozran while the
  // day reads 31 must not leave a 31 Gozran in state for even one render.
  const maxDay = daysInMonth(departMonth, departYear);
  const safeDay = Math.min(departDay, maxDay);

  const returnsOn = useMemo(
    () => addDays(safeDay, departMonth, departYear, duration),
    [safeDay, departMonth, departYear, duration],
  );

  const settlements = locations.filter((l) => l.group === "Settlements");
  const hexes = locations.filter((l) => l.group === "Hexes");

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function choosePlace(next: string) {
    setPlace(next);
    const match = locations.find((l) => l.value === next);
    // Selecting a map location fills the free-text name too, so the card still
    // reads correctly if that hex or settlement is deleted later.
    if (match) setLocationName(match.label);
  }

  const usesReturnDate = meta.hasReturnDate && !openEnded;
  const canSubmit = title.trim().length > 0 && selected.length > 0 && !saving;

  function submit() {
    if (!canSubmit) return;
    const [placeKind, placeId] = place === NO_PLACE ? [null, null] : place.split(":");

    onSubmit({
      kind,
      title: title.trim(),
      description: description.trim() || null,
      locationName: meta.hasLocation ? locationName.trim() || null : null,
      hexId: meta.hasLocation && placeKind === "hex" ? placeId : null,
      settlementId: meta.hasLocation && placeKind === "settlement" ? placeId : null,
      departDay: safeDay,
      departMonth,
      departYear,
      returnDay: usesReturnDate ? returnsOn.day : null,
      returnMonth: usesReturnDate ? returnsOn.month : null,
      returnYear: usesReturnDate ? returnsOn.year : null,
      characterIds: selected,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{existing ? "Edit orders" : "Muster a companion"}</DialogTitle>
        <DialogDescription>{meta.blurb}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Kind — segmented, so the whole form's shape is one click away */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ASSIGNMENT_KINDS.map((k) => {
            const Icon = KIND_ICON[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
                  k === kind
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {ASSIGNMENT_KIND_META[k].label}
              </button>
            );
          })}
        </div>

        <div>
          <Label htmlFor="assignment-title">
            {kind === "QUEST" ? "Quest" : kind === "STATION" ? "Posting" : "What happened"}
          </Label>
          <Input
            id="assignment-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={TITLE_PLACEHOLDER[kind]}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>

        {/* Roster picker */}
        <div>
          <Label>
            Who goes{" "}
            <span className="font-normal text-muted-foreground">
              ({selected.length} selected)
            </span>
          </Label>
          {available.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone is already out. Resolve an assignment to free someone up.
            </p>
          ) : (
            <div className="mt-1 flex flex-wrap gap-2">
              {available.map((c) => {
                const on = selected.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggle(c.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm transition-colors",
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <CompanionAvatar companion={c} size="sm" />
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {meta.hasLocation && (
          <div className="space-y-2">
            <Label htmlFor="assignment-location">
              <MapPin className="mr-1 inline h-3.5 w-3.5" />
              Where
            </Label>
            <Input
              id="assignment-location"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Fangberry Caves"
            />
            {locations.length > 0 && (
              <Select value={place} onValueChange={(v) => v && choosePlace(v)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Pin to the kingdom map (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PLACE} label="Not on the map">
                    Not on the map
                  </SelectItem>
                  {settlements.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Settlements</SelectLabel>
                      {settlements.map((l) => (
                        <SelectItem key={l.value} value={l.value} label={l.label}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {hexes.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Hexes</SelectLabel>
                      {hexes.map((l) => (
                        <SelectItem key={l.value} value={l.value} label={l.label}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Departure */}
        <div>
          <Label>
            <CalendarDays className="mr-1 inline h-3.5 w-3.5" />
            {kind === "MISSING" ? "Last seen" : "Departs"}
          </Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <NumberInput
              aria-label="Day"
              className="w-16"
              value={safeDay}
              min={1}
              max={maxDay}
              fallback={1}
              onValueChange={setDepartDay}
            />
            <Select
              value={String(departMonth)}
              onValueChange={(v) => v && setDepartMonth(Number(v))}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m) => (
                  <SelectItem key={m.index} value={String(m.index)} label={m.name}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <NumberInput
              aria-label="Year"
              className="w-24"
              value={departYear}
              min={1}
              fallback={today.year}
              onValueChange={setDepartYear}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDepartDay(today.day);
                setDepartMonth(today.month);
                setDepartYear(today.year);
              }}
            >
              Today
            </Button>
          </div>
        </div>

        {/* Expected return, entered as a duration */}
        {meta.hasReturnDate && (
          <div>
            <Label htmlFor="assignment-duration">
              {kind === "RECOVERING" ? "Out of action for" : "Expected to be away"}
            </Label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <NumberInput
                id="assignment-duration"
                className="w-20"
                value={duration}
                min={0}
                fallback={1}
                disabled={openEnded}
                onValueChange={setDuration}
              />
              <span className="text-sm text-muted-foreground">
                {duration === 1 ? "day" : "days"}
              </span>
              {[3, 7, 14, 30].map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={openEnded}
                  onClick={() => setDuration(d)}
                >
                  {d}d
                </Button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {openEnded ? (
                  "No return expected — you will resolve this by hand."
                ) : (
                  <>
                    {kind === "RECOVERING" ? "Back on their feet" : "Due back"} on{" "}
                    <span className="font-medium text-foreground">
                      {returnsOn.day} {monthName(returnsOn.month)} {returnsOn.year} AR
                    </span>
                  </>
                )}
              </p>
              <Button
                type="button"
                variant={openEnded ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setOpenEnded((v) => !v)}
              >
                {openEnded ? "Set a return date" : "No fixed return"}
              </Button>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="assignment-notes">Orders / notes</Label>
          <Textarea
            id="assignment-notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deliver the writ, then wait for a reply."
            rows={2}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={submit} disabled={!canSubmit}>
            {saving
              ? "Saving…"
              : existing
                ? "Save orders"
                : kind === "QUEST"
                  ? "Send out"
                  : "Record"}
          </Button>
        </div>

        {!existing && (
          <p className="text-center text-xs text-muted-foreground">
            {kind === "MISSING" ? "Last seen" : "Departing"}{" "}
            {formatGolarionDate(safeDay, departMonth, departYear)}
          </p>
        )}
      </div>
    </>
  );
}

const TITLE_PLACEHOLDER: Record<AssignmentKind, string> = {
  QUEST: "Escort the caravan to Restov",
  STATION: "Garrison the capital",
  RECOVERING: "Mauled by the owlbear",
  MISSING: "Never came back from the Narlmarches",
};

/** An existing assignment's duration is the gap between its two stored dates. */
function initialDuration(existing?: Assignment | null): number {
  if (
    !existing ||
    existing.returnDay === null ||
    existing.returnMonth === null ||
    existing.returnYear === null
  ) {
    return DEFAULT_DURATION;
  }

  return Math.max(
    0,
    daysBetween(
      { day: existing.departDay, month: existing.departMonth, year: existing.departYear },
      { day: existing.returnDay, month: existing.returnMonth, year: existing.returnYear },
    ),
  );
}
