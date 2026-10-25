import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SOURCE_FILE = /\.(ts|tsx)$/;

function collect(path) {
  const stats = statSync(path);
  if (stats.isFile()) return [path];
  return readdirSync(path)
    .sort()
    .flatMap((name) => collect(join(path, name)))
    .filter((file) => SOURCE_FILE.test(file));
}

/**
 * Concatenates the text of the given files and (recursively) directories so a
 * component split into modules is still checked as one body of source.
 * Throws when a path is missing: a deleted module must fail validation.
 */
export function readSources(...paths) {
  return paths
    .flatMap(collect)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}
