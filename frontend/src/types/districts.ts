/**
 * Type definitions for district-related data structures
 */

export interface District {
  id: string;
  name: string;
}

export interface DistrictsResponse {
  districts: District[];
}
