/** The model a `.meta` belongs to (`Assets/Hero.fbx.meta` → `Assets/Hero.fbx`), when it is a model's; null otherwise. */
export function modelOfMeta(path: string): string | null {
  const match = /^(.*\.(fbx|obj|gltf|glb))\.meta$/i.exec(path);
  return match ? match[1]! : null;
}
