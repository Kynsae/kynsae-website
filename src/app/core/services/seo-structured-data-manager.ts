import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Project } from '../../shared/models/project.model';

@Injectable({ providedIn: 'root' })
export class SEOStructuredDataManager {
  private readonly siteUrl = 'https://kynsae.com';

  constructor(@Inject(DOCUMENT) private document: Document) {}

  addStructuredData(data: object, id: string): void {
    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(data);
    script.id = id;

    this.document.getElementById(id)?.remove();
    this.document.head.appendChild(script);
  }

  /* ---------- Organization (site-wide) ---------- */

  addOrganizationSchema(): void {
    this.addStructuredData(
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "@id": `${this.siteUrl}/#organization`,
        "name": "Kynsae",
        "url": this.siteUrl,
        "logo": `${this.siteUrl}/icons/logo.svg`,
        "description": "A multidisciplinary creative studio exploring creative tech in all forms.",
        "sameAs": [
          "https://behance.net/kynsae",
          "https://instagram.com/kynsae",
          "https://github.com/kynsae"
        ],
        "contactPoint": {
          "@type": "ContactPoint",
          "email": "hello@kynsae.com",
          "contactType": "Customer Service"
        },
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Geneva",
          "addressCountry": "CH"
        }
      },
      'schema-organization'
    );
  }

  /* ---------- Portfolio Page ---------- */

  addPortfolioSchema(projects: readonly Project[]): void {
    this.addStructuredData(
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "@id": `${this.siteUrl}/work#collection`,
        "name": "Our Work",
        "description": "Explore our portfolio of web design, 3D renders, mobile development, and creative projects.",
        "mainEntity": {
          "@type": "ItemList",
          "itemListElement": projects.map((project, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
              "@type": "CreativeWork",
              "@id": `${this.siteUrl}/work/${project.id}#creativework`,
              "name": project.title,
              "description": project.description,
              "url": `${this.siteUrl}/work/${project.id}`,
              "image": `${this.siteUrl}/${project.thumbnail}`
            }
          }))
        }
      },
      'schema-portfolio'
    );
  }

  /* ---------- Individual Project ---------- */

  addCreativeWorkSchema(project: any): void {
    this.addStructuredData(
      {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "@id": `${this.siteUrl}/work/${project.id}#creativework`,
        "name": project.title,
        "description": project.description,
        "creator": {
          "@type": "Organization",
          "@id": `${this.siteUrl}/#organization`,
          "name": "Kynsae"
        },
        "datePublished": `${project.year}-01-01`,
        "image": `${this.siteUrl}/${project.thumbnail}`,
        "keywords": project.tags,
        "url": `${this.siteUrl}/work/${project.id}`,
        "about": project.services
      },
      'schema-creativework'
    );
  }
}