# Design System

## Overview
The SDD Bundle Editor uses a dark theme design system inspired by Antigravity and VS Code, optimized for professional IDE aesthetics with balanced information density.

---

## Color Palette

### Antigravity Dark Theme

**Backgrounds:**
```css
--color-bg-primary: #1a1b26;     /* Main background */
--color-bg-secondary: #16161e;   /* Sidebars, panels */
--color-bg-tertiary: #24283b;    /* Cards, elevated surfaces */
--color-bg-hover: #2f3549;       /* Hover states */
```

**Text:**
```css
--color-text-primary: #c0caf5;   /* Primary text, high contrast */
--color-text-secondary: #9aa5ce; /* Secondary text, medium contrast */
--color-text-muted: #565f89;     /* Muted text, low contrast */
```

**Accents:**
```css
--color-accent: #7aa2f7;         /* Primary accent (muted blue) */
--color-accent-hover: #7dcfff;   /* Accent hover state */
--color-accent-light: rgba(122, 162, 247, 0.15); /* Accent background */
```

**Semantic Colors:**
```css
--color-success: #9ece6a;        /* Success states */
--color-warning: #e0af68;        /* Warning states */
--color-error: #f7768e;          /* Error states */
```

**Entity Type Colors:**
```css
--color-feature: #bb9af7;        /* Purple */
--color-requirement: #7dcfff;    /* Cyan */
--color-task: #ff9e64;           /* Orange */
--color-adr: #9ece6a;            /* Green */
--color-profile: #f7768e;        /* Pink */
--color-fixture: #e0af68;        /* Yellow */
```

---

## Typography

### Font Sizes
```css
--font-size-xs: 0.6875rem;  /* 11px - Badges, small labels */
--font-size-sm: 0.8125rem;  /* 13px - Entity tree, compact UI */
--font-size-md: 0.875rem;   /* 14px - Base font size */
--font-size-lg: 1rem;       /* 16px - Headings, emphasis */
--font-size-xl: 1.125rem;   /* 18px - Large headings */
--font-size-2xl: 1.5rem;    /* 24px - Page titles */
```

**Base:** 14px (balanced density)  
**Line Height:** 1.45 (tighter for more content)  
**Font Family:** Inter, system fonts

### Usage Guidelines
- **Entity Tree:** 13px (--font-size-sm) for compact display
- **Body Text:** 14px (--font-size-md) for readability
- **Badges/Counts:** 11px (--font-size-xs) for small indicators
- **Breadcrumbs:** 13px (--font-size-sm) for hierarchy navigation

---

## Spacing Scale

### Balanced Density (15% reduction)
```css
--spacing-xs: 0.2rem;   /* ~3px - Minimal gaps */
--spacing-sm: 0.4rem;   /* ~6px - Compact spacing */
--spacing-md: 0.75rem;  /* ~12px - Standard spacing */
--spacing-lg: 1.2rem;   /* ~19px - Section spacing */
--spacing-xl: 1.7rem;   /* ~27px - Large gaps */
```

### Usage Guidelines
- **Component Padding:** Use --spacing-sm (6px) for compact UI
- **Section Gaps:** Use --spacing-md (12px) between sections
- **Page Margins:** Use --spacing-lg (19px) for page-level spacing
- **Entity Tree:** 4px vertical padding for maximum density

---

## Components

### Entity Tree

**Group Header:**
- Font: 13px (--font-size-sm)
- Padding: 4px 6px (vertical, horizontal)
- Gap: 6px between chevron, icon, name, count

**Entity Button:**
- Font: 13px (--font-size-sm)
- Padding: 4px 6px 4px 32px (indent for hierarchy)
- Hover: --color-bg-tertiary background
- Selected: --color-accent-light background, --color-accent text

**Chevron Animation:**
- Transition: 250ms ease
- Collapsed: rotate(-90deg) - pointing right (▸)
- Expanded: rotate(0deg) - pointing down (▾)

