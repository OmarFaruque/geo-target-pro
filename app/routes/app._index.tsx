import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/geotarget.module.css";
import {
  type BannerConfig,
  DEFAULT_BANNER_CONFIG,
  parseBannerConfig,
  parseProductRules,
  type ProductOption,
  type ProductRules,
} from "../lib/geo-target";

type FlowTabId = "placement" | "content" | "design";

const FLOW_TABS: Array<{ id: FlowTabId; title: string; subtitle: string }> = [
  { id: "placement", title: "Placement", subtitle: "Collections" },
  { id: "content", title: "Content", subtitle: "Selecting" },
  { id: "design", title: "Design", subtitle: "Customize style" },
];

const TEMPLATES = [
  {
    id: "hero-maroon",
    name: "Hero Maroon",
    background: "linear-gradient(90deg, #350000 0%, #4d0101 100%)",
    textColor: "#ffffff",
    ctaBg: "#f96565",
    ctaText: "#ffffff",
  },
  {
    id: "sunrise",
    name: "Sunrise",
    background: "linear-gradient(90deg, #ea6058 0%, #ff8b00 100%)",
    textColor: "#ffffff",
    ctaBg: "#121212",
    ctaText: "#ffffff",
  },
  {
    id: "platinum",
    name: "Platinum",
    background: "linear-gradient(90deg, #f7f7f7 0%, #ececec 100%)",
    textColor: "#232323",
    ctaBg: "#232323",
    ctaText: "#ffffff",
  },
  {
    id: "ocean-blue",
    name: "Ocean Blue",
    background: "linear-gradient(90deg, #0b3a61 0%, #1169b1 100%)",
    textColor: "#ffffff",
    ctaBg: "#ffffff",
    ctaText: "#0b3a61",
  },
  {
    id: "violet-night",
    name: "Violet Night",
    background: "linear-gradient(90deg, #2d0d46 0%, #5e1f89 100%)",
    textColor: "#ffffff",
    ctaBg: "#f2b8ff",
    ctaText: "#2d0d46",
  },
  {
    id: "mint-fresh",
    name: "Mint Fresh",
    background: "linear-gradient(90deg, #1f5f4f 0%, #2d8f77 100%)",
    textColor: "#ffffff",
    ctaBg: "#d5fff5",
    ctaText: "#1f5f4f",
  },
  {
    id: "amber",
    name: "Amber",
    background: "linear-gradient(90deg, #7a4b00 0%, #c27600 100%)",
    textColor: "#fff4e5",
    ctaBg: "#fff4e5",
    ctaText: "#7a4b00",
  },
  {
    id: "charcoal",
    name: "Charcoal",
    background: "linear-gradient(90deg, #2b2b2b 0%, #3d3d3d 100%)",
    textColor: "#ffffff",
    ctaBg: "#ff3f8e",
    ctaText: "#ffffff",
  },
];




