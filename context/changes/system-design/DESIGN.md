---
name: Field Journal Narrative
colors:
  surface: '#fbf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#fbf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ef'
  surface-container: '#efeeea'
  surface-container-high: '#eae8e4'
  surface-container-highest: '#e4e2de'
  on-surface: '#1b1c1a'
  on-surface-variant: '#54433a'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f0ed'
  outline: '#877369'
  outline-variant: '#dac2b6'
  surface-tint: '#934b19'
  primary: '#6c2f00'
  on-primary: '#ffffff'
  primary-container: '#8b4513'
  on-primary-container: '#ffc29f'
  inverse-primary: '#ffb68c'
  secondary: '#446464'
  on-secondary: '#ffffff'
  secondary-container: '#c6e9e9'
  on-secondary-container: '#4a6a6a'
  tertiary: '#35470f'
  on-tertiary: '#ffffff'
  tertiary-container: '#4c5f25'
  on-tertiary-container: '#c1d890'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbc9'
  primary-fixed-dim: '#ffb68c'
  on-primary-fixed: '#321200'
  on-primary-fixed-variant: '#753401'
  secondary-fixed: '#c6e9e9'
  secondary-fixed-dim: '#abcdcd'
  on-secondary-fixed: '#002020'
  on-secondary-fixed-variant: '#2c4c4c'
  tertiary-fixed: '#d4eca2'
  tertiary-fixed-dim: '#b8cf88'
  on-tertiary-fixed: '#141f00'
  on-tertiary-fixed-variant: '#3b4d14'
  background: '#fbf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2de'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin-mobile: 16px
  margin-desktop: 64px
---

## Brand & Style

The design system is centered on the concept of the "Chronicler’s Archive"—a digital extension of a physical miniature painting ledger. It targets hobbyists who value the process of documentation as much as the final result. The UI evokes a sense of tactile permanence and organized creativity.

The design style is **Tactile Minimalism**. It avoids heavy skeuomorphism in favor of subtle physical metaphors: the slight grain of heavy-stock paper, the ink-like quality of the typography, and a structured layout that feels like a hand-ruled notebook. The emotional response is one of calm focus, inviting the user to treat their painting logs with the same care they apply to their miniatures.

## Colors

The palette is derived from natural pigments and heritage artist materials. 

- **Primary (Burnt Sienna):** Used for primary actions, progress indicators, and "wet" states. It represents the warmth of the workshop.
- **Secondary (Slate Blue):** Used for technical metadata, secondary navigation, and "dry" states.
- **Tertiary (Forest Green):** Used for success states, completed projects, and collection milestones.
- **Neutral/Surface:** A warm parchment (`#FDFBF7`) serves as the canvas, reducing eye strain and providing a soft, organic backdrop.

**Dark Mode:** Transitions to a "Midnight Sketchbook" aesthetic. The parchment surface becomes a deep, desaturated charcoal (`#1A1C1E`), while accents retain their pigment-inspired hues with adjusted luminosity for accessibility.

## Typography

This design system employs a three-tier typographic scale to reinforce the ledger aesthetic:

1.  **Headlines (Source Serif 4):** Provides an authoritative, literary feel. Use for project titles, log entries, and section headers. It mimics printed headers in an expensive journal.
2.  **Body (Work Sans):** A clean, professional sans-serif that ensures high legibility for long-form painting notes and technique descriptions.
3.  **Labels & Metadata (JetBrains Mono):** A monospaced font used for "technical" data points: paint hex codes, brush sizes, and time logs. This creates the visual impression of a structured ledger or a stamp-printed catalog.

## Layout & Spacing

The layout follows a **structured grid** inspired by a multi-column ledger. 

- **Grid:** A 12-column grid for desktop, a 6-column grid for tablet, and a 2-column grid for mobile.
- **Rhythm:** All spacing is based on a 4px baseline. Vertical spacing between sections should be generous (`xl`) to allow the "paper" to breathe.
- **Rules:** Use horizontal rules (1px hairlines) to separate entries within a list, echoing the ruled lines of a notebook.
- **Margins:** Desktop views should utilize wide outer margins to focus the content in a central "page" container, rather than stretching edge-to-edge.

## Elevation & Depth

This design system rejects deep, aggressive shadows in favor of **Tonal Layers** and **Subtle Lifts**.

- **Level 0 (Base):** The parchment surface.
- **Level 1 (Cards):** A 1px border using a slightly darker version of the surface color (e.g., `#E8E2D9`) with no shadow. 
- **Level 2 (Interactive):** When hovered or active, elements gain a very soft, diffused ambient shadow (8px blur, 5% opacity) to suggest the element is "resting" on the paper rather than floating.
- **Depth Metaphor:** Instead of Z-axis height, use "recessed" fills for input fields (a slightly darker tint than the background) to make them look like they are indented into the page.

## Shapes

The shape language is **Rounded (Level 2)**. 

- **Default Corners:** 0.5rem (8px). This softens the "industrial" feel of a ledger and makes the UI feel more approachable and organic, like the rounded corners of a premium notebook cover.
- **Large Components:** Cards and major containers use 1rem (16px) to define distinct sections of the journal.
- **Interactive Elements:** Buttons follow the default corner radius to maintain a consistent "stamp" look.

## Components

- **Buttons:** Primary buttons use a solid Burnt Sienna fill with white text. Secondary buttons use a Slate Blue outline. They should feel like ink stamps—bold and decisive.
- **Cards (The Log Entry):** Cards are the primary container for miniatures. They feature a 1px "ink-line" border and no shadow. The header of the card should always use the Serif font.
- **Inputs:** Text fields should look like "blank lines" in a ledger. Use a bottom-border only approach for a minimal feel, or a light-recessed background for more complex forms.
- **Chips (Paint Swatches):** Used for color tags. These should be circular or pill-shaped, featuring a small circle of the actual paint color followed by its name in JetBrains Mono.
- **Lists:** Use dotted leaders (e.g., `Project Name ......... 80%`) to connect labels to their values, reinforcing the vintage ledger aesthetic.
- **Progress Bars:** Represented as "ink washes"—a semi-transparent fill of the primary color that appears to be hand-painted into a bounded track.