import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatInvoice } from "@/lib/format-invoice";

// GET - Fetch a single invoice
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(formatInvoice(invoice));
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}

// PUT - Update an invoice
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });
    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (body.invoiceNumber !== existingInvoice.invoiceNumber) {
      const duplicateInvoice = await prisma.invoice.findFirst({
        where: {
          invoiceNumber: body.invoiceNumber,
          id: { not: id },
        },
      });

      if (duplicateInvoice) {
        return NextResponse.json(
          { error: "Invoice number already exists" },
          { status: 400 }
        );
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: body.invoiceNumber,
        customerName: body.customerName,
        salesPerson: body.salesPerson,
        saleItem: body.saleItem,
        cost: parseFloat(body.cost),
        saleAmount: parseFloat(body.saleAmount),
        expenses: parseFloat(body.expenses),
        commission: parseFloat(body.commission),
        salesCommission: parseFloat(body.salesCommission),
        remarks: body.remarks || "",
        status: body.status,
        shippingRemarks: body.shippingRemarks || "",
        date: new Date(body.date),
      },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    return NextResponse.json(formatInvoice(updatedInvoice));
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json(
      { error: "Failed to update invoice" },
      { status: 500 }
    );
  }
}

// PATCH - Update commission payment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const updateData: any = {};
    const newCommissionPayments: Array<{ amount: number; date: Date; remarks: string }> = [];
    const newSalesCommissionPayments: Array<{ amount: number; date: Date; remarks: string }> = [];

    // Handle commission payment
    if (typeof body.commissionPayAmount === "number") {
      const currentPaid = existingInvoice.commissionPaidAmount || 0;
      const payAmount = Math.min(
        body.commissionPayAmount,
        existingInvoice.commission - currentPaid
      );
      const newPaidAmount = currentPaid + payAmount;
      updateData.commissionPaidAmount = newPaidAmount;
      updateData.commissionPaid = newPaidAmount >= existingInvoice.commission;
      updateData.commissionPaidDate = new Date();
      updateData.commissionPayRemarks = body.commissionPayRemarks ?? "";
      newCommissionPayments.push({
        amount: payAmount,
        date: new Date(),
        remarks: body.commissionPayRemarks ?? "",
      });
    } else if (body.commissionPaid === false) {
      updateData.commissionPaid = false;
      updateData.commissionPaidAmount = 0;
      updateData.commissionPaidDate = null;
      updateData.commissionPayRemarks = "";
      await prisma.commissionPayment.deleteMany({ where: { invoiceId: id } });
    }

    // Handle sales commission payment
    if (typeof body.salesCommissionPayAmount === "number") {
      const currentPaid = existingInvoice.salesCommissionPaidAmount || 0;
      const payAmount = Math.min(
        body.salesCommissionPayAmount,
        existingInvoice.salesCommission - currentPaid
      );
      const newPaidAmount = currentPaid + payAmount;
      updateData.salesCommissionPaidAmount = newPaidAmount;
      updateData.salesCommissionPaid = newPaidAmount >= existingInvoice.salesCommission;
      updateData.salesCommissionPaidDate = new Date();
      updateData.salesCommissionPayRemarks = body.salesCommissionPayRemarks ?? "";
      newSalesCommissionPayments.push({
        amount: payAmount,
        date: new Date(),
        remarks: body.salesCommissionPayRemarks ?? "",
      });
    } else if (body.salesCommissionPaid === false) {
      updateData.salesCommissionPaid = false;
      updateData.salesCommissionPaidAmount = 0;
      updateData.salesCommissionPaidDate = null;
      updateData.salesCommissionPayRemarks = "";
      await prisma.salesCommissionPayment.deleteMany({ where: { invoiceId: id } });
    }

    if (newCommissionPayments.length > 0) {
      updateData.commissionPayments = {
        create: newCommissionPayments,
      };
    }

    if (newSalesCommissionPayments.length > 0) {
      updateData.salesCommissionPayments = {
        create: newSalesCommissionPayments,
      };
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    return NextResponse.json(formatInvoice(updatedInvoice));
  } catch (error) {
    console.error("Error updating commission status:", error);
    return NextResponse.json(
      { error: "Failed to update commission status" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an invoice
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existingInvoice = await prisma.invoice.findUnique({ where: { id } });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    await prisma.invoice.delete({ where: { id } });

    return NextResponse.json({ message: "Invoice deleted successfully" });
  } catch (error) {
    console.error("Error deleting invoice:", error);
    return NextResponse.json(
      { error: "Failed to delete invoice" },
      { status: 500 }
    );
  }
}
