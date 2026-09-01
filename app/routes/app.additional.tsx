import { useEffect, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import {
  DEFAULT_BANNER_CONFIG,
  parseBannerConfig,
  parseProductRules,
  type ProductOption,
  type ProductRules,
} from "../lib/geo-target";
import styles from "../styles/geotarget.module.css";

const COUNTRY_OPTIONS = [
  { code: "BD", name: "Bangladesh" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IN", name: "India" },
  { code: "JP", name: "Japan" },
  { code: "SG", name: "Singapore" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "SE", name: "Sweden" },
  { code: "BR", name: "Brazil" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "PK", name: "Pakistan" },
  { code: "MY", name: "Malaysia" },
  { code: "ID", name: "Indonesia" },
];

const COUNTRY_LOOKUP = Object.fromEntries(COUNTRY_OPTIONS.map((country) => [country.code, country.name]));

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`#graphql
    query GeoTargetProductSettings {
      shop {
        id
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

  return {
    products: (responseJson.data?.products?.nodes ?? []) as ProductOption[],
    productRules: parseProductRules(shop?.countryRules?.value ?? null),
    bannerConfig: parseBannerConfig(shop?.bannerConfig?.value ?? null) ?? DEFAULT_BANNER_CONFIG,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const rulesPayload = String(formData.get("rules") ?? "{}");

  let parsedRules: ProductRules;

  try {
    parsedRules = JSON.parse(rulesPayload);
  } catch {
    return { ok: false, error: "Invalid product rules format." };
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
    mutation SaveProductRules($metafields: [MetafieldsSetInput!]!) {
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

export default function AdditionalPage() {
  const { products, productRules } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [countryRules, setCountryRules] = useState<ProductRules>(productRules);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");

  useEffect(() => {
    setCountryRules(productRules);
  }, [productRules]);

  const countryEntries = useMemo(
    () =>
      Object.entries(countryRules)
        .map(([code, productIds]) => ({
          code,
          name: COUNTRY_LOOKUP[code] ?? code,
          productIds: Array.isArray(productIds) ? productIds : [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [countryRules],
  );

  const availableCountries = useMemo(
    () => COUNTRY_OPTIONS.filter((country) => !countryRules[country.code]),
    [countryRules],
  );

  const submitRules = (nextRules: ProductRules) => {
    setCountryRules(nextRules);
    fetcher.submit({ rules: JSON.stringify(nextRules) }, { method: "POST" });
  };

  const updateCountryRule = (countryCode: string, productId: string, checked: boolean) => {
    const nextRules: ProductRules = { ...countryRules };
    const existing = new Set(nextRules[countryCode] ?? []);

    if (checked) {
      existing.add(productId);
    } else {
      existing.delete(productId);
    }

    nextRules[countryCode] = Array.from(existing);
    submitRules(nextRules);
  };

  const addCountry = () => {
    if (!selectedCountryCode) return;
    if (countryRules[selectedCountryCode]) return;

    const nextRules: ProductRules = {
      ...countryRules,
      [selectedCountryCode]: [],
    };

    setSelectedCountryCode("");
    submitRules(nextRules);
  };

  const removeCountry = (countryCode: string) => {
    const nextRules = { ...countryRules };
    delete nextRules[countryCode];
    submitRules(nextRules);
  };

  return (
    <s-page heading="Product Settings">
      <s-section>
        <div className={styles.productSettingsPage}>
          <div className={styles.productSettingsHeader}>
            <div>
              <p className={styles.productEyebrow}>Targeting rules</p>
              <h3>Country product restrictions</h3>
            </div>
            <span className={styles.productSettingsBadge}>{countryEntries.length} countries</span>
          </div>

          <div className={styles.addCountryPanel}>
            <label className={styles.fieldLabel} htmlFor="country-select">
              Add a country
            </label>
            <div className={styles.addCountryRow}>
              <select
                id="country-select"
                value={selectedCountryCode}
                onChange={(event) => setSelectedCountryCode(event.target.value)}
                className={styles.countrySelect}
              >
                <option value="">Select a country</option>
                {availableCountries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name} ({country.code})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={styles.primaryAction}
                onClick={addCountry}
                disabled={!selectedCountryCode}
              >
                Add country
              </button>
            </div>
          </div>

          <div className={styles.countryGrid}>
            {countryEntries.length === 0 ? (
              <div className={styles.emptyState}>
                No countries added yet. Pick a country from the dropdown to start managing disabled products.
              </div>
            ) : (
              countryEntries.map((country) => (
                <div key={country.code} className={styles.countryCard}>
                  <div className={styles.countryHeader}>
                    <div className={styles.countryTitleWrap}>
                      <span className={styles.countryCode}>{country.code}</span>
                      <h4>{country.name}</h4>
                    </div>
                    <button
                      type="button"
                      className={styles.removeCountryButton}
                      onClick={() => removeCountry(country.code)}
                    >
                      Remove
                    </button>
                  </div>

                  <p className={styles.countryMeta}>{country.productIds.length} products disabled</p>

                  <div className={styles.productGrid}>
                    {products.map((product) => {
                      const isChecked = country.productIds.includes(product.id);

                      return (
                        <label key={`${country.code}-${product.id}`} className={styles.productLabel}>
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
                </div>
              ))
            )}
          </div>

          {fetcher.data?.ok && <p className={styles.productSuccess}>Saved successfully.</p>}
          {fetcher.data?.error && <p className={styles.productError}>{fetcher.data.error}</p>}
        </div>
      </s-section>
    </s-page>
  );
}
