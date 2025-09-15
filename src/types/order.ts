export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export type OrderStatus = 'pending' | 'sent' | 'cancelled' | 'paid';

export interface Order {
  id: string;
  orderNumber: number;
  tableNumber: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: Date;
  agentCode: string;
}