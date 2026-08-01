import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function formatSalesman(s: any) {
  if (!s) return null;
  return {
    ...s,
    _id: s.id,
  };
}

// GET - Fetch all salesmen
export async function GET() {
  try {
    const salesmen = await prisma.salesman.findMany({
      orderBy: { createdAt: "desc" },
    });
    
    return NextResponse.json({
      success: true,
      salesmen: salesmen.map(formatSalesman),
    });
  } catch (error: unknown) {
    console.error("Error fetching salesmen:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch salesmen",
      },
      { status: 500 }
    );
  }
}

// POST - Create a new salesman
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, employeeId, address } = body;

    // Validate required fields
    if (!name || !email || !phone || !employeeId || !address) {
      return NextResponse.json(
        {
          success: false,
          message: "All fields are required",
        },
        { status: 400 }
      );
    }

    // Check if salesman with same email already exists
    const existingEmail = await prisma.salesman.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "A salesman with this email already exists",
        },
        { status: 400 }
      );
    }

    // Check if salesman with same employee ID already exists
    const existingEmployeeId = await prisma.salesman.findUnique({
      where: { employeeId },
    });
    if (existingEmployeeId) {
      return NextResponse.json(
        {
          success: false,
          message: "A salesman with this employee ID already exists",
        },
        { status: 400 }
      );
    }

    // Create new salesman
    const salesman = await prisma.salesman.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        employeeId,
        address,
        totalSales: 0,
        totalClients: 0,
        status: "active",
        joinedDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      salesman: formatSalesman(salesman),
      message: "Salesman created successfully",
    });
  } catch (error: unknown) {
    console.error("Error creating salesman:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to create salesman",
      },
      { status: 500 }
    );
  }
}

// PUT - Update a salesman
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, phone, employeeId, address, status, totalSales, totalClients } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Salesman ID is required",
        },
        { status: 400 }
      );
    }

    // Check if email is being changed and if it's already taken
    if (email) {
      const existingEmail = await prisma.salesman.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: id },
        },
      });
      if (existingEmail) {
        return NextResponse.json(
          {
            success: false,
            message: "A salesman with this email already exists",
          },
          { status: 400 }
        );
      }
    }

    // Check if employee ID is being changed and if it's already taken
    if (employeeId) {
      const existingEmployeeId = await prisma.salesman.findFirst({
        where: {
          employeeId,
          id: { not: id },
        },
      });
      if (existingEmployeeId) {
        return NextResponse.json(
          {
            success: false,
            message: "A salesman with this employee ID already exists",
          },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (employeeId !== undefined) updateData.employeeId = employeeId;
    if (address !== undefined) updateData.address = address;
    if (status !== undefined) updateData.status = status;
    if (totalSales !== undefined) updateData.totalSales = totalSales;
    if (totalClients !== undefined) updateData.totalClients = totalClients;

    const existingSalesman = await prisma.salesman.findUnique({ where: { id } });
    if (!existingSalesman) {
      return NextResponse.json(
        {
          success: false,
          message: "Salesman not found",
        },
        { status: 404 }
      );
    }

    const updatedSalesman = await prisma.salesman.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      salesman: formatSalesman(updatedSalesman),
      message: "Salesman updated successfully",
    });
  } catch (error: unknown) {
    console.error("Error updating salesman:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update salesman",
      },
      { status: 500 }
    );
  }
}

// DELETE - Deactivate a salesman (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          message: "Salesman ID is required",
        },
        { status: 400 }
      );
    }

    const existingSalesman = await prisma.salesman.findUnique({ where: { id } });
    if (!existingSalesman) {
      return NextResponse.json(
        {
          success: false,
          message: "Salesman not found",
        },
        { status: 404 }
      );
    }

    await prisma.salesman.update({
      where: { id },
      data: { status: "inactive" },
    });

    return NextResponse.json({
      success: true,
      message: "Salesman deactivated successfully",
    });
  } catch (error: unknown) {
    console.error("Error deactivating salesman:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to deactivate salesman",
      },
      { status: 500 }
    );
  }
}
