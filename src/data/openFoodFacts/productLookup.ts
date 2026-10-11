import { parseOpenFoodFactsResponse } from '@/domain/openFoodFacts'
import type { ProductLookupRepository } from '@/repositories/ProductLookupRepository'

const BASE_URL = 'https://world.openfoodfacts.org/api/v2/product'
const FIELDS = 'code,product_name,product_name_es,brands,nutriments,serving_quantity'
const TIMEOUT_MS = 8000

export const openFoodFactsProductLookup: ProductLookupRepository = {
  async findByBarcode(barcode) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const response = await fetch(`${BASE_URL}/${barcode}.json?fields=${FIELDS}`, { signal: controller.signal })
      // OFF responde 404 con { status: 0 } cuando no conoce el código: es "no encontrado", no un fallo
      if (response.status !== 404 && !response.ok) return { status: 'error' }
      return parseOpenFoodFactsResponse(await response.json(), barcode)
    } catch {
      // Sin conexión, tiempo agotado o respuesta que no es JSON
      return { status: 'error' }
    } finally {
      clearTimeout(timer)
    }
  },
}
