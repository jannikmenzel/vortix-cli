import type { CheckDefinition } from "@core/types.js";
import axe from "./accessibility/axe.js";
import colorContrast from "./accessibility/color-contrast.js";
import anchorLinks from "./bugs/anchor-links.js";
import brokenLinks from "./bugs/broken-links.js";
import consoleErrors from "./bugs/console-errors.js";
import nestedBlockElements from "./bugs/nested-block-elements.js";
import viewportMeta from "./bugs/viewport-meta.js";
import deadCss from "./maintainability/dead-css.js";
import duplication from "./maintainability/duplication.js";
import licenseCheck from "./maintainability/license-check.js";
import outdatedDependencies from "./maintainability/outdated-dependencies.js";
import assetWeight from "./performance/asset-weight.js";
import coreWebVitals from "./performance/core-web-vitals.js";
import imageFormat from "./performance/image-format.js";
import lazyLoading from "./performance/lazy-loading.js";
import thirdPartyImpact from "./performance/third-party-impact.js";
import externalFonts from "./privacy/external-fonts.js";
import fingerprinting from "./privacy/fingerprinting.js";
import trackerRequests from "./privacy/tracker-requests.js";
import cookieSecurity from "./security/cookie-security.js";
import dependencyVulnerabilities from "./security/dependency-vulnerabilities.js";
import httpsEnforced from "./security/https-enforced.js";
import mixedContent from "./security/mixed-content.js";
import securityHeaders from "./security/security-headers.js";
import serverInfoDisclosure from "./security/server-info-disclosure.js";
import canonicalUrl from "./seo/canonical-url.js";
import metaTags from "./seo/meta-tags.js";
import ogImages from "./seo/og-images.js";
import robotsSitemap from "./seo/robots-sitemap.js";
import structuredData from "./seo/structured-data.js";

export const BUILT_IN_CHECKS: CheckDefinition[] = [
  coreWebVitals,
  assetWeight,
  imageFormat,
  lazyLoading,
  thirdPartyImpact,
  dependencyVulnerabilities,
  mixedContent,
  securityHeaders,
  httpsEnforced,
  serverInfoDisclosure,
  cookieSecurity,
  axe,
  colorContrast,
  brokenLinks,
  consoleErrors,
  viewportMeta,
  anchorLinks,
  nestedBlockElements,
  metaTags,
  robotsSitemap,
  structuredData,
  canonicalUrl,
  ogImages,
  duplication,
  outdatedDependencies,
  licenseCheck,
  deadCss,
  trackerRequests,
  externalFonts,
  fingerprinting,
];
