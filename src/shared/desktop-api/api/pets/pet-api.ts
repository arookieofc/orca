import type { CustomPet } from '../../../pets/pet-types'
import type { PetImportFailure } from '../../../pets/pet-import-failure-copy'

export type PetApi = {
  import: () => Promise<CustomPet | PetImportFailure | null>
  importPetBundle: () => Promise<CustomPet | PetImportFailure | null>
  read: (id: string, fileName: string, kind?: 'image' | 'bundle') => Promise<ArrayBuffer | null>
  delete: (id: string, fileName: string, kind?: 'image' | 'bundle') => Promise<void>
}
