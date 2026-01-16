/**
 * Advanced Object Tracker using IoU (Intersection over Union) and Linear Velocity Prediction.
 * This implements a simplified SORT (Simple Online and Realtime Tracking) algorithm.
 */

export interface DetectedObject {
  bbox: [number, number, number, number]; // [x, y, width, height]
  class: string;
  score: number;
}

export interface TrackedObject extends DetectedObject {
  id: number;
  missingFrames: number;
  color: string;
  velocity: [number, number]; // [vx, vy] representing pixels per frame
}

export class ObjectTracker {
  private nextId: number = 1;
  private tracks: TrackedObject[] = [];
  private readonly maxMissingFrames: number;
  private readonly iouThreshold: number;

  constructor(maxMissingFrames = 30, iouThreshold = 0.25) {
    this.maxMissingFrames = maxMissingFrames;
    this.iouThreshold = iouThreshold;
  }

  public update(detections: DetectedObject[]): TrackedObject[] {
    // 1. Prediction Step: Estimate new position based on velocity
    // We update the bbox of existing tracks to where we expect them to be.
    this.tracks.forEach(track => {
      track.bbox[0] += track.velocity[0];
      track.bbox[1] += track.velocity[1];
    });

    // 2. Association Step: Match detections to predicted tracks using IoU
    // We compute IoU for all possible pairs and select matches greedily based on highest IoU.
    
    const matches: { trackIdx: number; detIdx: number; iou: number }[] = [];
    
    this.tracks.forEach((track, tIdx) => {
      detections.forEach((det, dIdx) => {
        // Only match if classes are consistent (optional, but helps reduce ID switches between classes)
        const iou = this.calculateIoU(track.bbox, det.bbox);
        if (iou >= this.iouThreshold) {
          matches.push({ trackIdx: tIdx, detIdx: dIdx, iou });
        }
      });
    });

    // Sort matches by IoU descending to prioritize best spatial overlaps
    matches.sort((a, b) => b.iou - a.iou);

    const activeTracks: TrackedObject[] = [];
    const assignedTrackIndices = new Set<number>();
    const assignedDetIndices = new Set<number>();

    for (const match of matches) {
      if (assignedTrackIndices.has(match.trackIdx) || assignedDetIndices.has(match.detIdx)) {
        continue;
      }

      assignedTrackIndices.add(match.trackIdx);
      assignedDetIndices.add(match.detIdx);

      const track = this.tracks[match.trackIdx];
      const det = detections[match.detIdx];

      // 3. Update Step for Matched Tracks
      // Update velocity: Simple momentum (Alpha-Beta filter style)
      // v_new = pos_measured - pos_previous_actual
      // We know pos_current_predicted = pos_previous_actual + v_old
      // So pos_previous_actual = pos_current_predicted - v_old
      
      const prevX = track.bbox[0] - track.velocity[0];
      const prevY = track.bbox[1] - track.velocity[1];
      
      const measuredVx = det.bbox[0] - prevX;
      const measuredVy = det.bbox[1] - prevY;

      // Alpha determines how much we trust the new measurement for velocity vs keeping momentum
      const alpha = 0.5; 
      track.velocity[0] = track.velocity[0] * (1 - alpha) + measuredVx * alpha;
      track.velocity[1] = track.velocity[1] * (1 - alpha) + measuredVy * alpha;

      // Update state
      track.bbox = det.bbox;
      track.score = det.score;
      track.class = det.class; // Accept new class label
      track.missingFrames = 0;
      
      activeTracks.push(track);
    }

    // 4. Handle Unmatched Tracks (Occlusion logic)
    this.tracks.forEach((track, index) => {
      if (!assignedTrackIndices.has(index)) {
        track.missingFrames++;
        // Only keep if not missing for too long
        if (track.missingFrames < this.maxMissingFrames) {
          activeTracks.push(track);
        }
      }
    });

    // 5. Handle Unmatched Detections (New Objects)
    detections.forEach((det, index) => {
      if (!assignedDetIndices.has(index)) {
        const newTrack: TrackedObject = {
          ...det,
          id: this.nextId++,
          missingFrames: 0,
          color: this.getRandomColor(),
          velocity: [0, 0] // Initialize with zero velocity
        };
        activeTracks.push(newTrack);
      }
    });

    this.tracks = activeTracks;
    return this.tracks;
  }

  private calculateIoU(bbox1: [number, number, number, number], bbox2: [number, number, number, number]): number {
    // bbox is [x, y, width, height]
    const x1 = Math.max(bbox1[0], bbox2[0]);
    const y1 = Math.max(bbox1[1], bbox2[1]);
    const x2 = Math.min(bbox1[0] + bbox1[2], bbox2[0] + bbox2[2]);
    const y2 = Math.min(bbox1[1] + bbox1[3], bbox2[1] + bbox2[3]);

    // No intersection
    if (x2 <= x1 || y2 <= y1) return 0.0;

    const intersectionArea = (x2 - x1) * (y2 - y1);
    const box1Area = bbox1[2] * bbox1[3];
    const box2Area = bbox2[2] * bbox2[3];
    const unionArea = box1Area + box2Area - intersectionArea;

    return intersectionArea / (unionArea || 1); // Avoid div by zero
  }

  private getRandomColor(): string {
    const colors = ['#00f0ff', '#ff2a6d', '#05d5fa', '#39ff14', '#ffe600', '#bd00ff'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  public reset() {
    this.tracks = [];
    this.nextId = 1;
  }
}