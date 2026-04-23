/**
 * G2A Growth Engine – Social Media Publisher
 * LinkedIn UGC Posts API integráció (CODEX.md 10.2 alapján)
 */

export async function publishToLinkedIn(
  accessToken: string,
  authorId: string,
  text: string,
  imageUrl?: string
): Promise<{ postId: string }> {
  const body = {
    author: `urn:li:person:${authorId}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: imageUrl ? "IMAGE" : "NONE",
        ...(imageUrl && {
          media: [
            {
              status: "READY",
              originalUrl: imageUrl,
            },
          ],
        }),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LinkedIn API error: ${response.status} – ${errText}`);
  }

  const data = await response.json() as { id: string };
  return { postId: data.id };
}
