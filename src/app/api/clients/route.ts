import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function formatClient(c: any) {
  if (!c) return null;
  return {
    ...c,
    _id: c.id,
  };
}

// GET - Fetch all clients
export async function GET(request: NextRequest) {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      {
        success: true,
        clients: clients.map(formatClient),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Fetch clients error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch clients", error: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new client
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, company, address } = body;

    if (!name || !email || !phone || !company || !address) {
      return NextResponse.json(
        { success: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    const existingClient = await prisma.client.findFirst({
      where: { email: email.toLowerCase() },
    });
    if (existingClient) {
      return NextResponse.json(
        { success: false, message: "Client with this email already exists" },
        { status: 400 }
      );
    }

    const client = await prisma.client.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone,
        company,
        address,
        totalInvoices: 0,
        totalAmount: 0,
        status: "active",
        joinedDate: new Date(),
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Client created successfully",
        client: formatClient(client),
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create client error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to create client", error: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a client
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Client ID is required" },
        { status: 400 }
      );
    }

    const existingClient = await prisma.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json(
        { success: false, message: "Client not found" },
        { status: 404 }
      );
    }

    await prisma.client.delete({ where: { id } });

    return NextResponse.json(
      {
        success: true,
        message: "Client deleted successfully",
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Delete client error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete client", error: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a client
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, email, phone, company, address, status } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "Client ID is required" },
        { status: 400 }
      );
    }

    const existingClient = await prisma.client.findUnique({ where: { id } });
    if (!existingClient) {
      return NextResponse.json(
        { success: false, message: "Client not found" },
        { status: 404 }
      );
    }

    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone) updateData.phone = phone;
    if (company) updateData.company = company;
    if (address) updateData.address = address;
    if (status) updateData.status = status;

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Client updated successfully",
        client: formatClient(client),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Update client error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to update client", error: error.message },
      { status: 500 }
    );
  }
}
