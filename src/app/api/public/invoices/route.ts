import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { formatInvoice } from "@/lib/format-invoice";

// POST - Create a new invoice (public endpoint)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.invoiceNumber) {
      return NextResponse.json(
        { error: "Invoice number is required" },
        { status: 400 }
      );
    }

    if (!body.customerName) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    if (!body.salesPerson) {
      return NextResponse.json(
        { error: "Sales person is required" },
        { status: 400 }
      );
    }

    if (!body.saleItem) {
      return NextResponse.json(
        { error: "Sale item is required" },
        { status: 400 }
      );
    }

    if (!body.cost || body.cost < 0) {
      return NextResponse.json(
        { error: "Valid cost is required" },
        { status: 400 }
      );
    }

    if (!body.saleAmount || body.saleAmount < 0) {
      return NextResponse.json(
        { error: "Valid sale amount is required" },
        { status: 400 }
      );
    }

    if (!body.date) {
      return NextResponse.json(
        { error: "Invoice date is required" },
        { status: 400 }
      );
    }

    if (body.expenses === undefined || body.expenses === null || body.expenses === "" || body.expenses < 0) {
      return NextResponse.json(
        { error: "Valid expenses value is required" },
        { status: 400 }
      );
    }

    if (body.commission === undefined || body.commission === null || body.commission === "" || body.commission < 0) {
      return NextResponse.json(
        { error: "Valid commission value is required" },
        { status: 400 }
      );
    }

    if (body.salesCommission === undefined || body.salesCommission === null || body.salesCommission === "" || body.salesCommission < 0) {
      return NextResponse.json(
        { error: "Valid sales commission value is required" },
        { status: 400 }
      );
    }

    // Check if invoice number already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: body.invoiceNumber },
    });

    if (existingInvoice) {
      return NextResponse.json(
        { error: "Invoice number already exists" },
        { status: 409 }
      );
    }

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
        date: new Date(body.date),
      },
      include: {
        commissionPayments: true,
        salesCommissionPayments: true,
      },
    });

    return NextResponse.json(formatInvoice(invoice), { status: 201 });
  } catch (error: any) {
    console.error("Error creating invoice:", error);
    
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Invoice number already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
