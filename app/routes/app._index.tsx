import { useEffect, useMemo, useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import styles from "../styles/geotarget.module.css";

type ProductOption = {
  id: string;
  title: string;
};
type AnnouncementItem = {
  id: string;
  message: string;
  ctaText: string;
  ctaUrl: string;
};



type BannerConfig = {
  selectedTemplateId: string;
  autoRotateMs: number;
  announcements: AnnouncementItem[];
};

type ProductRules = Record<string, string[]>;

const COUNTRY_OPTIONS = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
];

const TEMPLATES = [
  {
    id: "dark-sale",
    name: "Dark sale",
    background: "linear-gradient(90deg, #2f0505 0%, #4a0707 100%)",
    textColor: "#ffffff",
    ctaBg: "#f16363",
    ctaText: "#ffffff",
  },
  {
    id: "sunset",
    name: "Sunset",
    background: "linear-gradient(90deg, #e85c5c 0%, #ff8a00 100%)",
    textColor: "#ffffff",
    ctaBg: "#111111",
    ctaText: "#ffffff",
  },
  {
    id: "night",
    name: "Night",
    background: "#220000",
    textColor: "#ffffff",
    ctaBg: "#ffffff",
    ctaText: "#220000",
  },
  {
    id: "minimal",
    name: "Minimal",
    background: "#f4f4f4",
    textColor: "#1f1f1f",
    ctaBg: "#1f1f1f",
    ctaText: "#ffffff",
  },
];


const DEFAULT_CONFIG: BannerConfig = {
  selectedTemplateId: TEMPLATES[0].id,
  autoRotateMs: 4500,
  announcements: [
    {id: crypto.randomUUID(),
      message: "🔥 20% off all products!",
      ctaText: "Shop now!",
      ctaUrl: "/collections/all",
    },
    {
      id: crypto.randomUUID(),
      message: "🚚 Free shipping over $50",
      ctaText: "Buy now!",
      ctaUrl: "/collections/all",
    },
  ],
};



export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query GeoTargetDashboard {
      shop {
        id
        name
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

    let bannerConfig = DEFAULT_CONFIG;
    let productRules: ProductRules = {};

    try {
      if (shop?.bannerConfig?.value) {
        bannerConfig = JSON.parse(shop.bannerConfig.value);
      }
    } catch {
      bannerConfig = DEFAULT_CONFIG;
    }

    try {
      if (shop?.countryRules?.value) {
        productRules = JSON.parse(shop.countryRules.value);
      }
    } catch {
      productRules = {};
    }

    return {
      shopName: shop?.name ?? "Store",
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

  const [config, setConfig] = useState<BannerConfig>(loaderData.bannerConfig);
  const [rules, setRules] = useState<ProductRules>(loaderData.productRules);
  const [activeSlide, setActiveSlide] = useState(0);

  const selectedTemplate =
    TEMPLATES.find((template) => template.id === config.selectedTemplateId) ??
    TEMPLATES[0];

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
        rules: JSON.stringify(rules),
      },
      { method: "POST" },
    );
  };

  const sortedCountriesWithRules = useMemo(() => {
    return COUNTRY_OPTIONS.map((country) => ({
      ...country,
      productIds: rules[country.code] ?? [],
    }));
  }, [rules]);

  const updateCountryRule = (countryCode: string, productId: string, checked: boolean) => {
    setRules((previous) => {
      const existing = new Set(previous[countryCode] ?? []);
      if (checked) {
        existing.add(productId);
      } else {
        existing.delete(productId);
      }

      return {
        ...previous,
        [countryCode]: Array.from(existing),
      };
    });
  };

  return (
    

    <s-page heading="GeoTarget Promotion Studio">
      <s-section>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.title}>Announcement campaign for {loaderData.shopName}</h2>
            <p className={styles.subtitle}>
              Build rotating banners with template styles and country-based product restrictions.
            </p>
          </div>
          <s-button variant="primary" onClick={saveSettings}>
            Save campaign
          </s-button>
        </div>
      </s-section>

      <div className={styles.layout}>
        <section className={styles.panel}>
          <h3>Flow</h3>
          <div className={styles.steps}>
            <span className={`${styles.step} ${styles.activeStep}`}>1. Placement</span>
            <span className={styles.step}>2. Content</span>
            <span className={styles.step}>3. Design</span>
          </div>

          <h3>Choose template</h3>
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
                  style={{
                    background: template.background,
                    color: template.textColor,
                  }}
                >
                  🔥 20% off all products!
                </span>
                <span>{template.name}</span>
              </button>
            ))}
          </div>

          <h3>Banner slider content</h3>
          <div className={styles.stack}>
            {config.announcements.map((announcement, index) => (
              <div key={announcement.id} className={styles.card}>
                <label>
                  Message
                  <input
                    value={announcement.message}
                    onChange={(event) => {
                      const announcements = [...config.announcements];
                      announcements[index] = {
                        ...announcement,
                        message: event.target.value,
                      };
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
                      announcements[index] = {
                        ...announcement,
                        ctaText: event.target.value,
                      };
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
                      announcements[index] = {
                        ...announcement,
                        ctaUrl: event.target.value,
                      };
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
                  Remove
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
          > + Add slide
          </button>

       <label>
            Auto-rotate (milliseconds)
            <input
              type="number"
              min={1000}
              step={250}
              value={config.autoRotateMs}
              onChange={(event) =>
                setConfig((previous) => ({
                  ...previous,
                  autoRotateMs: Number(event.target.value) || 4500,
                }))
              }
            />
          </label>
        </section>

        <section className={styles.panel}>
          <h3>Live preview</h3>
          <div
            className={styles.previewBanner}
            style={{
              background: selectedTemplate.background,
              color: selectedTemplate.textColor,
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
              {config.announcements[activeSlide]?.message}
            </span>
            <a
              href={config.announcements[activeSlide]?.ctaUrl}
              className={styles.previewCta}
              style={{
                background: selectedTemplate.ctaBg,
                color: selectedTemplate.ctaText,
              }}
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

          <h3>Disable products by country</h3>
          <p className={styles.subtitle}>When a shopper is in a selected country, checked products are hidden.</p>
          <div className={styles.countryRules}>
            {sortedCountriesWithRules.map((country) => (
              <details className={styles.countryCard} key={country.code}>
                <summary>
                  {country.name} ({country.code}) — {country.productIds.length} disabled
                </summary>
                <div className={styles.productList}>
                  {loaderData.products.map((product) => {
                    const isChecked = country.productIds.includes(product.id);
                    return (
                      <label key={`${country.code}-${product.id}`} className={styles.checkboxRow}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(event) =>
                            updateCountryRule(country.code, product.id, event.currentTarget.checked)
                          }
                        />
                        <span>{product.title}</span>
                      </label>
                    );
                  })}
                </div>
              </details>
            ))}
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
