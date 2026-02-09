"use client";

import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Pipeline", href: "#pipeline" },
      { label: "Templates", href: "#templates" },
      { label: "Providers", href: "#providers" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#" },
      { label: "Status", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[#1C2230] bg-[#0B0E11]">
      <div className="container section">
        <div className="grid gap-10 md:grid-cols-4">
          {footerColumns.map((col) => (
            <div key={col.title}>
              <p className="text-xs uppercase tracking-[0.3em] text-[#6B7280] mb-4">
                {col.title}
              </p>
              <ul className="space-y-3 text-sm text-[#9CA3AF]">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className="hover:text-white transition-colors">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-white transition-colors">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-[#1C2230] pt-6 text-xs text-[#6B7280] md:flex-row md:items-center md:justify-between">
          <span>© {new Date().getFullYear()} FEEDR</span>
          <span>Made for creators &amp; agencies</span>
        </div>
      </div>
    </footer>
  );
}
