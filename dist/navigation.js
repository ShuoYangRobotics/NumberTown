/** Ground-plane navigation, independent of the renderer. Angles are in radians. */
export function movementVector(horizontal, vertical, yaw, speed = 6) {
  const length = Math.hypot(horizontal, vertical);
  if (!length) return { x: 0, z: 0 };
  const h = horizontal / length * speed, v = vertical / length * speed;
  return { x: h * Math.cos(yaw) + v * Math.sin(yaw), z: -h * Math.sin(yaw) + v * Math.cos(yaw) };
}

export function collides(x, z, obstacles, world, radius = .6) {
  const inset = (world.margin ?? 0) + radius;
  if (x < inset || z < inset || x > world.width - inset || z > world.depth - inset) return true;
  return obstacles.some(o => {
    if (o.radius != null) return Math.hypot(x - o.x, z - o.z) < radius + o.radius;
    const px = Math.max(o.x, Math.min(o.x + o.w, x));
    const pz = Math.max(o.z, Math.min(o.z + o.d, z));
    return Math.hypot(x - px, z - pz) < radius;
  });
}

export function moveWithCollisions(player, dx, dz, obstacles, world, radius = player.radius ?? .6) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .2));
  const start = { x: player.x, z: player.z };
  for (let i = 0; i < steps; i++) {
    if (!collides(player.x + dx / steps, player.z, obstacles, world, radius)) player.x += dx / steps;
    if (!collides(player.x, player.z + dz / steps, obstacles, world, radius)) player.z += dz / steps;
  }
  return Math.hypot(player.x - start.x, player.z - start.z);
}

export function nearestOpenPosition(position, obstacles, world, radius = .6) {
  if (!collides(position.x, position.z, obstacles, world, radius)) return { ...position };
  for (let distance = .5; distance < Math.max(world.width, world.depth); distance += .5) {
    for (let i = 0; i < 32; i++) {
      const angle = i * Math.PI / 16;
      const point = { x: position.x + Math.cos(angle) * distance, z: position.z + Math.sin(angle) * distance };
      if (!collides(point.x, point.z, obstacles, world, radius)) return point;
    }
  }
  throw new Error('No safe walking position in town.');
}

export function angleLerp(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * amount;
}
