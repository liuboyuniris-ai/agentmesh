import fs from "node:fs";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node";

/**
 * Shallow single-branch clone without the system `git` binary (pure JS).
 * Uses HTTPS URL (caller should inject auth into URL when needed).
 */
export async function shallowCloneIsomorphic(params: {
  url: string;
  destDir: string;
  branch?: string;
}): Promise<void> {
  await git.clone({
    fs,
    http,
    dir: params.destDir,
    url: params.url,
    singleBranch: true,
    depth: 1,
    ref: params.branch ?? "main",
  });
}
