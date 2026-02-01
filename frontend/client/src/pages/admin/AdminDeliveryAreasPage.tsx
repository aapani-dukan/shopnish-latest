// client/src/pages/admin/AdminDeliveryAreasPage.tsx
"use client";

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table";
import { Loader2, Plus, Trash2, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from "../../hooks/use-toast";

export default function AdminDeliveryAreasPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newArea, setNewArea] = useState({ areaName: '', pincode: '', city: '', deliveryCharge: '0', freeDeliveryAbove: '500' });

  // 1. Fetch Areas
  const { data: areas, isLoading } = useQuery({
    queryKey: ['deliveryAreas'],
    queryFn: () => apiRequest('GET', '/api/admin/delivery-areas'),
  });

  // 2. Add Area Mutation
  const addMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/admin/delivery-areas', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryAreas'] });
      toast({ title: "Success", description: "New delivery area added!" });
      setNewArea({ areaName: '', pincode: '', city: '', deliveryCharge: '0', freeDeliveryAbove: '500' });
    },
    onError: (err: any) => toast({ variant: "destructive", title: "Error", description: err.message })
  });

  // 3. Delete Area Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/admin/delivery-areas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryAreas'] });
      toast({ title: "Deleted", description: "Area removed from service." });
    }
  });

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <MapPin className="text-primary" /> Manage Serviceable Areas
      </h1>

      {/* Add New Area Form */}
      <Card className="bg-slate-50">
        <CardHeader><CardTitle>Add New Delivery Zone</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Label htmlFor="areaName">Area Name</Label>
            <Input placeholder="Area Name" value={newArea.areaName} onChange={e => setNewArea({...newArea, areaName: e.target.value})} />
            <Label htmlFor="pincode">Pincode</Label>
            <Input placeholder="Pincode" value={newArea.pincode} onChange={e => setNewArea({...newArea, pincode: e.target.value})} />
            <Label htmlFor="city">City</Label>
            <Input placeholder="City" value={newArea.city} onChange={e => setNewArea({...newArea, city: e.target.value})} />
            <Label htmlFor="deliveryCharge">Delivery Charge (₹)</Label>
            <Input placeholder="Charge (₹)" type="number" value={newArea.deliveryCharge} onChange={e => setNewArea({...newArea, deliveryCharge: e.target.value})} />
            <Label htmlFor="freeDeliveryAbove">Free Delivery Above (₹)</Label>
            <Button onClick={() => addMutation.mutate(newArea)} disabled={addMutation.isPending}>
              {addMutation.isPending ? <Loader2 className="animate-spin" /> : <Plus size={18} />} Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Areas List */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area & Pincode</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Delivery Fee</TableHead>
              <TableHead>Free Above</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {areas?.map((area: any) => (
              <TableRow key={area.id}>
                <TableCell className="font-medium">{area.areaName} ({area.pincode})</TableCell>
                <TableCell>{area.city}</TableCell>
                <TableCell>₹{area.deliveryCharge}</TableCell>
                <TableCell>₹{area.freeDeliveryAbove}</TableCell>
                <TableCell>
                  {area.isActive ? <CheckCircle2 className="text-green-500" size={18}/> : <XCircle className="text-red-500" size={18}/>}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(area.id)}>
                    <Trash2 size={16} className="text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}