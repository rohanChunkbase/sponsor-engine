# Chunkbase website design

This document records the visual system for the Chunkbase website. The source is the Paper file Chunkbase Website. The open page is Secret skies. The design system page supplies the tokens and the component specimens. The reference page supplies the limits. This document does not specify page layouts for build. Do not build pages from this file alone.

Source pages:

- Secret skies: [10 material studies](https://app.paper.design/file/01M2HA0EMSX1R2SBVV0BBDX6Q3/p-A-0)
- Design system: [foundations and components](https://app.paper.design/file/01M2HA0EMSX1R2SBVV0BBDX6Q3/3-0)
- References: [systems and motion](https://app.paper.design/file/01M2HA0EMSX1R2SBVV0BBDX6Q3/p-J-0)
- Hero study: [words and cloud cookies, 16 October](https://app.paper.design/file/01M2HA0EMSX1R2SBVV0BBDX6Q3/p-D-1)

Secret skies shows ten sky candidates. Narrow the set to three to five before a final choice. The 16 October board named Recommended uses the Printed Sky image. The secret reveal is a static proposal.

A token below comes from the file token set. A measured value comes from a specimen or from the latest hero. Do not treat a measured value as a token.

## Colour tokens

Each colour has one job. Carbon blue marks the active path. Green and amber describe evidence states. The other colours set the reading order.

| Token | Hex | Job |
| --- | --- | --- |
| `--color-paper` | `#FFFFFF` | Page ground. Hero button fill. |
| `--color-surface` | `#F7F8FA` | Quiet card fill. |
| `--color-ink` | `#121316` | Primary text on paper. |
| `--color-graphite` | `#5E6269` | Secondary text. |
| `--color-muted` | `#6F737A` | Muted text token. The specimens do not show a separate sample. |
| `--color-rule` | `#DADDE2` | Borders and dividers. |
| `--color-carbon-blue` | `#1F5EFF` | Active path and primary button on paper. |
| `--color-focus` | same as carbon blue | Focus colour. |
| `--color-on-cobalt` | `#FFFFFF` | Text on carbon blue and on the sky. |
| `--color-reviewed` | `#2B6B4F` | Reviewed state. |
| `--color-open` | `#B86B16` | Open state and needs-review dot. |
| `--color-open-text` | `#8C4E0B` | Text for the open state. |

The file also contains these colour tokens. The latest hero does not use them.

| Token | Hex |
| --- | --- |
| `--color-daylight-oak` | `#F0EDE7` |
| `--color-daylight-ink` | `#252A27` |
| `--color-projection-black` | `#090B0E` |
| `--color-projection-steel` | `#8793A3` |
| `--color-canvas-bluewash` | `#EDF2FF` |
| `--color-canvas-review` | `#FFF0D7` |

Measured colours. These values are not tokens.

| Use | Hex |
| --- | --- |
| Secret-sky discovery bar | `#123251` |
| Hero support text | `#EDF3FC` |
| Inline term chip fill | `#DCE9F8` |
| Inline term chip text | `#173C65` |
| Reviewed badge fill | `#EAF4EF` |
| Needs-review badge fill | `#FFF2E3` |
| Unavailable button fill | `#E8E9EC` |
| Unavailable button text | `#8B8E94` |

## Fonts and sizes

Use one family for each role. Do not swap families for the same role.

| Token | Family | Role on the latest hero and in the specimens |
| --- | --- | --- |
| `--font-sans` | Inter Tight | Display, wordmark, and the design-system specimens. |
| `--font-mono` | Geist Mono | Labels and status badges. |
| `--font-experiment-ui` | Geist | Navigation, hero support text, hero buttons, and the discovery bar. |

The file also names Bodoni Moda, Manrope, and Sora. The latest hero and the component specimens do not use those families.

Type ladder from the specimens. Size and line height are in pixels. Display, section, and title use tracking `-0.025em`. Labels use tracking `0.08em`.

| Style | Size | Line height | Weight | Family |
| --- | --- | --- | --- | --- |
| Display | 58 | 64 | 500 | Inter Tight |
| Section | 48 | 54 | 500 | Inter Tight |
| Title | 36 | 42 | 500 | Inter Tight |
| Subhead | 24 | 30 | 500 | Inter Tight |
| Body | 18 | 29 | 400 | Inter Tight |
| UI | 16 | 24 | 400 | Inter Tight |
| Nav token | 14 | 20 | — | Token only. The hero nav uses 16. |
| Caption | 13 | no token | — | Token only. The specimens do not show it. |
| Label | 12 | 16 | 400 | Geist Mono |

The file has line-height tokens for label, nav, body, title, and display. It has no line-height token for section, subhead, UI, or caption. The section, subhead, and UI line heights above are measured from the specimens.

The display token is 58px. The latest hero headline is Inter Tight, 80px, line height 84px, weight 400, tracking `-0.03em`, colour on-cobalt. The wordmark is Inter Tight, 28px, line height 34px, weight 400, tracking `-0.025em`, colour on-cobalt.

Hero support text is Geist, 18px, line height 29px, weight 400, colour `#EDF3FC`. Hero navigation and hero buttons are Geist, 16px, line height 24px, weight 400.

## Spacing scale

The base step is 4px.

| Token | Pixels |
| --- | --- |
| `--spacing-1` | 4 |
| `--spacing-2` | 8 |
| `--spacing-3` | 12 |
| `--spacing-4` | 16 |
| `--spacing-5` | 20 |
| `--spacing-6` | 24 |
| `--spacing-8` | 32 |
| `--spacing-10` | 40 |
| `--spacing-12` | 48 |
| `--spacing-16` | 64 |
| `--spacing-20` | 80 |
| `--spacing-22` | 88 |
| `--spacing-24` | 96 |

Named spacing:

| Token | Resolves to | Use |
| --- | --- | --- |
| `--spacing-bento-gap` | 12px | Token for the bento gap. The bento specimen uses 16px. |
| `--spacing-page-mobile` | 16px | Mobile page inset. |
| `--spacing-panel-mobile` | 20px | Mobile panel padding. |
| `--spacing-panel-desktop` | 32px | Desktop panel padding. |
| `--spacing-section-mobile` | 40px | Mobile section gap. |
| `--spacing-section-desktop` | 80px | Desktop section gap. |
| `--spacing-page-desktop` | 88px | Desktop page inset. |

Breakpoints: 640px, 768px, 1024px, 1280px.

Containers: reading 720px, working 928px, page 1120px, narrative 1104px, rail 336px, mobile content 350px. At 1440px the rail owns 336px and the narrative owns 1104px.

Latest hero frame, measured on a 1440px board:

- The discovery bar is 40px high. Side padding is 56px.
- The navigation row is 64px high. It sits 56px from the left and 72px from the top. The item gap is 36px.
- The headline block is 1120px wide. It sits 160px from the left and 174px from the top.
- The support copy is 1080px wide. The two lines have a 5px gap.
- The two hero actions have a 24px gap.
- The product image is 1100 by 739px. It sits 110px from the left and 574px from the top.
- The phone image is 234 by 499px. It sits 1120px from the left and 808px from the top.

## Radius

| Token | Value | Use |
| --- | --- | --- |
| `--radius-none` | 0px | No corner radius. |
| `--radius-control` | 8px | Buttons, on paper and on the sky. |
| `--radius-figure` | 12px | System cards. |
| `--radius-pill` | 999px | Status badges and status dots. |

Measured radii. These values are not tokens.

| Use | Value |
| --- | --- |
| Inline term chip | 3px |
| Product image on the hero | 14px |
| Phone image on the hero | 40px |

## Shadows

Buttons, badges, and system cards have no shadow.

The latest hero uses two shadows.

| Use | Value |
| --- | --- |
| Product image | `0 28px 72px #09243F3D` |
| Phone image | `0 22px 54px #09243F44` |

The focus style is an outline. See Buttons.

## Background treatments

Each sky is one image. The image is 1440 by 1360px. Set `background-size` to `cover`. Set `background-position` to `50%`. The Secret skies page uses images for the sky. It does not use a CSS gradient. The notes band under each study is paper (`#FFFFFF`).

The same product image and the same phone image sit on every sky. The product image uses `background-size: contain`. The phone image uses `background-size: contain`.

Asset base:

`https://app.paper.design/file-assets/01M2HA0EMSX1R2SBVV0BBDX6Q3/`

| Sky | File | Material note |
| --- | --- | --- |
| Painted Blue Hour | `77JK8TXRYGDN59ZB59WVDGGSB2.png` | Sculpted brushwork. Silver light. |
| Golden Hour | `28DF3C2D0QW96X1WTEX6YBZ2NN.png` | Champagne edges. A warmer atmosphere. |
| Matte Gouache | `2GTXQATF63DA4ZHZWP2M2AQ4PH.png` | Opaque pigment. Soft, definite planes. |
| Watercolour Sky | `19N9HRR9FP5Z483GHV4JYGXHX0.png` | Transparent washes. Pigment blooms. |
| Soft Pastel | `406W10K35KNTJSH3WTW720QSNX.png` | Powdered cobalt. Lavender shadows. |
| Indigo Ink Wash | `4V2V6M15W2V7EF6BQ5717VMMBM.png` | Deep ink. Light left untouched. |
| Printed Sky | `24CZ3B306K8BEZR7RY15W4PYJN.png` | Cobalt ink. Printed cloud grain. The Recommended board uses this file. |
| Paper Relief | `7885DEP10X4R3Z1TD2AEPEBVGF.png` | Layered paper. Shallow physical depth. |
| Pearlescent Clouds | `2RQD57B37ZQRCR08TJVQA8EHM1.png` | Satin pearl. Ice-blue reflections. |
| Dithered Blue Hour | `5HQ2SJN98W6XFCJC2B8BEV9BWP.png` | A digital sky. Carefully placed pixels. |

Product image: `2AQEA5T1M703CX5GTWRPQ6YJ41.png`

Phone image: `5HC0BRDKCC0DS7KT4ZDVAK8TZT.png`

The discovery bar is a solid fill, `#123251`. It is not an image and it is not a gradient.

## Buttons

A button is an action. A badge is a status. Do not give a status the shape of a button.

System buttons sit on paper. Text is Inter Tight, 16px, line height 24px, weight 500. A row below states each exception. Height is 48px. Radius is 8px. These buttons have no shadow.

| State | Fill | Text | Other |
| --- | --- | --- | --- |
| Primary | `#1F5EFF` | `#FFFFFF` | Inline padding 18px. |
| Secondary | `#FFFFFF` | `#121316` | 1px border `#DADDE2`. Inline padding 18px. |
| Text action | none | `#121316` | Inline padding 8px. Gap to the 14px icon is 10px. |
| Focus | `#1F5EFF` | `#FFFFFF` | Outline 2px solid `#1F5EFF`. Offset 3px. |
| Unavailable | `#E8E9EC` | `#8B8E94` | Inline padding 18px. |
| Sending | `#FFF2E3` | `#8C4E0B` | Inline padding 16px. Gap 8px. The mark is a 14px ring, 2px, colour `#B86B16`. |

Hero buttons sit on the sky. Text is Geist, 16px, line height 24px, weight 400. Radius is 8px. These buttons have no border. These buttons have no shadow.

| Control | Fill | Text | Padding |
| --- | --- | --- | --- |
| Sign up for alpha | `#FFFFFF` | `#121316` | 17px 25px |
| Sign up in the nav | `#FFFFFF` | `#121316` | 13px 22px |
| See it in action | none | `#FFFFFF` | Gap to the 14px icon is 8px. |
| Nav link | none | `#FFFFFF` | No extra padding. |

Use one primary button in a group. On paper, that button is carbon blue. On the sky, that button is paper.

## Cards

System cards use radius 12px. They have no shadow.

| Card | Fill | Border | Padding |
| --- | --- | --- | --- |
| Narrative | `#121316` | none | 32px |
| Support | `#F7F8FA` | 1px `#DADDE2` | 24px |
| Reviewed state | `#EAF4EF` | none | 24px |

One large card carries the point. Small cards support that card. The specimen gap is 16px. The bento-gap token is 12px. Use 12px for new work. Use 16px when a board shows 16px.

The hero product frame is an image. Radius is 14px. The shadow is in the Shadows section.

## Badges

A status badge is a pill. Height is 32px. Inline padding is 12px. The gap is 8px. The radius is 999px. The text is Geist Mono, 12px, line height 16px, weight 400. The dot is 8px.

| Status | Fill | Dot | Text |
| --- | --- | --- | --- |
| Reviewed | `#EAF4EF` | `#2B6B4F` | `#2B6B4F` |
| Needs review | `#FFF2E3` | `#B86B16` | `#8C4E0B` |

The colour specimen uses the same fills with block padding 8px, inline padding 12px, and a 10px gap.

The inline term chip is a separate mark. Radius is 3px. Padding is 1px 6px. The gap is 6px. Fill is `#DCE9F8`. Text is `#173C65`, Geist, 18px, line height 29px. The icon is 16px.

## Do and do not

1. Do use carbon blue for the active path. Do not use carbon blue as decoration.
2. Do use an 8px radius for a button. Do not use a pill radius for a button. A pill is a status.
3. Do keep one primary action in a group. Do not style a status as a button.
4. Do keep one large card for the main point. Do not place six equal cards in one row.
5. Do place one sky image behind the hero. Do not add decorative gradient blobs. Do not let the sky replace the product image.

## Tailwind theme

The first block matches the file tokens. Family names are in quotes so the CSS is valid. The second block records measured values from the specimens and the latest hero. Those names are not file tokens.

```css
@theme {
  --color-paper: #ffffff;
  --color-rule: #dadde2;
  --color-graphite: #5e6269;
  --color-ink: #121316;
  --color-carbon-blue: #1f5eff;
  --color-reviewed: #2b6b4f;
  --color-open: #b86b16;
  --color-surface: #f7f8fa;
  --color-muted: #6f737a;
  --color-focus: var(--color-carbon-blue);
  --color-open-text: #8c4e0b;
  --color-on-cobalt: #ffffff;
  --color-daylight-oak: #f0ede7;
  --color-daylight-ink: #252a27;
  --color-projection-black: #090b0e;
  --color-projection-steel: #8793a3;
  --color-canvas-bluewash: #edf2ff;
  --color-canvas-review: #fff0d7;

  --font-sans: "Inter Tight";
  --font-mono: "Geist Mono";
  --font-daylight-display: "Bodoni Moda";
  --font-experiment-sans: "Manrope";
  --font-projection-display: "Sora";
  --font-experiment-ui: "Geist";

  --text-label: 12px;
  --text-nav: 14px;
  --text-body: 18px;
  --text-title: 36px;
  --text-display: 58px;
  --text-caption: 13px;
  --text-ui: 16px;
  --text-subhead: 24px;
  --text-section: 48px;

  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;

  --tracking-tight: -0.025em;
  --tracking-label: 0.08em;

  --leading-label: 16px;
  --leading-nav: 20px;
  --leading-body: 29px;
  --leading-title: 42px;
  --leading-display: 64px;

  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  --container-reading: 720px;
  --container-page: 1120px;
  --container-mobile-content: 350px;
  --container-rail: 336px;
  --container-working: 928px;
  --container-narrative: 1104px;

  --spacing-1: 4px;
  --spacing-2: 8px;
  --spacing-3: 12px;
  --spacing-4: 16px;
  --spacing-5: 20px;
  --spacing-6: 24px;
  --spacing-8: 32px;
  --spacing-10: 40px;
  --spacing-12: 48px;
  --spacing-16: 64px;
  --spacing-20: 80px;
  --spacing-22: 88px;
  --spacing-24: 96px;
  --spacing-bento-gap: var(--spacing-3);
  --spacing-page-mobile: var(--spacing-4);
  --spacing-panel-mobile: var(--spacing-5);
  --spacing-panel-desktop: var(--spacing-8);
  --spacing-section-mobile: var(--spacing-10);
  --spacing-section-desktop: var(--spacing-20);
  --spacing-page-desktop: var(--spacing-22);

  --radius-control: 8px;
  --radius-figure: 12px;
  --radius-none: 0px;
  --radius-pill: 999px;
}

@theme {
  --color-discovery: #123251;
  --color-hero-copy: #edf3fc;
  --color-chip: #dce9f8;
  --color-chip-text: #173c65;
  --color-reviewed-wash: #eaf4ef;
  --color-open-wash: #fff2e3;
  --color-unavailable: #e8e9ec;
  --color-unavailable-text: #8b8e94;

  --text-hero: 80px;
  --leading-hero: 84px;
  --leading-section: 54px;
  --leading-subhead: 30px;
  --leading-ui: 24px;
  --tracking-hero: -0.03em;

  --radius-chip: 3px;
  --radius-workspace: 14px;
  --radius-phone: 40px;

  --shadow-workspace: 0 28px 72px #09243f3d;
  --shadow-phone: 0 22px 54px #09243f44;
}
```
