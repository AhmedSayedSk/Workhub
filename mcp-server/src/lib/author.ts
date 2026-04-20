/**
 * Resolves the author identity used when this MCP posts comments.
 *
 * Reads WORKHUB_MCP_AUTHOR_NAME / WORKHUB_MCP_AUTHOR_ID from the environment
 * so the display name in the WorkHub UI isn't hardcoded. Falls back to a
 * neutral "WorkHub Agent" identity so we never leak a runtime-specific label
 * like "Claude Code" into user-facing comments.
 */
export function getAuthor(): { authorId: string; authorName: string } {
  const envName = process.env.WORKHUB_MCP_AUTHOR_NAME?.trim();
  const envId = process.env.WORKHUB_MCP_AUTHOR_ID?.trim();

  const authorName = envName && envName.length > 0 ? envName : 'WorkHub Agent';
  // Derive a stable id from the name when none is provided.
  const authorId =
    envId && envId.length > 0
      ? envId
      : authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workhub-agent';

  return { authorId, authorName };
}
