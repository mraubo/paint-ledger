---
project: "Paint Ledger"
version: 1
status: draft
created: 2026-05-21
context_type: greenfield
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

Hobbysta malujący modele nie ma jednego, wygodnego miejsca do zapisywania procesu malowania: kolejnych kroków, użytych farb, zdjęć oraz krótkich notatek o pochodzeniu modelu. Informacje są rozproszone między notatkami, luźnymi zdjęciami, Discordem, telefonem albo folderami na dysku, więc po czasie trudno odtworzyć sprawdzony przepis, powtórzyć schemat kolorów albo szybko sprawdzić, skąd pochodził model i gdzie szukać go ponownie.

Paint Ledger ma rozwiązać ten problem prostym, uporządkowanym paint logiem: jeden wpis łączy tutorial, przepis kolorystyczny i notatkę warsztatową. Kluczowy insight MVP to to, że receptura malowania nie jest samą listą kroków ani samą listą farb, tylko połączeniem modelu, jego pochodzenia, palety farb, kolejnych działań i efektu końcowego w jednym miejscu.

## User & Persona

**Primary persona:** pojedynczy hobbysta malujący modele, początkowo sam autor produktu jako pierwszy użytkownik.

- **Kontekst:** Maluje modele w domowym warsztacie i chce zachować proces w sposób łatwy do ponownego odczytu.
- **Moment użycia:** Po sesji malowania lub po ukończeniu modelu zapisuje przepis; po czasie wraca do wpisu, żeby odtworzyć kolejność działań, kolory i pochodzenie modelu.
- **Koszt dzisiaj:** Musi ręcznie łączyć informacje z notatek, zdjęć, folderów, Discorda albo pamięci, co utrudnia powtórzenie sprawdzonego schematu.

## Success Criteria

### Primary

- Użytkownik może w mniej niż 10 minut dodać kompletny wpis dla jednego modelu: podstawowe dane, informację o modelu i jego pochodzeniu, listę farb, kilka kroków ze zdjęciami i przypisanymi farbami oraz zdjęcia efektu końcowego.
- Użytkownik może po czasie wejść w zapisany wpis i bez zgadywania zobaczyć, jak model był malowany: co robił, jakimi farbami i w jakiej kolejności.

### Secondary

- Użytkownik zapisuje i ponownie otwiera co najmniej 3 pełne wpisy bez potrzeby prowadzenia dodatkowych notatek poza aplikacją.
- W co najmniej 80% kroków użytkownik przypisuje farby z wcześniej zdefiniowanej listy zamiast wpisywać je ręcznie.
- Użytkownik potrafi odnaleźć informację o pochodzeniu modelu bez szukania w innych miejscach.

### Guardrails

- Zalogowany użytkownik widzi i edytuje tylko własne wpisy.
- Wpis ma zastąpić równoległe notatki poza aplikacją; jeżeli nadal trzeba szukać informacji w telefonie, Discordzie albo folderach, MVP nie spełnia obietnicy.
- Przy przypisywaniu farb do kroków użytkownik widzi czytelne karty farb pokazujące co najmniej nazwę farby i kolor.

## User Stories

### US-01: Add and reopen a complete paint log

- **Given** a logged-in user who wants to document a painted model
- **When** they create an entry with basic information, a custom model origin note, a paint list, ordered steps with assigned paints and optional one-photo step evidence, and a final model photo
- **Then** they can save it, find it later in a simple list, and open the detail view to see the model, paints, steps, photos, and final result without using external notes

#### Acceptance Criteria

- The entry can be completed in less than 10 minutes for a typical model recipe.
- Paints assigned to steps must come from the entry-level paint list.
- Each assigned paint is visible on the step as a card with at least paint name and approximate color.
- The detail view contains enough information to recreate the sequence of painting steps without searching outside the app.
- The entry is visible only to the user who created it.

## Functional Requirements

### Authentication & Data Isolation

- FR-001: User can sign up and log in. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; login stays because the MVP uses private user-owned entries.
- FR-002: User can view and edit only entries they created. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; data isolation is required for account-based private notes.

### Entries & Model Origin

- FR-003: User can create a paint log entry with title, short description, model information, and status; new entries default to draft and can be marked ready or published. Priority: must-have
  > Socrates: Counter-argument considered: entry type and status can be unclear without a larger workflow. Resolution: entry type removed from MVP; status stays because draft -> ready/published is useful and simple.
