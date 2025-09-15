import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Product, CartItem } from "@/types/order";
import { 
  ShoppingCart, 
  Search,
  Coffee,
  Wine,
  Utensils,
  Sandwich,
  MenuSquare
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface ProductGridProps {
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
}

const ProductGrid = ({ cart, onAddToCart, onUpdateQuantity }: ProductGridProps) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const { currentUser } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "products"), where("ownerUid", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          price: Number(data.price ?? 0),
          category: data.category || "",
          stock: Number(data.quantity ?? 0),
          image: data.icon || undefined,
        } as Product;
      });
      setProducts(list);
    });
    return () => unsub();
  }, [currentUser]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
      if (existingItem.quantity < product.stock) {
        onUpdateQuantity(product.id, existingItem.quantity + 1);
      } else {
        toast({
          title: "Stock insuffisant",
          description: `Il ne reste que ${product.stock} unités en stock`,
          variant: "destructive"
        });
      }
    } else {
      onAddToCart(product);
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
      rice: Utensils,
      menu: MenuSquare
    };
    const IconComponent = iconMap[imageType as keyof typeof iconMap] || Utensils;
    return <IconComponent size={32} className="text-nack-red" />;
  };

  return (
    <Card className="shadow-card border-0">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Produits disponibles</CardTitle>
            <CardDescription>Sélectionnez les produits pour la commande</CardDescription>
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
        <div className="space-y-4">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {['Tous', 'Boissons', 'Plats', 'Formules', 'Alcools', 'Snacks'].map((category) => (
              <Button
                key={category}
                variant="outline"
                size="sm"
                onClick={() => setSearchTerm(category === 'Tous' ? '' : category)}
                className={searchTerm === category || (category === 'Tous' && !searchTerm) ? 'bg-primary text-primary-foreground' : ''}
              >
                {category}
              </Button>
            ))}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((product) => (
            <Card 
              key={product.id} 
              className="shadow-card border-0 hover:shadow-elegant transition-shadow cursor-pointer"
              onClick={() => addToCart(product)}
            >
              <CardContent className="p-3 text-center">
                  <div className="mb-2">{getProductIcon(product.image || 'menu')}</div>
                  <h3 className="font-semibold text-sm mb-1">{product.name}</h3>
                  <div className="text-xs text-muted-foreground mb-1">{product.category}</div>
                  <p className="text-lg font-bold text-nack-red mb-1">{product.price.toLocaleString()} XAF</p>
                <p className="text-xs text-muted-foreground mb-2">Stock: {product.stock}</p>
                <Button 
                  className="w-full bg-gradient-primary text-white shadow-button text-xs h-8"
                  disabled={product.stock === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    addToCart(product);
                  }}
                >
                  <ShoppingCart size={12} className="mr-1" />
                  Ajouter
                </Button>
              </CardContent>
            </Card>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductGrid;