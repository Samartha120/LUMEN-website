/**
 * Live complaint tracking, SLA countdown, and engineer dispatch telemetry service.
 */

import { LiveComplaintTracking, MilestoneUpdate, EscalationRequest, TrackingStage } from '../types/tracking.types';
import { StorageService } from './storage.service';

const TRACKING_CACHE_KEY = 'live_tracking_data';

const SAMPLE_TRACKING: Record<string, LiveComplaintTracking> = {
  'cmp-001': {
    complaintId: 'cmp-001',
    ticketNumber: 'LMN-8021',
    currentStage: 'REPAIR_IN_PROGRESS',
    priority: 'HIGH',
    slaDeadline: new Date(Date.now() + 1000 * 3600 * 14).toISOString(),
    slaRemainingMinutes: 840,
    isOverdue: false,
    incidentLocation: {
      coordinate: { latitude: 12.9716, longitude: 77.5946 },
      address: '8th Main, 4th Block, Indiranagar, Bengaluru',
      ward: 'Ward 112 - Domlur',
    },
    assignedEngineer: {
      engineerId: 'eng-102',
      name: 'Ramesh Kumar (Team Lead)',
      phone: '+91 98450 12345',
      vehicleNumber: 'KA-04-GA-9021 (Asphalt Repair Van)',
      currentLocation: { latitude: 12.9718, longitude: 77.5944 },
      headingDegrees: 180,
      speedKmh: 0,
      lastUpdated: new Date().toISOString(),
      batteryLevel: 88,
    },
    routeWaypoints: [
      { latitude: 12.9750, longitude: 77.5900 },
      { latitude: 12.9730, longitude: 77.5920 },
      { latitude: 12.9716, longitude: 77.5946 },
    ],
    estimatedArrivalMinutes: 0,
    distanceRemainingMeters: 0,
    milestones: [
      {
        stage: 'QUEUED',
        title: 'Report Registered & AI Classified',
        description: 'Pothole detected with 94% confidence. Auto-routed to Roads & Infrastructure dept.',
        timestamp: new Date(Date.now() - 1000 * 3600 * 5).toISOString(),
        completed: true,
        active: false,
      },
      {
        stage: 'DISPATCHED',
        title: 'Work Order Assigned to Rapid Crew 4',
        description: 'Engineer Ramesh Kumar accepted dispatch. Material requisition approved.',
        timestamp: new Date(Date.now() - 1000 * 3600 * 3).toISOString(),
        completed: true,
        active: false,
        performedBy: 'Supervisor Anand Murthy',
      },
      {
        stage: 'EN_ROUTE',
        title: 'Crew Departed Central Depot',
        description: 'Vehicle KA-04-GA-9021 en route with cold-mix asphalt.',
        timestamp: new Date(Date.now() - 1000 * 3600 * 1.5).toISOString(),
        completed: true,
        active: false,
      },
      {
        stage: 'ARRIVED_ON_SITE',
        title: 'Site Safety Perimeter Deployed',
        description: 'Traffic cones placed and road section demarcated.',
        timestamp: new Date(Date.now() - 1000 * 3600 * 0.8).toISOString(),
        completed: true,
        active: false,
      },
      {
        stage: 'REPAIR_IN_PROGRESS',
        title: 'Pothole Surface Excavation & Compaction',
        description: 'Asphalt patching and mechanical roller compaction in active progress.',
        timestamp: new Date(Date.now() - 1000 * 3600 * 0.3).toISOString(),
        completed: false,
        active: true,
        estimatedTime: 'Approx. 45 mins remaining',
      },
      {
        stage: 'QUALITY_INSPECTION',
        title: 'AI Photo Verification & Surface Smoothness Test',
        description: 'Before/after computer vision alignment and supervisor sign-off.',
        timestamp: new Date(Date.now() + 1000 * 3600 * 1).toISOString(),
        completed: false,
        active: false,
      },
      {
        stage: 'COMPLETED',
        title: 'Public Closure & Transparency Log',
        description: 'Ticket marked resolved. Citizen notified with proof photos.',
        timestamp: new Date(Date.now() + 1000 * 3600 * 1.5).toISOString(),
        completed: false,
        active: false,
      },
    ],
    canEscalate: true,
    escalationCount: 0,
  },
};

export class TrackingService {
  /**
   * Get live tracking details for a complaint
   */
  static async getTracking(complaintId: string): Promise<LiveComplaintTracking | null> {
    const cached = await StorageService.getItem<Record<string, LiveComplaintTracking>>(TRACKING_CACHE_KEY);
    if (cached && cached[complaintId]) {
      return cached[complaintId];
    }
    return SAMPLE_TRACKING[complaintId] || null;
  }

  /**
   * Submit an escalation request for overdue or stalled issues
   */
  static async requestEscalation(req: EscalationRequest): Promise<{ success: boolean; newPriority: string }> {
    const tracking = await this.getTracking(req.complaintId);
    if (!tracking) throw new Error('Complaint tracking not found');

    tracking.escalationCount += 1;
    tracking.lastEscalatedAt = req.timestamp;
    tracking.canEscalate = false;

    // Add escalation note to active milestone
    const activeMilestone = tracking.milestones.find(m => m.active);
    if (activeMilestone) {
      activeMilestone.description += ` [ESCALATED: ${req.reason} - Citizen flagged high urgency]`;
    }

    const all = (await StorageService.getItem<Record<string, LiveComplaintTracking>>(TRACKING_CACHE_KEY)) || SAMPLE_TRACKING;
    all[req.complaintId] = tracking;
    await StorageService.setItem(TRACKING_CACHE_KEY, all);

    return { success: true, newPriority: 'CRITICAL' };
  }

  /**
   * Advance stage for demo / field engineer update
   */
  static async updateStage(complaintId: string, nextStage: TrackingStage, proofPhotoUrl?: string): Promise<LiveComplaintTracking> {
    const tracking = await this.getTracking(complaintId);
    if (!tracking) throw new Error('Complaint tracking not found');

    tracking.currentStage = nextStage;
    let foundCurrent = false;

    tracking.milestones = tracking.milestones.map(m => {
      if (m.stage === nextStage) {
        foundCurrent = true;
        return {
          ...m,
          active: true,
          completed: false,
          proofPhotoUrl: proofPhotoUrl || m.proofPhotoUrl,
          timestamp: new Date().toISOString(),
        };
      } else if (!foundCurrent) {
        return { ...m, active: false, completed: true };
      } else {
        return { ...m, active: false, completed: false };
      }
    });

    const all = (await StorageService.getItem<Record<string, LiveComplaintTracking>>(TRACKING_CACHE_KEY)) || SAMPLE_TRACKING;
    all[complaintId] = tracking;
    await StorageService.setItem(TRACKING_CACHE_KEY, all);

    return tracking;
  }
}
