export function formatInvoice(inv: any) {
  if (!inv) return null;
  const profit = (inv.saleAmount || 0) - (inv.cost || 0) - (inv.expenses || 0);
  const netProfit = profit - (inv.commission || 0) - (inv.salesCommission || 0);
  
  const commissionPayments = (inv.commissionPayments || []).map((cp: any) => ({
    ...cp,
    _id: cp.id,
  }));

  const salesCommissionPayments = (inv.salesCommissionPayments || []).map((scp: any) => ({
    ...scp,
    _id: scp.id,
  }));

  return {
    ...inv,
    _id: inv.id,
    profit,
    netProfit,
    commissionPayments,
    salesCommissionPayments,
  };
}
