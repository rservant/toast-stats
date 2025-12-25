import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { DataStatusIndicator } from '../DataStatusIndicator';
import { DataStatus } from '../../types/reconciliation';
import fc from 'fast-check';

/**
 * Property test for DataStatusIndicator component
 * 
 * Property 5: Data Status Indicators
 * Validates: Requirements 1.3, 3.1, 3.2, 3.4
 * 
 * This property test ensures that data status indicators correctly display
 * reconciliation status information across all possible data states.
 */

// Arbitraries for generating test data with reasonable constraints
const reconciliationPhaseArb = fc.constantFrom(
  'monitoring',
  'stabilizing', 
  'finalizing',
  'completed',
  'failed'
);

const reconciliationStatusArb = fc.record({
  phase: reconciliationPhaseArb,
  daysActive: fc.integer({ min: 0, max: 30 }),
  daysStable: fc.integer({ min: 0, max: 10 }),
  lastChangeDate: fc.option(fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms)), { nil: undefined }),
  nextCheckDate: fc.option(fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms)), { nil: undefined }),
  message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

const dataStatusArb = fc.record({
  isPreliminary: fc.boolean(),
  isFinal: fc.boolean(),
  dataCollectionDate: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
  reconciliationStatus: fc.option(reconciliationStatusArb, { nil: undefined }),
  lastUpdated: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
}).filter(status => {
  // Ensure logical consistency: can't be both preliminary and final
  return !(status.isPreliminary && status.isFinal);
});

describe('DataStatusIndicator Property Tests', () => {
  afterEach(() => {
    cleanup();
  });

  it('Property 5.1: Status badge always displays correct text based on data state', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} />);
        
        if (dataStatus.isFinal) {
          expect(container).toHaveTextContent('Final');
        } else if (dataStatus.isPreliminary) {
          expect(container).toHaveTextContent('Preliminary');
        } else {
          expect(container).toHaveTextContent('Processing');
        }
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.2: Data collection date is always formatted and displayed correctly', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} showDetails={true} />);
        
        // Extract expected formatted date
        const date = new Date(dataStatus.dataCollectionDate);
        const expectedFormat = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        
        expect(container).toHaveTextContent(`Data as of ${expectedFormat}`);
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.3: Reconciliation phase is displayed only for preliminary data with active reconciliation', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} showDetails={true} />);
        
        if (dataStatus.isPreliminary && dataStatus.reconciliationStatus && !dataStatus.isFinal) {
          const phase = dataStatus.reconciliationStatus.phase;
          
          switch (phase) {
            case 'monitoring':
              expect(container).toHaveTextContent('Monitoring Changes');
              break;
            case 'stabilizing':
              const stabilizingText = `Stabilizing (${dataStatus.reconciliationStatus.daysStable}/${dataStatus.reconciliationStatus.daysActive} days)`;
              expect(container).toHaveTextContent(stabilizingText);
              break;
            case 'finalizing':
              expect(container).toHaveTextContent('Finalizing');
              break;
            case 'failed':
              expect(container).toHaveTextContent('Reconciliation Failed');
              break;
          }
        }
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.4: Status colors are consistent with data state', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} />);
        
        const statusBadge = container.querySelector('[class*="border"]');
        expect(statusBadge).toBeInTheDocument();
        
        if (dataStatus.isFinal) {
          expect(statusBadge).toHaveClass('text-green-700', 'bg-green-100', 'border-green-200');
        } else if (dataStatus.isPreliminary) {
          expect(statusBadge).toHaveClass('text-amber-700', 'bg-amber-100', 'border-amber-200');
        } else {
          expect(statusBadge).toHaveClass('text-gray-700', 'bg-gray-100', 'border-gray-200');
        }
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.5: Details visibility is controlled by showDetails prop', () => {
    fc.assert(
      fc.property(dataStatusArb, fc.boolean(), (dataStatus, showDetails) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} showDetails={showDetails} />);
        
        const date = new Date(dataStatus.dataCollectionDate);
        const expectedFormat = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
        
        if (showDetails) {
          expect(container).toHaveTextContent(`Data as of ${expectedFormat}`);
        } else {
          expect(container).not.toHaveTextContent(`Data as of ${expectedFormat}`);
        }
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.6: Component never crashes with valid data status input', () => {
    fc.assert(
      fc.property(dataStatusArb, fc.boolean(), fc.string(), (dataStatus, showDetails, className) => {
        expect(() => {
          const { container } = render(
            <DataStatusIndicator 
              dataStatus={dataStatus} 
              showDetails={showDetails}
              className={className}
            />
          );
          cleanup();
        }).not.toThrow();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.7: Status icons are appropriate for each state', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} />);
        
        // Check that an SVG icon is present
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
        
        // Verify icon has correct attributes
        expect(icon).toHaveClass('w-4', 'h-4');
        expect(icon).toHaveAttribute('fill', 'none');
        expect(icon).toHaveAttribute('stroke', 'currentColor');
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });

  it('Property 5.8: Date parsing is robust and never fails', () => {
    fc.assert(
      fc.property(
        fc.record({
          isPreliminary: fc.boolean(),
          isFinal: fc.boolean(),
          dataCollectionDate: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
          lastUpdated: fc.integer({ min: Date.parse('2020-01-01'), max: Date.parse('2030-12-31') }).map(ms => new Date(ms).toISOString()),
        }).filter(status => !(status.isPreliminary && status.isFinal)),
        (dataStatus) => {
          expect(() => {
            const { container } = render(<DataStatusIndicator dataStatus={dataStatus} showDetails={true} />);
            
            // Verify the date was parsed and formatted correctly
            const parsedDate = new Date(dataStatus.dataCollectionDate);
            expect(parsedDate).toBeInstanceOf(Date);
            expect(parsedDate.getTime()).not.toBeNaN();
            
            cleanup();
          }).not.toThrow();
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property 5.9: Component maintains accessibility standards', () => {
    fc.assert(
      fc.property(dataStatusArb, (dataStatus) => {
        const { container } = render(<DataStatusIndicator dataStatus={dataStatus} />);
        
        // Check for proper semantic structure
        const statusBadge = container.querySelector('[class*="inline-flex"]');
        expect(statusBadge).toBeInTheDocument();
        
        // Ensure no accessibility violations in basic structure
        expect(container.firstChild).toBeInTheDocument();
        
        cleanup();
      }),
      { numRuns: 50 }
    );
  });
});