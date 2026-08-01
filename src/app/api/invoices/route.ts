import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatInvoice } from "@/lib/format-invoice";

// GET - Fetch all invoices
export async function GET() {
  try {
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    const formatted = invoices.map(formatInvoice);
    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

// POST - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const invoice = await prisma.invoice.create({
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
        status: body.status || "dispatch",
        shippingRemarks: body.shippingRemarks || "",
        date: new Date(body.date),
      },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    return NextResponse.json(formatInvoice(invoice), { status: 201 });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
