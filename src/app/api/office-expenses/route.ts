import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function formatOfficeExpense(exp: any) {
  if (!exp) return null;
  return {
    ...exp,
    _id: exp.id,
  };
}

// GET - Fetch all office expenses
export async function GET(request: NextRequest) {
  try {
    const officeExpenses = await prisma.officeExpense.findMany({
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(
      {
        success: true,
        officeExpenses: officeExpenses.map(formatOfficeExpense),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Fetch office expenses error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch office expenses", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new office expense
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, category, amount, date, expenseMonth, paymentMethod, paidTo, remarks } = body;

    // Validate required fields
    if (!title || !category || amount === undefined || amount === null) {
      return NextResponse.json(
        { success: false, message: "Title, category, and amount are required" },
        { status: 400 }
      );
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount < 0) {
      return NextResponse.json(
        { success: false, message: "Amount must be a valid non-negative number" },
        { status: 400 }
      );
    }

    const expDate = date ? new Date(date) : new Date();
    const defaultExpMonth = expenseMonth || `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

    const officeExpense = await prisma.officeExpense.create({
      data: {
        title,
        category,
        amount: numericAmount,
        date: expDate,
        expenseMonth: defaultExpMonth,
        paymentMethod: paymentMethod || "Cash",
        paidTo: paidTo || "",
        remarks: remarks || "",
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Office expense created successfully",
        officeExpense: formatOfficeExpense(officeExpense),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create office expense error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create office expense", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update an office expense
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, category, amount, date, expenseMonth, paymentMethod, paidTo, remarks } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Office expense ID is required" },
        { status: 400 }
      );
    }

    const existingExpense = await prisma.officeExpense.findUnique({ where: { id } });
    if (!existingExpense) {
      return NextResponse.json(
        { success: false, message: "Office expense not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (date !== undefined) updateData.date = new Date(date);
    if (expenseMonth !== undefined) updateData.expenseMonth = expenseMonth;
    if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
    if (paidTo !== undefined) updateData.paidTo = paidTo;
    if (remarks !== undefined) updateData.remarks = remarks;

    const officeExpense = await prisma.officeExpense.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Office expense updated successfully",
        officeExpense: formatOfficeExpense(officeExpense),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update office expense error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update office expense", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an office expense
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Office expense ID is required" },
        { status: 400 }
      );
    }

    const existingExpense = await prisma.officeExpense.findUnique({ where: { id } });
    if (!existingExpense) {
      return NextResponse.json(
        { success: false, message: "Office expense not found" },
        { status: 404 }
      );
    }

    await prisma.officeExpense.delete({ where: { id } });

    return NextResponse.json(
      {
        success: true,
        message: "Office expense deleted successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete office expense error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete office expense", error: error.message },
      { status: 500 }
    );
  }
}
