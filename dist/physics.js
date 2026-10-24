export function collides(x, y, obstacles, world, radius = 14) {
  if (x < radius + 12 || y < radius + 12 || x > world.width - radius - 12 || y > world.height - radius - 12) return true;
  if (world.cornerRadius) {
    const corner = world.cornerRadius, inset = world.edgeInset || 0;
    const cx = Math.max(inset + corner, Math.min(world.width - inset - corner, x));
    const cy = Math.max(inset + corner, Math.min(world.height - inset - corner, y));
    if (Math.hypot(x - cx, y - cy) > corner - radius) return true;
  }
  return obstacles.some(o => x + radius > o.x && x - radius < o.x + o.w && y + radius > o.y && y - radius < o.y + o.d);
}

// Invert the isometric projection so keyboard directions match the screen.
export function movementVector(horizontal, vertical, speed = 155) {
  const length = Math.hypot(horizontal, vertical);
  if (!length) return { x: 0, y: 0 };
  const dx = horizontal / length * speed;
  const dy = vertical / length * speed;
  return { x: (dx / .9 + dy / .45) / 2, y: (dy / .45 - dx / .9) / 2 };
}

export function moveWithCollisions(player, dx, dy, obstacles, world) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
  for (let i = 0; i < steps; i++) {
    if (!collides(player.x + dx / steps, player.y, obstacles, world)) player.x += dx / steps;
    if (!collides(player.x, player.y + dy / steps, obstacles, world)) player.y += dy / steps;
  }
}

export function nearestOpenPosition(position, obstacles, world) {
  if (!collides(position.x, position.y, obstacles, world)) return { ...position };
  for (let radius = 25; radius < 800; radius += 25) {
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const point = { x: position.x + Math.cos(angle) * radius, y: position.y + Math.sin(angle) * radius };
      if (!collides(point.x, point.y, obstacles, world)) return point;
    }
  }
  throw new Error('The town needs at least one open walking space.');
}
