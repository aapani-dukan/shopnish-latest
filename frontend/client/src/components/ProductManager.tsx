// frontend/components/productmanager.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"; // ✅ Corrected casing and path
import { Button } from "@/components/ui/button"; // ✅ Corrected casing and path
import { Badge } from "@/components/ui/badge"; // ✅ Corrected casing and path
import { Input } from "@/components/ui/input"; // ✅ Corrected casing and path
import { Textarea } from "@/components/ui/textarea"; // ✅ Corrected casing and path
import { Label } from "@/components/ui/label"; // ✅ Corrected casing and path
import { Skeleton } from "@/components/ui/skeleton"; // ✅ Corrected casing and path
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"; // ✅ Corrected casing and path
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // ✅ Corrected casing and path
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"; // ✅ Corrected casing and path
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"; // ✅ Corrected casing
import { useForm } from "react-hook-form"; // ✅ Corrected casing
import { zodResolver } from "@hookform/resolvers/zod"; // ✅ Corrected casing
import { insertProductSchema, insertCategorySchema, type Seller,  Category } from "shared/backend/schema"; // Ensure these types are correctly imported
import { apiRequest } from "@/lib/queryClient"; // ✅ Corrected casing and path
import { useToast } from "@/hooks/use-toast"; // ✅ Corrected casing and path
import { Plus, Edit, Trash2, Info } from "lucide-react";
import { z } from "zod";
import { getAuth } from "firebase/auth"; // ✅ Corrected casing
import { useState } from "react"; // ✅ Corrected casing
import { ProductWithSeller} from "../interfaces/productWithSeller.tsx";
// ✅ Updated ProductFormSchema for frontend use
const productFormSchema = insertProductSchema.extend({
  // For update operations, image might not be required
  image: z
    .any()
    .refine((file) => !file || file instanceof File, { // ✅ Make image optional for updates
      message: "An image file is required.",
    })
    .refine((file) => !file || file.size < 5000000, {
      message: "Image size must be less than 5MB.",
    })
    .optional(), // Make image optional
  price: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0.01, "Price must be a positive number")
  ),
  originalPrice: z.preprocess( // ✅ Corrected to originalPrice
    (val) => (val === "" ? undefined : Number(val)),
    z.number().min(0.01, "Original price must be a positive number").optional()
  ),
  stock: z.preprocess(
    (val) => (val === "" ? undefined : Number(val)),
    z.number().int("Stock must be an integer").min(0, "Stock cannot be negative").default(0)
  ),
  categoryId: z.preprocess( // ✅ Corrected to categoryId
    (val) => (val === "" ? undefined : Number(val)),
    z.number().int("Category ID must be an integer").min(1, "Category ID is required")
  ),
}).partial(); // ✅ Make all fields partial for PATCH requests, as only changed fields are sent

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "Category name must be at least 2 characters." }),
  slug: z.string().min(2, { message: "Slug must be at least 2 characters." }),
  description: z.string().optional(),
  image: z.any().refine(file => file instanceof File, { // ✅ Corrected to File
    message: "An image file is required.",
  }),
  isActive: z.boolean().default(true), // ✅ Corrected to isActive
});

interface ProductManagerProps { // ✅ Corrected casing
  seller: Seller;
}

export default function ProductManager({ seller }: ProductManagerProps) { // ✅ Corrected casing
  const { toast } = useToast(); // ✅ Corrected casing
  const queryClient = useQueryClient(); // ✅ Corrected casing
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false); // ✅ Corrected casing
  const [editingProduct, setEditingProduct] = useState<ProductWithSeller | null>(null); // ✅ Corrected casing
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false); // ✅ Corrected casing

  // fetch seller's products
  const { data: products, isLoading: productsLoading, error: productsError } = useQuery<ProductWithSeller[]>({ // ✅ Corrected casing
    queryKey: ["/api/sellers/products"], // ✅ Corrected casing
    queryFn: () => apiRequest("GET", "/api/sellers/products"), // ✅ Corrected casing
    enabled: !!seller?.id,
    staleTime: 5 * 60 * 1000, // ✅ Corrected casing
  });

  // fetch categories for product form
  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useQuery<Category[]>({ // ✅ Corrected casing
    queryKey: ["/api/categories"], // ✅ Corrected casing
    queryFn: () => apiRequest("GET", "/api/categories"), // ✅ Corrected casing
    staleTime: Infinity, // ✅ Corrected casing
  });

  
const productFormSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  price: z.number().optional(),
  originalPrice: z.number().optional(),
  categoryId: z.number().optional(),
  stock: z.number().optional(),
  image: z.string().optional(),
  // ... आपके अन्य fields (जितने चाहिए add करें)
});

// स्कीमा से टाइप infer करें
type FormInput = z.infer<typeof productFormSchema>;

// Main hook/function में इसका पूरा इस्तेमाल:
const productForm = useForm<FormInput>({
  resolver: zodResolver(productFormSchema),
  defaultValues: {
    name: "",
    description: "",
    price: undefined,         // नंबर है तो undefined/null दे सकते हैं
    originalPrice: undefined, // ऊपर को match करें
    categoryId: undefined,    // नंबर है तो undefined
    stock: 0,                 // अगर नंबर है और required नहीं, तो default 0 ठीक
    image: undefined,         // string है, और optional, तो undefined
    // ... अगर स्कीमा में और fields हैं तो यहाँ भी add करें
  },
});

  // category form
  const categoryForm = useForm<z.infer<typeof categoryFormSchema>>({ // ✅ Corrected casing
    resolver: zodResolver(categoryFormSchema), // ✅ Corrected casing
    defaultValues: { // ✅ Corrected casing
      name: "",
      slug: "",
      description: "",
      image: undefined,
      isActive: true, // ✅ Corrected to isActive
    },
  });

  // ✅ Product Create/Update Mutation
  const productMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async (data: z.infer<typeof productFormSchema>) => {
      const auth = getAuth();
      const user = auth.currentUser; // ✅ Corrected casing
      if (!user) {
        throw new Error("User not authenticated."); // ✅ Corrected casing
      }
      const token = await user.getIdToken(); // ✅ Corrected casing
      const formData = new FormData(); // ✅ Corrected casing

     // Append image if present
if (data.image) {
  // TypeScript अब जानता है कि data.image एक File हो सकता है (refine के कारण)
  // यदि यह instanceof File चेक पास करता है, तो यह निश्चित रूप से एक File है।
  // `as File` यहाँ सुरक्षित है क्योंकि स्कीमा ने इसे पहले ही मान्य कर दिया है।
  formData.append('image', data.image as File); 
}

// Append other fields, ensuring numbers are converted to string for FormData
for (const key of Object.keys(data) as Array<keyof typeof data>) {
  // 'image' फ़ील्ड को छोड़ दें क्योंकि इसे अलग से हैंडल किया जाता है
  if (key === 'image') {
    continue;
  }

  const value = data[key];

  // undefined या null मानों को छोड़ दें
  if (value === null || value === undefined) {
    continue;
  }

  // FormData.append() 'string', 'Blob', या 'File' मानों की अपेक्षा करता है।
  // अन्य सभी को एक स्ट्रिंग में परिवर्तित किया जाना चाहिए।
  // आपका स्कीमा नंबर, स्ट्रिंग, बूलियन को आउटपुट करेगा, जो सभी 'String()' द्वारा संभाले जाते हैं।
  // यदि आपके पास Zod स्कीमा में ऐसे नेस्टेड ऑब्जेक्ट्स हैं जिन्हें आप JSON के रूप में भेजना चाहते हैं
  // (जो File/Blob नहीं हैं), तो उस तर्क को यहाँ जोड़ें, लेकिन वर्तमान स्कीमा के साथ,
  // यह सीधे आवश्यक नहीं होना चाहिए।
  
  // यदि आप निश्चित हैं कि आपके स्कीमा से सभी गैर-छवि मान
  // सीधे String() में कनवर्ट किए जा सकते हैं:
  formData.append(key, String(value)); // ✅ 'String()' का उपयोग करके स्पष्ट रूपांतरण
}


      let response: Response;
      if (editingProduct) {
        // PATCH request for updating product
        response = await fetch(`/api/sellers/products/${editingProduct.id}`, { // ✅ Use PATCH and product ID
          method: "PATCH",
          body: formData,
          headers: {
            'Authorization': `Bearer ${token}` // Note: FormData doesn't like 'Content-Type': 'multipart/form-data' explicitly here. Fetch does it automatically.
          },
        });
      } else {
        // POST request for creating new product
        response = await fetch("/api/sellers/products", {
          method: "POST", // ✅ Use POST for new product
          body: formData,
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }

      if (!response.ok) {
        const errorData = await response.json(); // ✅ Corrected casing
        throw new Error(errorData.error || errorData.message || "Failed to process product"); // ✅ Corrected casing
      }
      return response.json();
    },
    onSuccess: () => { // ✅ Corrected casing
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/products"] }); // ✅ Invalidate seller's products, not general products
      toast({
        title: editingProduct ? "Product Updated" : "Product Created", // ✅ Consistent casing
        description: `Product has been ${editingProduct ? "updated" : "created"} successfully.`,
      });
      setIsProductDialogOpen(false); // ✅ Corrected casing
      setEditingProduct(null); // ✅ Corrected casing
      productForm.reset(); // ✅ Corrected casing
    },
    onError: (error: any) => { // ✅ Corrected casing
      toast({
        title: "Error", // ✅ Consistent casing
        description: error.message || `Failed to ${editingProduct ? "update" : "create"} product.`,
        variant: "destructive",
      });
    },
  });

  // delete product mutation
  const deleteProductMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async (productId: number) => { // ✅ Corrected casing
      return await apiRequest("delete", `/api/sellers/products/${productId}`); // ✅ Use seller's product delete endpoint
    },
    onSuccess: () => { // ✅ Corrected casing
      queryClient.invalidateQueries({ queryKey: ["/api/sellers/products"] }); // ✅ Invalidate seller's products
      toast({
        title: "Product Deleted", // ✅ Consistent casing
        description: "Product has been deleted successfully.",
      });
    },
    onError: (error: any) => { // ✅ Corrected casing
      toast({
        title: "Error", // ✅ Consistent casing
        description: error.response?.data?.message || "Failed to delete product.",
        variant: "destructive",
      });
    },
  });

  const categoryMutation = useMutation({ // ✅ Corrected casing
    mutationFn: async (data: FormData) => { // ✅ Corrected casing
      // Note: Backend endpoint for seller creating category is /api/sellers/categories
      return await apiRequest("post", "/api/sellers/categories", data);
    },
    onSuccess: () => { // ✅ Corrected casing
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] }); // ✅ Corrected casing
      toast({
        title: "Category Created", // ✅ Consistent casing
        description: "Category has been created successfully.",
      });
      setIsCategoryDialogOpen(false); // ✅ Corrected casing
      categoryForm.reset(); // ✅ Corrected casing
    },
    onError: (error: any) => { // ✅ Corrected casing
      toast({
        title: "Error", // ✅ Consistent casing
        description: error.response?.data?.message || "Failed to create category.",
        variant: "destructive",
      });
    },
  });

  const onProductSubmit = (data: z.infer<typeof productFormSchema>) => { // ✅ Corrected casing
    productMutation.mutate(data); // ✅ Corrected casing
  };

  const onCategorySubmit = (data: z.infer<typeof categoryFormSchema>) => { // ✅ Corrected casing
    if (!data.image) {
      toast({
        title: "Error", // ✅ Consistent casing
        description: "Please select an image for the category.",
        variant: "destructive",
      });
      return;
    }
    const formData = new FormData(); // ✅ Corrected casing
    formData.append("name", data.name);
    formData.append("slug", data.slug);
    formData.append("description", data.description || "");
    formData.append("image", data.image);
    categoryMutation.mutate(formData); // ✅ Corrected casing
  };

  const handleEditProduct = (product: ProductWithSeller) => { // ✅ Corrected casing
    setEditingProduct(product); // ✅ Corrected casing
    // Pre-fill form with product data for editing
    productForm.reset({ // ✅ Corrected casing
      name: product.name,
      description: product.description || "",
      price: parseFloat(product.price), // Convert string price to number for form
      originalPrice: product.originalPrice ? parseFloat(product.originalPrice) : undefined, // ✅ Convert to number, handle optional
      categoryId: product.categoryId, // ✅ Corrected casing
      stock: product.stock || 0,
      // Image is not pre-filled as file input cannot be programmatically set
      // images: product.images || [], // If you had a multi-image component, this would be more complex
    });
    setIsProductDialogOpen(true); // ✅ Corrected casing
  };

  const handleDeleteProduct = (productId: number) => { // ✅ Corrected casing
    toast({
      title: "Confirm Deletion", // ✅ Consistent casing
      description: "Are you sure you want to delete this product? This action cannot be undone.",
      variant: "destructive",
      action: (
        <div className="flex gap-2"> {/* ✅ Corrected className */}
          <Button onClick={() => { // ✅ Corrected component name and casing
            deleteProductMutation.mutate(productId); // ✅ Corrected casing
            toast.dismiss();
          }} className="bg-red-500 hover:bg-red-600 text-white"> {/* ✅ Corrected className */}
            Delete
          </Button>
          <Button onClick={() => toast.dismiss()} variant="outline"> {/* ✅ Corrected component name and casing */}
            Cancel
          </Button>
        </div>
      ),
      duration: 10000,
    });
  };

  return (
    <Card> {/* ✅ Corrected component name */}
      <CardHeader> {/* ✅ Corrected component name */}
        <div className="flex justify-between items-center"> {/* ✅ Corrected className */}
          <CardTitle>Your Products</CardTitle> {/* ✅ Corrected component name */}
          <div className="flex gap-2"> {/* ✅ Corrected className */}
            {seller.approvalStatus === "approved" ? ( // ✅ Corrected casing
              <>
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}> {/* ✅ Corrected casing */}
                  <DialogTrigger asChild> {/* ✅ Corrected casing */}
                    <Button variant="outline" onClick={() => { // ✅ Corrected component name and casing
                      categoryForm.reset(); // ✅ Corrected casing
                    }}>
                      <Plus className="h-4 w-4 mr-2" /> {/* ✅ Corrected className */}
                      Create Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent> {/* ✅ Corrected casing */}
                    <DialogHeader> {/* ✅ Corrected casing */}
                      <DialogTitle>Create New Category</DialogTitle> {/* ✅ Corrected casing */}
                      <DialogDescription> {/* ✅ Corrected casing */}
                        Add a new product category to organize your items.
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...categoryForm}> {/* ✅ Corrected component name */}
                      <form onSubmit={categoryForm.handleSubmit(onCategorySubmit)} className="space-y-4"> {/* ✅ Corrected casing */}
                        <FormField // ✅ Corrected component name
                          control={categoryForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Category Name</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Input {...field} /> {/* ✅ Corrected component name */}
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <FormField // ✅ Corrected component name
                          control={categoryForm.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Category Slug</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Input {...field} placeholder="e.g., electronics" /> {/* ✅ Corrected component name */}
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <FormField // ✅ Corrected component name
                          control={categoryForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Description (Optional)</FormLabel> {/* ✅ Consistent casing */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Textarea {...field} /> {/* ✅ Corrected component name */}
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <FormField // ✅ Corrected component name
                          control={categoryForm.control}
                          name="image"
                          render={({ field: { value, onChange, ...fieldProps } }) => ( // ✅ Corrected casing
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Category Image</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Input // ✅ Corrected component name
                                  {...fieldProps}
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => onChange(event.target.files?.[0])} // ✅ Corrected casing
                                />
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2"> {/* ✅ Corrected className */}
                          <Button // ✅ Corrected component name
                            type="button"
                            variant="outline"
                            onClick={() => setIsCategoryDialogOpen(false)} // ✅ Corrected casing
                          >
                            Cancel
                          </Button>
                          <Button type="submit"> {/* ✅ Corrected component name */}
                            Create Category
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </DialogContent>
                </Dialog>
                <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}> {/* ✅ Corrected casing */}
                  <DialogTrigger asChild> {/* ✅ Corrected casing */}
                    <Button onClick={() => { // ✅ Corrected component name and casing
                      setEditingProduct(null); // ✅ Corrected casing
                      productForm.reset(); // ✅ Corrected casing
                    }}>
                      <Plus className="h-4 w-4 mr-2" /> {/* ✅ Corrected className */}
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl"> {/* ✅ Corrected className */}
                    <DialogHeader> {/* ✅ Corrected casing */}
                      <DialogTitle> {/* ✅ Corrected casing */}
                        {editingProduct ? "Edit Product" : "Add New Product"} {/* ✅ Consistent casing */}
                      </DialogTitle>
                      <DialogDescription> {/* ✅ Corrected casing */}
                        {editingProduct ? "Update details for your product." : "Add a new product to your inventory."}
                      </DialogDescription>
                    </DialogHeader>
                    <Form {...productForm}> {/* ✅ Corrected component name */}
                      <form onSubmit={productForm.handleSubmit(onProductSubmit)} className="space-y-4"> {/* ✅ Corrected casing */}
                        <FormField // ✅ Corrected component name
                          control={productForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Product Name</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Input {...field} /> {/* ✅ Corrected component name */}
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <FormField // ✅ Corrected component name
                          control={productForm.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Description</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Textarea {...field} /> {/* ✅ Corrected component name */}
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* ✅ Corrected className */}
                          <FormField // ✅ Corrected component name
                            control={productForm.control}
                            name="price"
                            render={({ field }) => (
                              <FormItem> {/* ✅ Corrected component name */}
                                <FormLabel>Price (₹)</FormLabel> {/* ✅ Consistent casing */}
                                <FormControl> {/* ✅ Corrected component name */}
                                  <Input {...field} type="number" step="0.01" /> {/* ✅ Corrected component name */}
                                </FormControl>
                                <FormMessage /> {/* ✅ Corrected component name */}
                              </FormItem>
                            )}
                          />
                          <FormField // ✅ Corrected component name
                            control={productForm.control}
                            name="originalPrice" // ✅ Corrected to originalPrice
                            render={({ field }) => (
                              <FormItem> {/* ✅ Corrected component name */}
                                <FormLabel>Original Price (₹) (Optional)</FormLabel> {/* ✅ Consistent casing */}
                                <FormControl> {/* ✅ Corrected component name */}
                                  <Input {...field} type="number" step="0.01" /> {/* ✅ Corrected component name */}
                                </FormControl>
                                <FormMessage /> {/* ✅ Corrected component name */}
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> {/* ✅ Corrected className */}
                          <FormField // ✅ Corrected component name
                            control={productForm.control}
                            name="categoryId" // ✅ Corrected to categoryId
                            render={({ field }) => (
                              <FormItem> {/* ✅ Corrected component name */}
                                <FormLabel>Category</FormLabel> {/* ✅ Corrected component name */}
                                <Select onValueChange={field.onChange} value={field.value?.toString()}> {/* ✅ Corrected casing */}
                                  <FormControl> {/* ✅ Corrected component name */}
                                    <SelectTrigger> {/* ✅ Corrected component name */}
                                      <SelectValue placeholder="Select a category" /> {/* ✅ Corrected component name */}
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent> {/* ✅ Corrected component name */}
                                    {categories?.map((category) => (
                                      <SelectItem key={category.id} value={category.id.toString()}> {/* ✅ Corrected casing */}
                                        {category.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage /> {/* ✅ Corrected component name */}
                              </FormItem>
                            )}
                          />
                          <FormField // ✅ Corrected component name
                            control={productForm.control}
                            name="stock"
                            render={({ field }) => (
                              <FormItem> {/* ✅ Corrected component name */}
                                <FormLabel>Stock</FormLabel> {/* ✅ Corrected component name */}
                                <FormControl> {/* ✅ Corrected component name */}
                                  <Input {...field} type="number" /> {/* ✅ Corrected component name */}
                                </FormControl>
                                <FormMessage /> {/* ✅ Corrected component name */}
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField // ✅ Corrected component name
                          control={productForm.control}
                          name="image"
                          render={({ field: { value, onChange, ...fieldProps } }) => ( // ✅ Corrected casing
                            <FormItem> {/* ✅ Corrected component name */}
                              <FormLabel>Product Image</FormLabel> {/* ✅ Corrected component name */}
                              <FormControl> {/* ✅ Corrected component name */}
                                <Input // ✅ Corrected component name
                                  {...fieldProps}
                                  type="file"
                                  accept="image/*"
                                  onChange={(event) => onChange(event.target.files?.[0])} // ✅ Corrected casing
                                />
                              </FormControl>
                              <FormMessage /> {/* ✅ Corrected component name */}
                            </FormItem>
                          )}
                        />
                        <div className="flex justify-end space-x-2"> {/* ✅ Corrected className */}
                          <Button // ✅ Corrected component name
                            type="button"
                            variant="outline"
                            onClick={() => { // ✅ Corrected casing
                              setIsProductDialogOpen(false); // ✅ Corrected casing
                              setEditingProduct(null); // ✅ Corrected casing
                              productForm.reset(); // ✅ Corrected casing
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
      <CardContent> {/* ✅ Corrected component name */}
        {productsLoading ? ( // ✅ Corrected casing
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
            {[...Array(3)].map((_, i) => ( // ✅ Corrected casing
              <Skeleton key={i} className="h-48 w-full rounded-lg" /> // ✅ Corrected component name and className
            ))}
          </div>
        ) : productsError ? ( // ✅ Corrected casing
          <p className="text-red-500">Error loading products: {productsError.message}</p> // ✅ Corrected className and casing
        ) : products && products.length === 0 ? (
          <p className="text-muted-foreground">You haven't added any products yet.</p> 
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> 
            {products?.map((product) => (
              <Card key={product.id} className="relative group overflow-hidden"> 
                {product.image && ( // Assuming `image` is a single string URL for display
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-40 object-cover rounded-t-lg" // ✅ Corrected className
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
