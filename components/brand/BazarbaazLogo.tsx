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
  const viewBox = isMark ? "0 0 1000 1000" : "0 0 1950 650";

  return (
    <svg
      viewBox={viewBox}
      role={decorative ? "presentation" : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : language === "fa" ? "بازارباز" : "Bazarbaaz"}
      className={cls(styles.logo, styles[theme], className)}
      {...props}
    >
      <g className={styles.mark}>
        <path d="M170 120 V880" className={styles.mainStroke} />
        <path
          d="M300 120 H520 C690 120 815 240 815 400 C815 455 790 505 748 545"
          className={styles.accentStroke}
        />
        <path
          d="M300 500 H620 C706 500 770 527 800 565"
          className={styles.mainStroke}
        />
        <path
          d="M805 655 C822 710 813 765 780 810 C742 860 675 880 590 880 H300"
          className={styles.mainStroke}
        />
      </g>

      {!isMark && (
        <g transform="translate(720 0)">
          {(language === "en" || language === "both") && (
            <text
              x="0"
              y={language === "both" ? 325 : 390}
              className={cls(styles.wordmark, wordmarkClassName)}
            >
              Bazarbaaz
            </text>
          )}
          {(language === "fa" || language === "both") && (
            <text
              x="0"
              y={language === "both" ? 465 : 390}
              className={cls(styles.wordmarkFa, language === "both" && styles.accentText, wordmarkClassName)}
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
