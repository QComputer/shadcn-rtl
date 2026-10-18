import type { RetailContent, WebsiteMedia } from "@/lib/website-studio/retail-contract";
import { isEligibleWebsiteImage } from "@/lib/website-studio/core";
import Image from "next/image";
import styles from "./retail-preview.module.css";

type Props = { content: RetailContent; media: WebsiteMedia[]; organizationName: string };
function safeHref(value: string) {
  if (/^\/(?!\/)[^\\\s\x00-\x1f]*$/.test(value)) return value;
  try { const url = new URL(value); return ["https:", "tel:", "mailto:"].includes(url.protocol) && !url.username && !url.password ? value : ""; } catch { return ""; }
}

export function RetailWebsitePreview({ content, media, organizationName }: Props) {
  const images = new Map(media.filter(isEligibleWebsiteImage).map((item) => [item.id, item]));
  const sections = [...content.sections].filter((section) => section.visible).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  const image = (id: string) => images.get(id);
  return <main className={styles.page} dir="rtl" lang="fa">
    <header className={styles.header}><a href="#top" className={styles.brand}>{organizationName}</a><a href="#contact">ارتباط با فروشگاه</a></header>
    {sections.map((section) => <section className={`${styles.section} ${styles[section.kind.toLowerCase()]}`} id={section.kind === "HERO" ? "top" : section.kind === "CONTACT" ? "contact" : undefined} key={section.key}>
      {section.kind === "HERO" && <div className={styles.heroGrid}><div><p className={styles.eyebrow}>{content.title}</p><h1>{section.heading}</h1>{section.subtitle && <h2>{section.subtitle}</h2>}{section.body && <p className={styles.body}>{section.body}</p>}{section.ctaLabel && safeHref(section.ctaHref) && <a className={styles.cta} href={safeHref(section.ctaHref)}>{section.ctaLabel}</a>}</div>{image(section.imageId) && <Image className={styles.heroImage} src={image(section.imageId)!.url} alt={section.heading} width={1200} height={800} unoptimized />}</div>}
      {section.kind === "ABOUT" && <div className={styles.aboutGrid}>{image(section.imageId) && <Image className={styles.aboutImage} src={image(section.imageId)!.url} alt={section.heading} width={900} height={700} unoptimized />}<div><h2>{section.heading}</h2><p className={styles.body}>{section.body}</p></div></div>}
      {section.kind === "GALLERY" && <><h2>{section.heading}</h2><div className={styles.gallery}>{section.imageIds.map((id) => { const item = image(id); return item ? <figure key={id}><Image src={item.url} alt={item.filename ?? "تصویر فروشگاه"} width={640} height={480} unoptimized /><figcaption>{item.filename}</figcaption></figure> : null; })}</div></>}
      {section.kind === "FEATURES" && <><h2>{section.heading}</h2><div className={styles.features}>{section.items.map((item, index) => <article key={index}><span className={styles.icon} aria-hidden="true">{item.icon || "✦"}</span><h3>{item.heading}</h3><p>{item.body}</p></article>)}</div></>}
      {section.kind === "CONTACT" && <><h2>{section.heading}</h2><div className={styles.contactGrid}>{section.address && <p><strong>نشانی</strong><span>{section.address}</span></p>}{section.phone && <p><strong>تلفن</strong><a dir="ltr" href={safeHref(`tel:${section.phone}`) || undefined}>{section.phone}</a></p>}{section.email && <p><strong>ایمیل</strong><a dir="ltr" href={safeHref(`mailto:${section.email}`) || undefined}>{section.email}</a></p>}{section.links.filter((link) => safeHref(link.href)).map((link, index) => <p key={index}><strong>{link.label || "پیوند"}</strong><a href={safeHref(link.href)}>{link.href}</a></p>)}</div></>}
    </section>)}
    <footer className={styles.footer}>{organizationName} · {content.title}</footer>
  </main>;
}
