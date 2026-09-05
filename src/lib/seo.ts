export const seo = ({
  title,
  description,
  keywords,
  image,
  imageAlt,
  url,
}: {
  title: string
  description?: string
  image?: string
  imageAlt?: string
  keywords?: string
  url?: string
}) => {
  const tags = [
    { title },
    { name: 'description', content: description },
    { name: 'keywords', content: keywords },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(url ? [{ property: 'og:url', content: url }] : []),
    ...(image
      ? [
          { name: 'twitter:image', content: image },
          { name: 'twitter:card', content: 'summary_large_image' },
          ...(imageAlt
            ? [{ name: 'twitter:image:alt', content: imageAlt }]
            : []),
          { property: 'og:image', content: image },
          { property: 'og:image:width', content: '1200' },
          { property: 'og:image:height', content: '630' },
          ...(imageAlt
            ? [{ property: 'og:image:alt', content: imageAlt }]
            : []),
        ]
      : []),
  ]

  return tags
}
