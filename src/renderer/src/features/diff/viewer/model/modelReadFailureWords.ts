import type { ModelReadFailure } from './parseModel';

/** What the viewer says in place of a model it can't show, and what the user can do about it. */
export function modelReadFailureWords(failure: ModelReadFailure): { title: string; description: string } {
  switch (failure.kind) {
    case 'externalData':
      return {
        title: `This glTF keeps its geometry in ${failure.file}`,
        description: 'Only a model whose file holds all of its data shows here: export it as GLB, or embed its buffers.',
      };
    case 'compressed':
      return {
        title: `This glTF is compressed with ${failure.compression}`,
        description: "Its meshes need a decoder the diff doesn't have. Compare an uncompressed export instead.",
      };
    case 'oldFbx':
      return {
        title: `This FBX is in an older format (${Math.floor(failure.version / 1000)}.${Math.floor((failure.version % 1000) / 100)})`,
        description: 'The 3D view reads FBX 7.0 and later. Unity still imports it; export it again from a newer tool to see it here.',
      };
    case 'unreadable':
      return { title: "Couldn't display this model", description: "The file looks like a 3D model but couldn't be read." };
  }
}
