# Flight Lab — selected design QA

Date: 2026-10-08

**final result: passed**

## Reference and comparison setup

The user selected option 3 from the latest Vogue-inspired homepage set. This approval supersedes the earlier Teenage Engineering and Lusion directions.

- Original selected image: `/Users/mao18/.codex/generated_images/01a11a26-0c3f-78c3-9b20-77269ddeaaa6/exec-585fe5ef-0007-4191-874e-ec9bd236ef0c.png`.
- Durable reference: [selected-homepage.png](docs/design/selected-homepage.png), 1487 × 1058 pixels.
- Browser implementation: [homepage-desktop-final.png](docs/design/homepage-desktop-final.png), 1472 × 1047 pixels, captured at a 1487 × 1058 CSS viewport in the Codex in-app browser.
- The native browser screenshot presentation produces a slightly smaller raster. The source was resized to 1472 × 1047 with Lanczos for a same-size visual comparison; no page content was retouched.
- [Final combined comparison](docs/design/comparison-final.png): normalized source on the left, actual browser implementation on the right, reviewed together in one image.
- State: homepage, top of page, demo content loaded, menu and search closed, local fonts and all three cover images loaded.

## Visual review

| Surface | Result | Evidence and assessment |
| --- | --- | --- |
| Typography | Pass | Local Bodoni Moda masthead and italic motto; local Noto Serif SC subset for Chinese editorial headings. Hierarchy and headline wrapping follow the selected direction. [Headline comparison](docs/design/comparison-type.png), [masthead comparison](docs/design/comparison-masthead.png). |
| Layout and spacing | Pass | Centered masthead, thin topic-nav dividers, roughly 61/39 asymmetric columns, square image corners, large lead image, compact right feature and central motto. Mobile becomes one column. |
| Colors and controls | Pass | White canvas, near-black text, muted metadata and small red category labels. Lucide thin-line menu, search and arrows; visible keyboard focus. |
| Images | Pass | Three standalone AI-generated raster assets maintain the composition, subject, light and crop of the chosen direction. Optimized local WebP files; no UI screenshot was flattened into the page. |
| Copy and interaction fidelity | Pass | Aircraft headline, engineering topic labels and creative motif preserved. Article CTA corrected to “阅读原文” for the actual NASA article. Besiege links to the simulation topic rather than inventing a video source. |

## Comparison iterations

1. [Initial comparison](docs/design/comparison-initial.png): P2 Chinese heading family/weight and English title proportions differed; local serif fonts and adjusted headline sizing addressed this.
2. [Font comparison](docs/design/comparison-fonts.png): P2 right-side motto sizing and narrow-screen Chinese wrapping remained; smaller responsive motto and the tablet single-line treatment addressed these.
3. Final comparison: no remaining P0, P1 or P2 findings in the selected visual scope. P3 optical differences remain in Chinese glyph shape/weight and artwork camera/aircraft details. These do not prevent the selected layout from being recognizable and usable.

## Responsive and functional checks

- Desktop 1487 × 1058 CSS viewport: no horizontal overflow; all three cover assets complete.
- Tablet 805 × 864 CSS viewport: no horizontal overflow; right-side Chinese motto fits one line. [Tablet capture](docs/design/homepage-tablet.png), native raster 790 × 848.
- Mobile 390 × 844 CSS viewport: no horizontal overflow; readable single-column cover and usable menu. [Mobile viewport capture](docs/design/homepage-mobile-viewport.png), native raster 375 × 812.
- Header menu opens; Escape closes it and returns focus to its trigger.
- Header search works, including a one-result search and an empty-result state; clearing returns the content list.
- Topic navigation updates its URL and survives reload; the creative topic CTA reaches the simulation content.
- About and admin preview screens render; published demo list shows six records. Add-link form opens and Escape closes it.
- Browser console error check returned no errors during functional verification.
- Production build passed after the final source edits. Existing test suite passed 10/10.
- After the interrupted session, local preview was restarted and the homepage rechecked: three images loaded and no horizontal overflow at the default 1280 × 720 viewport. Temporary viewport overrides were reset.

## Scope and intentional limits

This is the selected page design implementation inside the existing Flight Lab project. Generated cover images are explicitly identified as AI concept art in the preview notice. Content is based on real linked sources. Supabase, paid DeepSeek calls and automatic ingestion are not active in this local preview; the one-week operational trial has not started. The redesign has not been pushed or deployed during this visual iteration.

## Asset provenance

- `public/images/editorial-aircraft.webp`: AI-generated high aerial editorial view of a white experimental aircraft on concrete, with a person and equipment for scale; no real organization mark.
- `public/images/editorial-airflow.webp`: AI-generated monochrome wind-tunnel wing and smoke-flow visualization.
- `public/images/editorial-build.webp`: AI-generated game-inspired wooden flying machine above a mountainous landscape and castle; an illustration, not a Besiege gameplay screenshot.
- Local font licenses: `public/fonts/OFL-Bodoni-Moda.txt` and `public/fonts/OFL-Noto-Serif-SC.txt`.
