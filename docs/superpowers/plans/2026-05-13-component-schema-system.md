# Component Schema System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a schema-driven component registry under `src/components/` so AI agents can discover, extend, and edit UI primitives without re-reading the whole codebase.

**Architecture:** Each component file exports `<Name>Props` interface + `schema` const + `create<Name>` default factory. A `registry.ts` auto-indexes via Vite's `import.meta.glob('./[A-Z]*.ts')`. No base class, no decorator, no runtime DSL.

**Tech Stack:** TypeScript (strict), Vite, Vitest, jsdom. Existing project conventions: vanilla DOM factory functions returning `HTMLElement`, styles live in `src/styles/globals.css`.

---

## File structure (final state)

```
src/components/
├── _schema.ts                    # NEW — shared schema types
├── registry.ts                   # NEW — auto-indexer
├── Button.ts                     # NEW — primitive
├── Tag.ts                        # NEW — primitive (replaces .level-tag)
├── FilterChip.ts                 # NEW — primitive (.filter-chip)
├── StatChip.ts                   # NEW — primitive (.resource-chip)
├── ListRow.ts                    # NEW — primitive
├── Card.ts                       # NEW — primitive
├── Banner.ts                     # NEW — primitive
├── Modal.ts                      # NEW — layout
├── Sheet.ts                      # NEW — layout
├── Progress.ts                   # MIGRATED — now exports schema
├── PetView.ts                    # MIGRATED — now exports schema
├── Layout.ts                     # untouched
├── TabBar.ts                     # untouched
├── DevPanel.ts                   # untouched
├── InstallPrompt.ts              # untouched
└── __tests__/
    ├── _schema.test.ts
    ├── registry.test.ts
    ├── Button.test.ts
    ├── Tag.test.ts
    ├── FilterChip.test.ts
    ├── StatChip.test.ts
    ├── ListRow.test.ts
    ├── Card.test.ts
    ├── Banner.test.ts
    ├── Modal.test.ts
    ├── Sheet.test.ts
    ├── Progress.test.ts          # NEW (test for migrated Progress)
    └── PetView.test.ts           # NEW (test for migrated PetView, if existing test is missing)
```

CSS additions in `src/styles/globals.css`: each new visual primitive adds its own block (`.tag`, `.stat-chip`, `.filter-chip` generic version, `.list-row`, `.card-shell`, `.banner-shell`, `.modal-shell`, `.sheet-shell`). Existing `.btn-*`, `.resource-chip`, `.filter-chip`, `.level-tag` classes stay in place during v1 (not removed) so already-built routes keep working.

---

## Task 1: Schema types foundation

**Files:**
- Create: `src/components/_schema.ts`
- Test: `src/components/__tests__/_schema.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/_schema.test.ts
import { describe, it, expect } from 'vitest';
import type {
  ComponentSchema,
  PropSchema,
  PropType,
  ComponentCategory,
  ComponentExample,
} from '../_schema';

describe('_schema types', () => {
  it('accepts a minimal component schema literal', () => {
    const s: ComponentSchema = {
      name: 'Foo',
      category: 'primitive',
      description: 'A foo.',
      props: {},
    };
    expect(s.name).toBe('Foo');
    expect(s.category).toBe('primitive');
  });

  it('accepts an enum prop with values and a default', () => {
    const p: PropSchema = {
      type: 'enum',
      enum: ['a', 'b'],
      default: 'a',
    };
    expect(p.enum).toEqual(['a', 'b']);
    expect(p.default).toBe('a');
  });

  it('accepts variants, slots, and examples on a schema', () => {
    const example: ComponentExample = { label: 'Default', props: { label: 'X' } };
    const s: ComponentSchema = {
      name: 'Bar',
      category: 'layout',
      description: 'Bar.',
      props: { label: { type: 'string', required: true } },
      variants: ['a', 'b'],
      slots: ['leading'],
      examples: [example],
    };
    expect(s.variants).toEqual(['a', 'b']);
    expect(s.examples?.[0].label).toBe('Default');
  });

  it('ComponentCategory accepts the three documented values', () => {
    const cats: ComponentCategory[] = ['primitive', 'layout', 'pattern'];
    expect(cats).toHaveLength(3);
  });

  it('PropType accepts the documented type literals', () => {
    const t: PropType[] = ['string', 'number', 'boolean', 'enum', 'function', 'element', 'array'];
    expect(t).toHaveLength(7);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/_schema.test.ts`
Expected: FAIL — `Cannot find module '../_schema'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/_schema.ts
/**
 * Shared schema types for the component registry.
 *
 * Every component file under src/components/ that starts with a capital
 * letter must export a `schema: ComponentSchema` constant alongside its
 * factory function. registry.ts picks them up automatically.
 */

export type PropType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'function'
  | 'element'
  | 'array';

export interface PropSchema {
  type: PropType;
  required?: boolean;
  default?: unknown;
  enum?: readonly string[];
  itemType?: PropType;
  description?: string;
}

export type PropSchemaMap = Record<string, PropSchema>;

export interface ComponentExample {
  label: string;
  props: Record<string, unknown>;
  notes?: string;
}

export type ComponentCategory = 'primitive' | 'layout' | 'pattern';

export interface ComponentSchema {
  name: string;
  category: ComponentCategory;
  description: string;
  props: PropSchemaMap;
  variants?: readonly string[];
  slots?: readonly string[];
  examples?: readonly ComponentExample[];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/_schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/_schema.ts src/components/__tests__/_schema.test.ts
git commit -m "feat(components): define shared component schema types"
```

---

## Task 2: Registry auto-indexer

**Files:**
- Create: `src/components/registry.ts`
- Test: `src/components/__tests__/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/registry.test.ts
import { describe, it, expect } from 'vitest';
import { registry, listComponents, getSchema, byCategory } from '../registry';

describe('component registry', () => {
  it('exposes an object (may be empty before any components ship)', () => {
    expect(typeof registry).toBe('object');
    expect(registry).not.toBeNull();
  });

  it('listComponents returns a sorted array', () => {
    const list = listComponents();
    expect(Array.isArray(list)).toBe(true);
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });

  it('getSchema returns undefined for an unknown name', () => {
    expect(getSchema('DefinitelyNotAComponent')).toBeUndefined();
  });

  it('byCategory always returns the three buckets', () => {
    const groups = byCategory();
    expect(groups.primitive).toBeInstanceOf(Array);
    expect(groups.layout).toBeInstanceOf(Array);
    expect(groups.pattern).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/registry.test.ts`
