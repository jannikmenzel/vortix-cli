import { spawnSync } from "node:child_process";

interface ClipboardCommand {
  command: string;
  args: string[];
}

function candidateCommands(): ClipboardCommand[] {
  switch (process.platform) {
    case "darwin":
      return [{ command: "pbcopy", args: [] }];
    case "win32":
      return [{ command: "clip", args: [] }];
    case "linux":
      return [
        { command: "wl-copy", args: [] },
        { command: "xclip", args: ["-selection", "clipboard"] },
        { command: "xsel", args: ["--clipboard", "--input"] },
      ];
    default:
      return [];
  }
}

export function copyToClipboard(text: string): boolean {
  for (const { command, args } of candidateCommands()) {
    const result = spawnSync(command, args, { input: text, stdio: ["pipe", "ignore", "ignore"] });
    if (!result.error && result.status === 0) return true;
  }
  return false;
}
