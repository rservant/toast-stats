/**
 * Get CSS classes for club status badge styling
 * @param status - Club operational status from Toastmasters dashboard
 * @returns CSS classes for badge styling, or null if status is undefined
 *
 * Validates: Requirements 7.2, 7.3, 7.4
 */
export const getClubStatusBadge = (
  status: string | undefined
): string | null => {
  if (!status) return null

  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-800 border-green-300'
    case 'suspended':
      return 'bg-red-100 text-red-800 border-red-300'
    case 'ineligible':
    case 'low':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300'
  }
}
