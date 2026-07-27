export type ProductOption = {
  id: string;
  title: string;
};

export type AnnouncementItem = {
  id: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
};

export type BannerConfig = {
  selectedTemplateId: string;
  autoRotateMs: number;
  announcements: AnnouncementItem[];
  pageTargets: string[];
  positions: string[];
};

export type ProductRules = Record<string, string[]>;

export const TEMPLATE_STYLE_MAP = {
  "hero-maroon": {
    background: "linear-gradient(90deg, #350000 0%, #4d0101 100%)",
    textColor: "#ffffff",
    ctaBg: "#f96565",
    ctaText: "#ffffff",
  },
  sunrise: {
    background: "linear-gradient(90deg, #ea6058 0%, #ff8b00 100%)",
    textColor: "#ffffff",
    ctaBg: "#121212",
    ctaText: "#ffffff",
  },
  platinum: {
    background: "linear-gradient(90deg, #f7f7f7 0%, #ececec 100%)",
    textColor: "#232323",
    ctaBg: "#232323",
    ctaText: "#ffffff",
  },
  "ocean-blue": {
    background: "linear-gradient(90deg, #0b3a61 0%, #1169b1 100%)",
    textColor: "#ffffff",
    ctaBg: "#ffffff",
    ctaText: "#0b3a61",
  },
  "violet-night": {
    background: "linear-gradient(90deg, #2d0d46 0%, #5e1f89 100%)",
    textColor: "#ffffff",
    ctaBg: "#f2b8ff",
    ctaText: "#2d0d46",
  },
  "mint-fresh": {
    background: "linear-gradient(90deg, #1f5f4f 0%, #2d8f77 100%)",
    textColor: "#ffffff",
    ctaBg: "#d5fff5",
    ctaText: "#1f5f4f",
  },
  amber: {
    background: "linear-gradient(90deg, #7a4b00 0%, #c27600 100%)",
    textColor: "#fff4e5",
    ctaBg: "#fff4e5",
    ctaText: "#7a4b00",
  },
  charcoal: {
    background: "linear-gradient(90deg, #2b2b2b 0%, #3d3d3d 100%)",
    textColor: "#ffffff",
    ctaBg: "#ff3f8e",
    ctaText: "#ffffff",
  },
} as const;

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  selectedTemplateId: "hero-maroon",
  autoRotateMs: 4500,
  announcements: [
    {
      id: "default-1",
      message: "🔥 20% off all products!",
      ctaText: "Shop now!",
      ctaUrl: "/collections/all",
    },
    {
      id: "default-2",
      message: "🚚 Free shipping over $50",
      ctaText: "Buy now!",
      ctaUrl: "/collections/all",
    },
  ],
  pageTargets: ["every-page"],
  positions: ["top-page"],
};

export function parseBannerConfig(value: string | undefined | null): BannerConfig {
  if (!value) {
    return DEFAULT_BANNER_CONFIG;
  }

  try {
    const parsed = JSON.parse(value);
    return {
      ...DEFAULT_BANNER_CONFIG,
      ...parsed,
      announcements: Array.isArray(parsed.announcements)
        ? parsed.announcements
        : DEFAULT_BANNER_CONFIG.announcements,
      pageTargets: Array.isArray(parsed.pageTargets) ? parsed.pageTargets : DEFAULT_BANNER_CONFIG.pageTargets,
      positions: Array.isArray(parsed.positions) ? parsed.positions : DEFAULT_BANNER_CONFIG.positions,
    };
  } catch {
    return DEFAULT_BANNER_CONFIG;
  }
}

export function parseProductRules(value: string | undefined | null): ProductRules {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as ProductRules;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}