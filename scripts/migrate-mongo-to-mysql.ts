import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Simple env loader for .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  for (const line of envConfig.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const equalsIdx = trimmed.indexOf("=");
      if (equalsIdx > 0) {
        const key = trimmed.substring(0, equalsIdx).trim();
        let value = trimmed.substring(equalsIdx + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
const DATABASE_URL = process.env.DATABASE_URL;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is missing in .env.local");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing in .env.local");
  process.exit(1);
}

const prisma = new PrismaClient();

async function migrate() {
  console.log("🚀 Starting Data Migration from MongoDB to MySQL...\n");

  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI!);
    console.log("✅ MongoDB Connected successfully.\n");

    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("Failed to get MongoDB database instance");
    }

    console.log("🧹 Clearing existing MySQL tables for clean migration...");
    await prisma.commissionPayment.deleteMany();
    await prisma.salesCommissionPayment.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.officeExpense.deleteMany();
    await prisma.client.deleteMany();
    await prisma.salesman.deleteMany();
    await prisma.user.deleteMany();
    console.log("✅ MySQL tables cleared.\n");

    // 1. Migrate Users
    console.log("📦 Migrating Users...");
    const users = await db.collection("users").find({}).toArray();
    let userCount = 0;
    for (const u of users) {
      await prisma.user.create({
        data: {
          id: u._id.toString(),
          email: u.email,
          password: u.password,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        },
      });
      userCount++;
    }
    console.log(`✅ Migrated ${userCount} Users.\n`);

    // 2. Migrate Clients
    console.log("📦 Migrating Clients...");
    const clients = await db.collection("clients").find({}).toArray();
    let clientCount = 0;
    for (const c of clients) {
      await prisma.client.create({
        data: {
          id: c._id.toString(),
          name: c.name || "",
          email: c.email || "",
          phone: c.phone || "",
          company: c.company || "",
          address: c.address || "",
          totalInvoices: Number(c.totalInvoices || 0),
          totalAmount: Number(c.totalAmount || 0),
          status: c.status || "active",
          joinedDate: c.joinedDate ? new Date(c.joinedDate) : new Date(),
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
        },
      });
      clientCount++;
    }
    console.log(`✅ Migrated ${clientCount} Clients.\n`);

    // 3. Migrate Salesmen
    console.log("📦 Migrating Salesmen...");
    const salesmen = await db.collection("salesmen").find({}).toArray();
    let salesmanCount = 0;
    for (const s of salesmen) {
      await prisma.salesman.create({
        data: {
          id: s._id.toString(),
          name: s.name || "",
          email: s.email || "",
          phone: s.phone || "",
          employeeId: s.employeeId || "",
          address: s.address || "",
          totalSales: Number(s.totalSales || 0),
          totalClients: Number(s.totalClients || 0),
          status: s.status || "active",
          joinedDate: s.joinedDate ? new Date(s.joinedDate) : new Date(),
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
        },
      });
      salesmanCount++;
    }
    console.log(`✅ Migrated ${salesmanCount} Salesmen.\n`);

    // 4. Migrate Office Expenses
    console.log("📦 Migrating Office Expenses...");
    const officeExpenses = await db.collection("officeexpenses").find({}).toArray();
    let expenseCount = 0;
    for (const e of officeExpenses) {
      await prisma.officeExpense.create({
        data: {
          id: e._id.toString(),
          title: e.title || "",
          category: e.category || "",
          amount: Number(e.amount || 0),
          date: e.date ? new Date(e.date) : new Date(),
          paymentMethod: e.paymentMethod || "Cash",
          paidTo: e.paidTo || "",
          remarks: e.remarks || "",
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
          updatedAt: e.updatedAt ? new Date(e.updatedAt) : new Date(),
        },
      });
      expenseCount++;
    }
    console.log(`✅ Migrated ${expenseCount} Office Expenses.\n`);

    // 5. Migrate Invoices
    console.log("📦 Migrating Invoices...");
    const invoices = await db.collection("invoices").find({}).toArray();
    let invoiceCount = 0;
    const usedInvoiceNumbers = new Set<string>();

    for (const inv of invoices) {
      const invId = inv._id.toString();
      let rawNum = (inv.invoiceNumber || `INV-${invId.slice(-6)}`).trim();
      let invoiceNum = rawNum;

      // Ensure invoice number is unique (case-insensitive for MySQL)
      while (usedInvoiceNumbers.has(invoiceNum.toLowerCase())) {
        invoiceNum = `${rawNum}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
      usedInvoiceNumbers.add(invoiceNum.toLowerCase());

      // Create Invoice
      await prisma.invoice.create({
        data: {
          id: invId,
          invoiceNumber: invoiceNum,
          customerName: inv.customerName || "",
          salesPerson: inv.salesPerson || "",
          saleItem: inv.saleItem || "",
          cost: Number(inv.cost || 0),
          saleAmount: Number(inv.saleAmount || 0),
          expenses: Number(inv.expenses || 0),
          commission: Number(inv.commission || 0),
          salesCommission: Number(inv.salesCommission || 0),
          remarks: inv.remarks || "",
          status: inv.status || "dispatch",
          shippingRemarks: inv.shippingRemarks || "",
          date: inv.date ? new Date(inv.date) : new Date(),
          commissionPaid: Boolean(inv.commissionPaid),
          commissionPaidDate: inv.commissionPaidDate ? new Date(inv.commissionPaidDate) : null,
          commissionPayRemarks: inv.commissionPayRemarks || "",
          commissionPaidAmount: Number(inv.commissionPaidAmount || 0),
          salesCommissionPaid: Boolean(inv.salesCommissionPaid),
          salesCommissionPaidDate: inv.salesCommissionPaidDate ? new Date(inv.salesCommissionPaidDate) : null,
          salesCommissionPayRemarks: inv.salesCommissionPayRemarks || "",
          salesCommissionPaidAmount: Number(inv.salesCommissionPaidAmount || 0),
          createdAt: inv.createdAt ? new Date(inv.createdAt) : new Date(),
          updatedAt: inv.updatedAt ? new Date(inv.updatedAt) : new Date(),
        },
      });

      // Migrate commissionPayments array
      if (Array.isArray(inv.commissionPayments) && inv.commissionPayments.length > 0) {
        for (const cp of inv.commissionPayments) {
          await prisma.commissionPayment.create({
            data: {
              id: cp._id ? cp._id.toString() : undefined,
              invoiceId: invId,
              amount: Number(cp.amount || 0),
              date: cp.date ? new Date(cp.date) : new Date(),
              remarks: cp.remarks || "",
            },
          });
        }
      }

      // Migrate salesCommissionPayments array
      if (Array.isArray(inv.salesCommissionPayments) && inv.salesCommissionPayments.length > 0) {
        for (const scp of inv.salesCommissionPayments) {
          await prisma.salesCommissionPayment.create({
            data: {
              id: scp._id ? scp._id.toString() : undefined,
              invoiceId: invId,
              amount: Number(scp.amount || 0),
              date: scp.date ? new Date(scp.date) : new Date(),
              remarks: scp.remarks || "",
            },
          });
        }
      }

      invoiceCount++;
    }
    console.log(`✅ Migrated ${invoiceCount} Invoices with payment transactions.\n`);

    console.log("🎉 ALL DATA MIGRATED SUCCESSFULLY FROM MONGODB TO MYSQL!");
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
  } finally {
    await mongoose.disconnect();
    await prisma.$disconnect();
  }
}

migrate();
