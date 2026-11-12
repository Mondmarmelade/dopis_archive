# E2E Test Infra: Dopis Mobile Flutter Client

## Test Philosophy
- Opaque-box, requirement-driven. Derived from `ORIGINAL_REQUEST.md` and user-facing specifications.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.
- Progressive Testability: Each tier verifies standalone capabilities without requiring more complex unverified internals.

## Feature Inventory Mapping
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|--------|:------:|:------:|:------:|
| 1 | Scaffolding & Build | ORIGINAL_REQUEST §Acceptance Criteria | 5 | 5 | ✓ |
| 2 | Auth & IMAP Login | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| 3 | Local Session Persistence | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ |
| 4 | Mailbox Stream & Folder Switch | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| 5 | Unread vs Read Formatting | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| 6 | Initial Avatars & Date Formatting | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ |
| 7 | Email Detail & Reading View | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| 8 | Quick Actions (Star, Archive, Trash) | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| 9 | AI Summary & Action Items | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ |
| 10 | Poppins Font & Brand Palette | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |
| 11 | Small-Screen Layout (360dp) | ORIGINAL_REQUEST R4 | 5 | 5 | ✓ |

## Test Architecture
- Framework: Flutter Test (`flutter_test`) executing standalone integration and widget tests with simulated HTTP backend server / client mock handlers.
- Test Cases Root: `apps/mobile_flutter/test/e2e/`
- Pass/Fail semantics: Exit code 0, all assertions pass, zero `RenderFlex` overflow errors.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Cold Start -> Login -> Fetch Inbox -> Read Unread Mail | F2, F3, F4, F5, F7 | High |
| 2 | Star Mail -> Archive Mail -> Switch to Archiv -> Verify Presence | F4, F7, F8 | High |
| 3 | Open Newsletter -> Trigger AI Summary -> Toggle Action Checklist | F4, F7, F9 | High |
| 4 | Switch between all 4 German folders -> Pull to refresh | F4, F5, F6 | Medium |
| 5 | Viewport Stress (360x640dp compact display) with long subjects | F10, F11 | High |

## Coverage Thresholds
- Tier 1 (Feature Coverage): >= 55 test cases (5 per feature across 11 features).
- Tier 2 (Boundary & Corner Cases): >= 55 test cases.
- Tier 3 (Cross-Feature Combinations): >= 11 pairwise test cases.
- Tier 4 (Real-World Application Scenarios): >= 5 application-level end-to-end workflows.
- Total Target: >= 126 test cases.
