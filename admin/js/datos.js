// Catálogo Maestro Temporal (Mock Data simulando ZapatosStock2026)
const MOCK_STOCK = [
  {
    codigo: "A276",
    marca: "Garley",
    categoria: "PibeNiña",
    tipo: "Sandalia",
    color: "Rosado",
    socio: "D",
    precioReferencial: 45,
    tallas: { 17: 0, 18: 2, 19: 3, 20: 1, 21: 0, 22: 4 }
  },
  {
    codigo: "006",
    marca: "Pasitos",
    categoria: "PibeNiño",
    tipo: "Zapatilla",
    color: "Azul",
    socio: "W",
    precioReferencial: 38,
    tallas: { 17: 2, 18: 0, 19: 5, 20: 2, 21: 1, 22: 0 }
  },
  {
    codigo: "ZN022",
    marca: "Cukis",
    categoria: "ZapatoNiño",
    tipo: "Cuero",
    color: "Negro",
    socio: "D",
    precioReferencial: 50,
    tallas: { 21: 3, 22: 2, 23: 1, 24: 0, 25: 2, 26: 1 }
  },
  {
    codigo: "B011",
    marca: "JyM",
    categoria: "ZapatoBebe",
    tipo: "Charol",
    color: "Blanco",
    socio: "W",
    precioReferencial: 32,
    tallas: { 16: 4, 17: 2, 18: 1, 19: 0, 20: 0, 21: 3 }
  },
  {
    codigo: "S000",
    marca: "Varios",
    categoria: "Oferta",
    tipo: "Liquidacion",
    color: "Multicolor",
    socio: "D",
    precioReferencial: 25,
    tallas: { 17: 99, 18: 99, 19: 99, 20: 99, 21: 99, 22: 99 }
  }
];

// Bitácoras temporales en memoria
const MOCK_COMPRAS = [];
const MOCK_VENTAS = [];