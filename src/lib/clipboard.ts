/**
 * Copies text in a user-initiated browser interaction. The modern Clipboard API is
 * preferred, but the DOM fallback keeps supported non-secure embedded contexts usable.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (
    !text ||
    typeof navigator === "undefined" ||
    typeof document === "undefined"
  ) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Continue to the legacy fallback in the same user gesture.
  }

  const activeElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  const selection = window.getSelection?.();
  const selectionRange = selection?.rangeCount
    ? selection.getRangeAt(0).cloneRange()
    : null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText =
    "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;";

  try {
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return (
      typeof document.execCommand === "function" && document.execCommand("copy")
    );
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (selection && selectionRange) {
      selection.removeAllRanges();
      selection.addRange(selectionRange);
    }
    activeElement?.focus();
  }
}
