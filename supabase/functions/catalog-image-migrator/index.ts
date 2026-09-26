import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
if (!SUPABASE_URL) throw new Error("SUPABASE_URL is missing");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REPO = "sotonnasa-glitch/Azim-abzar";
const GITHUB_API_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "Azim-Abzar-catalog-image-migrator/2.0",
});

const tokenCache = new Map<string, number>();
const TOKEN_TTL_MS = 5 * 60 * 1000;

async function githubTokenCanWriteRepo(token: string): Promise<boolean> {
  const cachedUntil = tokenCache.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;
  if (!token || token.length < 20) return false;

  const headers = GITHUB_API_HEADERS(token);

  // GitHub Actions GITHUB_TOKEN is an installation token.
  const installationResponse = await fetch(
    "https://api.github.com/installation/repositories?per_page=100",
    { headers },
  );
  if (installationResponse.ok) {
    const data = await installationResponse.json();
    const repository = Array.isArray(data.repositories)
      ? data.repositories.find((r: { full_name?: string }) => r.full_name === REPO)
      : null;
    if (repository) {
      tokenCache.set(token, Date.now() + TOKEN_TTL_MS);
      return true;
    }
    return false;
  }

  // Personal/fine-grained token fallback: verify the authenticated user is
  // actually a collaborator with write-level permission on this repository.
  const userResponse = await fetch("https://api.github.com/user", { headers });
  if (!userResponse.ok) return false;
  const user = await userResponse.json();
  if (!user?.login) return false;

  const permissionResponse = await fetch(
    `https://api.github.com/repos/${REPO}/collaborators/${encodeURIComponent(user.login)}/permission`,
    { headers },
  );
  if (!permissionResponse.ok) return false;

  const permission = await permissionResponse.json();
  const allowed = ["admin", "maintain", "push"].includes(String(permission?.permission || ""));
  if (allowed) tokenCache.set(token, Date.now() + TOKEN_TTL_MS);
  return allowed;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 &&
    bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);

    if (url.searchParams.get("action") === "health") {
      return Response.json({
        ok: true,
        version: 14,
        processor: "GitHub runner Pillow upscale + sharpen",
      });
    }

    if (req.method !== "POST" || url.searchParams.get("action") !== "upload") {
      return new Response("Use POST action=upload", { status: 400 });
    }

    const githubToken = req.headers.get("x-github-token")?.trim() || "";
    const authorized = await githubTokenCanWriteRepo(githubToken);
    if (!authorized) {
      return Response.json({ error: "GitHub repository authorization failed" }, { status: 403 });
    }

    const imageId = req.headers.get("x-image-id")?.trim().toUpperCase() || "";
    if (!/^P\d{4}$/.test(imageId)) {
      return new Response("Invalid image id", { status: 400 });
    }

    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      return new Response("Image is too large", { status: 413 });
    }

    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length < 100) {
      return new Response("Image body is empty", { status: 400 });
    }
    if (bytes.length > MAX_IMAGE_BYTES) {
      return new Response("Image is too large", { status: 413 });
    }
    if (!isJpeg(bytes)) {
      return new Response("Only valid JPEG images are accepted", { status: 415 });
    }

    const { error } = await supabase.storage
      .from("catalog-images")
      .upload(`${imageId}.jpg`, bytes, {
        contentType: "image/jpeg",
        cacheControl: "31536000",
        upsert: true,
      });

    if (error) throw new Error(error.message);
    return Response.json({ ok: true, id: imageId, bytes: bytes.length });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
