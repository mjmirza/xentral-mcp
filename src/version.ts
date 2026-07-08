/**
 * Single source of truth for the package version, shared by the stdio bin and
 * the hosted worker so the two never drift. Bump this together with the version
 * field in package.json on a release.
 */
export const VERSION = "0.1.3";
