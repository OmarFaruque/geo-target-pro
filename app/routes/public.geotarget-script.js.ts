import type { LoaderFunctionArgs } from "react-router";

const SCRIPT_HEADERS = {
  "Content-Type": "application/javascript; charset=utf-8",
  "Cache-Control": "no-store",
  "Access-Control-Allow-Origin": "*",
};

function buildScript(requestUrl: URL) {
  const appOrigin = requestUrl.origin;

  return `(() => {
  const currentScript = document.currentScript;
  if (!currentScript) return;

  const scriptUrl = new URL(currentScript.src);
  const shop = scriptUrl.searchParams.get("shop") || window.Shopify?.shop;
  if (!shop) return;

  const country = (window.Shopify?.country || (window.Shopify?.locale || "").split("-")[1] || "").toUpperCase();
  const endpoint = new URL("${appOrigin}/public/geotarget", window.location.origin);
  endpoint.searchParams.set("shop", shop);
  if (country) endpoint.searchParams.set("country", country);

  fetch(endpoint.toString(), { credentials: "omit" })
    .then((response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (!payload) return;

      const announcements = payload.banner?.announcements || [];
      const style = payload.banner?.style || {};
      const positions = payload.banner?.positions || [];

      if (announcements.length > 0 && positions.includes("top-page")) {
        const host = document.createElement("div");
        host.id = "geo-target-pro-banner";
        host.style.cssText = "position:relative;display:flex;align-items:center;justify-content:center;gap:12px;padding:10px 16px;z-index:9998;" +
          "background:" + (style.background || "#111") + ";color:" + (style.textColor || "#fff") + ";font-family:" + (style.fontFamily || "inherit") + ";";

        const message = document.createElement("span");
        message.style.fontSize = "14px";
        message.style.fontWeight = "600";

        const cta = document.createElement("a");
        cta.style.cssText = "padding:6px 12px;border-radius:999px;text-decoration:none;font-size:12px;font-weight:700;" +
          "background:" + (style.ctaBg || "#fff") + ";color:" + (style.ctaText || "#111") + ";";

        const applySlide = (index) => {
          const slide = announcements[index % announcements.length];
          const icon = style.icon || "";
          message.textContent = (icon ? icon + " " : "") + (slide?.message || "");
          cta.textContent = slide?.ctaText || "Shop now";
          cta.href = slide?.ctaUrl || "/collections/all";
        };

        applySlide(0);
        host.appendChild(message);
        host.appendChild(cta);
        document.body.insertBefore(host, document.body.firstChild);

        if (style.hideOnScroll) {
          let lastScrollY = window.scrollY;
          const handleScroll = () => {
            const currentScrollY = window.scrollY;
            host.style.display = currentScrollY > lastScrollY ? "none" : "flex";
            lastScrollY = currentScrollY;
          };
          window.addEventListener("scroll", handleScroll, { passive: true });
        }

        if (announcements.length > 1) {
          let active = 0;
          const intervalMs = Math.max(1000, Number(payload.banner?.autoRotateMs || 4500));
          window.setInterval(() => {
            active += 1;
            applySlide(active);
          }, intervalMs);
        }
      }

      const hiddenHandles = payload.hiddenProducts?.handles || [];
      if (hiddenHandles.length === 0) return;

      const selectors = hiddenHandles.map((handle) => 'a[href*="/products/' + handle + '"]').join(',');
      if (!selectors) return;

      const hideProducts = () => {
        document.querySelectorAll(selectors).forEach((anchor) => {
          const card = anchor.closest([
            'li',
            'article',
            '.product-card',
            '.ProductCard',
            '.card-wrapper',
            '.grid__item',
            '.product-item',
            '.product',
            '[data-product-handle]'
          ].join(','));

          const hideNode = (node) => {
            if (!node) return;
            node.style.display = 'none';
            node.style.visibility = 'hidden';
            node.setAttribute('aria-hidden', 'true');
          };

          if (card) {
            hideNode(card);
            card.querySelectorAll('img,picture,figure,video,a').forEach(hideNode);
            return;
          }

          hideNode(anchor);
          anchor.closest('img,picture,figure,video') && hideNode(anchor.closest('img,picture,figure,video'));
        });
      };

      hideProducts();
      const observer = new MutationObserver(hideProducts);
      observer.observe(document.body, { childList: true, subtree: true });
    })
    .catch(() => undefined);
})();`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response(buildScript(new URL(request.url)), {
    headers: SCRIPT_HEADERS,
  });
};