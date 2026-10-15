import type { SVGProps } from "react";
import styles from "./BazarbaazLogo.module.css";

type Theme = "auto" | "light" | "dark" | "mono";
type Language = "en" | "fa" | "both";
type Variant = "mark" | "lockup";

export type BazarbaazLogoProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  theme?: Theme;
  language?: Language;
  variant?: Variant;
  wordmarkClassName?: string;
  decorative?: boolean;
};

const cls = (...values: Array<string | undefined | false>) =>
  values.filter(Boolean).join(" ");

export function BazarbaazLogo({
  theme = "auto",
  language = "en",
  variant = "lockup",
  className,
  wordmarkClassName,
  decorative = false,
  ...props
}: BazarbaazLogoProps) {
  const isMark = variant === "mark";
  const viewBox = isMark ? "0 0 1000 1000" : language === "both" ? "0 0 1900 760" : "0 0 1900 620";

  return (
    <svg
      viewBox={viewBox}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : language === "fa" ? "بازارباز" : "Bazarbaaz"}
      className={cls(styles.logo, styles[theme], className)}
      {...props}
    >
      <g className={styles.mark} transform={isMark ? undefined : "translate(40,-70) scale(0.68)"}>
        <path d="M300 170 V830" className={styles.mainStroke} />
        <path d="M470 220 H635 A105 105 0 0 1 635 430" className={styles.accentStroke} />
        <path d="M470 500 H650 A150 150 0 0 1 650 800 H470" className={styles.mainStroke} />
      </g>

      {!isMark && (
        <g>
          {(language === "en" || language === "both") && (
            <text
              x="780"
              y={language === "both" ? 360 : 375}
              className={cls(styles.wordmark, wordmarkClassName)}
            >
              Bazarbaaz
            </text>
          )}
          {(language === "fa" || language === "both") && (
            <text
              x="780"
              y={language === "both" ? 505 : 375}
              className={cls(styles.wordmarkFa, language === "both" && styles.bilingualFa, language === "both" && styles.accentText, wordmarkClassName)}
              direction="rtl"
            >
              بازارباز
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
