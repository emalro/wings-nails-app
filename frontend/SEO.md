# SEO Checklist for wings-nails-app

## Every time you add a new public page:
1. Add route to `public/sitemap.xml`
2. Add `useSEO()` hook with title and description
3. Ensure the page has an `<h1>` tag
4. Add unique meta description (120-160 chars)
5. If the page has images, ensure they have `alt` text

## Every time you add a new feature:
1. Check if it affects existing meta tags
2. If adding images, ensure they're optimized (< 200KB)
3. If adding new content sections, ensure they use proper heading hierarchy (h1 → h2 → h3)

## Every time you deploy:
1. Verify sitemap.xml is accessible at /sitemap.xml
2. Verify robots.txt is accessible at /robots.txt
3. Test with Google Rich Results Test (https://search.google.com/test/rich-results)

## Open Graph image
- Create a 1200x630 PNG at `/public/og-image.png`
- Use brand colors (rose/lavender palette)
- Include business name and tagline
