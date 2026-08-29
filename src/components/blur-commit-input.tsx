"use client";

/**
 * A text field whose committed value lives on the server: you type freely, and
 * it saves on blur.
 *
 * The obvious spelling — an uncontrolled `<Input defaultValue={serverValue} />`
 * with an `onBlur` that PATCHes — is wrong here. `defaultValue` is only read
 * when the field mounts, so after the save round-trips and `router.refresh()`
 * re-renders with the new value, base-ui sees the default change underneath an
 * uncontrolled field and warns ("A component is changing the default value
 * state of an uncontrolled FieldControl after being initialized"). Anything
 * that refreshes the tree often — the Turn tab logs and refreshes on nearly
 * every action — turns that into a constant stream.
 *
 * So the field is controlled, holding a local draft, and adopts `value` again
 * whenever the server's copy actually changes. A refresh triggered by some
 * unrelated edit leaves `value` untouched and so never clobbers what is
 * currently being typed.
 */

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function BlurCommitInput({
  value,
  onCommit,
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "onBlur" | "defaultValue"> & {
  /** The saved value. Changing it replaces the draft. */
  value: string;
  /** Called on blur with the trimmed draft, only when it differs from `value`. */
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  // Adopt a new server value by adjusting state during render — React's own
  // recommendation for deriving state from a prop change, and the pattern this
  // codebase uses elsewhere, since `react-hooks/set-state-in-effect` is a hard
  // error here.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setDraft(value);
  }

  return (
    <Input
      {...props}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next !== value) onCommit(next);
      }}
    />
  );
}
