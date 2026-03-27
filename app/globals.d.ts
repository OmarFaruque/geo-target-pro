declare module "*.css";
declare module "*.module.css";

declare namespace JSX {
  interface IntrinsicElements {
    "s-app-nav": Record<string, unknown>;
  }
}
