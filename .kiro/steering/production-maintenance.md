# Toast-Stats Maintenance Steering Document (Internal / Small Group)

## Status

Internal reference document describing the intended operation and maintenance posture of the Toast-Stats application during its personal and small-group usage phase.

## Scope

This document applies to Toast-Stats while it is used primarily by its maintainer and a small, known group of users.  
The application is not publicly marketed, externally supported, or subject to uptime guarantees during this phase.

## Purpose

Toast-Stats exists to support analysis and decision-making related to Toastmasters district and club data.  
The application emphasizes correctness, usability, and low operational overhead over scalability or public availability.

## Operating Context

- The application is operated by a small number of trusted users.
- Users are personally known to the maintainer.
- There is no service-level agreement or on-call expectation.
- Deployment is typically single-instance.
- Operational simplicity is prioritized.

## Data Sources

- Primary data originates from scraped Toastmasters dashboard content.
- Scraped data is subject to change, latency, and occasional failure.
- The application treats scraping as an unreliable external dependency.

## Data Handling Model

- Application data is stored as discrete, time-ordered snapshots.
- Each snapshot represents a complete, normalized view of the source data at a specific point in time.
- One snapshot is designated as the current snapshot and represents the latest available successful data.
- Historical snapshots remain available for inspection and comparison.
- Snapshots are immutable once created.
- Each snapshot includes metadata such as:
  - creation timestamp
  - source identifier
  - schema version
  - calculation or scoring version
  - success or failure status
  - error information when applicable
  
## Last-Known-Good Data

- The application presents the most recent successful snapshot as the default data source.
- Previously successful snapshots remain available when newer refresh attempts fail.
- Users are able to see the timestamp associated with the data currently being displayed.

## Refresh Model

- Data refresh is an explicit operation.
- Refresh execution is separate from normal read access.
- Refresh operations may be triggered manually or via scheduled execution.
- Refresh failures do not invalidate previously successful snapshots.

## Read Model

- Normal application usage reads data from stored snapshots.
- The current snapshot is used as the default data source.
- Users may request data from a specific historical snapshot.
- Read operations do not initiate scraping or data refresh.
- Application responsiveness is independent of scraping performance.

## Historical Data Access

- Historical snapshots are treated as first-class application data.
- Users are able to view data as it existed at a specific point in time.
- Historical views reflect the schema and calculation version associated with the selected snapshot.
- Historical data is not retroactively recalculated when scoring or computation logic changes.
- Comparisons across snapshots are possible due to consistent normalization and metadata.

## Computation and Scoring

- Computation and scoring logic is applied to snapshot data.
- Each snapshot records the calculation or scoring version used to produce its results.
- Changes to computation or scoring logic result in new calculation versions.
- Newly created snapshots use the current calculation version at the time of creation.
- Historical snapshots retain the calculation version originally applied.
- Comparisons across snapshots account for calculation version differences through recorded metadata.
- Historical data reflects the results as computed at the time the snapshot was created.

## Terminology

- **Snapshot** refers to an immutable, time-specific representation of normalized application data and its derived results.
- **Current Snapshot** refers to the most recent successful snapshot and represents the latest available data.
- **Historical Snapshot** refers to any snapshot other than the current snapshot.
- **Refresh** refers to the process that creates a new snapshot from source data.
- **Read Operation** refers to retrieval of data from an existing snapshot.
- **Calculation Version** refers to the specific set of computation or scoring rules applied to a snapshot.
- **Schema Version** refers to the structural definition of the normalized data contained in a snapshot.

## Data Lifecycle

Data enters the system through an explicit refresh operation that retrieves source information and normalizes it into a snapshot. The snapshot is created with associated schema and calculation versions and recorded with success or failure status. When successful, the snapshot becomes the current snapshot and is used as the default data source for read operations. Previously created snapshots remain unchanged and available for historical access. Read operations retrieve data from the current or selected historical snapshot without initiating refresh activity. Over time, multiple snapshots accumulate, representing a time-ordered record of application data and derived results.

## Testing Focus

- Testing concentrates on correctness of key calculations and derived metrics.
- Golden test cases are used to validate stable outputs for known inputs.
- Snapshot-based data enables repeatable test scenarios independent of live scraping.

## Failure Modes

- Scraping failures are expected and tolerated.
- Application functionality continues using the last successful snapshot when failures occur.
- Failure information is recorded alongside snapshot metadata.

## Monitoring and Visibility

- Refresh activity produces structured logs including timing and outcome.
- Application health endpoints indicate runtime availability and snapshot presence.
- Data freshness is visible to users through snapshot metadata.

## Security Posture

- The application handles publicly visible Toastmasters data.
- Administrative actions are restricted to trusted users.
- Secrets and credentials are stored outside the source repository.

## Deployment Characteristics

- The application is deployed in a low-complexity environment.
- Manual deployment and rollback are acceptable.
- Recovery is achieved by redeploying the application and restoring snapshot data.

## Change Management

- Changes to data models, calculations, or refresh logic are documented.
- Snapshot versioning provides traceability across changes.
- Historical data remains interpretable within its original context.

## Future Considerations

- Public availability is a possible future state.
- Current architecture preserves clear seams for future authentication, scaling, and observability.
- No public-facing commitments are implied by the current operating model.
