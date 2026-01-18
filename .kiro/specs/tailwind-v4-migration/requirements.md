# Requirements Document

## Introduction

This document specifies the requirements for completing the Tailwind CSS v3 to v4 migration for the Toast-Stats frontend application. The migration was partially completed via a dependabot PR (commit 1aff9a6) which updated dependencies and postcss configuration but did not complete the full migration, resulting in visual issues throughout the application.

## Glossary

- **Migration_System**: The set of changes required to complete the Tailwind v4 migration
- **Theme_Configuration**: The CSS-first configuration system using `@theme` directive in Tailwind v4
- **Design_Token_System**: The existing CSS custom properties defined in `frontend/src/styles/tokens/`
- **Utility_Class**: Tailwind CSS utility classes used in component files (e.g., `bg-gray-100`, `text-white`)
- **Default_Color_Palette**: The standard Tailwind color palette (gray, red, green, yellow, blue, etc.)
- **Brand_Colors**: Toastmasters brand colors (TM Loyal Blue, TM True Maroon, TM Cool Gray, TM Happy Yellow, TM Black, TM White)
- **Renamed_Utility**: Utility classes that changed names between v3 and v4 (e.g., `shadow-sm` → `shadow-xs`)

## Requirements

### Requirement 1: Complete @theme Configuration

**User Story:** As a developer, I want the Tailwind v4 @theme configuration to be complete, so that all design tokens are available as Tailwind utilities.

#### Acceptance Criteria

1. THE Theme_Configuration SHALL include all Brand_Colors with their opacity variations (10% increments)
2. THE Theme_Configuration SHALL include font family definitions for `tm-headline` and `tm-body`
3. THE Theme_Configuration SHALL include the complete spacing scale from the Design_Token_System
4. THE Theme_Configuration SHALL include border radius values from the Design_Token_System
5. THE Theme_Configuration SHALL include font sizes with line heights from the Design_Token_System
6. THE Theme_Configuration SHALL include font weights from the Design_Token_System
7. THE Theme_Configuration SHALL include letter spacing values from the Design_Token_System
8. WHEN the @theme block is parsed THEN the Migration_System SHALL produce no CSS warnings or errors

### Requirement 2: Import Default Tailwind Color Palette

**User Story:** As a developer, I want the default Tailwind color palette available, so that existing components using gray, red, green, yellow, and blue colors continue to work.

#### Acceptance Criteria

1. THE Migration_System SHALL make the gray color palette available (gray-50 through gray-900)
2. THE Migration_System SHALL make the red color palette available (red-50 through red-900)
3. THE Migration_System SHALL make the green color palette available (green-50 through green-900)
4. THE Migration_System SHALL make the yellow color palette available (yellow-50 through yellow-900)
5. THE Migration_System SHALL make the blue color palette available (blue-50 through blue-900)
6. THE Migration_System SHALL make the amber color palette available (amber-50 through amber-900)
7. WHEN a component uses `bg-gray-100` THEN the Migration_System SHALL apply the correct gray background color

### Requirement 3: Update Renamed Utility Classes

**User Story:** As a developer, I want all renamed utility classes updated to their v4 equivalents, so that styling works correctly.

#### Acceptance Criteria

1. WHEN a component uses `shadow-sm` THEN the Migration_System SHALL update it to `shadow-xs`
2. WHEN a component uses `shadow` (default) THEN the Migration_System SHALL update it to `shadow-sm`
3. WHEN a component uses `rounded-sm` THEN the Migration_System SHALL update it to `rounded-xs`
4. WHEN a component uses `rounded` (default) THEN the Migration_System SHALL update it to `rounded-sm`
5. WHEN a component uses `outline-none` THEN the Migration_System SHALL update it to `outline-hidden`
6. WHEN a component uses `ring` (default width) THEN the Migration_System SHALL update it to `ring-3`

### Requirement 4: Handle Default Border and Ring Color Changes

**User Story:** As a developer, I want border and ring colors to work correctly, so that component styling is consistent with v3 behavior.

#### Acceptance Criteria

1. WHEN a component uses `border` without explicit color THEN the Migration_System SHALL ensure the border color matches v3 behavior (gray-200 equivalent)
2. WHEN a component uses `ring` without explicit color THEN the Migration_System SHALL ensure the ring color matches v3 behavior (blue-500 equivalent)
3. IF a component relies on default border color THEN the Migration_System SHALL add explicit border color classes where needed

### Requirement 5: Remove Legacy tailwind.config.js

**User Story:** As a developer, I want the configuration to be CSS-first, so that the project follows Tailwind v4 best practices.

#### Acceptance Criteria

1. THE Migration_System SHALL migrate all configuration from `tailwind.config.js` to the @theme block
2. WHEN migration is complete THEN the Migration_System SHALL remove or deprecate `tailwind.config.js`
3. THE Migration_System SHALL preserve all custom color, spacing, typography, and gradient configurations

### Requirement 6: Maintain Brand Compliance

**User Story:** As a developer, I want brand compliance maintained after migration, so that the application follows Toastmasters brand guidelines.

#### Acceptance Criteria

1. THE Migration_System SHALL preserve all Toastmasters brand colors exactly as specified
2. THE Migration_System SHALL preserve typography using Montserrat (headlines) and Source Sans 3 (body)
3. THE Migration_System SHALL preserve 44px minimum touch targets
4. THE Migration_System SHALL maintain WCAG AA accessibility compliance (4.5:1 contrast ratio for text)
5. WHEN migration is complete THEN the visual appearance SHALL match the pre-migration state

### Requirement 7: Build and Test Verification

**User Story:** As a developer, I want the build to succeed without warnings, so that I can confidently deploy the application.

#### Acceptance Criteria

1. WHEN running `npm run build` THEN the Migration_System SHALL produce no CSS compilation errors
2. WHEN running `npm run build` THEN the Migration_System SHALL produce no @theme CSS warnings
3. THE Migration_System SHALL ensure all existing tests continue to pass
4. WHEN the IDE parses index.css THEN the Migration_System SHALL produce no "Unknown at rule @theme" warnings

### Requirement 8: Preserve Existing Design Token Integration

**User Story:** As a developer, I want the existing design token system to continue working, so that custom utility classes remain functional.

#### Acceptance Criteria

1. THE Migration_System SHALL preserve CSS custom properties from `colors.css`
2. THE Migration_System SHALL preserve CSS custom properties from `typography.css`
3. THE Migration_System SHALL preserve CSS custom properties from `spacing.css`
4. THE Migration_System SHALL preserve CSS custom properties from `gradients.css`
5. WHEN a component uses `var(--tm-loyal-blue)` THEN the Migration_System SHALL resolve to the correct color value
