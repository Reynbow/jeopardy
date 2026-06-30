"use client";

import { useEffect } from "react";
import { upload } from "@vercel/blob/client";

// Exposes the Vercel Blob client `upload` to the vanilla settings script so
// files upload directly from the browser to Blob (bypassing the serverless
// request body limit). settings.js calls window.__blobUpload(...) on demand.
export function BlobUpload() {
  useEffect(() => {
    (window as unknown as { __blobUpload?: typeof upload }).__blobUpload =
      upload;
  }, []);
  return null;
}