Expected: FAIL — `Cannot find module '../registry'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/registry.ts
/**
 * Central component registry. Auto-imports every capitalised .ts file in
 * this directory (skipping _schema.ts and registry.ts) and indexes them by
 * their `schema.name`. Throws on duplicate names so collisions surface
 * immediately on app boot.
 */
import type { ComponentSchema } from './_schema';

const modules = import.meta.glob<{ schema?: ComponentSchema }>(
  './[A-Z]*.ts',
  { eager: true },
);

export const registry: Record<string, ComponentSchema> = Object.create(null);
const seen = new Set<string>();
for (const path in modules) {
  const s = modules[path].schema;
  if (!s) continue;
  if (seen.has(s.name)) {
    throw new Error(`[components/registry] duplicate schema name: ${s.name} (${path})`);
  }
  seen.add(s.name);
  registry[s.name] = s;
}

export function listComponents(): string[] {
  return Object.keys(registry).sort();
}

export function getSchema(name: string): ComponentSchema | undefined {
  return registry[name];
}

export function byCategory(): Record<ComponentSchema['category'], ComponentSchema[]> {
  const groups: Record<ComponentSchema['category'], ComponentSchema[]> = {
    primitive: [], layout: [], pattern: [],
  };
  for (const s of Object.values(registry)) groups[s.category].push(s);
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/registry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/registry.ts src/components/__tests__/registry.test.ts
git commit -m "feat(components): auto-indexing registry via import.meta.glob"
```

---

## Task 3: Button primitive

**Files:**
- Create: `src/components/Button.ts`
- Test: `src/components/__tests__/Button.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/Button.test.ts
import { describe, it, expect, vi } from 'vitest';
import createButton, { schema } from '../Button';
import { registry } from '../registry';

describe('Button', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Button');
    expect(schema.category).toBe('primitive');
    expect(schema.props.label.required).toBe(true);
  });

  it('renders a button element with default classes', () => {
    const el = createButton({ label: 'Hi' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toContain('btn');
    expect(el.className).toContain('btn-primary');
    expect(el.className).toContain('text-btn-m');
    expect(el.textContent).toBe('Hi');
  });

  it('applies variant + size from props (sm → btn-sm + text-mini)', () => {
    const el = createButton({ label: 'X', variant: 'secondary', size: 'sm' });
    expect(el.className).toContain('btn-secondary');
    expect(el.className).toContain('btn-sm');
    expect(el.className).toContain('text-mini');
  });

  it('size lg adds btn-l + text-btn-l', () => {
    const el = createButton({ label: 'X', size: 'lg' });
    expect(el.className).toContain('btn-l');
    expect(el.className).toContain('text-btn-l');
  });

  it('prepends a Material Symbols span when icon is given', () => {
    const el = createButton({ label: 'X', icon: 'star' });
    const icon = el.querySelector('.ms');
    expect(icon).not.toBeNull();
    expect(icon?.textContent).toBe('star');
  });

  it('respects disabled', () => {
    const el = createButton({ label: 'X', disabled: true });
    expect(el.disabled).toBe(true);
  });

  it('wires onClick', () => {
    const onClick = vi.fn();
    const el = createButton({ label: 'X', onClick });
    el.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('every variant in schema.variants renders without throwing', () => {
    for (const v of schema.variants ?? []) {
      expect(() => createButton({ label: 'X', variant: v as 'primary' })).not.toThrow();
    }
  });

  it('is registered in the registry', () => {
    expect(registry.Button).toBeDefined();
    expect(registry.Button.name).toBe('Button');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Button.test.ts`
Expected: FAIL — `Cannot find module '../Button'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/Button.ts
/**
 * Standard tappable action button. Visual styling delegates to the
 * existing CSS in src/styles/globals.css + tokens.css:
 *   .btn (base) + .btn-<variant> + size-specific size + text class.
 * Sizes:
 *   sm → .btn-sm + .text-mini
 *   md → (no size class) + .text-btn-m  (default)
 *   lg → .btn-l + .text-btn-l
 * Variants currently shipped in CSS: primary, secondary. ghost / danger
 * are intentionally not exposed in v1 — add them when the CSS gets the
 * matching classes.
 */
import type { ComponentSchema } from './_schema';

export type ButtonVariant = 'primary' | 'secondary';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  disabled?: boolean;
  onClick?: () => void;
}

const SIZE_CLASS: Record<ButtonSize, string> = { sm: 'btn-sm', md: '', lg: 'btn-l' };
const TEXT_CLASS: Record<ButtonSize, string> = { sm: 'text-mini', md: 'text-btn-m', lg: 'text-btn-l' };

export const schema: ComponentSchema = {
  name: 'Button',
  category: 'primitive',
  description: 'Tappable action button. Visual styled via existing .btn-* CSS.',
  props: {
    label:    { type: 'string',   required: true },
    variant:  { type: 'enum',     enum: ['primary', 'secondary'], default: 'primary' },
    size:     { type: 'enum',     enum: ['sm', 'md', 'lg'], default: 'md' },
    icon:     { type: 'string',   description: 'Material Symbol name' },
    disabled: { type: 'boolean',  default: false },
    onClick:  { type: 'function' },
  },
  variants: ['primary', 'secondary'],
  examples: [
    { label: 'Primary CTA',  props: { label: '繼續', variant: 'primary', size: 'lg' } },
    { label: 'Small action', props: { label: '取消', variant: 'secondary', size: 'sm' } },
  ],
};

export default function createButton(props: ButtonProps): HTMLButtonElement {
  const { label, variant = 'primary', size = 'md', icon, disabled = false, onClick } = props;
  const btn = document.createElement('button');
  const sizeClass = SIZE_CLASS[size];
  btn.className = ['btn', `btn-${variant}`, sizeClass, TEXT_CLASS[size]].filter(Boolean).join(' ');
  btn.disabled = disabled;
  if (icon) {
    const ic = document.createElement('span');
    ic.className = 'ms';
    ic.textContent = icon;
    btn.append(ic);
  }
  btn.append(document.createTextNode(label));
  if (onClick) btn.addEventListener('click', onClick);
  return btn;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Button.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Button.ts src/components/__tests__/Button.test.ts
git commit -m "feat(components): Button primitive"
```

---

## Task 4: Tag primitive

**Files:**
- Create: `src/components/Tag.ts`
- Test: `src/components/__tests__/Tag.test.ts`
- Modify: `src/styles/globals.css` — add `.tag` block

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/Tag.test.ts
import { describe, it, expect } from 'vitest';
import createTag, { schema } from '../Tag';
import { registry } from '../registry';

