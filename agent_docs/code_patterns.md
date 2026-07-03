# Code Patterns

## Purpose
This file defines implementation patterns to ensure Kisan-Trace remains performant on low-end hardware.

## Architecture Pattern
- **Primary pattern:** Feature-based layered architecture.
- **Rule:** Isolate AI logic (`src/ai/`) from the UI. The UI should only know how to send an image and receive a label.
- **Rule:** Use Web Workers for all LiteRT inference tasks to prevent UI jank.

## Data Fetching
- **Primary approach:** Local-first with RxDB.
- **Rule:** Components read from RxDB observables. Sync logic is decoupled in a separate background service.

## State Management
- **Server state:** Managed via RxDB replication.
- **Client state:** React `useState` / `useContext` (keep it simple).
- **Forms:** Native HTML forms with controlled inputs.

## Error Handling
- Use the `safeInference` pattern (see `tech_stack.md`) to handle AI failures without crashing the UI.
- Handle `QuotaExceededError` in IndexedDB by triggering the pruning strategy defined in Tech Design.

## File and Naming Conventions
- **Files:** kebab-case.
- **Components:** PascalCase.
- **AI Models:** Versioned naming (e.g., `model_v1_int8.tflite`).

## Testing Pattern
- Unit tests for all coordinate/math utilities and sync conflict logic.
- E2E tests for the "Airplane Mode" diagnostic flow.

## Change Discipline
- **DO NOT** change the LiteRT configuration or WASM load path without testing on a physical 2GB RAM device.
- **DO NOT** add heavy UI libraries (like large 3D chart libs) that could exceed our 8MB total budget.
