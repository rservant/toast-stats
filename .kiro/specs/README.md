# Active Specifications

This directory contains all specifications that are currently active for development or maintenance.

## Active Specifications

### 🚧 IN PROGRESS

#### analytics-engine-migration/

**Status**: ~90% Complete  
**Purpose**: Migrate AnalyticsEngine from legacy DistrictCacheManager to PerDistrictSnapshotStore  
**Remaining**: Optional property tests

#### data-refresh-architecture/

**Status**: ~80% Complete  
**Purpose**: Snapshot-based architecture separating data refresh from read operations  
**Remaining**: Admin endpoints, performance monitoring, optional property tests

#### district-scoped-data-collection/

**Status**: ~70% Complete  
**Purpose**: Configurable district selection with per-district snapshot storage  
**Remaining**: Performance monitoring, optional property tests, final validation

#### raw-csv-cache-system/

**Status**: ~85% Complete  
**Purpose**: Raw CSV caching for ToastmastersScraper with cache-first lookup  
**Remaining**: Monitoring, performance optimization, optional property tests

#### unified-backfill-service/

**Status**: ~90% Complete  
**Purpose**: Modern unified BackfillService replacing legacy services  
**Remaining**: Final checkpoint validation

### ⏳ NOT STARTED

#### club-health-classification/

**Status**: 0% Complete  
**Purpose**: 2D club health classification model with health status and trajectory  
**Notes**: Large feature spec with 17 major tasks

## Archived Specifications

Completed specifications have been moved to `.kiro/specs-archive/` for historical reference:

- `assessment-module-removal/` - Assessment module cleanup (complete)
- `closing-period-api-integration/` - Closing period snapshot handling (complete)
- `toastmasters-district-visualizer/` - Original project specification (fully implemented)
- `district-level-data/` - District analytics features (fully implemented)
- `dcp-goal-counting-fix/` - Analytics bug fixes (complete)
- `district-rankings-improvements/` - Ranking system enhancements (complete)
- `toastmasters-brand-compliance/` - Brand design system (complete)
- `test-infrastructure-stabilization/` - Test reliability improvements (complete)
- `cache-location-configuration/` - Unified cache configuration (complete)
- `clubs-table-column-filtering/` - Table filtering enhancements (complete)
- `distinguished-status-calculation-fix/` - Distinguished status logic fix (complete)
- `001-assessment-worksheet-generator/` - Assessment worksheet generation (complete)

See `.kiro/specs-archive/README.md` for details on archived specifications.

## Navigation

- **Project Overview**: [../../PROJECT_STATUS.md](../../PROJECT_STATUS.md)
- **Main README**: [../../README.md](../../README.md)
- **Archived Specs**: [specs-archive/README.md](specs-archive/README.md)

---

**Last Updated**: January 8, 2026  
**Maintained By**: Development Team
