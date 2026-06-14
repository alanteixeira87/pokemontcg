const fallbackCardImage = "https://images.pokemontcg.io/base1/4.png";

export function cardThumbnailUrl(url?: string | null): string {
  if (!url) return fallbackCardImage;
  if (url.endsWith("/high.png")) return url.replace("/high.png", "/low.png");
  if (url.includes("_hires.")) return url.replace("_hires.", ".");
  if (url.includes("/large/")) return url.replace("/large/", "/small/");
  if (url.includes("_large.")) return url.replace("_large.", "_small.");
  return url;
}

export function cardFullImageUrl(url?: string | null): string {
  if (!url) return fallbackCardImage;
  if (url.endsWith("/low.png")) return url.replace("/low.png", "/high.png");
  if (/\/[^/]+\.png$/i.test(url) && url.includes("images.pokemontcg.io") && !url.includes("_hires.")) {
    return url.replace(/\.png$/i, "_hires.png");
  }
  if (url.includes("/small/")) return url.replace("/small/", "/large/");
  if (url.includes("_small.")) return url.replace("_small.", "_large.");
  return url;
}

export function handleCardImageError(image: HTMLImageElement) {
  if (image.src !== fallbackCardImage) image.src = fallbackCardImage;
}
