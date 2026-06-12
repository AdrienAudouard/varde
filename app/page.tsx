import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/get-locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHow } from "@/components/landing/landing-how";
import { LandingUseCases } from "@/components/landing/landing-use-cases";
import { LandingFooter } from "@/components/landing/landing-footer";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary(await getLocale());
  return {
    title: dict.meta.title,
    description: dict.meta.description,
  };
}

export default async function LandingPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  return (
    <div className="landing">
      <LandingNav dict={dict.nav} locale={locale} />
      <a id="top" />
      <LandingHero dict={dict.hero} />
      <LandingFeatures dict={dict.features} />
      <LandingHow dict={dict.how} />
      <LandingUseCases dict={dict.uses} />
      <LandingFooter dict={dict.footer} />
    </div>
  );
}
