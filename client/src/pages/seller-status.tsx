// client/src/pages/seller-status.tsx

import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom"; // ✅ यहाँ बदलाव किया गया है
import { Clock, CheckCircle, XCircle, Store, AlertCircle } from "lucide-react";

export default function SellerStatusPage() {
  const { user, isLoadingAuth, isAuthenticated } = useAuth();
  
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <AlertCircle className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <CardTitle>Login Required</CardTitle>
            <CardDescription>
              Please log in to check your seller application status or to start a new application.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/auth">
              <Button>Go to Login Page</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const sellerProfile = user?.sellerProfile;
  const approvalStatus = sellerProfile?.approvalStatus;

  let title = "Seller Application Status";
  let description = "We are checking your application status.";
  let IconComponent: React.ElementType = Clock;
  let iconColor = "text-gray-500";
  let showActionButton = false;
  let actionButtonText = "";
  let actionButtonLink = "";
  let actionButtonVariant: "default" | "secondary" | "destructive" | "ghost" | "link" = "default";


  if (user?.role === "seller" && approvalStatus === "approved") {
    title = "Welcome, Approved Seller!";
    description = "Your seller account has been approved. You can now access your dashboard and start managing your business.";
    IconComponent = CheckCircle;
    iconColor = "text-green-500";
    showActionButton = true;
    actionButtonText = "Go to Seller Dashboard";
    actionButtonLink = "/seller-dashboard";
    actionButtonVariant = "default";
  } else if (user?.role === "seller" && approvalStatus === "pending") {
    title = "Application Under Review";
    description = "Thank you for applying to become a seller on Shopnish. Our admin team is reviewing your application. You will be notified once your account is approved.";
    IconComponent = Clock;
    iconColor = "text-yellow-500";
    showActionButton = false;
  } else if (user?.role === "seller" && approvalStatus === "rejected") {
    title = "Application Rejected";
    description = `Unfortunately, your seller application was rejected. Reason: ${sellerProfile?.rejectionReason || 'No specific reason provided.'} Please review the criteria or contact support for more details.`;
    IconComponent = XCircle;
    iconColor = "text-red-500";
    showActionButton = true;
    actionButtonText = "Re-apply as Seller";
    actionButtonLink = "/seller-apply";
    actionButtonVariant = "secondary";
  } else if (user?.role === "customer" && !sellerProfile) {
    title = "No Seller Application Found";
    description = "It seems you haven't applied to become a seller yet. Start your application now!";
    IconComponent = Store;
    iconColor = "text-purple-500";
    showActionButton = true;
    actionButtonText = "Apply to be a Seller";
    actionButtonLink = "/seller-apply";
    actionButtonVariant = "default";
  } else {
    title = "Unknown Application Status";
    description = "We couldn't determine your seller application status. Please contact support.";
    IconComponent = AlertCircle;
    iconColor = "text-red-500";
    showActionButton = true;
    actionButtonText = "Contact Support";
    actionButtonLink = "/contact";
    actionButtonVariant = "destructive";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="max-w-md w-full text-center rounded-lg shadow-lg">
        <CardHeader className="pt-8">
          <IconComponent className={`h-16 w-16 ${iconColor} mx-auto mb-4`} />
          <CardTitle className="text-3xl font-bold text-gray-900 mb-2">{title}</CardTitle>
          <CardDescription className="text-lg text-gray-600">{description}</CardDescription>
        </CardHeader>
        {showActionButton && (
          <CardContent className="pb-8">
            <Link to={actionButtonLink}>
              <Button size="lg" className="w-full max-w-xs" variant={actionButtonVariant}>
                {actionButtonText}
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
