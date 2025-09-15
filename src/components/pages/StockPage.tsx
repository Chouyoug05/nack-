import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  AlertTriangle,
  TrendingDown,
  DollarSign,
  Coffee,
  Wine,
  Pizza,
  Sandwich,
  IceCream,
  Beer,
  GlassWater,
  Cookie,
  Cherry,
  Apple
} from "lucide-react";
import { db } from "@/lib/firebase";
import { addDoc, collection, deleteDoc, doc, increment, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  cost: number;
  description?: string;
  icon?: string;
  formula?: {
    units: number;
    price: number;
  };
}

const StockPage = () => {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isLossModalOpen, setIsLossModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "products"),
      where("ownerUid", "==", currentUser.uid)
      // orderBy removed to avoid composite index requirements
    );
    const unsub = onSnapshot(q, (snap) => {
      const list: Product[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          name: data.name,
          category: data.category,
          price: Number(data.price ?? 0),
          quantity: Number(data.quantity ?? 0),
          cost: Number(data.cost ?? 0),
          description: data.description ?? "",
          icon: data.icon ?? undefined,
          formula: data.formula ? { units: Number(data.formula.units ?? 0), price: Number(data.formula.price ?? 0) } : undefined,
        } as Product;
      });
      setProducts(list);
    });
    return () => unsub();
  }, [currentUser]);

  const [newProduct, setNewProduct] = useState({
    name: "",
    category: "",
    price: "",
    quantity: "",
    cost: "",
    description: "",
    icon: "",
    formulaUnits: "",
    formulaPrice: ""
  });

  const [lossData, setLossData] = useState({
    productId: "",
    quantity: "",
    reason: "",
    date: new Date().toISOString().split('T')[0]
  });

  const categories = ["Boissons", "Plats", "Alcools", "Snacks", "Desserts"];
  
  const availableIcons = [
    { name: "Beer", icon: Beer, label: "Bière" },
    { name: "Wine", icon: Wine, label: "Vin/Alcool" },
    { name: "Coffee", icon: Coffee, label: "Café" },
    { name: "GlassWater", icon: GlassWater, label: "Boisson" },
    { name: "Pizza", icon: Pizza, label: "Pizza" },
    { name: "Sandwich", icon: Sandwich, label: "Sandwich" },
    { name: "Cookie", icon: Cookie, label: "Snack" },
    { name: "IceCream", icon: IceCream, label: "Dessert" },
    { name: "Cherry", icon: Cherry, label: "Fruit" },
    { name: "Apple", icon: Apple, label: "Pomme" }
  ];

  const getProductIcon = (iconName?: string) => {
    if (!iconName) return Package;
    const iconItem = availableIcons.find(item => item.name === iconName);
    return iconItem ? iconItem.icon : Package;
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockProducts = products.filter(p => p.quantity <= 10);
  const totalStockValue = products.reduce((total, product) => total + (product.price * product.quantity), 0);

  const handleAddProduct = async () => {
    if (!currentUser) return;
    if (!newProduct.name || !newProduct.category || !newProduct.price || !newProduct.quantity) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    try {
      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), {
          name: newProduct.name,
          category: newProduct.category,
          price: Number(newProduct.price),
          quantity: Number(newProduct.quantity),
          cost: Number(newProduct.cost) || 0,
          description: newProduct.description || "",
          icon: newProduct.icon || null,
          formula: newProduct.formulaUnits && newProduct.formulaPrice ? {
            units: Number(newProduct.formulaUnits),
            price: Number(newProduct.formulaPrice)
          } : null,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Produit mis à jour" });
      } else {
        await addDoc(collection(db, "products"), {
          ownerUid: currentUser.uid,
          name: newProduct.name,
          category: newProduct.category,
          price: Number(newProduct.price),
          quantity: Number(newProduct.quantity),
          cost: Number(newProduct.cost) || 0,
          description: newProduct.description || "",
          icon: newProduct.icon || null,
          formula: newProduct.formulaUnits && newProduct.formulaPrice ? {
            units: Number(newProduct.formulaUnits),
            price: Number(newProduct.formulaPrice)
          } : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Produit ajouté", description: "Produit ajouté au stock" });
      }
      setNewProduct({ name: "", category: "", price: "", quantity: "", cost: "", description: "", icon: "", formulaUnits: "", formulaPrice: "" });
      setEditingProductId(null);
      setIsAddModalOpen(false);
    } catch (e: any) {
      toast({ title: "Erreur d'enregistrement", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, "products", id));
      toast({ title: "Produit supprimé", description: "Le produit a été retiré du stock" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const handleRecordLoss = async () => {
    if (!currentUser) return;
    if (!lossData.productId || !lossData.quantity || !lossData.reason) {
      toast({ title: "Erreur", description: "Veuillez remplir tous les champs obligatoires", variant: "destructive" });
      return;
    }
    const product = products.find(p => p.id === lossData.productId);
    if (!product) {
      toast({ title: "Erreur", description: "Produit introuvable", variant: "destructive" });
      return;
    }
    const lossQuantity = Number(lossData.quantity);
    if (lossQuantity > product.quantity) {
      toast({ title: "Erreur", description: "La quantité de perte ne peut pas dépasser le stock disponible", variant: "destructive" });
      return;
    }
    try {
      await addDoc(collection(db, "losses"), {
        ownerUid: currentUser.uid,
        productId: lossData.productId,
        quantity: lossQuantity,
        reason: lossData.reason,
        date: Timestamp.fromDate(new Date(lossData.date)),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "products", lossData.productId), {
        quantity: increment(-lossQuantity),
        updatedAt: serverTimestamp(),
      });
      setLossData({ productId: "", quantity: "", reason: "", date: new Date().toISOString().split('T')[0] });
      setIsLossModalOpen(false);
      toast({ title: "Perte enregistrée", description: `${lossQuantity} unité(s) enregistrée(s) en perte` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "", variant: "destructive" });
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setNewProduct({
      name: p.name,
      category: p.category,
      price: String(p.price),
      quantity: String(p.quantity),
      cost: String(p.cost || 0),
      description: p.description || "",
      icon: p.icon || "",
      formulaUnits: p.formula ? String(p.formula.units) : "",
      formulaPrice: p.formula ? String(p.formula.price) : "",
    });
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produits</p>
                <p className="text-2xl font-bold">{products.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Package size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valeur du Stock</p>
                <p className="text-2xl font-bold">{totalStockValue.toLocaleString()} XAF</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <DollarSign size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Stock Faible</p>
                <p className="text-2xl font-bold text-red-600">{lowStockProducts.length}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <AlertTriangle size={24} className="text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Gestion du Stock</CardTitle>
              <CardDescription>Gérez vos produits et surveillez les stocks</CardDescription>
            </div>
             <div className="flex gap-2">
               <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     className="bg-gradient-primary text-white shadow-button hover:shadow-elegant"
                     onClick={() => setIsAddModalOpen(true)}
                   >
                     <Plus className="mr-2" size={18} />
                     Ajouter un produit
                   </Button>
                 </DialogTrigger>
                <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-bold">{editingProductId ? "Modifier le produit" : "Ajouter un nouveau produit"}</DialogTitle>
                    <DialogDescription className="text-base">
                      Remplissez les informations du produit à ajouter au stock.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    {/* Informations de base */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">Informations de base</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium mb-2 block">Nom du produit *</Label>
                          <Input
                            id="name"
                            value={newProduct.name}
                            onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                            className="w-full h-11 text-base"
                            placeholder="Ex: Bière Castel"
                          />
                        </div>
                        <div>
                          <Label htmlFor="category" className="text-sm font-medium mb-2 block">Catégorie *</Label>
                          <Select
                            value={newProduct.category}
                            onValueChange={(value) => setNewProduct({...newProduct, category: value})}
                          >
                            <SelectTrigger className="w-full h-11 text-base bg-background">
                              <SelectValue placeholder="Sélectionner une catégorie" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              {categories.map(cat => (
                                <SelectItem key={cat} value={cat} className="text-base py-2 cursor-pointer hover:bg-muted">
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="icon" className="text-sm font-medium mb-2 block">Icône</Label>
                          <Select
                            value={newProduct.icon}
                            onValueChange={(value) => setNewProduct({...newProduct, icon: value})}
                          >
                            <SelectTrigger className="w-full h-11 text-base bg-background">
                              <SelectValue placeholder="Sélectionner une icône" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50 max-h-60 overflow-y-auto">
                              {availableIcons.map(iconItem => (
                                <SelectItem key={iconItem.name} value={iconItem.name} className="text-base py-3 cursor-pointer hover:bg-muted">
                                  <div className="flex items-center gap-3">
                                    <iconItem.icon size={20} />
                                    <span>{iconItem.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="description" className="text-sm font-medium mb-2 block">Description</Label>
                          <Textarea
                            id="description"
                            value={newProduct.description}
                            onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                            className="w-full text-base min-h-[80px]"
                            placeholder="Description du produit (optionnel)"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Prix et stock */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">Prix et stock</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="price" className="text-sm font-medium mb-2 block">Prix de vente (XAF) *</Label>
                          <Input
                            id="price"
                            type="number"
                            value={newProduct.price}
                            onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                            className="w-full h-11 text-base"
                            placeholder="Ex: 1500"
                            min="0"
                          />
                        </div>
                        <div>
                          <Label htmlFor="cost" className="text-sm font-medium mb-2 block">Coût d'achat (XAF)</Label>
                          <Input
                            id="cost"
                            type="number"
                            value={newProduct.cost}
                            onChange={(e) => setNewProduct({...newProduct, cost: e.target.value})}
                            className="w-full h-11 text-base"
                            placeholder="Ex: 1000"
                            min="0"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="quantity" className="text-sm font-medium mb-2 block">Quantité initiale *</Label>
                        <Input
                          id="quantity"
                          type="number"
                          value={newProduct.quantity}
                          onChange={(e) => setNewProduct({...newProduct, quantity: e.target.value})}
                          className="w-full h-11 text-base"
                          placeholder="Ex: 50"
                          min="0"
                        />
                      </div>
                    </div>

                    {/* Formule optionnelle */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold border-b pb-2">Formule (optionnel)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="formulaUnits" className="text-sm font-medium mb-2 block">Nombre d'unités</Label>
                          <Input
                            id="formulaUnits"
                            type="number"
                            value={newProduct.formulaUnits}
                            onChange={(e) => setNewProduct({...newProduct, formulaUnits: e.target.value})}
                            className="w-full h-11 text-base"
                            placeholder="Ex: 2"
                            min="1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="formulaPrice" className="text-sm font-medium mb-2 block">Prix de la formule (XAF)</Label>
                          <Input
                            id="formulaPrice"
                            type="number"
                            value={newProduct.formulaPrice}
                            onChange={(e) => setNewProduct({...newProduct, formulaPrice: e.target.value})}
                            className="w-full h-11 text-base"
                            placeholder="Ex: 4500"
                            min="0"
                          />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        La formule permet de proposer un prix spécial pour plusieurs unités
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddModalOpen(false)}
                      className="h-11 px-6 text-base"
                    >
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleAddProduct} 
                      className="bg-gradient-primary text-white h-11 px-6 text-base font-medium"
                    >
                      {editingProductId ? "Modifier le produit" : "Ajouter le produit"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
               <Dialog open={isLossModalOpen} onOpenChange={setIsLossModalOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     variant="outline" 
                     className="border-red-200 text-red-600 hover:bg-red-50"
                     onClick={() => setIsLossModalOpen(true)}
                   >
                     <TrendingDown className="mr-2" size={18} />
                     Perte
                   </Button>
                 </DialogTrigger>
                 <DialogContent className="sm|max-w-[500px] max-h-[90vh] overflow-y-auto">
                   <DialogHeader className="pb-4">
                     <DialogTitle className="text-xl font-bold">Enregistrer une perte</DialogTitle>
                     <DialogDescription className="text-base">
                       Sélectionnez le produit et la quantité perdue pour mettre à jour le stock.
                     </DialogDescription>
                   </DialogHeader>
                   <div className="space-y-6 py-4">
                     <div>
                       <Label htmlFor="product" className="text-sm font-medium mb-2 block">Produit concerné *</Label>
                       <Select
                         value={lossData.productId}
                         onValueChange={(value) => setLossData({...lossData, productId: value})}
                       >
                         <SelectTrigger className="w-full h-11 text-base bg-background">
                           <SelectValue placeholder="Sélectionner un produit" />
                         </SelectTrigger>
                         <SelectContent className="bg-background border shadow-lg z-50 max-h-60 overflow-y-auto">
                           {products.map(product => (
                             <SelectItem key={product.id} value={product.id} className="text-base py-3 cursor-pointer hover:bg-muted">
                               <div className="flex flex-col items-start">
                                 <span className="font-medium">{product.name}</span>
                                 <span className="text-sm text-muted-foreground">Stock disponible: {product.quantity}</span>
                               </div>
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     </div>

                     <div>
                       <Label htmlFor="lossQuantity" className="text-sm font-medium mb-2 block">Quantité perdue *</Label>
                       <Input
                         id="lossQuantity"
                         type="number"
                         value={lossData.quantity}
                         onChange={(e) => setLossData({...lossData, quantity: e.target.value})}
                         className="w-full h-11 text-base"
                         placeholder="Nombre d'unités perdues"
                         min="1"
                       />
                     </div>

                     <div>
                       <Label htmlFor="reason" className="text-sm font-medium mb-2 block">Raison de la perte *</Label>
                       <Select
                         value={lossData.reason}
                         onValueChange={(value) => setLossData({...lossData, reason: value})}
                       >
                         <SelectTrigger className="w-full h-11 text-base bg-background">
                           <SelectValue placeholder="Sélectionner une raison" />
                         </SelectTrigger>
                         <SelectContent className="bg-background border shadow-lg z-50">
                           <SelectItem value="expired" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Produit expiré
                           </SelectItem>
                           <SelectItem value="damaged" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Produit endommagé
                           </SelectItem>
                           <SelectItem value="theft" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Vol
                           </SelectItem>
                           <SelectItem value="error" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Erreur d'inventaire
                           </SelectItem>
                           <SelectItem value="other" className="text-base py-2 cursor-pointer hover:bg-muted">
                             Autre
                           </SelectItem>
                         </SelectContent>
                       </Select>
                     </div>

                     <div>
                       <Label htmlFor="date" className="text-sm font-medium mb-2 block">Date de la perte</Label>
                       <Input
                         id="date"
                         type="date"
                         value={lossData.date}
                         onChange={(e) => setLossData({...lossData, date: e.target.value})}
                         className="w-full h-11 text-base"
                       />
                     </div>
                   </div>
                   <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                     <Button 
                       variant="outline" 
                       onClick={() => setIsLossModalOpen(false)}
                       className="h-11 px-6 text-base"
                     >
                       Annuler
                     </Button>
                     <Button 
                       onClick={handleRecordLoss} 
                       variant="destructive"
                       className="h-11 px-6 text-base font-medium"
                     >
                       Enregistrer la perte
                     </Button>
                   </div>
                 </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory as any}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Products Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-4 font-semibold">Produit</th>
                    <th className="text-left p-4 font-semibold">Catégorie</th>
                    <th className="text-left p-4 font-semibold">Prix</th>
                    <th className="text-left p-4 font-semibold">Stock</th>
                    <th className="text-left p-4 font-semibold">Statut</th>
                    <th className="text-left p-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-border hover:bg-muted/50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {(() => {
                            const IconComponent = getProductIcon(product.icon);
                            return <IconComponent size={20} className="text-nack-red" />;
                          })()}
                          <div>
                            <p className="font-medium">{product.name}</p>
                            {product.description && (
                              <p className="text-sm text-muted-foreground">{product.description}</p>
                            )}
                            {product.formula && (
                              <Badge variant="outline" className="mt-1 text-xs">
                                Formule: {product.formula.units} unités à {product.formula.price.toLocaleString()} XAF
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge variant="secondary">{product.category}</Badge>
                      </td>
                      <td className="p-4 font-semibold">{product.price.toLocaleString()} XAF</td>
                      <td className="p-4">
                        <span className={`font-medium ${product.quantity <= 10 ? 'text-red-600' : 'text-foreground'}`}>
                          {product.quantity}
                        </span>
                      </td>
                      <td className="p-4">
                        {product.quantity <= 10 ? (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <TrendingDown size={12} />
                            Stock faible
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            En stock
                          </Badge>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" onClick={() => startEditProduct(product)}>
                            <Edit size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleDeleteProduct(product.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockPage;
