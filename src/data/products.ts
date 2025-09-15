import { Product } from "@/types/order";

export const products: Product[] = [
  // Boissons
  { id: "1", name: "Bière Castel", price: 1500, category: "Boissons", stock: 45, image: "beer" },
  { id: "2", name: "Coca Cola", price: 500, category: "Boissons", stock: 8, image: "soda" },
  { id: "5", name: "Café", price: 300, category: "Boissons", stock: 25, image: "coffee" },
  { id: "7", name: "Jus d'orange", price: 800, category: "Boissons", stock: 12, image: "juice" },
  
  // Plats
  { id: "3", name: "Thieboudienne", price: 2500, category: "Plats", stock: 15, image: "plate" },
  { id: "8", name: "Riz sauce", price: 2000, category: "Plats", stock: 10, image: "rice" },
  { id: "9", name: "Poulet DG", price: 3500, category: "Plats", stock: 8, image: "plate" },
  { id: "10", name: "Poisson braisé", price: 3000, category: "Plats", stock: 12, image: "plate" },
  
  // Formules
  { id: "11", name: "Menu Étudiant", price: 2000, category: "Formules", stock: 20, image: "menu" },
  { id: "12", name: "Menu Famille", price: 8000, category: "Formules", stock: 15, image: "menu" },
  { id: "13", name: "Menu VIP", price: 12000, category: "Formules", stock: 5, image: "menu" },
  { id: "14", name: "Menu Déjeuner", price: 3500, category: "Formules", stock: 25, image: "menu" },
  
  // Alcools
  { id: "4", name: "Whisky", price: 25000, category: "Alcools", stock: 3, image: "wine" },
  { id: "15", name: "Vin Rouge", price: 15000, category: "Alcools", stock: 6, image: "wine" },
  { id: "16", name: "Champagne", price: 35000, category: "Alcools", stock: 2, image: "wine" },
  
  // Snacks
  { id: "6", name: "Sandwich", price: 1200, category: "Snacks", stock: 20, image: "sandwich" },
  { id: "17", name: "Croissant", price: 600, category: "Snacks", stock: 15, image: "sandwich" },
  { id: "18", name: "Pizza slice", price: 1800, category: "Snacks", stock: 10, image: "sandwich" }
];