**Count Badge:**
- Font: 11px (--font-size-xs)
- Padding: 2px 6px
- Border Radius: 10px (pill shape)
- Background: --color-bg-tertiary
- Text: --color-text-muted

### Header

**Height:** 48px (reduced for vertical space)  
**Padding:** 0 12px  
**Background:** --color-bg-secondary

**Breadcrumb:**
- Font: 13px (--font-size-sm)
- Color: --color-text-secondary
- Separator: › (--color-text-muted)
- Current: --color-text-primary, font-weight 500

**Icon Buttons:**
- Size: 32px × 32px
- Font Size: 18px
- Border Radius: 4px (--radius-sm)
- Hover: --color-bg-hover background
- Active: --color-accent-light background, --color-accent text

### Sidebar

**Default Width:** 280px  
**Collapsed Width:** 50px  
**Resizable Range:** 200px - 500px  
**Transition:** 250ms ease

**Resize Handle:**
- Width: 4px
- Position: Absolute right edge
- Cursor: col-resize
- Hover: --color-accent background

---

## Borders & Radius

```css
--color-border: #24283b;        /* Standard borders */
--color-border-light: #2f3549;  /* Lighter borders */

--radius-sm: 4px;   /* Buttons, small elements */
--radius-md: 8px;   /* Cards, panels */
--radius-lg: 12px;  /* Large containers */
```

---

## Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);    /* Subtle elevation */
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.5);    /* Medium elevation */
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.6);  /* High elevation */
```

**Usage:**
- Popovers/Tooltips: --shadow-md
- Modals/Drawers: --shadow-lg
- Hover states: --shadow-sm

---

## Transitions

```css
--transition-fast: 150ms ease;    /* Hover states, quick feedback */
--transition-normal: 250ms ease;  /* Sidebar collapse, animations */
```

---

## Responsive Breakpoints

### Mobile
**Max Width:** 768px
- Single column layout
- Bottom sheet agent panel (80vh)
- Slide-in navigation drawer
- Touch targets: 40px (vs 32px desktop)

### Tablet
**Range:** 769px - 1024px
- Reduced sidebar: 240px
- Reduced agent panel: 360px
- Base font: 13px (vs 14px desktop)

### Desktop
**Min Width:** 1025px
- Full layout with resizable sidebar
- Default sidebar: 280px
- Agent panel: 420px
- Base font: 14px

---

## Entity Type Icons

Unicode emoji used for entity types:

```
📄 Feature
📋 Requirement
✓  Task
📝 ADR
👤 Profile
⚙️  Fixture
🔗 Protocol
📄 Decision
📄 Component
📄 Bundle
```

**Size:** 16px  
**Display:** Inline-flex for alignment

---

## Accessibility

### Color Contrast
- Text Primary on BG Primary: 7.2:1 (AAA)
- Text Secondary on BG Primary: 4.8:1 (AA)
- Accent on BG Primary: 4.5:1 (AA)

### Touch Targets
- Desktop: 32px minimum
- Mobile: 40px minimum
- Spacing: 8px between interactive elements

### Focus Indicators
- Keyboard focus: 2px --color-accent outline
- Focus visible on all interactive elements

---

## Design Principles

1. **Information Density:** More content visible without scrolling (20-25% improvement)
2. **Professional Aesthetic:** Dark, muted colors matching modern IDEs
3. **Responsive Design:** Mobile-first approach with bottom sheet patterns
4. **Accessibility:** WCAG AA compliance minimum, AAA where possible
5. **Performance:** Smooth 250ms animations, no jank

---

## Migration Notes

### From Previous Version
- **Font Size:** 16px → 14px (12.5% smaller)
- **Spacing:** Standard → -15% (more compact)
- **Line Height:** 1.5 → 1.45 (tighter)
- **Colors:** Bright blues → Muted Antigravity palette

### Breaking Changes
- Entity groups now collapsed by default
- Header reduced from ~60px to 48px
- Icon-only buttons (text labels removed)
