import { avatarImageFor } from '../../../lib/avatars/avatarImages';
import { stableHue } from '../../../lib/stableHue';
import { initials } from '../../../lib/userName';
import type { DrawContext } from './drawContext';

interface AvatarStyle {
  x: number;
  y: number;
  radius: number;
  owner: string;
  /** Ring around the avatar, in the branch's color. */
  ringColor: string;
  ringWidth: number;
  showInitials: boolean;
  font: string;
}

/** A changeset drawn as its author's avatar (Gravatar, or initials on the author's color), ringed with the branch color. */
export function drawAvatar({ ctx, pen }: DrawContext, style: AvatarStyle): void {
  const { x, y, radius } = style;

  ctx.beginPath();
  pen.arc(x, y, radius + style.ringWidth / 2, 0, Math.PI * 2);
  ctx.strokeStyle = style.ringColor;
  ctx.lineWidth = style.ringWidth;
  ctx.stroke();

  ctx.beginPath();
  pen.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `hsl(${stableHue(style.owner)} 52% 50%)`;
  ctx.fill();

  const image = avatarImageFor(style.owner);
  if (image) {
    ctx.save();
    ctx.clip();
    pen.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
    ctx.restore();
    return;
  }

  if (!style.showInitials) return;
  ctx.fillStyle = '#fff';
  ctx.font = style.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  pen.fillText(initials(style.owner), x, y + 0.5);
}

/** At low zoom, a plain dot in the branch color reads better than a tiny avatar. */
export function drawDot({ ctx, pen }: DrawContext, x: number, y: number, radius: number, color: string, outline: string): void {
  ctx.beginPath();
  pen.arc(x, y, radius + 2, 0, Math.PI * 2);
  ctx.fillStyle = outline;
  ctx.fill();
  ctx.beginPath();
  pen.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}
