"use client";

import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  CreditCard, Plus, Edit, Trash2, Star, Smartphone, Loader2
} from "lucide-react";
import type { PaymentMethod } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { FirebaseAuthService } from "@/lib/firebase-services";

const initialPaymentForm = {
  type: "card" as 'card' | 'upi',
  name: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
  cardHolderName: "",
  cardType: "visa" as 'visa' | 'mastercard' | 'rupay',
  upiId: ""
};

export default function PaymentMethods() {
  const { user, updateUserData } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<PaymentMethod | null>(null);
  const [paymentForm, setPaymentForm] = useState(initialPaymentForm);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // CRUD: Load payment methods from user doc
  useEffect(() => {
    const loadPayments = async () => {
      setIsLoading(true);
      if (user?.customData?.payments) {
        setPaymentMethods(user.customData.payments);
      } else {
        try {
          const payments = await FirebaseAuthService.getPaymentMethods();
          setPaymentMethods(payments);
          if (user && updateUserData) updateUserData({ ...user.customData, payments });
        } catch { }
      }
      setIsLoading(false);
    };
    loadPayments();
  }, [user?.customData?.payments]);

  const refreshPayments = async () => {
    setIsLoading(true);
    try {
      const payments = await FirebaseAuthService.getPaymentMethods();
      setPaymentMethods(payments);
      if (user && updateUserData) updateUserData({ ...user.customData, payments });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setPaymentForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddPayment = () => {
    setEditingPayment(null);
    setPaymentForm(initialPaymentForm);
    setIsDialogOpen(true);
  };

  const handleEditPayment = (payment: PaymentMethod) => {
    setEditingPayment(payment);
    setPaymentForm({
      type: payment.type,
      name: payment.name,
      cardNumber: payment.cardNumber || "",
      expiryMonth: payment.expiryMonth || "",
      expiryYear: payment.expiryYear || "",
      cardHolderName: payment.cardHolderName || "",
      cardType: payment.cardType || "visa",
      upiId: payment.upiId || ""
    });
    setIsDialogOpen(true);
  };

  const maskCardNumber = (num: string = "") =>
    num && num.length >= 4 ? `**** **** **** ${num.slice(-4)}` : "";

  // Save handler (add or edit)
  const handleSavePayment = async () => {
    let isValid = false, details = "";
    if (paymentForm.type === 'card') {
      isValid = !!(paymentForm.name && paymentForm.cardNumber && paymentForm.expiryMonth && paymentForm.expiryYear && paymentForm.cardHolderName);
      details = maskCardNumber(paymentForm.cardNumber);
    } else if (paymentForm.type === 'upi') {
      isValid = !!(paymentForm.name && paymentForm.upiId);
      details = paymentForm.upiId;
    }
    if (!isValid) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      if (editingPayment) {
        await FirebaseAuthService.updatePaymentMethod(editingPayment.id, {
          ...paymentForm,
          details,
          isDefault: editingPayment.isDefault
        });
        toast({ title: "Payment Method Updated", description: "Your payment method has been updated successfully." });
      } else {
        await FirebaseAuthService.addPaymentMethod({ ...paymentForm, details, isDefault: paymentMethods.length === 0 });
        toast({ title: "Payment Method Added", description: "New payment method has been added successfully." });
      }
      await refreshPayments();
      setIsDialogOpen(false);
    } catch (error) {
      toast({ title: "Save Failed", description: "Failed to save payment method. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete
  const handleDeletePayment = async (paymentId: string) => {
    setIsSaving(true);
    try {
      await FirebaseAuthService.deletePaymentMethod(paymentId);
      await refreshPayments();
      toast({ title: "Payment Method Deleted", description: "Payment method has been removed successfully." });
    } catch {
      toast({ title: "Delete Failed", description: "Failed to delete payment method. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Set Default
  const handleSetDefault = async (paymentId: string) => {
    setIsSaving(true);
    try {
      await FirebaseAuthService.setDefaultPayment(paymentId);
      await refreshPayments();
      toast({ title: "Default Payment Set", description: "This payment method is now your default." });
    } finally {
      setIsSaving(false);
    }
  };

  // Card/UPI icons
  const getPaymentIcon = (type: string) => type === 'upi'
    ? <Smartphone size={20} className="text-green-600" />
    : <CreditCard size={20} className="text-blue-600" />;

  // Card/UPI badge color
  const getPaymentTypeColor = (type: string) => type === 'upi'
    ? 'bg-green-100 text-green-800 border-green-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

  // Payment form for dialog
  const renderPaymentForm = () => paymentForm.type === 'card'
    ? (
      <>
        <div>
          <Label htmlFor="cardName">Card Name *</Label>
          <Input id="cardName" value={paymentForm.name}
            onChange={e => handleInputChange('name', e.target.value)} placeholder="HDFC Credit Card" />
        </div>
        <div>
          <Label htmlFor="cardNumber">Card Number *</Label>
          <Input id="cardNumber"
            value={paymentForm.cardNumber}
            onChange={e => handleInputChange('cardNumber', e.target.value.replace(/\s/g, ''))}
            placeholder="1234567890123456" maxLength={16}
          />
        </div>
        <div>
          <Label htmlFor="cardHolderName">Card Holder Name *</Label>
          <Input id="cardHolderName" value={paymentForm.cardHolderName}
            onChange={e => handleInputChange('cardHolderName', e.target.value)} placeholder="John Doe" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label htmlFor="expiryMonth">Month *</Label>
            <Select value={paymentForm.expiryMonth} onValueChange={val => handleInputChange('expiryMonth', val)}>
              <SelectTrigger><SelectValue placeholder="MM" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>{String(i + 1).padStart(2, '0')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="expiryYear">Year *</Label>
            <Select value={paymentForm.expiryYear} onValueChange={val => handleInputChange('expiryYear', val)}>
              <SelectTrigger><SelectValue placeholder="YYYY" /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => (
                  <SelectItem key={i} value={String(new Date().getFullYear() + i)}>{new Date().getFullYear() + i}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="cardType">Type</Label>
          <Select value={paymentForm.cardType} onValueChange={val => handleInputChange('cardType', val)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="visa">Visa</SelectItem>
              <SelectItem value="mastercard">MasterCard</SelectItem>
              <SelectItem value="rupay">RuPay</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </>
    )
    : (
      <>
        <div>
          <Label htmlFor="upiName">UPI Name *</Label>
          <Input id="upiName" value={paymentForm.name}
            onChange={e => handleInputChange('name', e.target.value)} placeholder="Google Pay" />
        </div>
        <div>
          <Label htmlFor="upiId">UPI ID *</Label>
          <Input id="upiId" value={paymentForm.upiId}
            onChange={e => handleInputChange('upiId', e.target.value)} placeholder="john@okaxis" />
        </div>
      </>
    );

  return (
    <MobileLayout title="Payment Methods" subtitle="Manage your payment options" backPath="/account">
      <div className="p-4 space-y-4 ">
        <Button className="w-full" onClick={handleAddPayment}><Plus size={16} className="mr-2" /> Add Payment Method</Button>
        {isLoading ? (
          <div className="space-y-1">{[1, 2, 3].map(num => (
            <Card key={num}><CardContent className="p-4">
              <div className="animate-pulse flex items-center space-x-4">
                <div className="w-8 h-8 bg-gray-200 rounded" />
                <div>
                  <div className="w-32 h-4 bg-gray-200 rounded mb-2" />
                  <div className="w-24 h-3 bg-gray-200 rounded" />
                </div>
              </div>
            </CardContent></Card>
          ))}</div>
        ) : (
          <div className="space-y-3">
            {paymentMethods.map(payment => (
              <Card key={payment.id} className="mobile-card-hover">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {getPaymentIcon(payment.type)}
                        <div>
                          <h3 className="font-medium">{payment.name}</h3>
                          <p className="text-sm text-muted-foreground">{payment.details}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {payment.isDefault && (
                          <Badge className="bg-primary/10 text-primary border-primary/20"><Star size={12} className="mr-1" /> Default</Badge>
                        )}
                        <div className="flex items-center space-x-1">
                          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => handleEditPayment(payment)}><Edit size={14} /></Button>
                          <Button variant="ghost" size="icon" className="w-8 h-8 text-destructive hover:text-destructive" onClick={() => handleDeletePayment(payment.id)} disabled={isSaving}><Trash2 size={14} /></Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className={`capitalize ${getPaymentTypeColor(payment.type)}`}>{payment.type}</Badge>
                      {payment.lastUsed && (<span className="text-xs text-muted-foreground">Last used: {new Date(payment.lastUsed).toLocaleDateString()}</span>)}
                    </div>
                    {!payment.isDefault &&
                      <Button variant="outline" size="sm" className="w-full"
                        onClick={() => handleSetDefault(payment.id)} disabled={isSaving}>
                        Set as Default
                      </Button>
                    }
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {paymentMethods.length === 0 && !isLoading && (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard size={48} className="mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Payment Methods</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your first payment method to make checkout faster</p>
              {/* <Button onClick={handleAddPayment}><Plus size={16} className="mr-2" />Add Payment Method</Button> */}
            </CardContent>
          </Card>
        )}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-sm sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{editingPayment ? "Edit Payment Method" : "Add Payment Method"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Payment Type</Label>
                <Select value={paymentForm.type} onValueChange={val => handleInputChange('type', val)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {renderPaymentForm()}
            </div>
            <DialogFooter className="flex space-x-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSavePayment} disabled={isSaving} className="min-w-[100px]">
                {isSaving ? (
                  <div className="flex items-center space-x-2"><Loader2 className="w-4 h-4 animate-spin" /><span>Saving...</span></div>
                ) : (
                  editingPayment ? "Update" : "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MobileLayout>
  );
}
