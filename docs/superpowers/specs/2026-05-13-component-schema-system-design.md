# Component Schema System — Design Spec

**Date:** 2026-05-13
**Status:** Draft — pending user review
**Author:** Brainstorm with Claude

## Goal

Build a lightweight, schema-driven component registry so AI agents and human devs can extend the Yummi Go prototype reliably as the component count grows. Each component carries its own schema as a sibling export, and a central registry indexes them automatically via Vite's `import.meta.glob`. No base class, no decorators, no runtime DSL.

## Why now

- The prototype currently inlines repeated UI patterns directly in route HTML (`.btn-*`, `.resource-chip`, `.meal-row`, `.dist-row`, `.first-banner` …). Future agents have no way to discover them other than grep.
- Each new feature copies an HTML block, drifts visually, and adds another place to break.
- We want the next 6–12 months of edits — many of them AI-driven — to feel like editing a known, finite catalog rather than mutating a bag of strings.

## Non-goals (out of v1 scope)

- Rewriting every route to use components. v1 ships the catalog and migrates a handful of high-leverage primitives; routes can adopt incrementally afterward.
- Visual storybook / `/dev/components` page. The flow viewer brainstorm (subsystem B) is the natural place for that.
- Runtime prop validation. TypeScript catches misuse at compile time; we add dev-only asserts only if a concrete bug demands it.
- Class-based component framework, decorators, JSX, virtual DOM. None of these.

## Architecture

```
src/components/
├── _schema.ts          # shared types: ComponentSchema, PropSchema, etc.
├── registry.ts         # auto-index via import.meta.glob
├── Button.ts           # new
├── Chip.ts             # new
├── Modal.ts            # new (overlay + card pattern)
├── Sheet.ts            # new (bottom-sheet)
├── ListRow.ts          # new
├── Card.ts             # new
├── Banner.ts           # new (first-banner / meat-banner pattern)
├── Progress.ts         # existing — adds schema
├── PetView.ts          # existing — adds schema
├── Layout.ts           # existing — left as-is in v1
├── TabBar.ts           # existing — left as-is in v1
├── DevPanel.ts         # existing — left as-is in v1
├── InstallPrompt.ts    # existing — left as-is in v1
└── __tests__/
    ├── registry.test.ts # auto smoke: every glob'd file exports a schema
    └── <Name>.test.ts   # per-component
```

### Three rules every component file follows

1. **One file, one component.** Average length under 80 lines. Exceeding that means it should be split or it's a "pattern" not a "primitive".
2. **Three exports, in this order:** `<Name>Props` interface → `schema` const → default `create<Name>` factory function. Anything else is allowed but those three are the contract.
3. **No `class`, no decorator, no runtime DSL.** Plain TS types + plain object literal schema.

## Schema shape

```typescript
// _schema.ts
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
  enum?: readonly string[];        // when type === 'enum'
  itemType?: PropType;             // when type === 'array'
  description?: string;            // short, human-readable
}

export type PropSchemaMap = Record<string, PropSchema>;

export interface ComponentExample {
  label: string;
  props: Record<string, unknown>;
  notes?: string;
}

export type ComponentCategory = 'primitive' | 'layout' | 'pattern';

export interface ComponentSchema {
  name: string;                        // 'Button' — must match the factory name suffix
  category: ComponentCategory;
  description: string;                 // one-line purpose
  props: PropSchemaMap;
  variants?: readonly string[];        // distinct visual variants
  slots?: readonly string[];           // named child placeholders
  examples?: readonly ComponentExample[];
}
```

### Category guidance

- **primitive** — atomic tap targets / display chunks: `Button`, `Chip`, `ListRow`, `Card`, `Banner`
- **layout** — overlay/container patterns: `Modal`, `Sheet`
- **pattern** — domain-specific assemblies: `PetView`, `Progress`

Categories drive grouping in the future catalog page; they have no runtime effect.

## Component file template

