import { avatarImageFor } from '../../../lib/avatars/avatarImages';
import { initials, userHue } from '../../../lib/userName';

interface AvatarStyle {
  x: number;
  y: number;
  radius: number;
  owner: string;
  /** Ring around the avatar, in the branch's color. */
  ringColor: string;
  ringWidth: number;
  /** Separates the avatar from the band behind it. */
  outlineColor: string;
  showInitials: boolean;
  font: string;
}

/** A changeset drawn as its author's avatar (Gravatar, or initials on the author's color), ringed with the branch color. */
export function drawAvatar(ctx: CanvasRenderingContext2D, style: AvatarStyle): void {
  const { x, y, radius } = style;

  ctx.beginPath();
  ctx.arc(x, y, radius + style.ringWidth + 1.5, 0, Math.PI * 2);
  ctx.fillStyle = style.outlineColor;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, radius + style.ringWidth / 2, 0, Math.PI * 2);
  ctx.strokeStyle = style.ringColor;
  ctx.lineWidth = style.ringWidth;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${userHue(style.owner)} 52% 50%)`;
  ctx.fill();

  const image = avatarImageFor(style.owner);
  if (image) {
    ctx.save();
    ctx.clip();
    ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
    return;
  }

  if (!style.showInitials) return;
  ctx.fillStyle = '#fff';
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials(style.owner), x, y + 0.5);
}

/** At low zoom, a plain dot in the branch color reads better than a tiny avatar. */
export function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, outline: string): void {
  ctx.beginPath();
  ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