- FR-004: User can record model origin as a custom note, such as STL source, shop, producer, link, or where to find files on disk. Priority: must-have
  > Socrates: Counter-argument considered: structured origin fields may create too much form overhead. Resolution: MVP uses one custom origin note instead of separate producer/shop/link/source fields.

### Paints

- FR-005: User can define a paint list for the entry with paint name, brand, a typed color or color description, and an approximate color chosen with a picker. Priority: must-have
  > Socrates: Counter-argument considered: color entry could become heavier than needed. Resolution: use a plain input plus approximate color picker for MVP; dropdown dictionaries may come later if time allows.
- FR-006: User can assign paints to tutorial steps from the entry paint list, and can add a missing paint from the step flow so it becomes part of the entry paint list. Priority: must-have
  > Socrates: Counter-argument considered: users may need to add a paint while writing a step. Resolution: allow inline add, but keep the invariant that assigned paints belong to the entry-level list.
- FR-007: User can see assigned paints on a step as cards showing at least paint name and approximate color. Priority: must-have
  > Socrates: Counter-argument considered: UI colors may not accurately represent physical paint. Resolution: color is an approximate visual cue, not a guarantee of exact paint appearance.

### Tutorial Steps & Photos

- FR-008: User can create ordered tutorial steps with a text description. Priority: must-have
  > Socrates: Counter-argument considered: step title may be redundant if order and description already exist. Resolution: remove step title from MVP.
- FR-009: User can attach up to one optional photo to each tutorial step. Priority: must-have
  > Socrates: Counter-argument considered: multiple photos per step add media complexity. Resolution: step photo is optional and limited to one photo per step in MVP.
- FR-010: User can attach at least one final model photo in a separate final result area. Priority: must-have
  > Socrates: Counter-argument considered: a final photo area adds form and detail-view cost. Resolution: keep one separate final photo because the final result is central to later recall.

### Browsing & Detail View

- FR-011: User can open an entry detail view showing model information, model origin note, paint list, ordered tutorial steps, assigned paints, optional step photos, and final model photo. Priority: must-have
  > Socrates: Counter-argument considered: no counter-argument; this is the main recall surface for the product.
- FR-012: User can browse saved entries in a simple list. Priority: must-have
  > Socrates: Counter-argument considered: at low entry counts the list can remain minimal. Resolution: keep a simple list without advanced filtering or search.

## Non-Functional Requirements

- Entries, photos, paint lists, and model-origin notes are private by default and visible only to the authenticated owner unless a future sharing feature explicitly changes that.
- Saving an entry gives the user a clear success confirmation or an actionable error, so they are not left unsure whether their painting recipe was preserved.

## Business Logic

Paint Ledger treats a paint log entry as the source of truth for its own painting recipe: paints assigned to steps must belong to the entry-level paint list, missing paints added during step writing become part of that list, and entries move through a simple draft -> ready/published workflow.

Inputs visible to the user are the entry's basic information, custom origin note, paint list, ordered step descriptions, optional step photos, assigned paints, and final model photo. The output is one coherent paint log entry that can be reopened later to reconstruct what was painted, which paints were used, and in what order.

## Access Control

- **MVP:** Logowanie wymagane.
- **Izolacja danych:** Zalogowany użytkownik widzi i edytuje tylko wpisy utworzone przez siebie.
- **Role:** Brak ról w MVP; model dostępu jest płaski.

## Non-Goals

- **Advanced tagging, filtering, and full-text search** — explicitly outside MVP even though it becomes important at 100x scale.
- **Community features** — no public profiles, follows, comments, likes, or sharing in MVP.
- **Automatic paint recognition or intelligent step suggestions** — the user records paints and steps manually.
- **Expanded manufacturer or paint catalog** — no synchronization with external paint databases and no imports from other applications.
- **Pro-level editor** — no drag and drop, timelines, conditional sections, or rich formatting.
- **Offline-first, native mobile, or cross-platform sync** — MVP is a web app with account-based access.
- **Paint inventory, model wishlist, or miniature collection management** — these are separate modules, not part of the paint-log recipe workflow.
- **Tutorial versioning, recipe comparison, paint scaling, or shopping checklist generation** — these are beyond the first product shape.

## Open Questions

1. **No open questions captured.** — Quality cross-check accepted in the source notes: Access Control, one-sentence domain rule, `timeline_budget.mvp_weeks: 3`, and Non-Goals are present.
