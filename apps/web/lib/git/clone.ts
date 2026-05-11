import { mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { shallowCloneIsomorphic } from "@/lib/git/cloneIsomorphic";

const execFileAsync = promisify(execFile);

const GITHUB_HTTPS =
  /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\.git)?$/;

/** GitLab.com groups/projects path (at least group/repo). */
const GITLAB_COM_HTTPS =
  /^https:\/\/gitlab\.com\/[\w.-]+(?:\/[\w.-]+)+(?:\.git)?$/;

function normalizeHttpsGitUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim().replace(/\.git$/i, "");
  return `${trimmed}.git`;
}

export function sanitizeGithubHttps(repoUrl: string): string {
  const withGit = normalizeHttpsGitUrl(repoUrl);
  if (!GITHUB_HTTPS.test(withGit)) {
    throw new Error(
      "Only GitHub HTTPS URLs are supported for this helper (owner/repo)."
    );
  }
  return withGit;
}

export function sanitizeGitLabComHttps(repoUrl: string): string {
  const withGit = normalizeHttpsGitUrl(repoUrl);
  if (!GITLAB_COM_HTTPS.test(withGit)) {
    throw new Error(
      "Only GitLab.com HTTPS URLs are supported (group/subgroup/project)."
    );
  }
  return withGit;
}

/** Supported: github.com + gitlab.com HTTPS remotes. */
export function sanitizeHostedGitHttps(repoUrl: string): string {
  const withGit = normalizeHttpsGitUrl(repoUrl);
  if (GITHUB_HTTPS.test(withGit)) return withGit;
  if (GITLAB_COM_HTTPS.test(withGit)) return withGit;
  throw new Error(
    "Unsupported git remote. Use https://github.com/owner/repo or https://gitlab.com/group/project.git"
  );
}

function injectHttpsAuth(repoUrl: string, token: string): string {
  const u = new URL(repoUrl.replace(/\.git$/i, ""));
  const host = u.hostname.toLowerCase();
  const encoded = encodeURIComponent(token);
  if (host === "github.com") {
    return repoUrl.replace(
      "https://github.com/",
      `https://${encoded}@github.com/`
    );
  }
  if (host === "gitlab.com") {
    return repoUrl.replace(
      "https://gitlab.com/",
      `https://oauth2:${encoded}@gitlab.com/`
    );
  }
  throw new Error(`injectHttpsAuth: unsupported host ${host}`);
}

export async function cloneHostedGitRepo(params: {
  repoUrl: string;
  destDir: string;
  branch?: string;
  /** GitHub PAT / GitLab PAT (gitlab uses oauth2:TOKEN basic form). */
  token?: string;
}): Promise<void> {
  const url = sanitizeHostedGitHttps(params.repoUrl);
  mkdirSync(params.destDir, { recursive: true });
  const explicit = params.token?.trim() ?? "";
  const githubEnv = process.env.GITHUB_TOKEN?.trim() ?? process.env.GITHUB_PAT?.trim() ?? "";
  const gitlabEnv = process.env.GITLAB_TOKEN?.trim() ?? "";
  const host = new URL(url.replace(/\.git$/i, "")).hostname.toLowerCase();
  const fallback =
    host === "gitlab.com" ? gitlabEnv : githubEnv;
  const token = explicit || fallback;
  const authUrl =
    token.length > 0 ? injectHttpsAuth(url, token) : url;

  const preferIso =
    process.env.USE_ISOMORPHIC_GIT === "1" ||
    process.env.USE_ISOMORPHIC_GIT === "true";

  const fallbackIso =
    process.env.GIT_CLONE_FALLBACK_ISOMORPHIC === "1" ||
    process.env.GIT_CLONE_FALLBACK_ISOMORPHIC === "true";

  if (preferIso) {
    await shallowCloneIsomorphic({
      url: authUrl,
      destDir: params.destDir,
      branch: params.branch,
    });
    return;
  }

  try {
    await execFileAsync(
      "git",
      [
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--branch",
        params.branch ?? "main",
        authUrl,
        params.destDir,
      ],
      { maxBuffer: 10 * 1024 * 1024 }
    );
  } catch (e) {
    if (!fallbackIso) throw e;
    await shallowCloneIsomorphic({
      url: authUrl,
      destDir: params.destDir,
      branch: params.branch,
    });
  }
}

/** @deprecated Use cloneHostedGitRepo */
export async function clonePublicGithubRepo(params: {
  repoUrl: string;
  destDir: string;
  branch?: string;
  githubToken?: string;
}): Promise<void> {
  await cloneHostedGitRepo({
    repoUrl: params.repoUrl,
    destDir: params.destDir,
    branch: params.branch,
    token: params.githubToken,
  });
}
