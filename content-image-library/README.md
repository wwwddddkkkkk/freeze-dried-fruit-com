# Freeze-Dried Fruit Image Library

Local source gallery for Freeze-Dried-Fruit.com article cover photos.

Use this for consumer-facing articles. Technical articles should usually get a custom SVG cover generated specifically for the article.

Folders:

- `freezedriedfruit/fruit/`: fruit closeups, single fruit types, mixed fruit, texture shots.
- `freezedriedfruit/applications/`: bowls, toppings, snack boards, lunchboxes, desserts.
- `freezedriedfruit/packaging/`: pouches, jars, shelves, labels, bulk packs.
- `freezedriedfruit/process/`: trays, freeze dryers, frozen fruit, drying stages.
- `freezedriedfruit/diagrams/`: manually prepared diagrams if needed.
- `freezedriedfruit/used/`: optional archive for images already used.

Do not reference images directly from this folder in published articles.

When a photo is selected as an article cover, copy it to:

`public/images/articles/<slug>.<ext>`

Then add this frontmatter to the article:

```yaml
cover_image: /images/articles/<slug>.jpg
cover_alt: "Clear description of the photo"
```

Record used cover photos in:

`freezedriedfruit/used-hero-images.json`