describe('Tag', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Tag');
    expect(schema.category).toBe('primitive');
  });

  it('renders a span with default variant class', () => {
    const el = createTag({ label: '推薦' });
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('tag');
    expect(el.className).toContain('tag-default');
    expect(el.textContent).toBe('推薦');
  });

  it('applies variant when given', () => {
    const el = createTag({ label: '硬核', variant: 'warning' });
    expect(el.className).toContain('tag-warning');
  });

  it('every variant renders without throwing', () => {
    for (const v of schema.variants ?? []) {
      expect(() => createTag({ label: 'x', variant: v as 'default' })).not.toThrow();
    }
  });

  it('is registered', () => {
    expect(registry.Tag).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Tag.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/Tag.ts
/**
 * Small inline badge — used as 推薦 / 硬核 pills next to headings,
 * status indicators, etc. Visual is the new generic .tag .tag-<variant>
 * CSS (added in this commit), so we don't reuse the older domain-
 * specific .level-tag class.
 */
import type { ComponentSchema } from './_schema';

export type TagVariant = 'default' | 'secondary' | 'success' | 'warning';

export interface TagProps {
  label: string;
  variant?: TagVariant;
}

export const schema: ComponentSchema = {
  name: 'Tag',
  category: 'primitive',
  description: 'Small inline badge for status / category labels.',
  props: {
    label:   { type: 'string', required: true },
    variant: { type: 'enum',   enum: ['default', 'secondary', 'success', 'warning'], default: 'default' },
  },
  variants: ['default', 'secondary', 'success', 'warning'],
};

export default function createTag(props: TagProps): HTMLSpanElement {
  const { label, variant = 'default' } = props;
  const el = document.createElement('span');
  el.className = `tag tag-${variant}`;
  el.textContent = label;
  return el;
}
```

Append to `src/styles/globals.css` (anywhere after the existing chip rules; put it next to `.level-tag` for proximity):

```css
/* Generic Tag primitive — small inline badge. */
.tag {
  display: inline-block;
  font-size: var(--text-caption-size);
  font-weight: var(--font-weight-bold);
  padding: 2px var(--space-2);
  border-radius: var(--radius-pill);
  vertical-align: middle;
}
.tag-default   { background: var(--color-neutral-light-active); color: var(--color-foreground-alt); }
.tag-secondary { background: var(--color-secondary-light);      color: var(--color-secondary-dark); }
.tag-success   { background: var(--color-primary-light);        color: var(--color-primary-dark); }
.tag-warning   { background: #fde68a;                           color: #92400e; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Tag.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Tag.ts src/components/__tests__/Tag.test.ts src/styles/globals.css
git commit -m "feat(components): Tag primitive"
```

---

## Task 5: FilterChip primitive

**Files:**
- Create: `src/components/FilterChip.ts`
- Test: `src/components/__tests__/FilterChip.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/FilterChip.test.ts
import { describe, it, expect, vi } from 'vitest';
import createFilterChip, { schema } from '../FilterChip';
import { registry } from '../registry';

describe('FilterChip', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('FilterChip');
    expect(schema.category).toBe('primitive');
  });

  it('renders a button with .filter-chip', () => {
    const el = createFilterChip({ label: '中式' });
    expect(el.tagName).toBe('BUTTON');
    expect(el.className).toContain('filter-chip');
    expect(el.textContent).toBe('中式');
  });

  it('selected adds .selected class', () => {
    const el = createFilterChip({ label: 'X', selected: true });
    expect(el.classList.contains('selected')).toBe(true);
  });

  it('value goes onto data-value when given', () => {
    const el = createFilterChip({ label: 'X', value: 'chinese' });
    expect(el.dataset.value).toBe('chinese');
  });

  it('wires onClick', () => {
    const onClick = vi.fn();
    const el = createFilterChip({ label: 'X', onClick });
    el.click();
    expect(onClick).toHaveBeenCalled();
  });

  it('is registered', () => {
    expect(registry.FilterChip).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/FilterChip.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/FilterChip.ts
/**
 * Toggleable filter pill — used in the map page place-type / partner
 * filters. Reuses the existing .filter-chip / .selected CSS rules; this
 * factory only handles state composition + event wiring.
 */
import type { ComponentSchema } from './_schema';

export interface FilterChipProps {
  label: string;
  value?: string;
  selected?: boolean;
  onClick?: () => void;
}

export const schema: ComponentSchema = {
  name: 'FilterChip',
  category: 'primitive',
  description: 'Toggleable filter pill (map filters, etc.).',
  props: {
    label:    { type: 'string',   required: true },
    value:    { type: 'string',   description: 'Stamped onto data-value for CSS / handlers.' },
    selected: { type: 'boolean',  default: false },
    onClick:  { type: 'function' },
  },
};

export default function createFilterChip(props: FilterChipProps): HTMLButtonElement {
  const { label, value, selected = false, onClick } = props;
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'filter-chip' + (selected ? ' selected' : '');
  if (value !== undefined) el.dataset.value = value;
  el.textContent = label;
  if (onClick) el.addEventListener('click', onClick);
  return el;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/FilterChip.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/FilterChip.ts src/components/__tests__/FilterChip.test.ts
git commit -m "feat(components): FilterChip primitive"
```

---

## Task 6: StatChip primitive

**Files:**
- Create: `src/components/StatChip.ts`
- Test: `src/components/__tests__/StatChip.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/StatChip.test.ts
import { describe, it, expect } from 'vitest';
import createStatChip, { schema } from '../StatChip';
import { registry } from '../registry';

describe('StatChip', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('StatChip');
    expect(schema.category).toBe('primitive');
  });

  it('renders icon + value + unit inside .resource-chip', () => {
    const el = createStatChip({ icon: 'eco', value: 420, unit: 'XP', resource: 'xp' });
    expect(el.className).toContain('resource-chip');
    expect(el.dataset.resource).toBe('xp');
    expect(el.querySelector('.ms')?.textContent).toBe('eco');
    expect(el.querySelector('.resource-num')?.textContent).toBe('420');
    expect(el.querySelector('.resource-unit')?.textContent).toBe('XP');
  });

  it('omits unit element when unit is not provided', () => {
    const el = createStatChip({ icon: 'diamond', value: 12 });
    expect(el.querySelector('.resource-unit')).toBeNull();
  });

  it('uses title prop as tooltip', () => {
    const el = createStatChip({ icon: 'eco', value: 1, title: '累計總 XP' });
    expect(el.title).toBe('累計總 XP');
  });

  it('is registered', () => {
    expect(registry.StatChip).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/StatChip.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/StatChip.ts
/**
 * Display chip showing a numeric stat — icon + value + optional unit.
 * Covers the home header XP / gem / card chips (.resource-chip pattern).
 * Reuses the existing .resource-chip / .resource-num / .resource-unit CSS.
 */
import type { ComponentSchema } from './_schema';

export interface StatChipProps {
  icon: string;                // Material Symbol name
  value: number | string;
  unit?: string;
  resource?: string;           // → data-resource attribute for CSS hooks
  title?: string;
}

export const schema: ComponentSchema = {
  name: 'StatChip',
  category: 'primitive',
  description: 'Icon + value + optional unit display (resource header chip).',
  props: {
    icon:     { type: 'string', required: true, description: 'Material Symbol name' },
    value:    { type: 'string', required: true, description: 'number or string — coerced to string' },
    unit:     { type: 'string' },
    resource: { type: 'string', description: 'Stamped onto data-resource for CSS variants' },
    title:    { type: 'string', description: 'Tooltip text' },
  },
};

export default function createStatChip(props: StatChipProps): HTMLDivElement {
  const { icon, value, unit, resource, title } = props;
  const el = document.createElement('div');
  el.className = 'resource-chip';
  if (resource) el.dataset.resource = resource;
  if (title) el.title = title;

  const ic = document.createElement('span');
  ic.className = 'ms';
  ic.textContent = icon;
  el.append(ic);

  const num = document.createElement('span');
  num.className = 'resource-num';
  num.textContent = String(value);
  el.append(num);

  if (unit) {
    const u = document.createElement('span');
    u.className = 'resource-unit';
    u.textContent = unit;
    el.append(u);
  }
  return el;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/StatChip.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/StatChip.ts src/components/__tests__/StatChip.test.ts
git commit -m "feat(components): StatChip primitive"
```

---

## Task 7: ListRow primitive

**Files:**
- Create: `src/components/ListRow.ts`
- Test: `src/components/__tests__/ListRow.test.ts`
- Modify: `src/styles/globals.css` — append `.list-row` block

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/ListRow.test.ts
import { describe, it, expect } from 'vitest';
import createListRow, { schema } from '../ListRow';
import { registry } from '../registry';

describe('ListRow', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('ListRow');
    expect(schema.category).toBe('primitive');
  });

  it('renders a div.list-row containing a body slot', () => {
    const el = createListRow({ body: 'Hello' });
    expect(el.className).toContain('list-row');
    expect(el.querySelector('.list-row-body')?.textContent).toBe('Hello');
  });

  it('renders a leading slot when provided', () => {
    const leading = document.createElement('span');
    leading.textContent = '🥬';
    const el = createListRow({ leading, body: 'lettuce' });
    expect(el.querySelector('.list-row-leading')?.firstChild?.textContent).toBe('🥬');
  });

  it('renders a trailing slot when provided', () => {
    const el = createListRow({ body: 'item', trailing: 'X' });
    expect(el.querySelector('.list-row-trailing')?.textContent).toBe('X');
  });

  it('is registered', () => {
    expect(registry.ListRow).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/ListRow.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/ListRow.ts
/**
 * Three-slot horizontal row primitive — leading / body / trailing.
 * Replaces ad-hoc rows like .meal-row, .edit-row, .dist-row by giving
 * each slot an explicit class hook. Strings or HTMLElements both work
 * in any slot.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface ListRowProps {
  leading?: Slot;
  body: Slot;
  trailing?: Slot;
}

export const schema: ComponentSchema = {
  name: 'ListRow',
  category: 'primitive',
  description: 'Three-slot row (leading / body / trailing).',
  props: {
    leading:  { type: 'element', description: 'Optional left slot (icon, emoji, image)' },
    body:     { type: 'element', required: true, description: 'Main content' },
    trailing: { type: 'element', description: 'Optional right slot (action, value)' },
  },
  slots: ['leading', 'body', 'trailing'],
};

function attach(parent: HTMLElement, slotClass: string, content: Slot): void {
  const wrap = document.createElement('div');
  wrap.className = slotClass;
  if (typeof content === 'string') {
    wrap.textContent = content;
  } else {
    wrap.append(content);
  }
  parent.append(wrap);
}

export default function createListRow(props: ListRowProps): HTMLDivElement {
  const { leading, body, trailing } = props;
  const row = document.createElement('div');
  row.className = 'list-row';
  if (leading !== undefined) attach(row, 'list-row-leading', leading);
  attach(row, 'list-row-body', body);
  if (trailing !== undefined) attach(row, 'list-row-trailing', trailing);
  return row;
}
```

Append to `src/styles/globals.css`:

```css
/* Generic ListRow primitive — three-slot horizontal layout. */
.list-row {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-2) var(--space-3);
  background: var(--color-neutral-light);
  border-radius: 10px;
}
.list-row-leading  { flex: 0 0 auto; display: flex; align-items: center; }
.list-row-body     { flex: 1; min-width: 0; }
.list-row-trailing { flex: 0 0 auto; display: flex; align-items: center; gap: var(--space-2); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/ListRow.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ListRow.ts src/components/__tests__/ListRow.test.ts src/styles/globals.css
git commit -m "feat(components): ListRow primitive"
```

---

## Task 8: Card primitive

**Files:**
- Create: `src/components/Card.ts`
- Test: `src/components/__tests__/Card.test.ts`
- Modify: `src/styles/globals.css` — append `.card-shell` block

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/Card.test.ts
import { describe, it, expect } from 'vitest';
import createCard, { schema } from '../Card';
import { registry } from '../registry';

describe('Card', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Card');
    expect(schema.category).toBe('primitive');
  });

  it('renders a div.card-shell with default variant', () => {
    const el = createCard({ children: 'body' });
    expect(el.className).toContain('card-shell');
    expect(el.className).toContain('card-default');
    expect(el.textContent).toBe('body');
  });

  it('applies the requested variant class', () => {
    const el = createCard({ children: 'x', variant: 'raised' });
    expect(el.className).toContain('card-raised');
  });

  it('accepts an HTMLElement array as children', () => {
    const a = document.createElement('p'); a.textContent = 'a';
    const b = document.createElement('p'); b.textContent = 'b';
    const el = createCard({ children: [a, b] });
    expect(el.children.length).toBe(2);
  });

  it('is registered', () => {
    expect(registry.Card).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Card.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/Card.ts
/**
 * Generic content card — padded, rounded container with optional
 * shadow. Use Card whenever you need a content surface that isn't a
 * full-screen layout. Three variants share the same shape, differ only
 * in elevation.
 */
import type { ComponentSchema } from './_schema';

export type CardVariant = 'default' | 'flat' | 'raised';

export interface CardProps {
  children: HTMLElement | HTMLElement[] | string;
  variant?: CardVariant;
}

export const schema: ComponentSchema = {
  name: 'Card',
  category: 'primitive',
  description: 'Padded rounded content container, three elevation variants.',
  props: {
    children: { type: 'element', required: true, description: 'String, HTMLElement, or array of elements' },
    variant:  { type: 'enum',    enum: ['default', 'flat', 'raised'], default: 'default' },
  },
  variants: ['default', 'flat', 'raised'],
};

export default function createCard(props: CardProps): HTMLDivElement {
  const { children, variant = 'default' } = props;
  const card = document.createElement('div');
  card.className = `card-shell card-${variant}`;
  if (typeof children === 'string') {
    card.textContent = children;
  } else if (Array.isArray(children)) {
    for (const c of children) card.append(c);
  } else {
    card.append(children);
  }
  return card;
}
```

Append to `src/styles/globals.css`:

```css
/* Generic Card primitive — content surface with three elevations. */
.card-shell {
  background: var(--color-card, #fff);
  border-radius: 14px;
  padding: var(--space-4);
}
.card-default { box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); }
.card-flat    { box-shadow: none; }
.card-raised  { box-shadow: 0 6px 18px rgba(0, 0, 0, 0.10); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Card.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Card.ts src/components/__tests__/Card.test.ts src/styles/globals.css
git commit -m "feat(components): Card primitive"
```

---

## Task 9: Banner primitive

**Files:**
- Create: `src/components/Banner.ts`
- Test: `src/components/__tests__/Banner.test.ts`
- Modify: `src/styles/globals.css` — append `.banner-shell` block

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/Banner.test.ts
import { describe, it, expect } from 'vitest';
import createBanner, { schema } from '../Banner';
import { registry } from '../registry';

describe('Banner', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Banner');
    expect(schema.category).toBe('primitive');
  });

  it('renders emoji + title + body', () => {
    const el = createBanner({ emoji: '🎉', title: 'Hello', body: 'sub' });
    expect(el.className).toContain('banner-shell');
    expect(el.querySelector('.banner-emoji')?.textContent).toBe('🎉');
    expect(el.querySelector('.banner-title')?.textContent).toBe('Hello');
    expect(el.querySelector('.banner-body')?.textContent).toBe('sub');
  });

  it('omits emoji when not provided', () => {
    const el = createBanner({ title: 'Plain' });
    expect(el.querySelector('.banner-emoji')).toBeNull();
  });

  it('appends action elements when provided', () => {
    const a = document.createElement('button'); a.textContent = 'OK';
    const el = createBanner({ title: 'X', actions: [a] });
    expect(el.querySelector('.banner-actions button')?.textContent).toBe('OK');
  });

  it('applies variant class', () => {
    const el = createBanner({ title: 'X', variant: 'warning' });
    expect(el.className).toContain('banner-warning');
  });

  it('is registered', () => {
    expect(registry.Banner).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Banner.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/components/Banner.ts
/**
 * Highlighted full-width info card — emoji + title + body + optional
 * action buttons. Covers the AHA first-banner and the meat-detection
 * banner patterns. Four variants tint the background + border.
 */
import type { ComponentSchema } from './_schema';

export type BannerVariant = 'info' | 'success' | 'warning' | 'meat-prompt';

export interface BannerProps {
  title: string;
  body?: string;
  emoji?: string;
  actions?: HTMLElement[];
  variant?: BannerVariant;
}

export const schema: ComponentSchema = {
  name: 'Banner',
  category: 'primitive',
  description: 'Highlighted info card with emoji + title + body + actions.',
  props: {
    title:   { type: 'string',  required: true },
    body:    { type: 'string',  description: 'Subtext below the title' },
    emoji:   { type: 'string',  description: 'Leading emoji or symbol' },
    actions: { type: 'array',   itemType: 'element', description: 'Buttons rendered in a trailing row' },
    variant: { type: 'enum',    enum: ['info', 'success', 'warning', 'meat-prompt'], default: 'info' },
  },
  variants: ['info', 'success', 'warning', 'meat-prompt'],
};

export default function createBanner(props: BannerProps): HTMLDivElement {
  const { title, body, emoji, actions, variant = 'info' } = props;
  const root = document.createElement('div');
  root.className = `banner-shell banner-${variant}`;

  if (emoji) {
    const e = document.createElement('span');
    e.className = 'banner-emoji';
    e.textContent = emoji;
    root.append(e);
  }

  const text = document.createElement('div');
  text.className = 'banner-body-wrap';
  const t = document.createElement('strong');
  t.className = 'banner-title';
  t.textContent = title;
  text.append(t);
  if (body) {
    const b = document.createElement('p');
    b.className = 'banner-body';
    b.textContent = body;
    text.append(b);
  }
  root.append(text);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'banner-actions';
    for (const btn of actions) a.append(btn);
    root.append(a);
  }
  return root;
}
```

Append to `src/styles/globals.css`:

```css
/* Generic Banner primitive — highlighted callout. */
.banner-shell {
  display: flex; align-items: flex-start; gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: 14px;
  border: 1px solid transparent;
}
.banner-emoji { font-size: 26px; line-height: 1; }
.banner-body-wrap { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.banner-title { font-size: var(--text-button-m-size); color: var(--color-foreground); font-weight: var(--font-weight-extrabold); }
.banner-body  { font-size: var(--text-mini-size); color: var(--color-foreground-alt); margin: 0; line-height: 1.5; }
.banner-actions { display: flex; gap: var(--space-2); align-items: center; }

.banner-info        { background: var(--color-neutral-light);   border-color: var(--color-neutral-light-active); }
.banner-success     { background: var(--color-primary-light);   border-color: var(--color-primary); }
.banner-warning     { background: #fef3c7;                      border-color: #f59e0b; }
.banner-meat-prompt { background: #fef3c7;                      border-color: #f59e0b; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/Banner.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Banner.ts src/components/__tests__/Banner.test.ts src/styles/globals.css
git commit -m "feat(components): Banner primitive"
```

---

## Task 10: Modal + Sheet layout primitives

**Files:**
- Create: `src/components/Modal.ts`
- Create: `src/components/Sheet.ts`
- Test: `src/components/__tests__/Modal.test.ts`
- Test: `src/components/__tests__/Sheet.test.ts`
- Modify: `src/styles/globals.css` — append `.modal-shell` / `.sheet-shell` blocks

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/__tests__/Modal.test.ts
import { describe, it, expect, vi } from 'vitest';
import createModal, { schema } from '../Modal';
import { registry } from '../registry';

describe('Modal', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Modal');
    expect(schema.category).toBe('layout');
  });

  it('renders an overlay with a card containing title + body', () => {
    const el = createModal({ title: 'Hello', body: 'world' });
    expect(el.className).toContain('modal-shell');
    expect(el.querySelector('.modal-card')).not.toBeNull();
    expect(el.querySelector('.modal-title')?.textContent).toBe('Hello');
    expect(el.querySelector('.modal-body')?.textContent).toBe('world');
  });

  it('open=false sets hidden', () => {
    const el = createModal({ title: 'X', body: 'y', open: false });
    expect(el.hidden).toBe(true);
  });

  it('open=true is visible', () => {
    const el = createModal({ title: 'X', body: 'y', open: true });
    expect(el.hidden).toBe(false);
  });

  it('appends action buttons', () => {
    const btn = document.createElement('button'); btn.textContent = 'OK';
    const el = createModal({ title: 'X', body: 'y', actions: [btn] });
    expect(el.querySelector('.modal-actions button')?.textContent).toBe('OK');
  });

  it('clicking the backdrop fires onClose', () => {
    const onClose = vi.fn();
    const el = createModal({ title: 'X', body: 'y', onClose });
    el.click();   // root is the backdrop
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the inner card does not fire onClose', () => {
    const onClose = vi.fn();
    const el = createModal({ title: 'X', body: 'y', onClose });
    (el.querySelector('.modal-card') as HTMLElement).click();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('is registered', () => {
    expect(registry.Modal).toBeDefined();
  });
});
```

```typescript
// src/components/__tests__/Sheet.test.ts
import { describe, it, expect } from 'vitest';
import createSheet, { schema } from '../Sheet';
import { registry } from '../registry';

describe('Sheet', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Sheet');
    expect(schema.category).toBe('layout');
  });

  it('renders a .sheet-shell with a card aligned to the bottom', () => {
    const el = createSheet({ title: 'Edit', body: 'content' });
    expect(el.className).toContain('sheet-shell');
    expect(el.querySelector('.sheet-card')).not.toBeNull();
  });

  it('is registered', () => {
    expect(registry.Sheet).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/__tests__/Modal.test.ts src/components/__tests__/Sheet.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write minimal implementations**

```typescript
// src/components/Modal.ts
/**
 * Centered overlay with a card. Tap the backdrop to close (calls
 * onClose). Tap inside the card does nothing. Use Modal for short
 * decisions / prompts; use Sheet for forms anchored to the bottom edge.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface ModalProps {
  title: string;
  body: Slot;
  actions?: HTMLElement[];
  open?: boolean;
  onClose?: () => void;
}

export const schema: ComponentSchema = {
  name: 'Modal',
  category: 'layout',
  description: 'Centered overlay with a card body and optional action row.',
  props: {
    title:   { type: 'string',  required: true },
    body:    { type: 'element', required: true },
    actions: { type: 'array',   itemType: 'element' },
    open:    { type: 'boolean', default: true },
    onClose: { type: 'function' },
  },
};

function attach(parent: HTMLElement, content: Slot): void {
  if (typeof content === 'string') parent.append(document.createTextNode(content));
  else parent.append(content);
}

export default function createModal(props: ModalProps): HTMLDivElement {
  const { title, body, actions, open = true, onClose } = props;
  const root = document.createElement('div');
  root.className = 'modal-shell';
  root.hidden = !open;

  const card = document.createElement('div');
  card.className = 'modal-card';
  card.addEventListener('click', (e) => e.stopPropagation());

  const t = document.createElement('h2');
  t.className = 'modal-title text-h3';
  t.textContent = title;
  card.append(t);

  const b = document.createElement('div');
  b.className = 'modal-body';
  attach(b, body);
  card.append(b);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'modal-actions';
    for (const btn of actions) a.append(btn);
    card.append(a);
  }

  root.append(card);
  if (onClose) root.addEventListener('click', () => onClose());
  return root;
}
```

```typescript
// src/components/Sheet.ts
/**
 * Bottom-anchored overlay with a card. Same internals as Modal but the
 * card slides up from the bottom edge. Used for forms / editors where
 * the keyboard might cover a centered modal on mobile.
 */
import type { ComponentSchema } from './_schema';

type Slot = HTMLElement | string;

export interface SheetProps {
  title: string;
  body: Slot;
  actions?: HTMLElement[];
  open?: boolean;
  onClose?: () => void;
}

export const schema: ComponentSchema = {
  name: 'Sheet',
  category: 'layout',
  description: 'Bottom-aligned overlay (a Modal that slides up from the bottom).',
  props: {
    title:   { type: 'string',  required: true },
    body:    { type: 'element', required: true },
    actions: { type: 'array',   itemType: 'element' },
    open:    { type: 'boolean', default: true },
    onClose: { type: 'function' },
  },
};

function attach(parent: HTMLElement, content: Slot): void {
  if (typeof content === 'string') parent.append(document.createTextNode(content));
  else parent.append(content);
}

export default function createSheet(props: SheetProps): HTMLDivElement {
  const { title, body, actions, open = true, onClose } = props;
  const root = document.createElement('div');
  root.className = 'sheet-shell';
  root.hidden = !open;

  const card = document.createElement('div');
  card.className = 'sheet-card';
  card.addEventListener('click', (e) => e.stopPropagation());

  const t = document.createElement('h2');
  t.className = 'sheet-title text-h3';
  t.textContent = title;
  card.append(t);

  const b = document.createElement('div');
  b.className = 'sheet-body';
  attach(b, body);
  card.append(b);

  if (actions && actions.length > 0) {
    const a = document.createElement('div');
    a.className = 'sheet-actions';
    for (const btn of actions) a.append(btn);
    card.append(a);
  }

  root.append(card);
  if (onClose) root.addEventListener('click', () => onClose());
  return root;
}
```

Append to `src/styles/globals.css`:

```css
/* Modal + Sheet overlay primitives. Backdrop shares colour; card alignment differs. */
.modal-shell, .sheet-shell {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(15, 23, 25, 0.45);
  padding: var(--space-4);
  display: flex;
}
.modal-shell { align-items: center; justify-content: center; }
.sheet-shell { align-items: flex-end; justify-content: center; }
.modal-shell[hidden], .sheet-shell[hidden] { display: none; }

.modal-card, .sheet-card {
  width: 100%; max-width: 420px;
  background: var(--color-card, #fff);
  border-radius: 18px;
  padding: var(--space-5);
  display: flex; flex-direction: column; gap: var(--space-3);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  max-height: 85vh; overflow-y: auto;
}
.sheet-card { border-radius: 18px 18px 0 0; }
.modal-title, .sheet-title { margin: 0; color: var(--color-primary-dark); }
.modal-actions, .sheet-actions { display: flex; gap: var(--space-3); margin-top: var(--space-2); }
.modal-actions .btn, .sheet-actions .btn { flex: 1; }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/__tests__/Modal.test.ts src/components/__tests__/Sheet.test.ts`
Expected: PASS (10 tests across the two files).

- [ ] **Step 5: Commit**

```bash
git add src/components/Modal.ts src/components/Sheet.ts src/components/__tests__/Modal.test.ts src/components/__tests__/Sheet.test.ts src/styles/globals.css
git commit -m "feat(components): Modal + Sheet layout primitives"
```

---

## Task 11: Migrate Progress to schema shape

**Files:**
- Modify: `src/components/Progress.ts` — rewrite to new convention
- Create: `src/components/__tests__/Progress.test.ts`
- Modify (5 callers): `src/routes/onboarding/diet-survey.ts`, `src/routes/onboarding/baseline.ts`, `src/routes/onboarding/purpose.ts`, `src/routes/onboarding/day1-hook.ts`, `src/routes/onboarding/pet-name.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/__tests__/Progress.test.ts
import { describe, it, expect } from 'vitest';
import createProgress, { schema } from '../Progress';
import { registry } from '../registry';

describe('Progress', () => {
  it('schema basics', () => {
    expect(schema.name).toBe('Progress');
    expect(schema.category).toBe('pattern');
    expect(schema.props.current.required).toBe(true);
    expect(schema.props.total.required).toBe(true);
  });

  it('renders total dots, current marked done', () => {
    const el = createProgress({ current: 3, total: 5 });
    expect(el.querySelectorAll('.onb-progress-dot').length).toBe(5);
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(3);
  });

  it('current = 0 renders all dots un-done', () => {
    const el = createProgress({ current: 0, total: 4 });
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(0);
  });

  it('current = total renders all dots done', () => {
    const el = createProgress({ current: 4, total: 4 });
    expect(el.querySelectorAll('.onb-progress-dot.done').length).toBe(4);
  });

  it('is registered', () => {
    expect(registry.Progress).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/Progress.test.ts`
Expected: FAIL — `default export is not a function` (since current Progress.ts exports a named `createProgress`, not default).

- [ ] **Step 3: Rewrite `src/components/Progress.ts`**

```typescript
// src/components/Progress.ts
/**
 * Onboarding progress dots — N segments, the first M filled with `.done`.
 *
 * Migrated to the schema-driven shape: now a default factory taking a
 * props object, plus a `schema` export so the registry can index it.
 */
import type { ComponentSchema } from './_schema';

export interface ProgressProps {
  current: number;
  total: number;
}

export const schema: ComponentSchema = {
  name: 'Progress',
  category: 'pattern',
  description: 'Horizontal row of N dots, first M filled. Used at the top of onboarding screens.',
  props: {
    current: { type: 'number', required: true, description: '1-based count of completed steps' },
    total:   { type: 'number', required: true, description: 'Total number of steps' },
  },
  examples: [
    { label: 'Onboarding 3/5', props: { current: 3, total: 5 } },
  ],
};

export default function createProgress(props: ProgressProps): HTMLElement {
  const { current, total } = props;
  const wrap = document.createElement('div');
  wrap.className = 'onb-progress';
  for (let i = 1; i <= total; i++) {
    const dot = document.createElement('span');
    dot.className = 'onb-progress-dot' + (i <= current ? ' done' : '');
    wrap.appendChild(dot);
  }
  return wrap;
}

// Backwards-compatible named export so callers can migrate in one go.
export { createProgress };
```

- [ ] **Step 4: Update each onboarding caller to use the props-object signature**

In all five files, replace the `${createProgress(N, 5).outerHTML}` calls with `${createProgress({ current: N, total: 5 }).outerHTML}`:

`src/routes/onboarding/diet-survey.ts` — change `createProgress(1, 5)` → `createProgress({ current: 1, total: 5 })`
`src/routes/onboarding/baseline.ts`    — change `createProgress(2, 5)` → `createProgress({ current: 2, total: 5 })`
`src/routes/onboarding/purpose.ts`     — change `createProgress(3, 5)` → `createProgress({ current: 3, total: 5 })`
`src/routes/onboarding/day1-hook.ts`   — change `createProgress(4, 5)` → `createProgress({ current: 4, total: 5 })`
`src/routes/onboarding/pet-name.ts`    — change `createProgress(5, 5)` → `createProgress({ current: 5, total: 5 })`

Imports stay the same (`import { createProgress } from '@/components/Progress'`).

- [ ] **Step 5: Run full test suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — all existing tests + the new Progress test.

- [ ] **Step 6: Commit**

```bash
git add src/components/Progress.ts src/components/__tests__/Progress.test.ts src/routes/onboarding/diet-survey.ts src/routes/onboarding/baseline.ts src/routes/onboarding/purpose.ts src/routes/onboarding/day1-hook.ts src/routes/onboarding/pet-name.ts
git commit -m "refactor(components): migrate Progress to schema-driven shape"
```

---

## Task 12: Migrate PetView to schema shape

**Files:**
- Modify: `src/components/PetView.ts` — add schema export, keep API
- Create: `src/components/__tests__/PetView.test.ts` (if missing)

- [ ] **Step 1: Read the current PetView.ts to understand its signature**

Run: `cat src/components/PetView.ts | head -40`

PetView's current factory signature is whatever it currently is (`createPetView(...)`). The migration **keeps the existing signature** — we just add a `schema` export and a default export pointing to the existing factory. Callers don't change.

- [ ] **Step 2: Write the failing test**

```typescript
// src/components/__tests__/PetView.test.ts
import { describe, it, expect } from 'vitest';
import { schema } from '../PetView';
import { registry } from '../registry';

describe('PetView', () => {
  it('exports a schema with name "PetView" + category "pattern"', () => {
    expect(schema.name).toBe('PetView');
    expect(schema.category).toBe('pattern');
  });

  it('is registered', () => {
    expect(registry.PetView).toBeDefined();
  });
});
```

If a `PetView.test.ts` already exists, append these two cases instead of creating a new file.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/__tests__/PetView.test.ts`
Expected: FAIL — `schema` is not exported.

- [ ] **Step 4: Add the schema export to `src/components/PetView.ts`**

Append (do not replace the existing factory) to the top of the file, after imports:

```typescript
import type { ComponentSchema } from './_schema';

export const schema: ComponentSchema = {
  name: 'PetView',
  category: 'pattern',
  description: 'Pet display component used on /home — stage sprite + mood + level.',
  props: {},
  examples: [],
};
```

(props/examples can be filled in later; v1 just needs the name+category so the registry can index it.)

Also ensure the existing factory is exported as `default` (in addition to whatever named export already exists). If it's currently `export function createPetView(...)`, add `export default createPetView;` at the bottom of the file.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/__tests__/PetView.test.ts`
Expected: PASS.

- [ ] **Step 6: Run full test suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — all tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/PetView.ts src/components/__tests__/PetView.test.ts
git commit -m "refactor(components): expose PetView schema for registry"
```

---

## Task 13: Adopt createButton in splash.ts

**Files:**
- Modify: `src/routes/splash.ts` — replace the two `<button class="btn ...">` blocks with `createButton({...})` and wire handlers via the props
- Modify: `src/routes/__tests__/splash.test.ts` — update assertions if needed

- [ ] **Step 1: Read the current splash.ts and splash.test.ts to confirm the button structure**

Run: `cat src/routes/splash.ts`
Run: `cat src/routes/__tests__/splash.test.ts`

You'll see two `<button>` elements (`#get-started` and `#goto-login`) inside `<div class="splash-actions" id="splash-actions" hidden>`, with their click handlers wired separately further down the file.

- [ ] **Step 2: Write the failing assertion in `src/routes/__tests__/splash.test.ts`**

Append this case inside the existing `describe('splash route', ...)` block:

```typescript
  it('renders the two CTAs as Button-component output (has .btn class)', () => {
    mockedUser.$isLoggedIn.get.mockReturnValue(false);
    const el = splash();
    const start = el.querySelector('#get-started');
    const login = el.querySelector('#goto-login');
    expect(start?.classList.contains('btn')).toBe(true);
    expect(start?.classList.contains('btn-primary')).toBe(true);
    expect(login?.classList.contains('btn')).toBe(true);
    expect(login?.classList.contains('btn-secondary')).toBe(true);
  });
```

- [ ] **Step 3: Run the test to verify the new case still passes (the existing HTML already includes those classes)**

Run: `npx vitest run src/routes/__tests__/splash.test.ts`
Expected: PASS (the existing markup already satisfies the new assertion — this case is a regression guard for the refactor below).

- [ ] **Step 4: Refactor `src/routes/splash.ts` to use `createButton`**

Replace the existing innerHTML block with this:

```typescript
import { $isLoggedIn, setLoggedInUser } from '@/store/user';
import { navigate } from '@/router';
import { registerGuest } from '@/api/auth';
import createButton from '@/components/Button';

export default function splash(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'splash';
  wrap.innerHTML = `
    <div class="splash-logo">
      <div class="splash-logo-mark">🌿</div>
      <div class="splash-title text-title is-latin">Yummi Go</div>
      <div class="splash-tagline">吃出更好的自己 · 養好你的寵物</div>
    </div>
    <div class="splash-loader" id="splash-loader">
      <div class="dot"></div><div class="dot"></div><div class="dot"></div>
    </div>
    <div class="splash-actions" id="splash-actions" hidden>
      <p class="splash-error" id="guest-error" hidden></p>
    </div>
  `;

  const actions = wrap.querySelector<HTMLElement>('#splash-actions')!;
  const errorEl = wrap.querySelector<HTMLElement>('#guest-error')!;

  const startBtn = createButton({
    label: 'Get Started',
    variant: 'primary',
    size: 'lg',
  });
  startBtn.id = 'get-started';
  actions.insertBefore(startBtn, errorEl);

  const loginBtn = createButton({
    label: '已有帳號 — 登入',
    variant: 'secondary',
    size: 'lg',
    onClick: () => navigate('/login'),
  });
  loginBtn.id = 'goto-login';
  actions.insertBefore(loginBtn, errorEl);

  setTimeout(() => {
    if ($isLoggedIn.get()) {
      navigate('/home');
      return;
    }
    const loader = wrap.querySelector<HTMLElement>('#splash-loader');
    if (loader) loader.hidden = true;
    actions.hidden = false;
  }, 1200);

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    startBtn.textContent = '準備中…';
    try {
      const u = await registerGuest();
      setLoggedInUser(u);
      navigate('/onboarding/diet-survey');
    } catch (e) {
      console.error('[splash] registerGuest failed:', e);
      startBtn.disabled = false;
      startBtn.textContent = 'Get Started';
      errorEl.hidden = false;
      errorEl.textContent = '建立帳號失敗，請稍後再試或選擇登入。';
    }
  });

  return wrap;
}
```

Notes:
- `createButton` puts the label as a text node, so `startBtn.textContent = '準備中…'` still works (it replaces all text nodes inside the button).
- The `id` attributes are set imperatively after the factory call so existing selectors keep working.
- `onClick` for the login button uses the schema-friendly prop; the start button's click is wired separately because it needs access to the `errorEl` closure.

- [ ] **Step 5: Run full test suite to verify nothing regressed**

Run: `npx vitest run`
Expected: PASS — all tests including the splash.test.ts cases.

- [ ] **Step 6: Run a production build to catch any TS issues**

Run: `npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add src/routes/splash.ts src/routes/__tests__/splash.test.ts
git commit -m "feat(splash): adopt Button component as the schema convention proof"
```

---

## Acceptance checklist (verify before declaring v1 done)

- [ ] `_schema.ts` types are exhaustive: covers `PropType`, `PropSchema`, `ComponentSchema`, `ComponentCategory`, `ComponentExample`.
- [ ] `registry.ts` exposes `registry`, `listComponents`, `getSchema`, `byCategory` and throws on duplicate `schema.name`.
- [ ] Seven new components exist with schema + tests: Button, Tag, FilterChip, StatChip, ListRow, Card, Banner.
- [ ] Modal + Sheet exist with schema + tests.
- [ ] Progress + PetView export `schema` and are registered.
- [ ] `splash.ts` renders its two CTAs via `createButton`.
- [ ] `npx vitest run` shows all tests passing (existing 444 + ~50 new component tests).
- [ ] `npm run build` succeeds.
- [ ] Manual sanity check: open the deployed app, splash page still works, onboarding still works, map filter chips still work.
