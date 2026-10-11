import type { ProductLookupResult } from '@/domain/openFoodFacts'

// Busca un producto envasado por su código de barras en una base externa
export interface ProductLookupRepository {
  findByBarcode(barcode: string): Promise<ProductLookupResult>
}
