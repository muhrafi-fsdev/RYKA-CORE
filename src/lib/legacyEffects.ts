import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type LegacyEffectMode = "blur" | "mosaic" | "flip" | null;
export type EffectSelection = "auto" | Exclude<LegacyEffectMode, null>;
export type EffectHandsMode = "auto" | "single" | "dual";

export type LegacyEffectOptions = {
  selection: EffectSelection;
  handsMode: EffectHandsMode;
  blurStrength: number;
  mosaicBlockSize: number;
};

type Point = { x: number; y: number };
type HandControlPoints = {
  thumb: Point;
  index: Point;
  thumbAbove: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function chooseHands(
  landmarks: NormalizedLandmark[][],
  handsMode: EffectHandsMode,
): NormalizedLandmark[][] {
  if (handsMode === "single") return landmarks.slice(0, 1);
  if (handsMode === "dual") return landmarks.length >= 2 ? landmarks.slice(0, 2) : [];
  return landmarks.slice(0, 2);
}

export function resolveLegacyEffectMode(
  thumbDirections: boolean[],
  selection: EffectSelection,
): Exclude<LegacyEffectMode, null> {
  if (selection !== "auto") return selection;
  const allThumbsUp = thumbDirections.every(Boolean);
  const allThumbsDown = thumbDirections.every((value) => !value);
  if (allThumbsUp) return "flip";
  if (allThumbsDown) return "blur";
  return "mosaic";
}

function polygonForHands(
  hands: HandControlPoints[],
  mode: Exclude<LegacyEffectMode, null>,
): Point[] {
  const [first, second] = hands;
  if (second) {
    if (mode === "mosaic") {
      return [first.index, second.thumb, second.index, first.thumb];
    }
    return [first.index, second.index, second.thumb, first.thumb];
  }

  return [
    first.thumb,
    { x: first.index.x, y: first.thumb.y },
    first.index,
    { x: first.thumb.x, y: first.index.y },
  ];
}

export function drawLegacyHandEffect(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  landmarks: NormalizedLandmark[][],
  canvasWidth: number,
  canvasHeight: number,
  temporaryCanvas: HTMLCanvasElement,
  options: LegacyEffectOptions,
): LegacyEffectMode {
  const selectedHands = chooseHands(landmarks, options.handsMode);
  if (selectedHands.length === 0 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null;
  }

  const hands: HandControlPoints[] = selectedHands.map((hand) => ({
    thumb: { x: hand[4].x * canvasWidth, y: hand[4].y * canvasHeight },
    index: { x: hand[8].x * canvasWidth, y: hand[8].y * canvasHeight },
    thumbAbove: hand[4].y < hand[8].y,
  }));
  const mode = resolveLegacyEffectMode(
    hands.map((hand) => hand.thumbAbove),
    options.selection,
  );
  const points = polygonForHands(hands, mode);
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = clamp(Math.min(...xs), 0, canvasWidth);
  const minY = clamp(Math.min(...ys), 0, canvasHeight);
  const maxX = clamp(Math.max(...xs), 0, canvasWidth);
  const maxY = clamp(Math.max(...ys), 0, canvasHeight);
  const width = maxX - minX;
  const height = maxY - minY;
  if (width < 2 || height < 2) return mode;

  const sourceX = (minX / canvasWidth) * video.videoWidth;
  const sourceY = (minY / canvasHeight) * video.videoHeight;
  const sourceWidth = (width / canvasWidth) * video.videoWidth;
  const sourceHeight = (height / canvasHeight) * video.videoHeight;

  context.save();
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    context.lineTo(points[index].x, points[index].y);
  }
  context.closePath();
  context.clip();

  if (mode === "mosaic") {
    const block = clamp(options.mosaicBlockSize, 4, 40);
    const scaledWidth = Math.max(1, Math.round(width / block));
    const scaledHeight = Math.max(1, Math.round(height / block));
    temporaryCanvas.width = scaledWidth;
    temporaryCanvas.height = scaledHeight;
    const temporaryContext = temporaryCanvas.getContext("2d");
    if (temporaryContext) {
      temporaryContext.clearRect(0, 0, scaledWidth, scaledHeight);
      temporaryContext.drawImage(
        video,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        scaledWidth,
        scaledHeight,
      );
      context.imageSmoothingEnabled = false;
      context.drawImage(
        temporaryCanvas,
        0,
        0,
        scaledWidth,
        scaledHeight,
        minX,
        minY,
        width,
        height,
      );
      context.imageSmoothingEnabled = true;
    }
  } else {
    context.filter = mode === "blur" ? `blur(${clamp(options.blurStrength, 2, 30)}px)` : "none";
    if (mode === "flip") {
      context.translate(minX + width / 2, minY + height / 2);
      context.rotate(Math.PI);
      context.translate(-(minX + width / 2), -(minY + height / 2));
    }
    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      minX,
      minY,
      width,
      height,
    );
  }

  context.restore();
  context.filter = "none";
  return mode;
}
