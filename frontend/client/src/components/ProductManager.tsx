import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProductSchema, insertCategorySchema, type Seller, ProductWithSeller, Category } from "@shared/backend/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Info } from "lucide-react";
import { z } from "zod";
import { getAuth } from "firebase/auth";
import { useState } from "react";

const productFormSchema = insertProductSchema.extend({
  image: z
    .any()
    .refine((file) => file instanceof File, {
      message: "An image file is required.",
    })
    .refine((file) => file.size < 5000000, {
      message: "Image size must be less than 5MB.",
    }),
  price: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0.01, "Price must be a positive number")
  ),
  originalPrice: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0.01, "Original price must be a positive number").optional()
  ),
  stock: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().int("Stock must be an integer").min(0, "Stock cannot be negative").default(0)
  ),
  categoryId: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().int("Category ID must be an integer").min(1, "Category ID is required")
  ),
});

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  slug: z.string().min(2, { message: "Slug must be at least 2 characters." }),
  description: z.string().optional(),
  image: z.any().refine(file => file instanceof File, {
    message: "An image file is required.",
  }),
  isActive: z.boolean().default(true),
});

interface ProductManagerProps {
  seller: Seller;
}

export default function ProductManager({ seller }: ProductManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithSeller | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  // Fetch seller's products

    // Fetch seller's products
    
  const { data: products, isLoading: productsLoading, error: productsError } = useQuery({
    queryKey: ["/api/sellers/products"],
    queryFn: () => apiRequest("GET", "/api/sellers/products"),
    enabled: !!seller?.id,
    staleTime: 5 * 60 * 1000,
  });


  // Fetch categories for product form
  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    queryFn: () => apiRequest("GET", "/api/categories"),
    staleTime: Infinity,
  });
  
  // Product form
  const productForm = useForm<z.infer<typeof productFormSchema>>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      price: undefined,
      originalPrice: undefined,
      categoryId: null,
      stock: 0,
      images: null,
    },
  });

  // Category form
  const categoryForm = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      image: undefined,
      isActive: true,
    },
  });
  
  const productMutation = useMutation({
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error("User not authenticated.");
      }
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('image', data.image);
      for (const key in data) {
        if (data[key] !== null && data[key] !== undefined && key !== 'image') {
          formData.append(key, data[key]);
        }
      }
      const response = await fetch("/api/sellers/products", {
        method: "POST",
        body: formData,
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || "Failed to create product");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: editingProduct ? "Product updated" : "Product created",
        description: `Product has been ${editingProduct ? "updated" : "created"} successfully`,
      });
      setIsProductDialogOpen(false);
      setEditingProduct(null);
      productForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${editingProduct ? "update" : "create"} product`,
        variant: "destructive",
      });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: number) => {
      return await apiRequest("DELETE", `/api/products/${productId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Product deleted",
        description: "Product has been deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to delete product",
        variant: "destructive",
      });
    },
  });

  const categoryMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest("POST", "/api/sellers/categories", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({
        title: "Category created",
        description: "Category has been created successfully",
      });
      setIsCategoryDialogOpen(false);
      categoryForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.response?.data?.message || "Failed to create category",
        variant: "destructive",
      });
    },
  });

  const onProductSubmit = (data: z.infer<typeof productFormSchema>) => {
    productMutation.mutate(data);
  };

  const onCategorySubmit = (data: z.infer<typeof categoryFormSchema>) => {
    if (!data.image) {
      toast({
        title: "Error",
        description: "Please select an image for the category.",
        variant: "destructive",
      });
      return;
    }
    const formData = new FormData();
    formData.append("name", data.name);
    formData.append("slug", data.slug);
    formData.append("description", data.description || "");
    formData.append("image", data.image);
    categoryMutation.mutate(formData);
  };

  const handleEditProduct = (product: ProductWithSeller) => {
    setEditingProduct(product);
    productForm.reset({
      name: product.name,
      description: product.description || "",
      price: product.price,
      originalPrice: product.originalPrice,
      categoryId: product.categoryId,
      stock: product.stock || 0,
      images: product.images || [],
    });
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = (productId: number) => {
    toast({
      title: "Confirm Deletion",
      description: "Are you sure you want to delete this product? This action cannot be undone.",
      variant: "destructive",
      action: (
        <div className="flex gap-2">
          <Button onClick={() => {
            deleteProductMutation.mutate(productId);
            toast.dismiss();
          }} className="bg-red-500 hover:bg-red-600 text-white">
            Delete
          </Button>
          <Button onClick={() => toast.dismiss()} variant="outline">
            Cancel
          </Button>
        </div>
      ),
      duration: 10000,
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Your Products</CardTitle>
          <div className="flex gap-2">
            {seller.approvalStatus === "approved" ? (
              <>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => {
                      categoryForm.reset();
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Category</DialogTitle>
                      <DialogDescription>
                        Add a new product category to organize your items.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...categoryForm}>
                      <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4">
                        <FormField
                          control={categoryForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Category Slug</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="e.g., electronics" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description (Optional)</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={categoryForm.control}
                          name="image"
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem>
                              <FormLabel>Category Image</FormLabel>
                              <FormControl>
                                <Input
                                  {...fieldProps}
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => onChange(event.target.files?.[0])}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCategoryDialogOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit">
                            Create Category
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => {
                      setEditingProduct(null);
                      productForm.reset();
                    }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingProduct ? "Edit Product" : "Add New Product"}
                      </DialogTitle>
                      <DialogDescription>
                        {editingProduct ? "Update details for your product." : "Add a new product to your inventory."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...productForm}>
                      <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4">
                        <FormField
                          control={productForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Product Name</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={productForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Description</FormLabel>
                              <FormControl>
                                <Textarea {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={productForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Price (₹)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.01" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={productForm.control}
                            name="originalPrice"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Original Price (₹) (Optional)</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" step="0.01" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <FormField
                            control={productForm.control}
                            name="categoryId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Category</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select a category" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {categories?.map((category) => (
                                      <SelectItem key={category.id} value={category.id.toString()}>
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={productForm.control}
                            name="stock"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Stock</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={productForm.control}
                          name="image"
                          render={({ field: { value, onChange, ...fieldProps } }) => (
                            <FormItem>
                              <FormLabel>Product Image</FormLabel>
                              <FormControl>
                                <Input
                                  {...fieldProps}
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => onChange(event.target.files?.[0])}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsProductDialogOpen(false);
                              setEditingProduct(null);
                              productForm.reset();
                            }}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={productMutation.isPending}>
                            {productMutation.isPending ? (editingProduct ? "Updating..." : "Adding...") : (editingProduct ? "Update Product" : "Add Product")}
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
              </>
            ) : (
              <Badge variant="outline" className="text-orange-500">
                <Info className="h-4 w-4 mr-2" />
                Verify account to add products
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {productsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-lg" />
            ))}
          </div>
        ) : productsError ? (
          <p className="text-red-500">Error loading products: {productsError.message}</p>
        ) : products && products.length === 0 ? (
          <p className="text-muted-foreground">You haven't added any products yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {products?.map((product) => (
              <Card key={product.id} className="relative group overflow-hidden">
                {product.images && product.images.length > 0 && (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-t-lg"
                  />
                )}
                <CardContent className="p-4">
                  <h4 className="font-semibold text-lg line-clamp-1">{product.name}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-lg font-bold text-primary">₹{product.price}</p>
                    <Badge variant="secondary">{product.stock} in stock</Badge>
                  </div>
                  <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="outline" size="icon" onClick={() => handleEditProduct(product)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDeleteProduct(product.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
            
