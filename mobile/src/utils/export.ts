/**
 * Report export utilities (CSV, GeoJSON, and JSON summary builders).
 */

import { CivicComplaint } from '../types/civic.types';

export class DataExportUtil {
  /**
   * Convert list of complaints to standard CSV string
   */
  static complaintsToCSV(complaints: CivicComplaint[]): string {
    const headers = [
      'Ticket Number',
      'Category',
      'Damage Class',
      'Status',
      'Priority',
      'Priority Score',
      'Address',
      'Latitude',
      'Longitude',
      'Ward',
      'Department',
      'Upvotes',
      'Created At',
      'Resolved At',
    ];

    const rows = complaints.map(c => [
      `"${c.ticketNumber}"`,
      `"${c.category}"`,
      `"${c.damageClass}"`,
      `"${c.status}"`,
      `"${c.priority}"`,
      c.priorityScore,
      `"${(c.location.address || '').replace(/"/g, '""')}"`,
      c.location.coordinate.latitude,
      c.location.coordinate.longitude,
      `"${c.location.ward || ''}"`,
      `"${c.assignedDepartment}"`,
      c.upvoteCount,
      `"${c.createdAt}"`,
      `"${c.resolvedAt || ''}"`,
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  /**
   * Convert complaints to standard GeoJSON FeatureCollection
   */
  static complaintsToGeoJSON(complaints: CivicComplaint[]): string {
    const features = complaints.map(c => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [c.location.coordinate.longitude, c.location.coordinate.latitude],
      },
      properties: {
        id: c.id,
        ticketNumber: c.ticketNumber,
        category: c.category,
        damageClass: c.damageClass,
        priority: c.priority,
        priorityScore: c.priorityScore,
        status: c.status,
        address: c.location.address,
        ward: c.location.ward,
        department: c.assignedDepartment,
        createdAt: c.createdAt,
      },
    }));

    return JSON.stringify(
      {
        type: 'FeatureCollection',
        features,
      },
      null,
      2
    );
  }
}
