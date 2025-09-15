import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import OrderManagement from "@/components/OrderManagement";
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Search,
  TrendingUp,
  DollarSign,
  Coffee,
  Wine,
  Utensils,
  Sandwich,
  CircleX,
  ClipboardList
} from "lucide-react";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, increment, onSnapshot, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { useOrders } from "@/contexts/OrderContext";

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
  formula?: {
    units: number;
    price: number;
  };
}

interface CartItem extends Product {
  quantity: number;
  isFormula?: boolean;
}

const SalesPage = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const { orders } = useOrders();
  const pendingForManager = useMemo(() => orders.filter(o => o.status === 'sent').length, [orders]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<'card' | 'cash' | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isFormulaDialogOpen, setIsFormulaDialogOpen] = useState(false);
  const [cashReceived, setCashReceived] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "products"),
      where("ownerUid", "==", currentUser.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          price: Number(data.price ?? 0),
          category: data.category,
          stock: Number(data.quantity ?? data.stock ?? 0),
          image: data.icon ?? data.image ?? "",
          formula: data.formula ? { units: Number(data.formula.units ?? 0), price: Number(data.formula.price ?? 0) } : undefined,
        } as Product;
      });
      setProducts(list);
    });
    return () => unsub();
  }, [currentUser]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product, isFormula: boolean = false) => {
    const priceToUse = isFormula && product.formula ? product.formula.price : product.price;
    const quantityToAdd = isFormula && product.formula ? product.formula.units : 1;
    const existingItem = cart.find(item => item.id === product.id && item.isFormula === isFormula);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantityToAdd;
      const maxUnits = product.stock; // enforce by units available
      if (newQuantity <= maxUnits) {
        setCart(cart.map(item =>
          item.id === product.id && item.isFormula === isFormula
            ? { ...item, quantity: newQuantity }
            : item
        ));
      } else {
        toast({
          title: "Stock insuffisant",
          description: `Stock disponible: ${maxUnits} unités`,
          variant: "destructive"
        });
      }
    } else {
      setCart([...cart, { 
        ...product, 
        quantity: quantityToAdd,
        price: priceToUse,
        isFormula
      }]);
    }
  };

  const handleAddToCartClick = (product: Product) => {
    if (product.formula) {
      setSelectedProduct(product);
      setIsFormulaDialogOpen(true);
    } else {
      addToCart(product);
    }
  };

  const updateQuantity = (id: string, quantity: number, isFormula: boolean = false) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => !(item.id === id && item.isFormula === isFormula)));
    } else {
      setCart(cart.map(item =>
        item.id === id && item.isFormula === isFormula ? { ...item, quantity } : item
      ));
    }
  };

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const change = selectedPayment === 'cash' ? Math.max(0, (parseFloat(cashReceived || '0') - cartTotal)) : 0;

  const handleSale = async () => {
    if (!currentUser) return;
    if (!selectedPayment) {
      toast({ title: "Mode de paiement requis", description: "Veuillez sélectionner un mode de paiement", variant: "destructive" });
      return;
    }
    if (cart.length === 0) {
      toast({ title: "Panier vide", description: "Ajoutez des articles avant d'encaisser", variant: "destructive" });
      return;
    }

    try {
      const batch = writeBatch(db);
      const saleRef = doc(collection(db, "sales"));

      // Build sale data
      const saleItems = cart.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        isFormula: !!i.isFormula
      }));

      batch.set(saleRef, {
        ownerUid: currentUser.uid,
        items: saleItems,
        total: cartTotal,
        paymentMethod: selectedPayment,
        createdAt: serverTimestamp(),
      });

      // Decrement stock for each product by the number of units sold
      cart.forEach(item => {
        const productRef = doc(collection(db, "products"), item.id);
        batch.update(productRef, {
          quantity: increment(-Number(item.quantity || 0)),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      toast({ title: "Vente enregistrée", description: `Vente de ${cartTotal.toLocaleString()} XAF par ${selectedPayment === 'card' ? 'carte' : 'espèces'}${change>0?` • Rendu: ${change.toLocaleString()} XAF`:''}` });
      setCart([]);
      setSelectedPayment(null);
      setIsCheckoutOpen(false);
      setCashReceived("");
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const getProductIcon = (imageType: string) => {
    const iconMap = {
      beer: Wine,
      soda: Coffee,
      plate: Utensils,
      wine: Wine,
      coffee: Coffee,
      sandwich: Sandwich,
      juice: Coffee,
      rice: Utensils
    };
    const IconComponent = (iconMap as any)[imageType] || Utensils;
    return <IconComponent size={32} className="text-nack-red" />;
  };

  return (
    <div className="space-y-6">
      {/* Orders Button */}
      <div className="mb-6">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-gradient-primary text-white shadow-button">
              <ClipboardList className="mr-2" size={18} />
              Commandes reçues
              <Badge variant="secondary" className="ml-2 bg-white text-nack-red">
                {pendingForManager}
              </Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Commandes reçues</DialogTitle>
              <DialogDescription>
                Commandes envoyées par les serveurs - Encaissez les paiements
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <OrderManagement showActions={true} />
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Products Grid */}
        <div className="lg:col-span-2">
          <Card className="shadow-card border-0">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Produits disponibles</CardTitle>
                  <CardDescription>Sélectionnez les produits à vendre</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="Rechercher un produit..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full md:w-[300px]"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map((product) => (
                  <Card 
                    key={product.id} 
                    className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer relative"
                    onClick={() => handleAddToCartClick(product)}
                  >
                    <CardContent className="p-3 text-center">
                      <div className="mb-2">{getProductIcon(product.image || "")}</div>
                      <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                      <p className="text-lg font-bold text-nack-red mb-1">{product.price.toLocaleString()} XAF</p>
                      <p className="text-xs text-muted-foreground mb-2">Stock: {product.stock}</p>
                      <div className="flex gap-1">
                        <Button 
                          className="flex-1 bg-gradient-primary text-white shadow-button text-xs h-8"
                          disabled={product.stock === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCartClick(product);
                          }}
                        >
                          <ShoppingCart size={12} className="mr-1" />
                          Panier
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cart */}
        <div>
          <Card className="shadow-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Panier
                {cart.length > 0 && (
                  <Dialog open={isCheckoutOpen} onOpenChange={(open)=>{ setIsCheckoutOpen(open); if(!open){ setCashReceived(""); setSelectedPayment(null);} }}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-primary text-white shadow-button">
                        Finaliser la vente
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Finaliser la vente</DialogTitle>
                        <DialogDescription>
                          Total: {cartTotal.toLocaleString()} XAF
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-3">
                          <p className="font-medium">Mode de paiement:</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Button
                              variant={selectedPayment === 'card' ? 'default' : 'outline'}
                              onClick={() => setSelectedPayment('card')}
                              className={`h-16 sm:h-20 flex flex-col gap-2 ${
                                selectedPayment === 'card' 
                                  ? 'bg-gradient-primary text-white' 
                                  : 'border-2 hover:border-nack-red'
                              }`}
                            >
                              <CreditCard size={20} />
                              <span className="text-xs sm:text-sm">Paiement par carte</span>
                            </Button>
                            <Button
                              variant={selectedPayment === 'cash' ? 'default' : 'outline'}
                              onClick={() => setSelectedPayment('cash')}
                              className={`h-16 sm:h-20 flex flex-col gap-2 ${
                                selectedPayment === 'cash' 
                                  ? 'bg-gradient-primary text-white' 
                                  : 'border-2 hover:border-nack-red'
                              }`}
                            >
                              <Banknote size={20} />
                              <span className="text-xs sm:text-sm">Paiement cash</span>
                            </Button>
                          </div>
                        </div>

                        {selectedPayment === 'cash' && (
                          <div className="space-y-2">
                            <Label htmlFor="cashReceived">Montant reçu (XAF)</Label>
                            <Input
                              id="cashReceived"
                              type="number"
                              value={cashReceived}
                              onChange={(e) => setCashReceived(e.target.value)}
                              placeholder="Montant en XAF"
                            />
                            <p className="text-sm text-muted-foreground">
                              À rendre: <span className="font-semibold">{change.toLocaleString()} XAF</span>
                            </p>
                          </div>
                        )}

                        <div className="bg-nack-beige-light p-3 sm:p-4 rounded-lg max-h-40 overflow-y-auto">
                          <h4 className="font-semibold mb-2 text-sm">Récapitulatif:</h4>
                          {cart.map(item => (
                            <div key={`${item.id}-${item.isFormula ? 'formula' : 'single'}`} className="flex justify-between text-xs sm:text-sm">
                              <span>{item.name} x{item.quantity}</span>
                              <span>{(item.price * item.quantity).toLocaleString()} XAF</span>
                            </div>
                          ))}
                          <div className="border-t mt-2 pt-2 font-semibold text-sm">
                            Total: {cartTotal.toLocaleString()} XAF
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsCheckoutOpen(false)} className="w-full sm:w-auto">
                          Annuler
                        </Button>
                        <Button onClick={handleSale} className="bg-gradient-primary text-white w-full sm:w-auto">
                          Confirmer la vente
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun article dans le panier
                </p>
              ) : (
                <div className="space-y-3">
                   {cart.map((item) => (
                     <div key={`${item.id}-${item.isFormula ? 'formula' : 'single'}`} className="flex items-center justify-between p-3 bg-nack-beige-light rounded-lg">
                       <div className="flex-1">
                         <p className="font-medium text-sm">
                           {item.name}
                           {item.isFormula && <span className=" ml-2 text-xs bg-nack-red text-white px-1 rounded">Formule</span>}
                         </p>
                         <p className="text-sm text-muted-foreground">{item.price.toLocaleString()} XAF</p>
                       </div>
                       <div className="flex items-center gap-2">
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => updateQuantity(item.id, item.quantity - 1, item.isFormula)}
                         >
                           <Minus size={16} />
                         </Button>
                         <span className="w-8 text-center font-medium">{item.quantity}</span>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => updateQuantity(item.id, item.quantity + 1, item.isFormula)}
                           disabled={item.quantity >= item.stock}
                         >
                           <Plus size={16} />
                         </Button>
                       </div>
                     </div>
                   ))}
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center font-bold text-lg">
                      <span>Total:</span>
                      <span className="text-nack-red">{cartTotal.toLocaleString()} XAF</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog de sélection formule/produit unitaire */}
      <Dialog open={isFormulaDialogOpen} onOpenChange={setIsFormulaDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sélectionner le type d'achat</DialogTitle>
            <DialogDescription>
              {selectedProduct?.name} - Choisissez entre un produit unitaire ou la formule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedProduct) addToCart(selectedProduct, false);
                  setIsFormulaDialogOpen(false);
                }}
                className="h-16 flex flex-col gap-2 border-2 hover:border-nack-red"
              >
                <span className="font-semibold">Produit unitaire</span>
                <span className="text-sm text-muted-foreground">
                  {selectedProduct?.price.toLocaleString()} XAF l'unité
                </span>
              </Button>
              {selectedProduct?.formula && (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedProduct) addToCart(selectedProduct, true);
                    setIsFormulaDialogOpen(false);
                  }}
                  className="h-16 flex flex-col gap-2 border-2 hover:border-nack-red"
                >
                  <span className="font-semibold">Formule</span>
                  <span className="text-sm text-muted-foreground">
                    {selectedProduct.formula.units} unités à {selectedProduct.formula.price.toLocaleString()} XAF
                  </span>
                </Button>
              )}
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsFormulaDialogOpen(false)}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesPage;