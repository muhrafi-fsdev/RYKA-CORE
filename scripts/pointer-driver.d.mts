export type PointerRequest =
  | { op: "move"; x: number; y: number }
  | { op: "down" }
  | { op: "up" };

export type PointerHelper = {
  write: (line: string) => unknown;
  backlog: () => number;
  close: () => void;
};

export const POINTER_OPS: ReadonlyArray<string>;
export const POINTER_RELEASE_AFTER_MS: number;
export const POINTER_STOP_AFTER_MS: number;
export const POINTER_HELPER_SCRIPT: string;

export function parsePointerRequest(payload: unknown): PointerRequest;
export function formatHelperCommand(request: PointerRequest): string;
export function encodeHelperScript(script?: string): string;
export function spawnPowerShellHelper(options: { onExit: () => void }): PointerHelper;

export class PointerController {
  constructor(options: {
    spawnHelper: (options: { onExit: () => void }) => PointerHelper;
    onEvent?: (event: string) => void;
    releaseAfterMs?: number;
    stopAfterMs?: number;
  });
  readonly buttonDown: boolean;
  readonly running: boolean;
  handle(request: PointerRequest): void;
  stop(reason?: string): void;
}
