# GEMINI.md — Antigravity Configuration for Kisan-Trace

## Project Context
**App:** Kisan-Trace
**Stack:** React (PWA), LiteRT (WASM), RxDB, Node.js
**Stage:** MVP Implementation
**User Level:** C (In-Between) - Agent takes the lead on core functionality.

## Directives
1. **Master Plan:** Always read `AGENTS.md` first. It contains the active phase and roadmap.
2. **Documentation:** Refer to `agent_docs/` for specific patterns and the tech stack.
3. **Plan-First:** Propose a detailed step-by-step plan before writing any code.
4. **Resilience Engineering:** Refer to `TechDesign-KisanTrace-MVP.md` Section 6 for edge cases (OOM, heat, blur).
5. **On-Device Focus:** Prioritize performance and memory efficiency. No large dependencies.
6. **Communication:** Be concise. Focus on technical implementation and verification.

## Commands
- `npm install` — Initial setup
- `npm run dev` — Local development
- `npm test` — Run all tests
- `npm run build` — Build production PWA
- `npm run preview` — Test PWA locally
