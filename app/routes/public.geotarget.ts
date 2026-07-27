import type { LoaderFunctionArgs } from "react-router";
import { unauthenticated } from "../shopify.server";
import { parseBannerConfig, parseProductRules, TEMPLATE_STYLE_MAP } from "../lib/geo-target";

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const requestUrl = new URL(request.url);
  const shop = requestUrl.searchParams.get("shop");
  const country = (requestUrl.searchParams.get("country") ?? "").toUpperCase();

  if (!shop) {
    return Response.json({ error: "Missing required 'shop' query parameter." }, { status: 400, headers: JSON_HEADERS });
  }

  const { admin } = await unauthenticated.admin(shop);

  const response = await admin.graphql(`#graphql
    query GeoTargetStorefrontConfig {
      shop {
        bannerConfig: metafield(namespace: "geo_target_pro", key: "banner_config") {
          value
        }
        countryRules: metafield(namespace: "geo_target_pro", key: "country_product_rules") {
          value
        }
      }
    }
  `);

  const json = await response.json();
  const bannerConfig = parseBannerConfig(json.data?.shop?.bannerConfig?.value ?? null);
  const productRules = parseProductRules(json.data?.shop?.countryRules?.value ?? null);

  const hiddenProductIds = Array.isArray(productRules[country]) ? productRules[country] : [];

  let hiddenProductHandles: string[] = [];
  if (hiddenProductIds.length > 0) {
    const productResponse = await admin.graphql(
      `#graphql
      query HiddenProductHandles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            handle
          }
        }
      }
      `,
      { variables: { ids: hiddenProductIds } },
    );

    const productJson = await productResponse.json();
    hiddenProductHandles = (productJson.data?.nodes ?? [])
      .map((node: { handle?: string | null }) => node?.handle)
      .filter((handle: string | undefined | null): handle is string => Boolean(handle));
  }

  const templateStyle =
    TEMPLATE_STYLE_MAP[bannerConfig.selectedTemplateId as keyof typeof TEMPLATE_STYLE_MAP] ?? TEMPLATE_STYLE_MAP["hero-maroon"];

  return Response.json(
    {
      shop,
      country,
      banner: {
        ...bannerConfig,
        style: templateStyle,
      },
      hiddenProducts: {
        ids: hiddenProductIds,
        handles: hiddenProductHandles,
      },
    },
    { headers: JSON_HEADERS },
  );
};