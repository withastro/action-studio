import { exec } from '@actions/exec';

export const setupUser = async () => {
  await exec("git", [
    "config",
    "--global",
    "user.name",
    `"astro-studio-beta[bot]"`,
  ]);
  await exec("git", [
    "config",
    "--global",
    "user.email",
    `"astro-studio-beta[bot]@users.noreply.github.com"`,
  ]);
};