```typescript
// Button.ts
import type { ComponentSchema } from './_schema';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;          // Material Symbol name
  disabled?: boolean;
  onClick?: () => void;
}

export const schema: ComponentSchema = {
  name: 'Button',
  category: 'primitive',
  description: 'Tappable action button. Visual styled via existing .btn-* CSS.',
  props: {
    label:    { type: 'string',   required: true },
    variant:  { type: 'enum',     enum: ['primary', 'secondary', 'ghost', 'danger'], default: 'primary' },
    size:     { type: 'enum',     enum: ['sm', 'md', 'lg'], default: 'md' },
    icon:     { type: 'string',   description: 'Material Symbol name' },
    disabled: { type: 'boolean',  default: false },
    onClick:  { type: 'function' },
  },
  variants: ['primary', 'secondary', 'ghost', 'danger'],
  examples: [
    { label: 'Primary CTA', props: { label: '繼續', variant: 'primary', size: 'lg' } },
    { label: 'Destructive', props: { label: '刪除', variant: 'danger' } },
  ],
};

export default function createButton(props: ButtonProps): HTMLButtonElement {
  const { label, variant = 'primary', size = 'md', icon, disabled = false, onClick } = props;
  const btn = document.createElement('button');
  btn.className = `btn btn-${variant} btn-${size} text-btn-${size}`;
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

## Registry

```typescript
// registry.ts
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

The glob pattern `./[A-Z]*.ts` matches only capitalised filenames, so `_schema.ts` and `registry.ts` are automatically excluded.

## Migration scope (v1)

### Phase 1 — Foundation (one task)
- `_schema.ts` + `registry.ts` + `registry.test.ts`

### Phase 2 — New primitives (six tasks, seven components)
Each task = one component file + its tests. No route migration in this phase; that's Phase 4's job.

1. **Button** — covers `.btn .btn-*` usage
2. **Chip** — covers `.resource-chip`, `.filter-chip`, `.level-tag`
3. **ListRow** — covers `.meal-row`, `.edit-row`, `.dist-row`
4. **Card** — generic content container (e.g., wallet card on home)
5. **Banner** — covers `.first-banner`, `.meat-banner` (icon + body + optional actions)
6. **Modal** + **Sheet** (one task, two components) — same overlay+card mechanic, two presets (centred modal vs. bottom sheet)

### Phase 3 — Migrate existing (two tasks)
7. **Progress** — keep behaviour, add `schema` export, rename `createProgress` to `default`
8. **PetView** — same

### Phase 4 — Adopt in one route (one task)
Pick one well-trafficked route (e.g. `splash.ts`) and replace inline `<button class="btn...">` with `createButton({...})`. Validates the convention end-to-end. The rest of the routes adopt opportunistically as they're edited.

### Deferred
`Layout`, `TabBar`, `DevPanel`, `InstallPrompt` get schemas in a later pass — they work fine and aren't blocking the next feature.

## Testing

### Per-component (`<Name>.test.ts`)
- Smoke: factory returns the right tag with the right CSS classes
- For each value in `schema.variants`: factory renders without throwing
- Event wiring: simulated click triggers `onClick`

### Registry-level (`registry.test.ts`)
- Every glob'd file exposes a `schema` export
- `schema.name` is unique across the registry
- For every component: instantiating with `defaults` only (no extra props) does not throw
- For every component: each `examples[i].props` instantiates without throwing

## AI introspection workflow

For agents working on a follow-up feature:

```typescript
import { listComponents, getSchema } from '@/components/registry';

listComponents();          // ['Banner', 'Button', 'Card', ...]
getSchema('Button');       // → full schema, variants, examples, defaults
```

Plus: opening any `<Name>.ts` shows the schema right next to the factory. Two source-of-truth rules guarantee an agent can't be misled:
- The `schema` export is in the same file as the factory it describes
- Every component in `src/components/` is reachable via `registry`

## Error handling

- **Compile time:** TS catches wrong prop types at every call site (the factory signature is the contract).
- **Module load:** `registry.ts` throws on duplicate `schema.name` values. Caught immediately on `npm run dev`.
- **Runtime:** No prop validation in v1. If a class of bug ever shows up (e.g., agent passes a string where number is expected and TS slips), we add a `validateProps(schema, props)` dev-only helper in a later pass.

## Acceptance criteria for v1

- [ ] `_schema.ts` defines the types above
- [ ] `registry.ts` auto-indexes every `<Name>.ts` and throws on duplicate names
- [ ] Seven new primitive components (Button, Chip, ListRow, Card, Banner, Modal, Sheet) ship with schema + tests
- [ ] Progress + PetView migrated to new shape (schema + default export)
- [ ] One route (`splash.ts`) adopts `createButton`, demonstrating end-to-end usage
- [ ] `registry.test.ts` smoke passes for all components
- [ ] No regression in existing tests (currently 444 passing)
- [ ] `npm run build` clean