export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query GeoTargetDashboard {
      shop {
        id
        name
        primaryDomain {
          url
        }
        bannerConfig: metafield(namespace: "geo_target_pro", key: "banner_config") {
          value
        }
        countryRules: metafield(namespace: "geo_target_pro", key: "country_product_rules") {
          value
        }
      }
      products(first: 50) {
        nodes {
          id
          title
        }
      }
    }
  `);

    const responseJson = await response.json();
    const shop = responseJson.data?.shop;


    const bannerConfig = parseBannerConfig(shop?.bannerConfig?.value ?? null);
    const productRules = parseProductRules(shop?.countryRules?.value ?? null);

    return {
      shopName: shop?.name ?? "Store",
      storefrontUrl: shop?.primaryDomain?.url ?? "",
      products: (responseJson.data?.products?.nodes ?? []) as ProductOption[],
      bannerConfig,
      productRules,
    };
  };

  export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const configPayload = String(formData.get("config") ?? "{}");
  const rulesPayload = String(formData.get("rules") ?? "{}");

  let parsedConfig: BannerConfig;
  let parsedRules: ProductRules;

  try {
    parsedConfig = JSON.parse(configPayload);
    parsedRules = JSON.parse(rulesPayload);
  } catch {
    return { ok: false, error: "Invalid payload format." };
  }

  const shopResponse = await admin.graphql(`#graphql
    query ShopId {
      shop {
        id
      }
    }
  `);

  const shopJson = await shopResponse.json();
  const ownerId = shopJson.data?.shop?.id;

  const saveResponse = await admin.graphql(
    `#graphql
    mutation SaveGeoTargetSettings($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
          }
          userErrors {
            field
            message
          }
        }
      }
        `,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: "geo_target_pro",
            key: "banner_config",
            type: "json",
            value: JSON.stringify(parsedConfig),
          },
          {
            ownerId,
            namespace: "geo_target_pro",
            key: "country_product_rules",
            type: "json",
            value: JSON.stringify(parsedRules),
          },
        ],
      },
    },
  );

  const saveJson = await saveResponse.json();
  const userErrors = saveJson.data?.metafieldsSet?.userErrors ?? [];

  if (userErrors.length > 0) {
    return { ok: false, error: userErrors[0].message };
  }

  return { ok: true };
};


export default function Index() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [activeTab, setActiveTab] = useState<FlowTabId>("placement");

  const [config, setConfig] = useState<BannerConfig>(loaderData.bannerConfig ?? DEFAULT_BANNER_CONFIG);
  const [activeSlide, setActiveSlide] = useState(0);

  const selectedTemplate =
    TEMPLATES.find((template) => template.id === config.selectedTemplateId) ??
    TEMPLATES[0];

  const bannerBackground =
    config.bannerStyle.transparent && config.bannerStyle.backgroundColor
      ? `linear-gradient(90deg, ${config.bannerStyle.backgroundColor} ${config.bannerStyle.backgroundOpacity}%, rgba(255,255,255,0.08) 100%)`
      : config.bannerStyle.backgroundGradient || selectedTemplate.background;

  const bannerTextStyle = {
    fontFamily:
      config.bannerStyle.fontFamily === "serif"
        ? "Georgia, serif"
        : config.bannerStyle.fontFamily === "mono"
          ? "'SFMono-Regular', Consolas, monospace"
          : config.bannerStyle.fontFamily === "display"
            ? "'Trebuchet MS', 'Segoe UI', sans-serif"
            : "Inter, Arial, sans-serif",
  };

  useEffect(() => {

     if (config.announcements.length <= 1) return;

    const timer = setInterval(() => {
      setActiveSlide((oldSlide) => (oldSlide + 1) % config.announcements.length);
    }, config.autoRotateMs);

  return () => clearInterval(timer);
  }, [config.autoRotateMs, config.announcements.length]);

  const saveSettings = () => {
    fetcher.submit(
      {
        config: JSON.stringify(config),
        rules: JSON.stringify({}),
      },
      { method: "POST" },
    );
  };

  const toggleFromList = (field: "pageTargets" | "positions", value: string) => {
    setConfig((previous) => {
      const list = new Set(previous[field]);
      if (list.has(value)) {
        list.delete(value);
      } else {
        list.add(value);
      }
      return { ...previous, [field]: Array.from(list) };
    });
  };

  return (
    
    <s-page heading="GeoTarget Promotion Studio">
      <s-section>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Announcement campaign for {loaderData.shopName}</h2>
            <p className={styles.subtitle}> Build rotating banners with template styles and country-based product restrictions.</p>
            <p className={styles.subtitle}>
              Theme integration: Enable <strong>GeoTarget Pro Embed</strong> in Theme Customizer (App embeds).
            </p>
            <p className={styles.subtitle}>
              This app uses Shopify App Proxy at <code>/apps/geotarget-pro</code>; no manual script tag is required.
            </p>
            {loaderData.storefrontUrl && (
              <p className={styles.subtitle}>
                Storefront preview:{" "}
                <a href={loaderData.storefrontUrl} target="_blank" rel="noreferrer">
                  {loaderData.storefrontUrl}
                </a>
              </p>
            )}
          </div>
          <s-button variant="primary" onClick={saveSettings}>
            Save campaign
          </s-button>
        </div>
      </s-section>
      <section className={styles.topTabs}>
        {FLOW_TABS.map((tab, index) => (
          <div key={tab.id} className={styles.tabWrap}>
            <button
              type="button"
              className={`${styles.topTab} ${tab.id === activeTab ? styles.topTabActive : ""}`}
              onClick={() => setActiveTab(tab.id)}
            > <strong>{tab.title}</strong>
              <span>{tab.subtitle}</span>
            </button>
            {index < FLOW_TABS.length - 1 && <span className={styles.tabArrow}>→</span>}
          </div>
        ))}
      </section>

      <div className={styles.layout}>
        <section className={styles.leftPanel}>
          {activeTab === "placement" && (
            <>
              <h3>Announcement Bar Position</h3>
              <div className={styles.card}>
                <h4>Page to display</h4>
                {[
                  ["every-page", "Every page"],
                  ["product-page", "Product page"],
                  ["home-only", "Home page only"],
                  ["collection-page", "Collection page"],
                  ["manual-position", "Manual position"],
                ].map(([value, label]) => (
                  <label key={value} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={config.pageTargets.includes(value)}
                      onChange={() => toggleFromList("pageTargets", value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <div className={styles.card}>
                <h4>Show announcement bar on</h4>
                {[
                  ["top-page", "Top of page"],
                  ["bottom-page", "Bottom of page"],
                  ["above-buy", "Above buy button"],
                  ["below-buy", "Below buy button"],
                  ["sticky", "Sticky on top/bottom"],
                ].map(([value, label]) => (
                  <label key={value} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={config.positions.includes(value)}
                      onChange={() => toggleFromList("positions", value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </>
          )}          

{activeTab === "content" && (
            <>
              <h3>Announcement content</h3>
              <div className={styles.stack}>
                {config.announcements.map((announcement, index) => (
                  <div key={announcement.id} className={styles.card}>
                    <label>
                      Message
                      <input
                        value={announcement.message}
                        onChange={(event) => {
                          const announcements = [...config.announcements];
                          announcements[index] = { ...announcement, message: event.target.value };
                          setConfig((previous) => ({ ...previous, announcements }));
                        }}
                      />
                    </label>
                    <label>
                      CTA text
                      <input
                        value={announcement.ctaText}
                        onChange={(event) => {
                          const announcements = [...config.announcements];
                          announcements[index] = { ...announcement, ctaText: event.target.value };
                          setConfig((previous) => ({ ...previous, announcements }));
                        }}
                      />
                    </label>
                    <label>
                      CTA URL
                      <input
                        value={announcement.ctaUrl}
                        onChange={(event) => {
                          const announcements = [...config.announcements];
                          announcements[index] = { ...announcement, ctaUrl: event.target.value };
                          setConfig((previous) => ({ ...previous, announcements }));
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={config.announcements.length === 1}
                      onClick={() => {
                        setConfig((previous) => ({
                          ...previous,
                          announcements: previous.announcements.filter((item) => item.id !== announcement.id),
                        }));
                      }}
                    >
                      Remove slide
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className={styles.addBtn}
                onClick={() => {
                  setConfig((previous) => ({
                    ...previous,
                    announcements: [
                      ...previous.announcements,
                      {
                        id: crypto.randomUUID(),
                        message: "✨ New promotion message",
                        ctaText: "Explore",
                        ctaUrl: "/collections/all",
                      },
                    ],
                  }));
                }}
              > + Add contents
              </button>
              <label className="mt-10 d-block">
                Scrolling speed (ms)
                <input
                  type="number"
                  min={1000}
                  step={250}
                  value={config.autoRotateMs}
                  onChange={(event) =>
                    setConfig((previous) => ({ ...previous, autoRotateMs: Number(event.target.value) || 4500 }))
                  }
                />
              </label>
            </>
          )}


           {activeTab === "design" && (
            <>
              <h3>Select template</h3>
              <p className={styles.subtitle}>Choose from 8 styles. All template colors and CTA styles are unique.</p>
              <div className={styles.templateGrid}>
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    className={`${styles.templateCard} ${
                      template.id === config.selectedTemplateId ? styles.templateSelected : ""
                    }`}
                    type="button"
                    onClick={() => setConfig((previous) => ({ ...previous, selectedTemplateId: template.id }))}
                  >
                    <span
                      className={styles.templatePreview}
                      style={{ background: template.background, color: template.textColor }}
                    >
                      🔥 20% off all products!
                    </span>
                    <span>{template.name}</span>
                  </button>
                ))}
              </div>

              <div className={styles.card}>
                <h4>Banner styling</h4>
                <label>
                  Icon
                  <select
                    value={config.bannerStyle.icon}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: { ...previous.bannerStyle, icon: event.target.value },
                      }))
                    }
                  >
                    <option value="🔥">Fire</option>
                    <option value="⚡">Flash</option>
                    <option value="🎉">Celebration</option>
                    <option value="🚚">Shipping</option>
                    <option value="💡">Idea</option>
                    <option value="🎁">Gift</option>
                    <option value="🏷️">Offer</option>
                    <option value="✨">Sparkle</option>
                  </select>
                </label>
                <label>
                  Font style
                  <select
                    value={config.bannerStyle.fontFamily}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: {
                          ...previous.bannerStyle,
                          fontFamily: event.target.value as typeof previous.bannerStyle.fontFamily,
                        },
                      }))
                    }
                  >
                    <option value="sans">Sans</option>
                    <option value="serif">Serif</option>
                    <option value="mono">Monospace</option>
                    <option value="display">Display</option>
                  </select>
                </label>
                <label>
                  Background color
                  <input
                    type="color"
                    value={config.bannerStyle.backgroundColor}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: {
                          ...previous.bannerStyle,
                          backgroundColor: event.target.value,
                          backgroundGradient: `linear-gradient(90deg, ${event.target.value} 0%, ${event.target.value} 100%)`,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Gradient
                  <input
                    type="text"
                    value={config.bannerStyle.backgroundGradient}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: { ...previous.bannerStyle, backgroundGradient: event.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Transparency
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={config.bannerStyle.backgroundOpacity}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: {
                          ...previous.bannerStyle,
                          backgroundOpacity: Number(event.target.value),
                          transparent: Number(event.target.value) < 100,
                        },
                      }))
                    }
                  />
                  <span>{config.bannerStyle.backgroundOpacity}%</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={config.bannerStyle.transparent}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: {
                          ...previous.bannerStyle,
                          transparent: event.target.checked,
                          backgroundOpacity: event.target.checked ? 70 : 100,
                        },
                      }))
                    }
                  />
                  <span>Transparent background</span>
                </label>
                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={config.bannerStyle.hideOnScroll}
                    onChange={(event) =>
                      setConfig((previous) => ({
                        ...previous,
                        bannerStyle: { ...previous.bannerStyle, hideOnScroll: event.target.checked },
                      }))
                    }
                  />
                  <span>Hide on scroll</span>
                </label>
              </div>
            </>
          )}
        </section>

        <section className={styles.rightPanel}>
          <h3>Live preview</h3>
          <div className={styles.previewShell}>
            <div
              className={styles.previewBanner}
              style={{
                background: bannerBackground,
                color: selectedTemplate.textColor,
                fontFamily: bannerTextStyle.fontFamily,
              }}
            >
              <button
                type="button"
                className={styles.arrowBtn}
                onClick={() =>
                  setActiveSlide((previous) =>
                    (previous - 1 + config.announcements.length) % config.announcements.length,
                  )
                }
                aria-label="Previous slide"
              >
                ‹
              </button>
              <span className={styles.previewMessage}>
                {config.bannerStyle.icon} {config.announcements[activeSlide]?.message}
              </span>
              <a
                href={config.announcements[activeSlide]?.ctaUrl}
                className={styles.previewCta}
                style={{ background: selectedTemplate.ctaBg, color: selectedTemplate.ctaText }}
              >
                {config.announcements[activeSlide]?.ctaText}
              </a>
              <button
                type="button"
                className={styles.arrowBtn}
                onClick={() => setActiveSlide((previous) => (previous + 1) % config.announcements.length)}
                aria-label="Next slide"
              >
                ›
              </button>
            </div>
          </div>

          <div className={styles.previewCard}>
            <h4>Promotion card preview</h4>
            <p className={styles.subtitle}>Use this area for trusted badges, bundles, or coupon blocks below the main bar.</p>
            <div className={styles.promoMock}>
              <div>
                <strong>Standard price</strong>
                <p>$35.00 → $32.99</p>
              </div>
              <div>
                <strong>Save 10%</strong>
                <p>$70.00 → $59.38</p>
              </div>
            </div>
          </div>

          {fetcher.data?.ok && <p className={styles.success}>Saved successfully.</p>}
          {fetcher.data?.error && <p className={styles.error}>{fetcher.data.error}</p>}
        </section>
      </div>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
