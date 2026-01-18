# Implementation Plan: Tailwind CSS v4 Migration

## Overview

This implementation plan completes the Tailwind CSS v3 to v4 migration by:

1. Completing the @theme configuration in index.css
2. Importing default Tailwind color palettes
3. Updating renamed utility classes throughout the codebase
4. Removing the legacy tailwind.config.js
5. Verifying build and test success

## Tasks

- [x] 1. Complete @theme Configuration in index.css
  - [x] 1.1 Add complete brand color definitions with all opacity variations to @theme
    - Add TM Loyal Blue with 10-100% opacity variations
    - Add TM True Maroon with 10-100% opacity variations
    - Add TM Cool Gray with 10-100% opacity variations
    - Add TM Happy Yellow with 10-100% opacity variations
    - Add TM Black with 10-100% opacity variations
    - Add TM White with 10-100% opacity variations
    - _Requirements: 1.1, 6.1_
  - [x] 1.2 Add typography configuration to @theme
    - Add font-family definitions for tm-headline (Montserrat) and tm-body (Source Sans 3)
    - Add font-size definitions with line-height values
    - Add font-weight definitions
    - Add letter-spacing definitions
    - _Requirements: 1.2, 1.5, 1.6, 1.7, 6.2_
  - [x] 1.3 Add spacing and layout configuration to @theme
    - Add spacing scale (xs, sm, md, lg, xl, 2xl, 3xl)
    - Add touch target spacing (44px)
    - Add border-radius values (sm, md, lg, xl, 2xl)
    - _Requirements: 1.3, 1.4, 6.3_
  - [x] 1.4 Add gradient configurations to @theme
    - Add brand gradient definitions
    - Add overlay gradient definitions
    - _Requirements: 5.3_

- [x] 2. Import Default Tailwind Color Palettes
  - [x] 2.1 Add default color palette definitions to @theme
    - Add gray color palette (gray-50 through gray-900)
    - Add red color palette (red-50 through red-900)
    - Add green color palette (green-50 through green-900)
    - Add yellow color palette (yellow-50 through yellow-900)
    - Add blue color palette (blue-50 through blue-900)
    - Add amber color palette (amber-50 through amber-900)
    - Add white color definition
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. Update Renamed Utility Classes
  - [x] 3.1 Update shadow utility classes in component files
    - Replace `shadow-sm` with `shadow-xs` throughout codebase
    - Replace standalone `shadow` with `shadow-sm` (exclude shadow-md, shadow-lg, etc.)
    - _Requirements: 3.1, 3.2_
  - [x] 3.2 Update rounded utility classes in component files
    - Replace `rounded-sm` with `rounded-xs` throughout codebase
    - Replace standalone `rounded` with `rounded-sm` (exclude rounded-md, rounded-lg, etc.)
    - _Requirements: 3.3, 3.4_
  - [x] 3.3 Update outline and ring utility classes
    - Replace `outline-none` with `outline-hidden`
    - Replace standalone `ring` with `ring-3`
    - _Requirements: 3.5, 3.6_

- [x] 4. Handle Default Border and Ring Color Changes
  - [x] 4.1 Add explicit border colors where needed
    - Identify components using `border` class without color specification
    - Add explicit `border-gray-200` or `border-gray-300` where needed
    - _Requirements: 4.1, 4.3_
  - [x] 4.2 Add explicit ring colors where needed
    - Identify components using `ring` class without color specification
    - Add explicit ring color classes where needed (e.g., `ring-blue-500`)
    - _Requirements: 4.2_

- [x] 5. Checkpoint - Verify CSS Configuration
  - Run `npm run build` to verify no CSS compilation errors
  - Visually inspect key pages for styling issues
  - _Requirements: 7.1, 7.2_

- [x] 6. Remove Legacy Configuration
  - [x] 6.1 Verify all tailwind.config.js settings are migrated to @theme
    - Compare tailwind.config.js entries with @theme entries
    - Ensure no configuration is lost
    - _Requirements: 5.1, 5.3_
  - [x] 6.2 Remove tailwind.config.js
    - Delete the file after confirming migration is complete
    - _Requirements: 5.2_

- [x] 7. Build and Test Verification
  - [x] 7.1 Run build verification
    - Execute `npm run build` and verify success
    - Check for any CSS warnings or errors
    - _Requirements: 7.1, 7.2_
  - [x] 7.2 Run existing test suite
    - Execute `npm run test` and verify all tests pass
    - _Requirements: 7.3_
  - [x] 7.3 Verify design token CSS custom properties work
    - Manually verify `var(--tm-loyal-blue)` resolves correctly
    - Verify typography tokens are accessible
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Final Checkpoint - Complete Migration Verification
  - Ensure all tests pass
  - Verify visual appearance matches pre-migration state
  - Confirm no CSS compilation warnings

## Notes

- Property-based tests are NOT included per PBT steering guidance - this is a styling/configuration change where failures are immediately observable through visual inspection and build errors
- Simple verification through build success and visual inspection provides equivalent confidence
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- The implementation uses TypeScript as specified in the existing codebase
