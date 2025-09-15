import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useOrders } from "@/contexts/OrderContext";
import { Order, OrderStatus } from "@/types/order";
import { Clock, CheckCircle, XCircle, Send, Eye } from "lucide-react";

interface OrderManagementProps {
  showActions?: boolean;
  title?: string;
  description?: string;
}

const OrderManagement = ({ 
  showActions = true, 
  title = "Commandes reçues",
  description = "Gérez les commandes des serveurs"
}: OrderManagementProps) => {
  const { orders, updateOrderStatus } = useOrders();
  const { toast } = useToast();

  const visibleOrders = orders.filter(o => o.status !== 'paid');

  const getStatusIcon = (status: OrderStatus) => {
    const icons = {
      pending: <Clock className="h-4 w-4" />,
      sent: <CheckCircle className="h-4 w-4" />,
      cancelled: <XCircle className="h-4 w-4" />
    } as const;
    return (icons as any)[status] || null;
  };

  const getStatusColor = (status: OrderStatus) => {
    const colors = {
      pending: "bg-accent text-accent-foreground",
      sent: "bg-primary text-primary-foreground", 
      cancelled: "bg-destructive text-destructive-foreground"
    } as const;
    return (colors as any)[status] || "bg-accent";
  };

  const getStatusText = (status: OrderStatus) => {
    const texts = {
      pending: "En attente",
      sent: "Envoyée",
      cancelled: "Annulée"
    } as const;
    return (texts as any)[status] || String(status);
  };

  const handleProcessOrder = (order: Order) => {
    updateOrderStatus(order.id, 'sent');
    toast({
      title: "Commande traitée",
      description: `Commande #${order.orderNumber} de la table ${order.tableNumber} traitée`,
    });
  };

  const handleCancelOrder = (order: Order) => {
    updateOrderStatus(order.id, 'cancelled');
    toast({
      title: "Commande annulée",
      description: `Commande #${order.orderNumber} annulée`,
      variant: "destructive"
    });
  };

  // Trier les commandes visibles : en attente d'abord, puis par date
  const sortedOrders = [...visibleOrders].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className="text-accent-foreground">
            En attente: {visibleOrders.filter(o => o.status === 'pending').length}
          </Badge>
          <Badge variant="outline" className="text-primary">
            Envoyées: {visibleOrders.filter(o => o.status === 'sent').length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 max-h-[500px] overflow-y-auto">
        {sortedOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Aucune commande pour le moment
          </p>
        ) : (
          sortedOrders.map((order) => (
            <div key={order.id} className="bg-card border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-lg">#{order.orderNumber}</div>
                  <Badge variant="outline" className="text-sm font-semibold">
                    Table {order.tableNumber}
                  </Badge>
                  <Badge className={`${getStatusColor(order.status)} flex items-center gap-1`}>
                    {getStatusIcon(order.status)}
                    {getStatusText(order.status)}
                  </Badge>
                </div>
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">
                    {order.createdAt.toLocaleTimeString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Agent: {order.agentCode}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Articles:</div>
                {order.items.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-muted p-2 rounded">
                    <span>{item.name} x{item.quantity}</span>
                    <span className="font-medium">{(item.price * item.quantity).toLocaleString()} XAF</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total:</span>
                  <span className="text-nack-red">{order.total.toLocaleString()} XAF</span>
                </div>
              </div>

              {showActions && order.status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleProcessOrder(order)}
                    className="flex-1 bg-gradient-primary text-white shadow-button"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Traiter la commande
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleCancelOrder(order)}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default OrderManagement;