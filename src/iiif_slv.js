// src/iiif/slv.js

/**
 * Resolve an SLV IE number to an IIIF Image API URL.
 * This follows SLV's documented pattern:
 * - Manifest: https://rosetta.slv.vic.gov.au/delivery/iiif/presentation/2.1/{IE}/manifest
 * - Image service @id appears in manifest under canvas.images[0].resource.service["@id"]
 * - Image URL: {serviceId}/full/max/0/default.jpg
 */
export async function getSlvIiifImageUrl(ieNumber, {
  canvasIndex = 0,
  size = "max",          // or e.g. "pct:25" or "!2000,2000"
  region = "full",
  rotation = "0",
  quality = "default",   // or "gray"
  format = "jpg",
} = {}) {
  const manifestUrl =
    `https://rosetta.slv.vic.gov.au/delivery/iiif/presentation/2.1/${encodeURIComponent(ieNumber)}/manifest`;

  const resp = await fetch(manifestUrl, { mode: "cors" });
  if (!resp.ok) throw new Error(`Manifest fetch failed (${resp.status}): ${manifestUrl}`);
  const manifest = await resp.json();

  // IIIF Presentation 2.1 structure (as used by SLV in their guide)
  const canvases = manifest?.sequences?.[0]?.canvases;
  if (!Array.isArray(canvases) || canvases.length === 0) {
    throw new Error("No canvases found in manifest (unexpected manifest structure).");
  }

  const canvas = canvases[Math.min(canvasIndex, canvases.length - 1)];
  const serviceId = canvas?.images?.[0]?.resource?.service?.["@id"];
  if (!serviceId) {
    throw new Error("No IIIF image service @id found in manifest canvas.");
  }

  // Build IIIF Image API URL (SLV examples use /full/max/0/default.jpg)
  return `${serviceId}/${region}/${size}/${rotation}/${quality}.${format}`;
}
