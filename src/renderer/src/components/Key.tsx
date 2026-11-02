/** The key that triggers a button, shown on the button itself. */
export function Key({ k }: { k: string }) {
  return <kbd className="key">{k}</kbd>;
}
