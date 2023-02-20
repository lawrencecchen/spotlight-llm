import { useState } from "react";
import { useTimeout, useClipboard } from "@mantine/hooks";
import { Clipboard, Check } from "lucide-react";

export function CopyToClipboard(props: { content: string }) {
  const clipboard = useClipboard({ timeout: 2000 });

  return (
    <button
      className="flex items-center font-sans text-xs space-x-1 px-2 py-0.5"
      onClick={() => clipboard.copy(props.content)}
    >
      {clipboard.copied ? (
        <>
          <Check className="w-3 h-3" />
          <span>Copied!</span>
        </>
      ) : (
        <>
          <Clipboard className="w-3 h-3" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
