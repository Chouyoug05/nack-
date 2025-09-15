import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { Order, OrderStatus, CartItem } from "@/types/order";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { enqueue, setupFlushInterval, OfflineTask } from "@/lib/offlineQueue";

interface OrderContextType {
  orders: Order[];
  addOrder: (order: Omit<Order, 'id' | 'createdAt'>) => Promise<void>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  getOrdersByAgent: (agentCode: string) => Order[];
  orderCounter: number;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

export const OrderProvider = ({ children, ownerUidOverride }: { children: ReactNode, ownerUidOverride?: string }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderCounter, setOrderCounter] = useState(1);
  const { currentUser } = useAuth();

  const resolvedOwnerUid = ownerUidOverride || currentUser?.uid || null;

  useEffect(() => {
    if (!resolvedOwnerUid) return;
    // Subscribe to orders owned by resolved owner
    const q = query(
      collection(db, "orders"),
      where("ownerUid", "==", resolvedOwnerUid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const mapped: Order[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          orderNumber: data.orderNumber ?? 0,
          tableNumber: String(data.tableNumber ?? ""),
          items: Array.isArray(data.items) ? data.items as CartItem[] : [],
          total: Number(data.total ?? 0),
          status: (data.status ?? "pending") as OrderStatus,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          agentCode: String(data.agentCode ?? "")
        } as Order;
      });
      setOrders(mapped);
      const maxNum = mapped.reduce((m, o) => Math.max(m, o.orderNumber || 0), 0);
      setOrderCounter(maxNum + 1);
    });
    return () => unsub();
  }, [resolvedOwnerUid]);

  // Flush de la file offline périodiquement
  useEffect(() => {
    const stop = setupFlushInterval(async (task: OfflineTask) => {
      if (task.type === 'add_order') {
        const d = task.payload;
        const orderRef = doc(collection(db, "orders"));
        const batch = writeBatch(db);
        batch.set(orderRef, {
          ownerUid: d.ownerUid,
          orderNumber: d.orderNumber,
          tableNumber: d.tableNumber,
          items: d.items,
          total: d.total,
          status: d.status,
          agentCode: d.agentCode,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      }
    });
    return () => stop();
  }, []);

  const addOrder = async (orderData: Omit<Order, 'id' | 'createdAt'>) => {
    if (!resolvedOwnerUid) return;
    // Optimistic local add (temporary id)
    const tempId = `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimistic: Order = { ...orderData, id: tempId, createdAt: new Date() };
    setOrders(prev => [optimistic, ...prev]);
    setOrderCounter(prev => prev + 1);

    try {
      // Créer la commande
      const orderRef = doc(collection(db, "orders"));
      const batch = writeBatch(db);
      batch.set(orderRef, {
        ownerUid: resolvedOwnerUid,
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        items: orderData.items,
        total: orderData.total,
        status: orderData.status,
        agentCode: orderData.agentCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      // onSnapshot hydratera avec le vrai doc et écrasera l'optimistic
    } catch (e: any) {
      // En cas d'échec (souvent offline), on enfile et on garde l'optimistic
      enqueue({ type: 'add_order', payload: {
        ownerUid: resolvedOwnerUid,
        orderNumber: orderData.orderNumber,
        tableNumber: orderData.tableNumber,
        items: orderData.items,
        total: orderData.total,
        status: orderData.status,
        agentCode: orderData.agentCode,
      }});
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    // Optimistic update
    const prev = orders;
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      // rollback on error
      setOrders(prev);
      throw e;
    }
  };

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status);
  };

  const getOrdersByAgent = (agentCode: string) => {
    return orders.filter(order => order.agentCode === agentCode);
  };

  return (
    <OrderContext.Provider value={{
      orders,
      addOrder,
      updateOrderStatus,
      getOrdersByStatus,
      getOrdersByAgent,
      orderCounter
    }}>
      {children}
    </OrderContext.Provider>
  );
};