"use client";
//import React from 'react';
import { } from 'react'; // या फिर इस लाइन को पूरी तरह हटा दें
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Loader2, User, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminVendorsPage() {
  const navigate = useNavigate();
  const { data: vendors, isLoading } = useQuery({
    queryKey: ['adminVendors'],
    queryFn: () => apiRequest('GET', '/api/admin/vendors'), 
  });

  if (isLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Select a Vendor to Manage</h1>
      <div className="space-y-3">
        {vendors?.map((v: any) => (
          <Card key={v.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/admin/vendors/${v.id}`)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-blue-100 p-2 rounded-full"><User size={20} className="text-blue-600" /></div>
                <div>
                  <h3 className="font-semibold text-gray-800">{v.businessName}</h3>
                  <p className="text-xs text-gray-500">ID: {v.id} | {v.city}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm">
      Manage <ChevronRight size={16} className="ml-1" />
    </Button>
              <ChevronRight size={20} className="text-gray-400" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}