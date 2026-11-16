"use client";
import { useFormStatus } from "react-dom";
export function RefreshButton({label="更新榜单"}:{label?:string}) {
  const {pending}=useFormStatus();
  return <button type="submit" disabled={pending} aria-live="polite" className="rounded-sm text-xs text-[#777] hover:text-[#c83d2c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c83d2c] disabled:cursor-wait disabled:text-[#aaa]">{pending ? "正在更新，请稍候…" : `↻ ${label}`}</button>;
}
