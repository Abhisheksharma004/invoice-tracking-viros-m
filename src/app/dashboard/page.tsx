"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Invoice {
  _id?: string;
  id?: string;
  invoiceNumber: string;
  customerName?: string;
  client?: string;
  salesPerson: string;
  saleItem: string;
  cost: number;
  amount?: number;
  saleAmount?: number;
  expenses: number;
  commission: number;
  salesCommission: number;
  remarks?: string;
  status: "dispatch" | "intransit" | "delivered";
  shippingRemarks?: string;
  date: string;
  commissionPaid?: boolean;
  commissionPaidDate?: string;
  commissionPayRemarks?: string;
  commissionPaidAmount?: number;
  commissionPayments?: { amount: number; date: string; remarks: string; _id?: string }[];
  salesCommissionPaid?: boolean;
  salesCommissionPaidDate?: string;
  salesCommissionPayRemarks?: string;
  salesCommissionPaidAmount?: number;
  salesCommissionPayments?: { amount: number; date: string; remarks: string; _id?: string }[];
  profit?: number;
  netProfit?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface Client {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  totalInvoices: number;
  totalAmount: number;
  status: "active" | "inactive";
  joinedDate: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Salesman {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  address: string;
  totalSales: number;
  totalClients: number;
  status: "active" | "inactive";
  joinedDate: string;
  createdAt?: string;
  updatedAt?: string;
}

interface OfficeExpense {
  _id?: string;
  id?: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paymentMethod: "Cash" | "Bank Transfer" | "Credit Card" | "UPI" | "Cheque";
  paidTo?: string;
  remarks?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  role?: "admin" | "manager" | "user" | "viewer";
  permissions: {
    dashboard: {
      view: boolean;
      export: boolean;
    };
    invoices: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      export: boolean;
    };
    customers: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
      import: boolean;
      export: boolean;
    };
    salesPerson: {
      view: boolean;
      create: boolean;
      edit: boolean;
      delete: boolean;
    };
    reports: {
      view: boolean;
      export: boolean;
    };
    settings: {
      view: boolean;
      edit: boolean;
      manageUsers: boolean;
    };
  };
  status: "active" | "inactive";
  createdAt?: string;
  lastLogin?: string;
}

type ShippingStatus = "dispatch" | "intransit" | "delivered";

const SHIPPING_STATUS_OPTIONS: { value: ShippingStatus; label: string }[] = [
  { value: "dispatch", label: "Dispatch" },
  { value: "intransit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
];

const getShippingStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    dispatch: "Dispatch",
    intransit: "In Transit",
    intransist: "In Transit",
    delivered: "Delivered",
    pending: "Dispatch",
    paid: "Delivered",
    overdue: "In Transit",
  };
  return labels[status] || status;
};

const normalizeShippingStatus = (status: string): ShippingStatus => {
  const map: Record<string, ShippingStatus> = {
    dispatch: "dispatch",
    intransit: "intransit",
    intransist: "intransit",
    delivered: "delivered",
    pending: "dispatch",
    paid: "delivered",
    overdue: "intransit",
  };
  return map[status] || "dispatch";
};

// Role-based permission templates
const ROLE_PERMISSIONS = {
  admin: {
    dashboard: { view: true, export: true },
    invoices: { view: true, create: true, edit: true, delete: true, export: true },
    customers: { view: true, create: true, edit: true, delete: true, import: true, export: true },
    salesPerson: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: true, manageUsers: true },
  },
  manager: {
    dashboard: { view: true, export: true },
    invoices: { view: true, create: true, edit: true, delete: false, export: true },
    customers: { view: true, create: true, edit: true, delete: false, import: true, export: true },
    salesPerson: { view: true, create: true, edit: true, delete: false },
    reports: { view: true, export: true },
    settings: { view: true, edit: false, manageUsers: false },
  },
  user: {
    dashboard: { view: true, export: false },
    invoices: { view: true, create: true, edit: true, delete: false, export: false },
    customers: { view: true, create: true, edit: false, delete: false, import: false, export: false },
    salesPerson: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: false },
    settings: { view: true, edit: false, manageUsers: false },
  },
  viewer: {
    dashboard: { view: true, export: false },
    invoices: { view: true, create: false, edit: false, delete: false, export: false },
    customers: { view: true, create: false, edit: false, delete: false, import: false, export: false },
    salesPerson: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: false },
    settings: { view: false, edit: false, manageUsers: false },
  },
};

export default function Dashboard() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("dashboard");
  // Set default to current month (YYYY-MM format)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  // User and permissions state
  const [currentUser, setCurrentUser] = useState<User>({
    name: "Admin User",
    email: "admin@example.com",
    phone: "+91 98765 43210",
    role: "admin",
    permissions: ROLE_PERMISSIONS.admin,
    status: "active",
  });
  const [users, setUsers] = useState<User[]>([
    {
      id: "1",
      name: "Admin User",
      email: "admin@example.com",
      phone: "+91 98765 43210",
      role: "admin",
      permissions: ROLE_PERMISSIONS.admin,
      status: "active",
      createdAt: "2025-01-01",
      lastLogin: "2025-11-13",
    },
    {
      id: "2",
      name: "Manager User",
      email: "manager@example.com",
      phone: "+91 98765 43211",
      role: "manager",
      permissions: ROLE_PERMISSIONS.manager,
      status: "active",
      createdAt: "2025-01-15",
      lastLogin: "2025-11-12",
    },
    {
      id: "3",
      name: "Viewer User",
      email: "viewer@example.com",
      phone: "+91 98765 43212",
      role: "viewer",
      permissions: ROLE_PERMISSIONS.viewer,
      status: "active",
      createdAt: "2025-02-01",
      lastLogin: "2025-11-10",
    },
  ]);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    permissions: {
      dashboard: { view: false, export: false },
      invoices: { view: false, create: false, edit: false, delete: false, export: false },
      customers: { view: false, create: false, edit: false, delete: false, import: false, export: false },
      salesPerson: { view: false, create: false, edit: false, delete: false },
      reports: { view: false, export: false },
      settings: { view: false, edit: false, manageUsers: false },
    },
  });
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showEditUserModal, setShowEditUserModal] = useState(false);

  // Helper function to check permissions
  const hasPermission = (section: keyof User['permissions'], action: string): boolean => {
    if (!currentUser?.permissions) return false;
    return currentUser.permissions[section][action as keyof typeof currentUser.permissions[typeof section]] || false;
  };

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/check", {
          method: "GET",
          credentials: "include",
        }).catch(() => null);

        if (!response) {
          router.replace("/");
          return;
        }

        const data = await response.json().catch(() => ({}));

        if (response.ok && data.authenticated) {
          setIsAuthenticated(true);
        } else {
          // User is not authenticated, redirect to login
          router.replace("/");
        }
      } catch (error) {
        // Error checking auth, redirect to login
        router.replace("/");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Fetch data from database
  useEffect(() => {
    if (isAuthenticated) {
      fetchClients();
      fetchSalesmen();
      fetchInvoices();
      fetchOfficeExpenses();
    }
  }, [isAuthenticated]);

  const fetchClients = async () => {
    try {
      const response = await fetch("/api/clients");
      const data = await response.json();

      if (data.success) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchSalesmen = async () => {
    try {
      const response = await fetch("/api/salesmen");
      const data = await response.json();

      if (data.success) {
        setSalesmen(data.salesmen);
      }
    } catch (error) {
      console.error("Error fetching salesmen:", error);
    }
  };

  const fetchInvoices = async () => {
    try {
      const response = await fetch("/api/invoices", { cache: "no-store" });
      const data = await response.json();
      setInvoices(data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    }
  };

  const fetchOfficeExpenses = async () => {
    try {
      const response = await fetch("/api/office-expenses", { cache: "no-store" });
      const data = await response.json();
      if (data.success) {
        setOfficeExpenses(data.officeExpenses);
      }
    } catch (error) {
      console.error("Error fetching office expenses:", error);
    }
  };

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [officeExpenses, setOfficeExpenses] = useState<OfficeExpense[]>([]);

  const [showAddOfficeExpenseModal, setShowAddOfficeExpenseModal] = useState(false);
  const [showEditOfficeExpenseModal, setShowEditOfficeExpenseModal] = useState(false);
  const [editingOfficeExpense, setEditingOfficeExpense] = useState<OfficeExpense | null>(null);
  const [searchOfficeExpense, setSearchOfficeExpense] = useState("");
  const [filterExpenseCategory, setFilterExpenseCategory] = useState("all");

  const [newOfficeExpense, setNewOfficeExpense] = useState({
    title: "",
    category: "Utilities",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "Cash" as "Cash" | "Bank Transfer" | "Credit Card" | "UPI" | "Cheque",
    paidTo: "",
    remarks: "",
  });

  const handleAddOfficeExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/office-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newOfficeExpense),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Office expense added successfully!");
        setShowAddOfficeExpenseModal(false);
        setNewOfficeExpense({
          title: "",
          category: "Utilities",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          paymentMethod: "Cash",
          paidTo: "",
          remarks: "",
        });
        fetchOfficeExpenses();
      } else {
        toast.error(data.message || "Failed to add office expense");
      }
    } catch (error) {
      console.error("Error adding office expense:", error);
      toast.error("An error occurred while adding office expense");
    }
  };

  const handleEditOfficeExpense = (expense: OfficeExpense) => {
    setEditingOfficeExpense({
      ...expense,
      date: expense.date ? new Date(expense.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setShowEditOfficeExpenseModal(true);
  };

  const handleUpdateOfficeExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOfficeExpense) return;
    try {
      const response = await fetch("/api/office-expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingOfficeExpense._id || editingOfficeExpense.id,
          title: editingOfficeExpense.title,
          category: editingOfficeExpense.category,
          amount: editingOfficeExpense.amount,
          date: editingOfficeExpense.date,
          paymentMethod: editingOfficeExpense.paymentMethod,
          paidTo: editingOfficeExpense.paidTo,
          remarks: editingOfficeExpense.remarks,
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Office expense updated successfully!");
        setShowEditOfficeExpenseModal(false);
        setEditingOfficeExpense(null);
        fetchOfficeExpenses();
      } else {
        toast.error(data.message || "Failed to update office expense");
      }
    } catch (error) {
      console.error("Error updating office expense:", error);
      toast.error("An error occurred while updating office expense");
    }
  };

  const handleDeleteOfficeExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this office expense?")) return;
    try {
      const response = await fetch(`/api/office-expenses?id=${id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Office expense deleted successfully!");
        fetchOfficeExpenses();
      } else {
        toast.error(data.message || "Failed to delete office expense");
      }
    } catch (error) {
      console.error("Error deleting office expense:", error);
      toast.error("An error occurred while deleting office expense");
    }
  };

  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [showEditClientModal, setShowEditClientModal] = useState(false);
  const [showViewClientModal, setShowViewClientModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddSalesmanModal, setShowAddSalesmanModal] = useState(false);
  const [showEditSalesmanModal, setShowEditSalesmanModal] = useState(false);
  const [showViewSalesmanModal, setShowViewSalesmanModal] = useState(false);
  const [showImportSalesmanModal, setShowImportSalesmanModal] = useState(false);
  const [showAddInvoiceModal, setShowAddInvoiceModal] = useState(false);
  const [showEditInvoiceModal, setShowEditInvoiceModal] = useState(false);
  const [showPayCommissionModal, setShowPayCommissionModal] = useState(false);
  const [payCommissionData, setPayCommissionData] = useState<{
    invoiceId: string;
    type: "commission" | "salesCommission";
    totalAmount: number;
    alreadyPaid: number;
    payAmount: number;
    invoiceNumber: string;
    salesPerson: string;
    remarks: string;
  } | null>(null);
  const [showBulkPayModal, setShowBulkPayModal] = useState(false);
  const [bulkPayType, setBulkPayType] = useState<"commission" | "salesCommission">("commission");
  const [bulkPayRemarks, setBulkPayRemarks] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [newClient, setNewClient] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
  });
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewingClient, setViewingClient] = useState<Client | null>(null);

  const [newSalesman, setNewSalesman] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    address: "",
  });
  const [editingSalesman, setEditingSalesman] = useState<Salesman | null>(null);
  const [viewingSalesman, setViewingSalesman] = useState<Salesman | null>(null);

  const [newInvoice, setNewInvoice] = useState({
    customerName: "",
    salesPerson: "",
    invoiceNumber: "",
    saleItem: "",
    cost: "",
    saleAmount: "",
    expenses: "",
    commission: "",
    salesCommission: "",
    remarks: "",
    status: "dispatch" as ShippingStatus,
    shippingRemarks: "",
    date: "",
  });

  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showSalesPersonSuggestions, setShowSalesPersonSuggestions] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [filteredSalesmen, setFilteredSalesmen] = useState<Salesman[]>([]);

  // Filter states
  const [filterCustomer, setFilterCustomer] = useState("");
  const [filterSalesPerson, setFilterSalesPerson] = useState("");
  const [filterInvoiceNumber, setFilterInvoiceNumber] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showFilterCustomerSuggestions, setShowFilterCustomerSuggestions] = useState(false);
  const [filteredFilterClients, setFilteredFilterClients] = useState<Client[]>([]);
  const [showFilterSalesPersonSuggestions, setShowFilterSalesPersonSuggestions] = useState(false);
  const [filteredFilterSalesmen, setFilteredFilterSalesmen] = useState<Salesman[]>([]);

  // Password change handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError("All fields are required");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    // Password strength validation
    const hasUpperCase = /[A-Z]/.test(passwordData.newPassword);
    const hasLowerCase = /[a-z]/.test(passwordData.newPassword);
    const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>]/.test(passwordData.newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumberOrSymbol) {
      setPasswordError("Password must contain uppercase, lowercase, and number/symbol");
      return;
    }

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPasswordSuccess("Password changed successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setTimeout(() => setPasswordSuccess(""), 3000);
      } else {
        setPasswordError(data.message || "Failed to change password");
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("An error occurred while changing password");
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newClient.name,
          email: newClient.email,
          phone: newClient.phone,
          company: newClient.company,
          address: newClient.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh clients list
        await fetchClients();
        setShowAddClientModal(false);
        setNewClient({ name: "", email: "", phone: "", company: "", address: "" });
        toast.success("Client added successfully!");
      } else {
        toast.error(data.message || "Failed to add client");
      }
    } catch (error) {
      console.error("Error adding client:", error);
      toast.error("An error occurred while adding the client");
    }
  };

  const handleEditClient = (client: Client) => {
    setEditingClient(client);
    setShowEditClientModal(true);
  };

  const handleViewClient = (client: Client) => {
    setViewingClient(client);
    setShowViewClientModal(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingClient) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/clients", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingClient._id || editingClient.id,
          name: editingClient.name,
          email: editingClient.email,
          phone: editingClient.phone,
          company: editingClient.company,
          address: editingClient.address,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Refresh clients list
        await fetchClients();
        setShowEditClientModal(false);
        setEditingClient(null);
        toast.success("Client updated successfully!");
      } else {
        toast.error(data.message || "Failed to update client");
      }
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error("An error occurred while updating the client");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm("Are you sure you want to delete this client? This action cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch(`/api/clients?id=${clientId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        // Refresh clients list
        await fetchClients();
        toast.success("Client deleted successfully!");
      } else {
        toast.error(data.message || "Failed to delete client");
      }
    } catch (error) {
      console.error("Error deleting client:", error);
      toast.error("An error occurred while deleting the client");
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5MB limit");
      return;
    }

    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'xlsx' && fileExtension !== 'xls') {
      toast.error("Please upload a valid Excel file (.xlsx or .xls)");
      return;
    }

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      if (jsonData.length < 2) {
        toast.error("Excel file is empty or has no data rows");
        return;
      }

      // Skip header row and process data
      const customers = jsonData.slice(1).filter(row => row.length > 0).map((row, index) => {
        return {
          company: row[0]?.toString().trim() || '',
          email: row[1]?.toString().trim() || '',
          phone: row[2]?.toString().trim() || '',
          name: row[3]?.toString().trim() || '',
          address: row[4]?.toString().trim() || ''
        };
      }).filter(customer => customer.company); // Only include rows with company name

      if (customers.length === 0) {
        toast.error("No valid customer data found in the Excel file");
        return;
      }

      // Import customers one by one
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const customer of customers) {
        try {
          const response = await fetch("/api/clients", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(customer),
          });

          const data = await response.json();

          if (data.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${customer.company}: ${data.message || "Unknown error"}`);
          }
        } catch (error) {
          errorCount++;
          errors.push(`${customer.company}: Failed to import`);
        }
      }

      // Refresh clients list
      await fetchClients();
      setShowImportModal(false);

      // Show summary
      let message = `Import completed!\n\n✓ Successfully imported: ${successCount} customers`;
      if (errorCount > 0) {
        message += `\n✗ Failed to import: ${errorCount} customers`;
        if (errors.length > 0) {
          message += `\n\nErrors:\n${errors.slice(0, 5).join('\n')}`;
          if (errors.length > 5) {
            message += `\n... and ${errors.length - 5} more`;
          }
        }
      }
      toast.success(message, { duration: 5000 });

      // Reset file input
      e.target.value = '';
    } catch (error) {
      console.error("Error importing file:", error);
      toast.error("Failed to import Excel file. Please check the file format and try again.");
      e.target.value = '';
    }
  };

  const handleAddSalesman = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch("/api/salesmen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newSalesman.name,
          email: newSalesman.email,
          phone: newSalesman.phone,
          employeeId: newSalesman.employeeId,
          address: newSalesman.address,
          totalSales: 0,
          totalClients: 0,
          status: "active",
          joinedDate: new Date(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Salesman added successfully!");
        setShowAddSalesmanModal(false);
        setNewSalesman({ name: "", email: "", phone: "", employeeId: "", address: "" });
        fetchSalesmen(); // Refresh the salesmen list
      } else {
        toast.error(data.message || "Error adding salesman");
      }
    } catch (error) {
      console.error("Error adding salesman:", error);
      toast.error("Failed to add salesman. Please try again.");
    }
  };

  const handleEditSalesman = (salesman: Salesman) => {
    setEditingSalesman(salesman);
    setShowEditSalesmanModal(true);
  };

  const handleViewSalesman = (salesman: Salesman) => {
    setViewingSalesman(salesman);
    setShowViewSalesmanModal(true);
  };

  const handleUpdateSalesman = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSalesman) return;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/salesmen", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editingSalesman._id || editingSalesman.id,
          name: editingSalesman.name,
          email: editingSalesman.email,
          phone: editingSalesman.phone,
          employeeId: editingSalesman.employeeId,
          address: editingSalesman.address,
          totalSales: editingSalesman.totalSales,
          totalClients: editingSalesman.totalClients,
          status: editingSalesman.status,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Salesman updated successfully!");
        setShowEditSalesmanModal(false);
        setEditingSalesman(null);
        fetchSalesmen(); // Refresh the salesmen list
      } else {
        toast.error(data.message || "Error updating salesman");
      }
    } catch (error) {
      console.error("Error updating salesman:", error);
      toast.error("Failed to update salesman. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSalesman = async (salesmanId: string) => {
    if (!confirm("Are you sure you want to deactivate this salesman? This will change their status to inactive.")) {
      return;
    }

    try {
      const response = await fetch("/api/salesmen", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: salesmanId }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Salesman deactivated successfully!");
        fetchSalesmen(); // Refresh the salesmen list
      } else {
        toast.error(data.message || "Error deactivating salesman");
      }
    } catch (error) {
      console.error("Error deactivating salesman:", error);
      toast.error("Failed to deactivate salesman. Please try again.");
    }
  };

  const handleImportSalesmanFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log("File selected:", file.name);
      toast.success(`File "${file.name}" selected. Import functionality can be implemented here.`);
      setShowImportSalesmanModal(false);
    }
  };

  const handleAddInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: newInvoice.invoiceNumber,
          customerName: newInvoice.customerName,
          salesPerson: newInvoice.salesPerson,
          saleItem: newInvoice.saleItem,
          cost: newInvoice.cost,
          saleAmount: newInvoice.saleAmount,
          expenses: newInvoice.expenses,
          commission: newInvoice.commission,
          salesCommission: newInvoice.salesCommission,
          remarks: newInvoice.remarks,
          status: newInvoice.status,
          shippingRemarks: newInvoice.shippingRemarks,
          date: newInvoice.date,
        }),
      });

      if (response.ok) {
        // Refresh invoices list
        await fetchInvoices();

        setShowAddInvoiceModal(false);
        setNewInvoice({
          customerName: "",
          salesPerson: "",
          invoiceNumber: "",
          saleItem: "",
          cost: "",
          saleAmount: "",
          expenses: "",
          commission: "",
          salesCommission: "",
          remarks: "",
          status: "dispatch",
          shippingRemarks: "",
          date: "",
        });

        toast.success("Invoice created successfully!");
      } else {
        const error = await response.json();
        toast.error(`Failed to create invoice: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast.error("Failed to create invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setNewInvoice({
      customerName: getInvoiceClient(invoice),
      salesPerson: invoice.salesPerson,
      invoiceNumber: invoice.invoiceNumber,
      saleItem: invoice.saleItem,
      cost: invoice.cost.toString(),
      saleAmount: getInvoiceAmount(invoice).toString(),
      expenses: invoice.expenses.toString(),
      commission: invoice.commission.toString(),
      salesCommission: invoice.salesCommission.toString(),
      remarks: invoice.remarks || "",
      status: normalizeShippingStatus(invoice.status),
      shippingRemarks: invoice.shippingRemarks || "",
      date: invoice.date.split('T')[0],
    });
    setShowEditInvoiceModal(true);
  };

  const handleUpdateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingInvoice) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/invoices/${getInvoiceId(editingInvoice)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          invoiceNumber: newInvoice.invoiceNumber,
          customerName: newInvoice.customerName,
          salesPerson: newInvoice.salesPerson,
          saleItem: newInvoice.saleItem,
          cost: newInvoice.cost,
          saleAmount: newInvoice.saleAmount,
          expenses: newInvoice.expenses,
          commission: newInvoice.commission,
          salesCommission: newInvoice.salesCommission,
          remarks: newInvoice.remarks,
          status: newInvoice.status,
          shippingRemarks: newInvoice.shippingRemarks,
          date: newInvoice.date,
        }),
      });

      if (response.ok) {
        await fetchInvoices();
        setShowEditInvoiceModal(false);
        setEditingInvoice(null);
        setNewInvoice({
          customerName: "",
          salesPerson: "",
          invoiceNumber: "",
          saleItem: "",
          cost: "",
          saleAmount: "",
          expenses: "",
          commission: "",
          salesCommission: "",
          remarks: "",
          status: "dispatch",
          shippingRemarks: "",
          date: "",
        });
        toast.success("Invoice updated successfully!");
      } else {
        const error = await response.json();
        toast.error(`Failed to update invoice: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating invoice:", error);
      toast.error("Failed to update invoice. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to delete this invoice?")) {
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchInvoices();
        toast.success("Invoice deleted successfully!");
      } else {
        const error = await response.json();
        toast.error(`Failed to delete invoice: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error deleting invoice:", error);
      toast.error("Failed to delete invoice. Please try again.");
    }
  };

  const openPayCommissionModal = (
    invoice: Invoice,
    type: "commission" | "salesCommission"
  ) => {
    const totalAmount = type === "commission" ? invoice.commission : invoice.salesCommission;
    const alreadyPaid = type === "commission"
      ? (invoice.commissionPaidAmount || 0)
      : (invoice.salesCommissionPaidAmount || 0);
    const remaining = totalAmount - alreadyPaid;
    setPayCommissionData({
      invoiceId: getInvoiceId(invoice),
      type,
      totalAmount,
      alreadyPaid,
      payAmount: remaining,
      invoiceNumber: invoice.invoiceNumber,
      salesPerson: invoice.salesPerson,
      remarks: "",
    });
    setShowPayCommissionModal(true);
  };

  const handlePayCommission = async () => {
    if (!payCommissionData) return;
    const { payAmount, totalAmount, alreadyPaid } = payCommissionData;
    if (!payAmount || payAmount <= 0) {
      toast.error("Please enter a valid amount to pay.");
      return;
    }
    if (payAmount > totalAmount - alreadyPaid) {
      toast.error("Amount cannot exceed the remaining balance.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { invoiceId, type, remarks } = payCommissionData;
      const body =
        type === "commission"
          ? { commissionPayAmount: payAmount, commissionPayRemarks: remarks }
          : { salesCommissionPayAmount: payAmount, salesCommissionPayRemarks: remarks };

      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchInvoices();
        const label = type === "commission" ? "Commission" : "Sales Commission";
        const isFullyPaid = alreadyPaid + payAmount >= totalAmount;
        toast.success(`${label} ${isFullyPaid ? "fully paid!" : "partially paid!"}`);
        setShowPayCommissionModal(false);
        setPayCommissionData(null);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update commission status");
      }
    } catch (error) {
      console.error("Error updating commission status:", error);
      toast.error("Failed to update commission status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkPayCommission = async () => {
    setIsSubmitting(true);
    try {
      const unpaidInvoices = filteredInvoices.filter((inv) =>
        bulkPayType === "commission"
          ? !inv.commissionPaid && inv.commission > 0
          : !inv.salesCommissionPaid && inv.salesCommission > 0
      );
      if (unpaidInvoices.length === 0) {
        toast("No unpaid commissions to process.");
        setShowBulkPayModal(false);
        return;
      }
      await Promise.all(
        unpaidInvoices.map((inv) => {
          const body =
            bulkPayType === "commission"
              ? { commissionPayAmount: inv.commission - (inv.commissionPaidAmount || 0), commissionPayRemarks: bulkPayRemarks }
              : { salesCommissionPayAmount: inv.salesCommission - (inv.salesCommissionPaidAmount || 0), salesCommissionPayRemarks: bulkPayRemarks };
          return fetch(`/api/invoices/${getInvoiceId(inv)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
        })
      );
      await fetchInvoices();
      const label = bulkPayType === "commission" ? "Commission" : "Sales Commission";
      toast.success(`${unpaidInvoices.length} invoice(s) marked as ${label} paid!`);
      setShowBulkPayModal(false);
      setBulkPayRemarks("");
    } catch (error) {
      console.error("Error bulk paying commissions:", error);
      toast.error("Failed to bulk pay commissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUndoCommission = async (
    invoiceId: string,
    type: "commission" | "salesCommission"
  ) => {
    try {
      const body =
        type === "commission"
          ? { commissionPaid: false, commissionPayRemarks: "" }
          : { salesCommissionPaid: false, salesCommissionPayRemarks: "" };

      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await fetchInvoices();
        const label = type === "commission" ? "Commission" : "Sales Commission";
        toast.success(`${label} marked as unpaid.`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to undo commission status");
      }
    } catch (error) {
      console.error("Error undoing commission status:", error);
      toast.error("Failed to undo commission status");
    }
  };

  // Helper functions to handle both old and new field names
  const getInvoiceClient = (invoice: Invoice) => invoice.customerName || invoice.client || "";
  const getInvoiceAmount = (invoice: Invoice) => invoice.saleAmount || invoice.amount || 0;
  const getInvoiceId = (invoice: Invoice) => invoice._id || invoice.id || "";

  // Generate available months from invoice data
  const availableMonths = Array.from(new Set(
    invoices
      .filter(inv => inv.date) // Only include invoices with valid dates
      .map(inv => {
        const date = new Date(inv.date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      })
  )).sort().reverse();

  // Filter invoices by selected month based on invoice date
  const filteredInvoicesByMonth = selectedMonth === "all"
    ? invoices
    : invoices.filter(inv => {
      if (!inv.date) return false; // Skip invoices without dates
      const date = new Date(inv.date);
      const invoiceMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return invoiceMonth === selectedMonth;
    });

  const totalRevenue = filteredInvoicesByMonth.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);

  const getStatusColor = (status: string) => {
    switch (normalizeShippingStatus(status)) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "dispatch":
        return "bg-yellow-100 text-yellow-800";
      case "intransit":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Filter invoices based on search criteria and selected month
  const filteredInvoices = filteredInvoicesByMonth.filter((invoice) => {
    const customerName = getInvoiceClient(invoice).toLowerCase();
    const salesPerson = invoice.salesPerson.toLowerCase();
    const invoiceNumber = invoice.invoiceNumber.toLowerCase();

    const matchesCustomer = filterCustomer === "" || customerName === filterCustomer.toLowerCase();
    const matchesSalesPerson = filterSalesPerson === "" || salesPerson === filterSalesPerson.toLowerCase();
    const matchesInvoiceNumber = filterInvoiceNumber === "" || invoiceNumber.includes(filterInvoiceNumber.toLowerCase());
    const matchesStatus = filterStatus === "" || normalizeShippingStatus(invoice.status) === filterStatus;

    return matchesCustomer && matchesSalesPerson && matchesInvoiceNumber && matchesStatus;
  });

  const hasActiveInvoiceFilters =
    filterCustomer !== "" ||
    filterSalesPerson !== "" ||
    filterInvoiceNumber !== "" ||
    filterStatus !== "";

  const clearInvoiceFilters = () => {
    setFilterCustomer("");
    setFilterSalesPerson("");
    setFilterInvoiceNumber("");
    setFilterStatus("");
    setShowFilterCustomerSuggestions(false);
    setShowFilterSalesPersonSuggestions(false);
    setFilteredFilterClients([]);
    setFilteredFilterSalesmen([]);
  };

  const filteredRevenue = filteredInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
  const filteredNetProfit = filteredInvoices.reduce((sum, inv) => {
    const amount = getInvoiceAmount(inv);
    const profit = amount - inv.cost - inv.expenses;
    return sum + (profit - inv.commission - inv.salesCommission);
  }, 0);
  const filteredDispatchCount = filteredInvoices.filter((inv) => normalizeShippingStatus(inv.status) === "dispatch").length;
  const filteredInTransitCount = filteredInvoices.filter((inv) => normalizeShippingStatus(inv.status) === "intransit").length;
  const filteredDeliveredCount = filteredInvoices.filter((inv) => normalizeShippingStatus(inv.status) === "delivered").length;

  const getClientStatusColor = (status: string) => {
    return status === "active"
      ? "bg-green-100 text-green-800"
      : "bg-gray-100 text-gray-800";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      // Use replace to prevent back button from returning to dashboard
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      router.replace("/");
    }
  };

  const menuItems = [
    {
      id: "dashboard",
      name: "Dashboard",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      id: "invoices",
      name: "Invoices",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "clients",
      name: "Customers",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "salesman",
      name: "Sales Person",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      id: "office-expenses",
      name: "Office Expenses",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      id: "reports",
      name: "Reports",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "settings",
      name: "Settings",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  // Show loading state while checking authentication
  const renderInvoiceFilterBar = () => (
    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter by Customer
          </label>
          <input
            type="text"
            value={filterCustomer}
            onChange={(e) => {
              const value = e.target.value;
              setFilterCustomer(value);
              if (value.trim()) {
                const filtered = clients.filter((client) =>
                  client.company.toLowerCase().includes(value.toLowerCase())
                );
                setFilteredFilterClients(filtered);
                setShowFilterCustomerSuggestions(filtered.length > 0);
              } else {
                setShowFilterCustomerSuggestions(false);
                setFilteredFilterClients([]);
              }
            }}
            onFocus={() => {
              if (filterCustomer.trim() && filteredFilterClients.length > 0) {
                setShowFilterCustomerSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowFilterCustomerSuggestions(false), 200);
            }}
            placeholder="Search customer name..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
          />
          {showFilterCustomerSuggestions && filteredFilterClients.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredFilterClients.map((client) => (
                <div
                  key={client._id || client.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFilterCustomer(client.company);
                    setShowFilterCustomerSuggestions(false);
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-semibold text-gray-900">{client.company}</p>
                  <p className="text-sm text-gray-500">{client.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filter by Sales Person
          </label>
          <input
            type="text"
            value={filterSalesPerson}
            onChange={(e) => {
              const value = e.target.value;
              setFilterSalesPerson(value);
              if (value.trim()) {
                const filtered = salesmen.filter((salesman) =>
                  salesman.name.toLowerCase().includes(value.toLowerCase())
                );
                setFilteredFilterSalesmen(filtered);
                setShowFilterSalesPersonSuggestions(filtered.length > 0);
              } else {
                setShowFilterSalesPersonSuggestions(false);
                setFilteredFilterSalesmen([]);
              }
            }}
            onFocus={() => {
              if (filterSalesPerson.trim() && filteredFilterSalesmen.length > 0) {
                setShowFilterSalesPersonSuggestions(true);
              }
            }}
            onBlur={() => {
              setTimeout(() => setShowFilterSalesPersonSuggestions(false), 200);
            }}
            placeholder="Search sales person..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
          />
          {showFilterSalesPersonSuggestions && filteredFilterSalesmen.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredFilterSalesmen.map((salesman) => (
                <div
                  key={salesman._id || salesman.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setFilterSalesPerson(salesman.name);
                    setShowFilterSalesPersonSuggestions(false);
                  }}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-semibold text-gray-900">{salesman.name}</p>
                  <p className="text-sm text-gray-500">{salesman.email}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Filter by Invoice Number
          </label>
          <input
            type="text"
            value={filterInvoiceNumber}
            onChange={(e) => setFilterInvoiceNumber(e.target.value)}
            placeholder="Search invoice number..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Filter by Shipping Status
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium bg-white"
          >
            <option value="">All Statuses</option>
            {SHIPPING_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-gray-200">
        <div className="flex flex-wrap gap-2">
          {filterCustomer && (
            <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">
              Customer: {filterCustomer}
            </span>
          )}
          {filterSalesPerson && (
            <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
              Sales: {filterSalesPerson}
            </span>
          )}
          {filterInvoiceNumber && (
            <span className="px-3 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded-full">
              Invoice #: {filterInvoiceNumber}
            </span>
          )}
          {filterStatus && (
            <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(filterStatus)}`}>
              Shipping Status: {getShippingStatusLabel(filterStatus)}
            </span>
          )}
          {!hasActiveInvoiceFilters && (
            <span className="text-sm text-gray-500">No filters applied — showing all invoices for selected month</span>
          )}
        </div>
        <button
          type="button"
          onClick={clearInvoiceFilters}
          disabled={!hasActiveInvoiceFilters}
          className="px-4 py-2 text-sm font-semibold rounded-lg border transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed border-gray-300 text-gray-700 hover:bg-gray-100 enabled:border-red-300 enabled:text-red-700 enabled:hover:bg-red-50"
        >
          Clear Filters
        </button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-20"
          } bg-linear-to-b from-blue-900 to-blue-800 text-white transition-all duration-300 flex flex-col`}
      >
        {/* Logo */}
        <div className="p-4 border-b border-blue-700">
          <div className="flex items-center justify-between">
            {sidebarOpen ? (
              <div className="flex items-center space-x-3">
                <div className="bg-white rounded-lg p-2 shadow-md">
                  <img className="w-8 h-8" src="/logo.png" alt="" />
                </div>

                <div>
                  <span className="font-bold text-xl tracking-tight">InvoiceTrack</span>
                  <p className="text-xs text-blue-200">Invoice & Expense System</p>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg p-2 mx-auto shadow-md">
                <svg
                  className="w-8 h-8 text-blue-900"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" />
                  <path d="M14 2v6h6" fill="white" />
                  <path d="M9 13h6M9 17h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  <circle cx="10" cy="9" r="1.5" fill="#FFD700" />
                  <circle cx="14" cy="9" r="1.5" fill="#FFD700" />
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${activeTab === item.id
                ? "bg-blue-700 shadow-lg"
                : "hover:bg-blue-800"
                }`}
            >
              <span>{item.icon}</span>
              {sidebarOpen && (
                <span className="font-medium">{item.name}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Toggle Button & Logout */}
        <div className="p-4 border-t border-blue-700 space-y-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-800 transition"
          >
            <svg
              className={`w-6 h-6 transition-transform ${sidebarOpen ? "" : "rotate-180"
                }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
              />
            </svg>
            {sidebarOpen && <span className="font-medium">Collapse</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            {sidebarOpen && <span className="font-medium">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white shadow-sm">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {activeTab === "clients" ? "Customers" : activeTab === "salesman" ? "Sales Person" : activeTab === "office-expenses" ? "Office Expenses" : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back! Here's what's happening today.
              </p>
            </div>
            <div className="flex items-center space-x-4">

              {/* Month Filter - Show on dashboard, invoices, clients, salesman, office-expenses, and reports tabs */}
              {(activeTab === "dashboard" || activeTab === "invoices" || activeTab === "clients" || activeTab === "salesman" || activeTab === "office-expenses" || activeTab === "reports") && (
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 font-medium bg-white cursor-pointer hover:border-blue-400 transition-colors appearance-none"
                    style={{ minWidth: '180px' }}
                  >
                    <option value="all">All Months</option>
                    {availableMonths.map((month) => {
                      const [year, monthNum] = month.split('-');
                      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
                      const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      return (
                        <option key={month} value={month}>
                          {monthName}
                        </option>
                      );
                    })}
                  </select>
                  <svg
                    className="w-5 h-5 text-gray-500 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Profile */}
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                  A
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto p-6">
          {activeTab === "dashboard" && (
            <>
              {/* Stats Cards - Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {/* Total Cost */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Cost</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.cost, 0))}
                    </p>
                  </div>
                </div>

                {/* Total Sale Amount */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sale Amount</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                      {formatINR(totalRevenue)}
                    </p>
                  </div>
                </div>

                {/* Total Expenses */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Expenses</p>
                    <p className="text-3xl font-bold text-red-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.expenses, 0))}
                    </p>
                  </div>
                </div>

                {/* Total Commission */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Commission</p>
                    <p className="text-3xl font-bold text-orange-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.commission, 0))}
                    </p>
                  </div>
                </div>

                {/* Total Sales Commission */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Sales Commission</p>
                    <p className="text-3xl font-bold text-purple-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + inv.salesCommission, 0))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats Cards - Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-6">
                {/* All Invoices */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">All Invoices</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{filteredInvoicesByMonth.length}</p>
                  </div>
                </div>

                {/* Profit Without Expense */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Profit Without Expense</p>
                    <p className="text-3xl font-bold text-blue-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost), 0))}
                    </p>
                  </div>
                </div>

                {/* Profit */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Profit</p>
                    <p className="text-3xl font-bold text-emerald-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost - inv.expenses), 0))}
                    </p>
                  </div>
                </div>

                {/* Net Profit */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Net Profit</p>
                    <p className="text-3xl font-bold text-green-600 mt-2">
                      {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => {
                        const amount = getInvoiceAmount(inv);
                        const profit = amount - inv.cost - inv.expenses;
                        return sum + (profit - inv.commission - inv.salesCommission);
                      }, 0))}
                    </p>
                  </div>
                </div>

                {/* Profit Margin */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                    <p className="text-3xl font-bold text-teal-600 mt-2">
                      {totalRevenue > 0 ? ((filteredInvoicesByMonth.reduce((sum, inv) => {
                        const amount = getInvoiceAmount(inv);
                        const profit = amount - inv.cost - inv.expenses;
                        return sum + (profit - inv.commission - inv.salesCommission);
                      }, 0) / totalRevenue) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoice Analysis Section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Invoice Analysis</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      Filter invoices to analyze revenue, profit, and status breakdown
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-semibold rounded-full">
                    {filteredInvoices.length} of {filteredInvoicesByMonth.length} invoices
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  {renderInvoiceFilterBar()}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <p className="text-sm font-medium text-blue-600">Filtered Revenue</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">{formatINR(filteredRevenue)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <p className="text-sm font-medium text-green-600">Net Profit</p>
                      <p className="text-2xl font-bold text-green-700 mt-1">{formatINR(filteredNetProfit)}</p>
                    </div>
                    <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                      <p className="text-sm font-medium text-teal-600">Avg Invoice Value</p>
                      <p className="text-2xl font-bold text-teal-700 mt-1">
                        {formatINR(filteredInvoices.length > 0 ? filteredRevenue / filteredInvoices.length : 0)}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {filteredRevenue > 0 ? ((filteredNetProfit / filteredRevenue) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-base font-bold text-gray-900 mb-4">Shipping Status Breakdown</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Dispatch", value: filteredDispatchCount, color: "#eab308" },
                              { name: "In Transit", value: filteredInTransitCount, color: "#f97316" },
                              { name: "Delivered", value: filteredDeliveredCount, color: "#22c55e" },
                            ].filter((item) => item.value > 0)}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={4}
                            dataKey="value"
                            label={({ name, value }) => `${name}: ${value}`}
                          >
                            {[
                              { name: "Dispatch", value: filteredDispatchCount, color: "#eab308" },
                              { name: "In Transit", value: filteredInTransitCount, color: "#f97316" },
                              { name: "Delivered", value: filteredDeliveredCount, color: "#22c55e" },
                            ]
                              .filter((item) => item.value > 0)
                              .map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <h3 className="text-base font-bold text-gray-900 mb-4">Top Customers (Filtered)</h3>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={(() => {
                            const customerRevenue = new Map<string, number>();
                            filteredInvoices.forEach((inv) => {
                              const customer = getInvoiceClient(inv);
                              const amount = getInvoiceAmount(inv);
                              customerRevenue.set(customer, (customerRevenue.get(customer) || 0) + amount);
                            });
                            return Array.from(customerRevenue.entries())
                              .map(([name, revenue]) => ({ name, revenue }))
                              .sort((a, b) => b.revenue - a.revenue)
                              .slice(0, 5);
                          })()}
                          layout="vertical"
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="name" type="category" width={100} />
                          <Tooltip formatter={(value) => formatINR(Number(value))} />
                          <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-gray-900 mb-3">Filtered Invoices</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Invoice #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Person</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipping Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredInvoices.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                No invoices match the current filters.
                              </td>
                            </tr>
                          ) : (
                            [...filteredInvoices]
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .slice(0, 10)
                              .map((invoice) => (
                                <tr key={getInvoiceId(invoice)} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.invoiceNumber}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{getInvoiceClient(invoice)}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{invoice.salesPerson}</td>
                                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatINR(getInvoiceAmount(invoice))}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{formatDate(invoice.date)}</td>
                                  <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                                      {getShippingStatusLabel(invoice.status)}
                                    </span>
                                  </td>
                                </tr>
                              ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredInvoices.length > 10 && (
                      <p className="text-sm text-gray-500 mt-2">
                        Showing 10 of {filteredInvoices.length} filtered invoices. Go to Invoices tab for the full list.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Revenue Trend Chart */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(() => {
                      const last7Days = Array.from({ length: 7 }, (_, i) => {
                        const date = new Date();
                        date.setDate(date.getDate() - (6 - i));
                        return date.toISOString().split('T')[0];
                      });

                      return last7Days.map(date => {
                        const dayInvoices = filteredInvoicesByMonth.filter(inv =>
                          inv.date && inv.date.split('T')[0] === date
                        );
                        const revenue = dayInvoices.reduce((sum, inv) => sum + (getInvoiceAmount(inv) || 0), 0);
                        return {
                          date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                          revenue: revenue
                        };
                      });
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatINR(Number(value))} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Profit Analysis Chart */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Profit Analysis</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      {
                        name: 'Profit Breakdown',
                        'Profit Without Expense': filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost), 0),
                        'Profit': filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost - inv.expenses), 0),
                        'Net Profit': filteredInvoicesByMonth.reduce((sum, inv) => {
                          const amount = getInvoiceAmount(inv);
                          const profit = amount - inv.cost - inv.expenses;
                          return sum + (profit - inv.commission - inv.salesCommission);
                        }, 0)
                      }
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatINR(Number(value))} />
                      <Legend />
                      <Bar dataKey="Profit Without Expense" fill="#3b82f6" />
                      <Bar dataKey="Profit" fill="#10b981" />
                      <Bar dataKey="Net Profit" fill="#22c55e" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Customers */}
              <div className="grid grid-cols-1 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Top 5 Customers by Revenue</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={(() => {
                        const customerRevenue = new Map();
                        filteredInvoicesByMonth.forEach(inv => {
                          const customer = getInvoiceClient(inv);
                          const amount = getInvoiceAmount(inv);
                          customerRevenue.set(customer, (customerRevenue.get(customer) || 0) + amount);
                        });
                        return Array.from(customerRevenue.entries())
                          .map(([name, revenue]) => ({ name, revenue }))
                          .sort((a, b) => b.revenue - a.revenue)
                          .slice(0, 5);
                      })()}
                      layout="vertical"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip formatter={(value) => formatINR(Number(value))} />
                      <Bar dataKey="revenue" fill="#8b5cf6" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Recent Invoices Table */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900">
                    Recent Invoices
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Client
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Shipping Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredInvoicesByMonth.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {invoice.invoiceNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {getInvoiceClient(invoice)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                            {formatINR(getInvoiceAmount(invoice))}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {formatDate(invoice.date)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                                invoice.status
                              )}`}
                            >
                              {getShippingStatusLabel(invoice.status)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <button className="text-blue-600 hover:text-blue-800 font-medium mr-3">
                              View
                            </button>
                            <button className="text-green-600 hover:text-green-800 font-medium">
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition duration-200 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                  Add Invoice
                </button>
                <button className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition duration-200 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Generate Report
                </button>
                <button className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-xl shadow-lg transition duration-200 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Manage Clients
                </button>
              </div>
            </>
          )}

          {/* Invoices Tab Content */}
          {activeTab === "invoices" && (
            <>
              {/* Invoice Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{filteredInvoicesByMonth.length}</p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit Without Expense</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost), 0))}
                      </p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit</p>
                      <p className="text-3xl font-bold text-emerald-600 mt-2">
                        {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost - inv.expenses), 0))}
                      </p>
                    </div>
                    <div className="bg-emerald-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Net Profit</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {formatINR(filteredInvoicesByMonth.reduce((sum, inv) => {
                          const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses;
                          return sum + (profit - inv.commission - inv.salesCommission);
                        }, 0))}
                      </p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Invoice Button and Filters */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-gray-900">All Invoices</h2>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        // Export filtered invoices to Excel
                        const invoicesToExport = filteredInvoices;

                        if (invoicesToExport.length === 0) {
                          toast.error('No invoices to export!');
                          return;
                        }

                        // Prepare data for export
                        const exportData = invoicesToExport.map((invoice, index) => {
                          const amount = getInvoiceAmount(invoice);
                          const profit = amount - invoice.cost - invoice.expenses;
                          const netProfit = profit - invoice.commission - invoice.salesCommission;
                          const profitMargin = amount > 0 ? ((netProfit / amount) * 100).toFixed(2) : '0.00';

                          return {
                            'Sr. No.': index + 1,
                            'Invoice Number': invoice.invoiceNumber,
                            'Date': new Date(invoice.date).toLocaleDateString('en-IN'),
                            'Customer Name': invoice.customerName,
                            'Sales Person': invoice.salesPerson,
                            'Sale Item': invoice.saleItem.replace(/\n/g, ' | '),
                            'Cost': invoice.cost,
                            'Sale Amount': amount,
                            'Expenses': invoice.expenses,
                            'Commission': invoice.commission,
                            'Sales Commission': invoice.salesCommission,
                            'Profit (Without Expense)': amount - invoice.cost,
                            'Profit': profit,
                            'Net Profit': netProfit,
                            'Profit Margin (%)': profitMargin,
                            'Shipping Status': getShippingStatusLabel(invoice.status),
                            'Shipping Remarks': invoice.shippingRemarks || '',
                            'Remarks': invoice.remarks || ''
                          };
                        });

                        // Create workbook
                        const wb = XLSX.utils.book_new();
                        const ws = XLSX.utils.json_to_sheet(exportData);

                        // Set column widths
                        const colWidths = [
                          { wch: 8 },  // Sr. No.
                          { wch: 15 }, // Invoice Number
                          { wch: 12 }, // Date
                          { wch: 20 }, // Customer Name
                          { wch: 20 }, // Sales Person
                          { wch: 40 }, // Sale Item
                          { wch: 12 }, // Cost
                          { wch: 12 }, // Sale Amount
                          { wch: 12 }, // Expenses
                          { wch: 12 }, // Commission
                          { wch: 15 }, // Sales Commission
                          { wch: 18 }, // Profit (Without Expense)
                          { wch: 12 }, // Profit
                          { wch: 12 }, // Net Profit
                          { wch: 15 }, // Profit Margin (%)
                          { wch: 10 }, // Status
                          { wch: 30 }  // Remarks
                        ];
                        ws['!cols'] = colWidths;

                        XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

                        // Add summary sheet
                        const summaryData = [
                          ['Invoice Summary Report'],
                          ['Generated on', new Date().toLocaleString('en-IN')],
                          ['Total Invoices', invoicesToExport.length],
                          [''],
                          ['Financial Summary'],
                          ['Total Revenue', invoicesToExport.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0)],
                          ['Total Cost', invoicesToExport.reduce((sum, inv) => sum + inv.cost, 0)],
                          ['Total Expenses', invoicesToExport.reduce((sum, inv) => sum + inv.expenses, 0)],
                          ['Total Commission', invoicesToExport.reduce((sum, inv) => sum + inv.commission, 0)],
                          ['Total Sales Commission', invoicesToExport.reduce((sum, inv) => sum + inv.salesCommission, 0)],
                          ['Total Profit (Without Expense)', invoicesToExport.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost), 0)],
                          ['Total Profit', invoicesToExport.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost - inv.expenses), 0)],
                          ['Total Net Profit', invoicesToExport.reduce((sum, inv) => {
                            const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses;
                            return sum + (profit - inv.commission - inv.salesCommission);
                          }, 0)],
                          [''],
                          ['Shipping Status Breakdown'],
                          ['Dispatch', invoicesToExport.filter(inv => normalizeShippingStatus(inv.status) === 'dispatch').length],
                          ['In Transit', invoicesToExport.filter(inv => normalizeShippingStatus(inv.status) === 'intransit').length],
                          ['Delivered', invoicesToExport.filter(inv => normalizeShippingStatus(inv.status) === 'delivered').length],
                        ];
                        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                        XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

                        // Download file
                        const fileName = hasActiveInvoiceFilters
                          ? `Invoices_Filtered_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`
                          : `All_Invoices_${new Date().toLocaleDateString('en-IN').replace(/\//g, '-')}.xlsx`;

                        XLSX.writeFile(wb, fileName);
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export to Excel
                    </button>
                    <button
                      onClick={() => setShowAddInvoiceModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Invoice
                    </button>
                  </div>
                </div>

                {/* Filter Inputs */}
                {renderInvoiceFilterBar()}
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm font-medium text-gray-600 mb-1">Cost</p>
                  <p className="text-xl font-bold text-gray-900">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + inv.cost, 0))}
                  </p>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-medium text-blue-600 mb-1">Sale Amount</p>
                  <p className="text-xl font-bold text-blue-700">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0))}
                  </p>
                </div>

                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-sm font-medium text-red-600 mb-1">Expenses</p>
                  <p className="text-xl font-bold text-red-700">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + inv.expenses, 0))}
                  </p>
                </div>

                <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                  <p className="text-sm font-medium text-orange-600 mb-2">Commission</p>
                  <p className="text-xl font-bold text-orange-700 mb-2">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + inv.commission, 0))}
                  </p>
                  <div className="space-y-1 border-t border-orange-200 pt-2 mb-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Paid</span>
                      <span className="text-xs font-semibold text-green-600">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (inv.commissionPaidAmount || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Remaining</span>
                      <span className="text-xs font-semibold text-red-500">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (inv.commission - (inv.commissionPaidAmount || 0)), 0))}
                      </span>
                    </div>
                  </div>
                  {filteredInvoices.some((inv) => !inv.commissionPaid && inv.commission > 0) && (
                    <button
                      onClick={() => { setBulkPayType("commission"); setBulkPayRemarks(""); setShowBulkPayModal(true); }}
                      className="w-full flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Bulk Pay All
                    </button>
                  )}
                </div>

                <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                  <p className="text-sm font-medium text-pink-600 mb-2">Sales Commission</p>
                  <p className="text-xl font-bold text-pink-700 mb-2">
                    {formatINR(filteredInvoices.reduce((sum, inv) => sum + inv.salesCommission, 0))}
                  </p>
                  <div className="space-y-1 border-t border-pink-200 pt-2 mb-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Paid</span>
                      <span className="text-xs font-semibold text-green-600">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (inv.salesCommissionPaidAmount || 0), 0))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">Remaining</span>
                      <span className="text-xs font-semibold text-red-500">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (inv.salesCommission - (inv.salesCommissionPaidAmount || 0)), 0))}
                      </span>
                    </div>
                  </div>
                  {filteredInvoices.some((inv) => !inv.salesCommissionPaid && inv.salesCommission > 0) && (
                    <button
                      onClick={() => { setBulkPayType("salesCommission"); setBulkPayRemarks(""); setShowBulkPayModal(true); }}
                      className="w-full flex items-center justify-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors shadow-sm"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Bulk Pay All
                    </button>
                  )}
                </div>

                <div className="bg-teal-50 rounded-lg p-4 border border-teal-200">
                  <p className="text-sm font-medium text-teal-600 mb-1">Profit Margin</p>
                  <p className="text-xl font-bold text-teal-700">
                    {(() => {
                      const totalSaleAmount = filteredInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
                      const totalCost = filteredInvoices.reduce((sum, inv) => sum + inv.cost, 0);
                      const totalExpenses = filteredInvoices.reduce((sum, inv) => sum + inv.expenses, 0);
                      const totalCommission = filteredInvoices.reduce((sum, inv) => sum + inv.commission, 0);
                      const totalSalesCommission = filteredInvoices.reduce((sum, inv) => sum + inv.salesCommission, 0);
                      const netProfit = totalSaleAmount - totalCost - totalExpenses - totalCommission - totalSalesCommission;
                      const profitMargin = totalSaleAmount > 0 ? (netProfit / totalSaleAmount) * 100 : 0;
                      return `${profitMargin.toFixed(1)}%`;
                    })()}
                  </p>
                </div>
              </div>

              {/* Invoices Table */}
              <div className="space-y-4">
                {[...filteredInvoices].sort((a, b) => {
                  const dateA = new Date(a.date).getTime();
                  const dateB = new Date(b.date).getTime();
                  return dateB - dateA; // Sort by date descending (newest first)
                }).map((invoice) => {
                  const amount = getInvoiceAmount(invoice);
                  const profit = amount - invoice.cost - invoice.expenses;
                  const netProfit = profit - invoice.commission - invoice.salesCommission;
                  const clientName = getInvoiceClient(invoice);

                  return (
                    <div key={getInvoiceId(invoice)} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
                      {/* Header Section */}
                      <div className="flex items-start justify-between mb-4 pb-4 border-b border-gray-100">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                            {clientName.charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-gray-900">{clientName}</h3>
                            <p className="text-sm text-gray-500">Invoice: {invoice.invoiceNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 flex-wrap justify-end">
                          <div className="text-right max-w-xs mr-1">
                            <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                              {getShippingStatusLabel(invoice.status)}
                            </span>
                            {invoice.shippingRemarks?.trim() && (
                              <p className="text-sm text-gray-900 mt-1.5 break-words">
                                {invoice.shippingRemarks.trim()}
                              </p>
                            )}
                          </div>
                          {invoice.commission > 0 && (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${invoice.commissionPaid
                              ? "bg-green-100 text-green-700"
                              : (invoice.commissionPaidAmount || 0) > 0
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-orange-100 text-orange-700"
                              }`}>
                              Comm: {invoice.commissionPaid ? "Paid" : (invoice.commissionPaidAmount || 0) > 0 ? "Partial" : "Unpaid"}
                            </span>
                          )}
                          {invoice.salesCommission > 0 && (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${invoice.salesCommissionPaid
                              ? "bg-green-100 text-green-700"
                              : (invoice.salesCommissionPaidAmount || 0) > 0
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-pink-100 text-pink-700"
                              }`}>
                              Sales Comm: {invoice.salesCommissionPaid ? "Paid" : (invoice.salesCommissionPaidAmount || 0) > 0 ? "Partial" : "Unpaid"}
                            </span>
                          )}
                          <button
                            onClick={() => handleEditInvoice(invoice)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteInvoice(getInvoiceId(invoice))}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Sales Person & Sale Item */}
                      <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Sales Person:</span>
                            <span className="text-sm font-semibold text-blue-600 ml-2 bg-blue-50 px-2 py-1 rounded">{invoice.salesPerson}</span>
                          </div>
                          <div className="flex items-start">
                            <svg className="w-4 h-4 text-gray-400 mr-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1">
                              <span className="text-sm font-medium text-gray-700">Sale Item:</span>
                              <ul className="text-sm mt-2 space-y-2">
                                {invoice.saleItem.split('\n').filter(item => item.trim()).map((item, index) => {
                                  const colors = [
                                    'bg-blue-500',
                                    'bg-green-500',
                                    'bg-purple-500',
                                    'bg-orange-500',
                                    'bg-pink-500',
                                    'bg-teal-500',
                                    'bg-indigo-500',
                                    'bg-red-500'
                                  ];
                                  const colorClass = colors[index % colors.length];
                                  return (
                                    <li key={index} className="flex items-start">
                                      <span className={`inline-block w-2 h-2 rounded-full ${colorClass} mt-1.5 mr-2 shrink-0`}></span>
                                      <span className="text-gray-900 flex-1">{item.replace(/^[•\-\*]\s*/, '').trim()}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center mb-2">
                            <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-sm font-medium text-gray-700">Invoice Date:</span>
                            <span className="text-sm text-gray-900 ml-2">
                              {(() => {
                                const date = new Date(invoice.date);
                                const day = String(date.getDate()).padStart(2, '0');
                                const month = String(date.getMonth() + 1).padStart(2, '0');
                                const year = date.getFullYear();
                                return `${day}-${month}-${year}`;
                              })()}
                            </span>
                          </div>
                          {invoice.remarks && (
                            <div className="flex items-start">
                              <svg className="w-4 h-4 text-gray-400 mr-2 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                              </svg>
                              <div>
                                <span className="text-sm font-medium text-gray-700">Remarks:</span>
                                <p className="text-sm text-gray-900 mt-1">{invoice.remarks}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Transaction Details Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
                        {/* Cost */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Cost</p>
                          <p className="text-sm font-semibold text-gray-900">{formatINR(invoice.cost)}</p>
                        </div>

                        {/* Sale Amount */}
                        <div className="bg-blue-50 rounded-lg p-3">
                          <p className="text-xs text-blue-600 mb-1">Sale Amount</p>
                          <p className="text-sm font-bold text-blue-600">{formatINR(amount)}</p>
                        </div>

                        {/* Expenses */}
                        <div className="bg-red-50 rounded-lg p-3">
                          <p className="text-xs text-red-600 mb-1">Expenses</p>
                          <p className="text-sm font-semibold text-red-600">{formatINR(invoice.expenses)}</p>
                        </div>

                        {/* Commission */}
                        <div className="bg-orange-50 rounded-lg p-3 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-orange-600 mb-2 font-semibold">Commission</p>
                            {/* Breakdown rows */}
                            <div className="space-y-1 mb-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Total</span>
                                <span className="text-xs font-bold text-orange-700">{formatINR(invoice.commission)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Paid</span>
                                <span className="text-xs font-semibold text-green-600">{formatINR(invoice.commissionPaidAmount || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-orange-200 pt-1">
                                <span className="text-xs text-gray-500">Remaining</span>
                                <span className={`text-xs font-bold ${invoice.commissionPaid ? "text-gray-400" : "text-red-500"}`}>
                                  {formatINR(invoice.commission - (invoice.commissionPaidAmount || 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                          {invoice.commission > 0 && (
                            invoice.commissionPaid ? (
                              <div className="flex items-center justify-between bg-green-100 border border-green-300 rounded-lg px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-xs font-bold text-green-700">Fully Paid</span>
                                </div>
                                <button
                                  onClick={() => handleUndoCommission(getInvoiceId(invoice), "commission")}
                                  className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openPayCommissionModal(invoice, "commission")}
                                className="w-full flex items-center justify-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {(invoice.commissionPaidAmount || 0) > 0 ? "Pay Remaining" : "Pay Commission"}
                              </button>
                            )
                          )}
                        </div>

                        {/* Sales Commission */}
                        <div className="bg-pink-50 rounded-lg p-3 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-pink-600 mb-2 font-semibold">Sales Commission</p>
                            {/* Breakdown rows */}
                            <div className="space-y-1 mb-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Total</span>
                                <span className="text-xs font-bold text-pink-700">{formatINR(invoice.salesCommission)}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-500">Paid</span>
                                <span className="text-xs font-semibold text-green-600">{formatINR(invoice.salesCommissionPaidAmount || 0)}</span>
                              </div>
                              <div className="flex justify-between items-center border-t border-pink-200 pt-1">
                                <span className="text-xs text-gray-500">Remaining</span>
                                <span className={`text-xs font-bold ${invoice.salesCommissionPaid ? "text-gray-400" : "text-red-500"}`}>
                                  {formatINR(invoice.salesCommission - (invoice.salesCommissionPaidAmount || 0))}
                                </span>
                              </div>
                            </div>
                          </div>
                          {invoice.salesCommission > 0 && (
                            invoice.salesCommissionPaid ? (
                              <div className="flex items-center justify-between bg-green-100 border border-green-300 rounded-lg px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span className="text-xs font-bold text-green-700">Fully Paid</span>
                                </div>
                                <button
                                  onClick={() => handleUndoCommission(getInvoiceId(invoice), "salesCommission")}
                                  className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
                                >
                                  Undo
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => openPayCommissionModal(invoice, "salesCommission")}
                                className="w-full flex items-center justify-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-2 py-1.5 rounded-lg transition-colors shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                {(invoice.salesCommissionPaidAmount || 0) > 0 ? "Pay Remaining" : "Pay Sales Commission"}
                              </button>
                            )
                          )}
                        </div>

                        {/* Profit Margin */}
                        <div className="bg-teal-50 rounded-lg p-3">
                          <p className="text-xs text-teal-600 mb-1">Profit Margin</p>
                          <p className="text-sm font-bold text-teal-600">
                            {amount > 0 ? ((netProfit / amount) * 100).toFixed(1) : 0}%
                          </p>
                        </div>
                      </div>

                      {/* Profit Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-green-600 mb-1">Profit Without Expense</p>
                              <p className="text-sm text-gray-500">(Sale - Cost)</p>
                            </div>
                            <p className="text-lg font-bold text-green-600">{formatINR(amount - invoice.cost)}</p>
                          </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-green-600 mb-1">Profit</p>
                              <p className="text-sm text-gray-500">(Sale - Cost - Expenses)</p>
                            </div>
                            <p className="text-lg font-bold text-green-600">{formatINR(profit)}</p>
                          </div>
                        </div>

                        <div className="bg-green-100 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-green-700 mb-1">Net Profit</p>
                              <p className="text-sm text-gray-600">(Profit - Commissions)</p>
                            </div>
                            <p className="text-lg font-bold text-green-700">{formatINR(netProfit)}</p>
                          </div>
                        </div>
                      </div>

                      {/* Payment History */}
                      {(((invoice.commissionPayments?.length ?? 0) > 0) || ((invoice.salesCommissionPayments?.length ?? 0) > 0)) && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment History</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Commission payment history */}
                            {(invoice.commissionPayments?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-orange-600 mb-2">Commission Payments</p>
                                <div className="space-y-2">
                                  {invoice.commissionPayments!.map((txn, idx) => (
                                    <div key={txn._id || idx} className="flex items-start justify-between bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-green-600">{formatINR(txn.amount)}</span>
                                          <span className="text-xs text-gray-400">
                                            {new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                          </span>
                                        </div>
                                        {txn.remarks && (
                                          <p className="text-xs text-gray-500 mt-0.5 truncate">{txn.remarks}</p>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-400 ml-2 shrink-0">#{idx + 1}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Sales Commission payment history */}
                            {(invoice.salesCommissionPayments?.length ?? 0) > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-pink-600 mb-2">Sales Commission Payments</p>
                                <div className="space-y-2">
                                  {invoice.salesCommissionPayments!.map((txn, idx) => (
                                    <div key={txn._id || idx} className="flex items-start justify-between bg-pink-50 border border-pink-100 rounded-lg px-3 py-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-green-600">{formatINR(txn.amount)}</span>
                                          <span className="text-xs text-gray-400">
                                            {new Date(txn.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                          </span>
                                        </div>
                                        {txn.remarks && (
                                          <p className="text-xs text-gray-500 mt-0.5 truncate">{txn.remarks}</p>
                                        )}
                                      </div>
                                      <span className="text-xs text-gray-400 ml-2 shrink-0">#{idx + 1}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Filtered Totals Footer */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{filteredInvoices.length}</p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit Without Expense</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost), 0))}
                      </p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit</p>
                      <p className="text-3xl font-bold text-emerald-600 mt-2">
                        {formatINR(filteredInvoices.reduce((sum, inv) => sum + (getInvoiceAmount(inv) - inv.cost - inv.expenses), 0))}
                      </p>
                    </div>
                    <div className="bg-emerald-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Net Profit</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {formatINR(filteredInvoices.reduce((sum, inv) => {
                          const amount = getInvoiceAmount(inv);
                          const profit = amount - inv.cost - inv.expenses;
                          return sum + (profit - inv.commission - inv.salesCommission);
                        }, 0))}
                      </p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Customers Tab Content */}
          {activeTab === "clients" && (() => {
            // Filter clients by selected month for the table only
            const filteredClientsByMonth = selectedMonth === "all"
              ? clients
              : clients.filter(client => {
                if (!client.joinedDate) return false;
                const date = new Date(client.joinedDate);
                const clientMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                return clientMonth === selectedMonth;
              });

            // Calculate actual total amounts from invoices for each client
            const clientsWithCalculatedAmounts = clients.map(client => {
              const clientInvoices = invoices.filter(inv =>
                getInvoiceClient(inv).toLowerCase() === client.company.toLowerCase()
              );
              const calculatedTotal = clientInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
              const calculatedInvoiceCount = clientInvoices.length;

              return {
                ...client,
                totalAmount: calculatedTotal,
                totalInvoices: calculatedInvoiceCount
              };
            });

            // Compute customer statistics from ALL clients with calculated amounts
            const topCustomer = clientsWithCalculatedAmounts.length > 0
              ? [...clientsWithCalculatedAmounts].sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0))[0]
              : null;

            const recentCustomer = clientsWithCalculatedAmounts.length > 0
              ? [...clientsWithCalculatedAmounts].sort((a, b) => {
                const dateA = a.joinedDate ? new Date(a.joinedDate).getTime() : 0;
                const dateB = b.joinedDate ? new Date(b.joinedDate).getTime() : 0;
                return dateB - dateA;
              })[0]
              : null;

            const mostInvoicesCustomer = clientsWithCalculatedAmounts.length > 0
              ? [...clientsWithCalculatedAmounts].sort((a, b) => (b.totalInvoices || 0) - (a.totalInvoices || 0))[0]
              : null;

            return (
              <>
                {/* Customers Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Customers</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{clients.length}</p>
                      </div>
                      <div className="bg-blue-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Top Customer</h3>
                    {topCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {topCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{topCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{formatINR(topCustomer.totalAmount || 0)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Customer</h3>
                    {recentCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {recentCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{recentCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Joined {recentCustomer.joinedDate ? formatDate(recentCustomer.joinedDate) : 'N/A'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Most Invoices</h3>
                    {mostInvoicesCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {mostInvoicesCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{mostInvoicesCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{mostInvoicesCustomer.totalInvoices || 0} invoices</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>
                </div>

                {/* Add Customer Button */}
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">All Customers</h2>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowImportModal(true)}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      Import Customers
                    </button>
                    <button
                      onClick={() => setShowAddClientModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Customer
                    </button>
                  </div>
                </div>

                {/* Customers Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Company Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email Address
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredClientsByMonth.map((client) => (
                          <tr key={client._id || client.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3 shrink-0">
                                  {client.company?.charAt(0) || 'N'}
                                </div>
                                <div className="text-sm font-medium text-gray-900 wrap-break-word max-w-[280px]">
                                  {client.company || 'N/A'}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {client.email || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {client.phone || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {client.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleViewClient(client)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEditClient(client)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteClient(client._id || client.id || '')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Customer Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Customer</h3>
                    {topCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {topCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{topCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{formatINR(topCustomer.totalAmount || 0)}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Customer</h3>
                    {recentCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {recentCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{recentCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Joined {recentCustomer.joinedDate ? formatDate(recentCustomer.joinedDate) : 'N/A'}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Most Invoices</h3>
                    {mostInvoicesCustomer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                          {mostInvoicesCustomer.company?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{mostInvoicesCustomer.company || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{mostInvoicesCustomer.totalInvoices || 0} invoices</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No customers yet</p>
                    )}
                  </div>
                </div>
              </>
            );
          })()}

          {/* Sales Person Tab Content */}
          {activeTab === "salesman" && (() => {
            // Calculate actual totals from invoices and clients for each salesperson
            const salesmenWithCalculatedData = salesmen.map(salesman => {
              // Calculate total sales amount from invoices
              const salesmanInvoices = invoices.filter(inv =>
                inv.salesPerson?.toLowerCase() === salesman.name.toLowerCase()
              );
              const calculatedTotalSales = salesmanInvoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0);
              const calculatedTotalInvoices = salesmanInvoices.length;

              // Calculate total clients assigned to this salesperson
              const calculatedTotalClients = clients.filter(client =>
                // Assuming clients are linked to salesperson somehow, adjust this logic if needed
                client.name || client.company // Placeholder - adjust based on your data model
              ).length;

              return {
                ...salesman,
                totalSales: calculatedTotalSales,
                totalClients: calculatedTotalClients,
                totalInvoices: calculatedTotalInvoices
              };
            });

            // Compute salesperson statistics
            const topPerformer = salesmenWithCalculatedData.length > 0
              ? [...salesmenWithCalculatedData].sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))[0]
              : null;

            const recentSalesPerson = salesmenWithCalculatedData.length > 0
              ? [...salesmenWithCalculatedData].sort((a, b) => {
                const dateA = a.joinedDate ? new Date(a.joinedDate).getTime() : 0;
                const dateB = b.joinedDate ? new Date(b.joinedDate).getTime() : 0;
                return dateB - dateA;
              })[0]
              : null;

            const mostCustomers = salesmenWithCalculatedData.length > 0
              ? [...salesmenWithCalculatedData].sort((a, b) => (b.totalClients || 0) - (a.totalClients || 0))[0]
              : null;

            return (
              <>
                {/* Sales Person Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Sales People</p>
                        <p className="text-3xl font-bold text-gray-900 mt-2">{salesmen.length}</p>
                      </div>
                      <div className="bg-blue-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Top Performer</h3>
                    {topPerformer ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {topPerformer.name?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{topPerformer.name || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{formatINR(topPerformer.totalSales || 0)}</p>
                          <p className="text-xs text-gray-500">{topPerformer.totalInvoices || 0} invoices • {topPerformer.totalClients || 0} clients</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Recent Sales Person</h3>
                    {recentSalesPerson ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {recentSalesPerson.name?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{recentSalesPerson.name || 'N/A'}</p>
                          <p className="text-sm text-gray-600">Joined {formatDate(recentSalesPerson.joinedDate || '')}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data</p>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Most Customers</h3>
                    {mostCustomers ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-linear-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {mostCustomers.name?.charAt(0) || 'N'}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{mostCustomers.name || 'N/A'}</p>
                          <p className="text-sm text-gray-600">{formatINR(mostCustomers.totalSales || 0)}</p>
                          <p className="text-xs text-gray-500">{mostCustomers.totalInvoices || 0} invoices • {mostCustomers.totalClients || 0} clients</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No data</p>
                    )}
                  </div>
                </div>

                {/* Add Sales Person Button */}
                <div className="mb-6 flex justify-between items-center">
                  <h2 className="text-xl font-bold text-gray-900">All Sales People</h2>
                  <button
                    onClick={() => setShowAddSalesmanModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Add New Sales Person
                  </button>
                </div>

                {/* Sales People Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Employee ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Full Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email Address
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone Number
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {salesmen.map((salesman) => (
                          <tr key={salesman._id || salesman.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                                  {salesman.name.charAt(0)}
                                </div>
                                <div className="text-sm font-medium text-gray-900">{salesman.employeeId}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                              {salesman.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {salesman.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                              {salesman.phone}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-semibold ${salesman.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                                  }`}
                              >
                                {salesman.status.charAt(0).toUpperCase() + salesman.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => handleViewSalesman(salesman)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="View"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEditSalesman(salesman)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteSalesman(salesman._id || salesman.id || '')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}

          {/* Reports Tab Content */}
          {activeTab === "reports" && (
            <>
              {/* Export Report Header */}
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Business Analytics Report</h2>
                  <p className="text-sm text-gray-600 mt-1">Comprehensive insights and performance metrics</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      // Export to Excel
                      const reportData = {
                        summary: {
                          totalRevenue: invoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0),
                          totalProfit: invoices.reduce((sum, inv) => {
                            const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses;
                            return sum + (profit - inv.commission - inv.salesCommission);
                          }, 0),
                          totalExpenses: invoices.reduce((sum, inv) => sum + inv.expenses + inv.commission + inv.salesCommission, 0),
                          profitMargin: invoices.length > 0 ? (
                            ((invoices.reduce((sum, inv) => {
                              const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses - inv.commission - inv.salesCommission;
                              return sum + profit;
                            }, 0) / invoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0)) * 100).toFixed(1)
                          ) : 0,
                          totalInvoices: invoices.length,
                          totalCustomers: clients.length,
                          totalSalesPeople: salesmen.length,
                          dispatchInvoices: invoices.filter(inv => normalizeShippingStatus(inv.status) === 'dispatch').length,
                          inTransitInvoices: invoices.filter(inv => normalizeShippingStatus(inv.status) === 'intransit').length,
                          deliveredInvoices: invoices.filter(inv => normalizeShippingStatus(inv.status) === 'delivered').length,
                        }
                      };

                      // Create workbook
                      const wb = XLSX.utils.book_new();

                      // Summary Sheet
                      const summaryData = [
                        ['Business Analytics Report'],
                        ['Generated on', new Date().toLocaleDateString()],
                        [''],
                        ['Financial Summary'],
                        ['Total Revenue', reportData.summary.totalRevenue],
                        ['Total Profit', reportData.summary.totalProfit],
                        ['Total Expenses', reportData.summary.totalExpenses],
                        ['Profit Margin (%)', reportData.summary.profitMargin],
                        [''],
                        ['Business Metrics'],
                        ['Total Invoices', reportData.summary.totalInvoices],
                        ['Total Customers', reportData.summary.totalCustomers],
                        ['Total Sales People', reportData.summary.totalSalesPeople],
                        ['Average Invoice Value', reportData.summary.totalInvoices > 0 ? reportData.summary.totalRevenue / reportData.summary.totalInvoices : 0],
                        [''],
                        ['Shipping Status'],
                        ['Dispatch', reportData.summary.dispatchInvoices],
                        ['In Transit', reportData.summary.inTransitInvoices],
                        ['Delivered', reportData.summary.deliveredInvoices],
                      ];
                      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

                      // Top Customers Sheet
                      const customerRevenue: { [key: string]: number } = {};
                      invoices.forEach(inv => {
                        const customer = inv.customerName;
                        if (customer) {
                          if (!customerRevenue[customer]) customerRevenue[customer] = 0;
                          customerRevenue[customer] += getInvoiceAmount(inv);
                        }
                      });

                      const topCustomersData = [
                        ['Top Customers by Revenue'],
                        ['Rank', 'Customer Name', 'Total Revenue'],
                        ...Object.entries(customerRevenue)
                          .sort(([, a], [, b]) => (b as number) - (a as number))
                          .slice(0, 10)
                          .map(([customer, revenue], index) => [index + 1, customer, revenue])
                      ];
                      const wsCustomers = XLSX.utils.aoa_to_sheet(topCustomersData);
                      XLSX.utils.book_append_sheet(wb, wsCustomers, 'Top Customers');

                      // Sales Performance Sheet
                      const salesPerformanceData = [
                        ['Sales Person Performance'],
                        ['Rank', 'Sales Person', 'Total Sales', 'Invoice Count'],
                        ...salesmen
                          .map(sp => ({
                            name: sp.name,
                            totalSales: sp.totalSales,
                            invoices: invoices.filter(inv => inv.salesPerson === sp.name).length
                          }))
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .slice(0, 10)
                          .map((sp, index) => [index + 1, sp.name, sp.totalSales, sp.invoices])
                      ];
                      const wsSales = XLSX.utils.aoa_to_sheet(salesPerformanceData);
                      XLSX.utils.book_append_sheet(wb, wsSales, 'Sales Performance');

                      // Monthly Trend Sheet
                      const monthlyData: { [key: string]: { revenue: number; profit: number; month: string } } = {};
                      invoices.forEach(inv => {
                        const date = new Date(inv.date);
                        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                        if (!monthlyData[monthKey]) {
                          monthlyData[monthKey] = { month: monthName, revenue: 0, profit: 0 };
                        }

                        monthlyData[monthKey].revenue += getInvoiceAmount(inv);
                        const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses - inv.commission - inv.salesCommission;
                        monthlyData[monthKey].profit += profit;
                      });

                      const monthlyTrendData = [
                        ['Monthly Revenue Trend'],
                        ['Month', 'Revenue', 'Profit'],
                        ...Object.keys(monthlyData)
                          .sort()
                          .map(key => [monthlyData[key].month, monthlyData[key].revenue, monthlyData[key].profit])
                      ];
                      const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyTrendData);
                      XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Trend');

                      // Download
                      XLSX.writeFile(wb, `Business_Analytics_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200 flex items-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export to Excel
                  </button>
                </div>
              </div>

              {/* Financial Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                      <p className="text-3xl font-bold text-blue-600 mt-2">
                        {formatINR(invoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0))}
                      </p>
                    </div>
                    <div className="bg-blue-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Profit</p>
                      <p className="text-3xl font-bold text-green-600 mt-2">
                        {formatINR(invoices.reduce((sum, inv) => {
                          const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses;
                          return sum + (profit - inv.commission - inv.salesCommission);
                        }, 0))}
                      </p>
                    </div>
                    <div className="bg-green-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                      <p className="text-3xl font-bold text-orange-600 mt-2">
                        {formatINR(invoices.reduce((sum, inv) => sum + inv.expenses + inv.commission + inv.salesCommission, 0))}
                      </p>
                    </div>
                    <div className="bg-orange-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Profit Margin</p>
                      <p className="text-3xl font-bold text-purple-600 mt-2">
                        {invoices.length > 0 ? (
                          ((invoices.reduce((sum, inv) => {
                            const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses - inv.commission - inv.salesCommission;
                            return sum + profit;
                          }, 0) / invoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0)) * 100).toFixed(1)
                        ) : 0}%
                      </p>
                    </div>
                    <div className="bg-purple-100 rounded-full p-3">
                      <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue Trend Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={(() => {
                    const monthlyData: { [key: string]: { revenue: number; profit: number; month: string } } = {};
                    invoices.forEach(inv => {
                      const date = new Date(inv.date);
                      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                      if (!monthlyData[monthKey]) {
                        monthlyData[monthKey] = { month: monthName, revenue: 0, profit: 0 };
                      }

                      monthlyData[monthKey].revenue += getInvoiceAmount(inv);
                      const profit = getInvoiceAmount(inv) - inv.cost - inv.expenses - inv.commission - inv.salesCommission;
                      monthlyData[monthKey].profit += profit;
                    });

                    return Object.keys(monthlyData)
                      .sort()
                      .slice(-6)
                      .map(key => monthlyData[key]);
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="month" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number) => formatINR(value)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} name="Revenue" />
                    <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} name="Profit" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Analytics Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Top Customers */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Top Customers by Revenue</h3>
                  <div className="space-y-4">
                    {(() => {
                      const customerRevenue: { [key: string]: number } = {};
                      invoices.forEach(inv => {
                        const customer = inv.customerName;
                        if (customer) {
                          if (!customerRevenue[customer]) customerRevenue[customer] = 0;
                          customerRevenue[customer] += getInvoiceAmount(inv);
                        }
                      });

                      return Object.entries(customerRevenue)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .slice(0, 5)
                        .map(([customer, revenue], index) => {
                          const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500'];
                          return (
                            <div key={customer} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 ${colors[index]} rounded-full flex items-center justify-center text-white font-bold`}>
                                  {index + 1}
                                </div>
                                <span className="font-semibold text-gray-900">{customer}</span>
                              </div>
                              <span className="text-lg font-bold text-blue-600">{formatINR(revenue)}</span>
                            </div>
                          );
                        });
                    })()}
                  </div>
                </div>

                {/* Top Sales Person */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Top Sales Person</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={(() => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                          return salesmen
                            .sort((a, b) => b.totalSales - a.totalSales)
                            .slice(0, 5)
                            .map((sp, idx) => ({
                              name: sp.name,
                              value: sp.totalSales,
                              color: colors[idx]
                            }));
                        })()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {salesmen
                          .sort((a, b) => b.totalSales - a.totalSales)
                          .slice(0, 5)
                          .map((_, index) => {
                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                            return <Cell key={`cell-${index}`} fill={colors[index]} />;
                          })}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatINR(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sales Performance Chart */}
              <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Sales Person Performance</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={(() => {
                    return salesmen.map(sp => ({
                      name: sp.name,
                      totalSales: sp.totalSales,
                      invoices: invoices.filter(inv => inv.salesPerson === sp.name).length
                    })).sort((a, b) => b.totalSales - a.totalSales).slice(0, 10);
                  })()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                      formatter={(value: number, name: string) => {
                        if (name === 'totalSales') return [formatINR(value), 'Total Sales'];
                        return [value, 'Invoices'];
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalSales" fill="#3b82f6" name="Total Sales" />
                    <Bar dataKey="invoices" fill="#10b981" name="Invoice Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Additional Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Business Metrics */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Business Metrics</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Average Invoice Value</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {invoices.length > 0 ? formatINR(invoices.reduce((sum, inv) => sum + getInvoiceAmount(inv), 0) / invoices.length) : formatINR(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Cost</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatINR(invoices.reduce((sum, inv) => sum + inv.cost, 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Commissions</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {formatINR(invoices.reduce((sum, inv) => sum + inv.commission + inv.salesCommission, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Customer & Sales Stats */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Customer & Sales</h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Customers</p>
                      <p className="text-2xl font-bold text-blue-600">{clients.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Total Sales People</p>
                      <p className="text-2xl font-bold text-green-600">{salesmen.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Avg Invoices per Customer</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {clients.length > 0 ? (invoices.length / clients.length).toFixed(1) : '0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Settings Tab Content */}
          {activeTab === "settings" && (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Manage your account and application preferences</p>
              </div>

              {/* Settings Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Security Settings */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
                  <div className="flex items-center mb-6">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Security Settings</h3>
                      <p className="text-sm text-gray-600">Manage password and security options</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <form onSubmit={handleChangePassword} className="space-y-4">
                      {passwordError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                          {passwordError}
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                          {passwordSuccess}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Current Password</label>
                        <input
                          type="password"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                          placeholder="Enter current password"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">New Password</label>
                        <input
                          type="password"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                          placeholder="Enter new password"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-900"
                          placeholder="Confirm new password"
                          required
                        />
                      </div>
                      <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 rounded-lg transition duration-200">
                        Change Password
                      </button>
                    </form>
                    <div className="space-y-4">
                      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="font-semibold text-gray-900 mb-3">Password Requirements</h4>
                        <ul className="space-y-2 text-sm text-gray-600">
                          <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            At least 8 characters long
                          </li>
                          <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Contains uppercase letter
                          </li>
                          <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Contains lowercase letter
                          </li>
                          <li className="flex items-center">
                            <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Contains number or symbol
                          </li>
                        </ul>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">Security Tip</h4>
                            <p className="text-sm text-gray-600">Use a strong, unique password and enable two-factor authentication for better security.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* About & Version */}
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100 lg:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">About Application</h3>
                        <p className="text-sm text-gray-600">Version and system information</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Version</p>
                      <p className="text-lg font-bold text-gray-900">1.0.0</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Records</p>
                      <p className="text-lg font-bold text-gray-900">{invoices.length + clients.length + salesmen.length}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Last Updated</p>
                      <p className="text-lg font-bold text-gray-900">{new Date().toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                </div>

              </div>
            </>
          )}

          {/* Office Expenses Tab Content */}
          {activeTab === "office-expenses" && (() => {
            // Filter by month
            const filteredExpensesByMonth = selectedMonth === "all"
              ? officeExpenses
              : officeExpenses.filter(exp => {
                if (!exp.date) return false;
                const d = new Date(exp.date);
                const expMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                return expMonth === selectedMonth;
              });

            // Filter by category & search term
            const displayExpenses = filteredExpensesByMonth.filter(exp => {
              const matchesSearch = searchOfficeExpense === "" ||
                exp.title.toLowerCase().includes(searchOfficeExpense.toLowerCase()) ||
                (exp.paidTo && exp.paidTo.toLowerCase().includes(searchOfficeExpense.toLowerCase())) ||
                (exp.remarks && exp.remarks.toLowerCase().includes(searchOfficeExpense.toLowerCase()));

              const matchesCategory = filterExpenseCategory === "all" || exp.category === filterExpenseCategory;
              return matchesSearch && matchesCategory;
            });

            const totalAmount = filteredExpensesByMonth.reduce((sum, exp) => sum + exp.amount, 0);

            // Calculate total net profit from invoices for the selected month to compute Profit with Expenses
            const totalInvoiceNetProfit = invoices.filter(inv => {
              if (selectedMonth === "all") return true;
              if (!inv.date) return false;
              const d = new Date(inv.date);
              const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              return m === selectedMonth;
            }).reduce((sum, inv) => {
              const amount = getInvoiceAmount(inv);
              const profit = amount - inv.cost - inv.expenses;
              return sum + (profit - inv.commission - inv.salesCommission);
            }, 0);

            const profitWithExpenses = totalInvoiceNetProfit - totalAmount;

            const categories = ["Rent", "Utilities", "Supplies", "Salaries", "Maintenance", "Travel", "Miscellaneous"];
            const categoryTotals: { [key: string]: number } = {};
            filteredExpensesByMonth.forEach(exp => {
              categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
            });
            const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
            const topCategory = topCategoryEntry ? topCategoryEntry[0] : "N/A";

            return (
              <>
                {/* Office Expenses Header & Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Office Expenses Directory</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage and track your operational and office expenditures</p>
                  </div>
                  <button
                    onClick={() => {
                      let defaultDate = new Date().toISOString().split("T")[0];
                      if (selectedMonth && selectedMonth !== "all") {
                        if (!defaultDate.startsWith(selectedMonth)) {
                          defaultDate = `${selectedMonth}-01`;
                        }
                      }
                      setNewOfficeExpense({
                        title: "",
                        category: "Utilities",
                        amount: "",
                        date: defaultDate,
                        paymentMethod: "Cash",
                        paidTo: "",
                        remarks: "",
                      });
                      setShowAddOfficeExpenseModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-lg transition duration-200 flex items-center justify-center space-x-2 shadow-md"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Add Office Expense</span>
                  </button>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Office Expenses</p>
                        <p className="text-2xl font-bold text-red-600 mt-2">{formatINR(totalAmount)}</p>
                      </div>
                      <div className="bg-red-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Expense Records</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">{filteredExpensesByMonth.length}</p>
                      </div>
                      <div className="bg-blue-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Top Expense Category</p>
                        <p className="text-xl font-bold text-purple-600 mt-2 truncate max-w-[150px]">{topCategory}</p>
                      </div>
                      <div className="bg-purple-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Average Per Record</p>
                        <p className="text-2xl font-bold text-amber-600 mt-2">
                          {formatINR(filteredExpensesByMonth.length > 0 ? totalAmount / filteredExpensesByMonth.length : 0)}
                        </p>
                      </div>
                      <div className="bg-amber-100 rounded-full p-3">
                        <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Final Profit - Office Expenses</p>
                        <p className={`text-2xl font-bold mt-2 ${profitWithExpenses >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {formatINR(profitWithExpenses)}
                        </p>
                      </div>
                      <div className={`${profitWithExpenses >= 0 ? "bg-emerald-100" : "bg-red-100"} rounded-full p-3`}>
                        <svg className={`w-8 h-8 ${profitWithExpenses >= 0 ? "text-emerald-600" : "text-red-600"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12M6 8h12M6 13l8.5 8M6 13h3a4 4 0 0 0 0-8" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                  <div className="relative w-full md:w-80">
                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search title, vendor, remarks..."
                      value={searchOfficeExpense}
                      onChange={(e) => setSearchOfficeExpense(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Category:</label>
                    <select
                      value={filterExpenseCategory}
                      onChange={(e) => setFilterExpenseCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Expenses Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  {displayExpenses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                      <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-lg font-medium text-gray-700">No Office Expenses Found</p>
                      <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or click 'Add Office Expense' to add one.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <th className="py-3 px-4">Title / Description</th>
                            <th className="py-3 px-4">Category</th>
                            <th className="py-3 px-4">Amount</th>
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">Payment Method</th>
                            <th className="py-3 px-4">Paid To</th>
                            <th className="py-3 px-4">Remarks</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                          {displayExpenses.map((exp) => (
                            <tr key={exp._id || exp.id} className="hover:bg-gray-50/80 transition-colors">
                              <td className="py-3.5 px-4 font-semibold text-gray-900">{exp.title}</td>
                              <td className="py-3.5 px-4">
                                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-red-600">{formatINR(exp.amount)}</td>
                              <td className="py-3.5 px-4 text-gray-600">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">
                                    {new Date(exp.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                  </span>
                                  <span className="text-xs text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-0.5 border border-blue-100">
                                    {new Date(exp.date).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                  {exp.paymentMethod}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-gray-700">{exp.paidTo || "-"}</td>
                              <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{exp.remarks || "-"}</td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end space-x-2">
                                  <button
                                    onClick={() => handleEditOfficeExpense(exp)}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteOfficeExpense(exp._id || exp.id || "")}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </main>
      </div>

      {/* Add Customer Modal */}
      {showAddClientModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add Customer</h3>
              <button
                onClick={() => {
                  setShowAddClientModal(false);
                  setNewClient({ name: "", email: "", phone: "", company: "", address: "" });
                }}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddClient} className="p-6 space-y-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              {/* Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Company Field */}
                <div>
                  <label htmlFor="clientCompany" className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="clientCompany"
                      value={newClient.company}
                      onChange={(e) => setNewClient({ ...newClient, company: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="clientEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      id="clientEmail"
                      value={newClient.email}
                      onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div>
                  <label htmlFor="clientPhone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      id="clientPhone"
                      value={newClient.phone}
                      onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                </div>

                {/* Name Field */}
                <div>
                  <label htmlFor="clientName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="clientName"
                      value={newClient.name}
                      onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="Enter client name"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Company Address Field - Full Width */}
              <div>
                <label htmlFor="clientAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <textarea
                    id="clientAddress"
                    value={newClient.address}
                    onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition resize-none text-gray-900 placeholder:text-gray-400"
                    placeholder="Street, City, State, PIN Code"
                    required
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddClientModal(false);
                    setNewClient({ name: "", email: "", phone: "", company: "", address: "" });
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-lg"
                >
                  Add Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Customer Modal */}
      {showEditClientModal && editingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Customer</h3>
              <button
                onClick={() => {
                  setShowEditClientModal(false);
                  setEditingClient(null);
                }}
                className="text-white hover:bg-green-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateClient} className="p-6 space-y-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              {/* Two Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Company Field */}
                <div>
                  <label htmlFor="editClientCompany" className="block text-sm font-semibold text-gray-700 mb-2">
                    Company Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="editClientCompany"
                      value={editingClient.company}
                      onChange={(e) => setEditingClient({ ...editingClient, company: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="Enter company name"
                      required
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div>
                  <label htmlFor="editClientEmail" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      id="editClientEmail"
                      value={editingClient.email}
                      onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="client@example.com"
                      required
                    />
                  </div>
                </div>

                {/* Phone Field */}
                <div>
                  <label htmlFor="editClientPhone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      type="tel"
                      id="editClientPhone"
                      value={editingClient.phone}
                      onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="+91 98765 43210"
                      required
                    />
                  </div>
                </div>

                {/* Name Field */}
                <div>
                  <label htmlFor="editClientName" className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="editClientName"
                      value={editingClient.name}
                      onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                      placeholder="Enter client name"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Company Address Field - Full Width */}
              <div>
                <label htmlFor="editClientAddress" className="block text-sm font-semibold text-gray-700 mb-2">
                  Company Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute top-3 left-0 pl-3 flex items-start pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <textarea
                    id="editClientAddress"
                    value={editingClient.address}
                    onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                    rows={3}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition resize-none text-gray-900 placeholder:text-gray-400"
                    placeholder="Street, City, State, PIN Code"
                    required
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClientModal(false);
                    setEditingClient(null);
                  }}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-4 py-3 text-white font-semibold rounded-lg transition duration-200 shadow-lg flex items-center justify-center ${isSubmitting ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    "Update Customer"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Customer Modal */}
      {showViewClientModal && viewingClient && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-xl font-bold text-white">Customer Details</h3>
              <button
                onClick={() => {
                  setShowViewClientModal(false);
                  setViewingClient(null);
                }}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="flex items-center space-x-4 pb-6 border-b border-gray-200">
                  <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                    {viewingClient.company.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">{viewingClient.company}</h4>
                    <p className="text-sm text-gray-500 mt-1">Contact: {viewingClient.name}</p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${viewingClient.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                        }`}
                    >
                      {viewingClient.status.charAt(0).toUpperCase() + viewingClient.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h5>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Contact Person</p>
                        <p className="text-gray-900 font-medium">{viewingClient.name}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-gray-900 font-medium">{viewingClient.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="text-gray-900 font-medium">{viewingClient.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="text-gray-900 font-medium">{viewingClient.address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Joined Date</span>
                      <span className="text-gray-900 font-medium">{formatDate(viewingClient.joinedDate)}</span>
                    </div>
                    {viewingClient.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created At</span>
                        <span className="text-gray-900 font-medium">{formatDate(viewingClient.createdAt)}</span>
                      </div>
                    )}
                    {viewingClient.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Updated</span>
                        <span className="text-gray-900 font-medium">{formatDate(viewingClient.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewClientModal(false);
                    setViewingClient(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewClientModal(false);
                    setViewingClient(null);
                    handleEditClient(viewingClient);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition shadow-lg"
                >
                  Edit Client
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Customers Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Import Customers</h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-white hover:bg-green-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-gray-600">
                  Upload an Excel file containing client information. The file should include columns in this order:
                </p>
                <a
                  href="/customer-import-template.xlsx"
                  download
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Template
                </a>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full mr-3 flex items-center justify-center text-xs font-bold">1</span>
                    Company Name
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full mr-3 flex items-center justify-center text-xs font-bold">2</span>
                    Email Address
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full mr-3 flex items-center justify-center text-xs font-bold">3</span>
                    Phone Number
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full mr-3 flex items-center justify-center text-xs font-bold">4</span>
                    Full Name
                  </li>
                  <li className="flex items-center">
                    <span className="w-6 h-6 bg-blue-500 text-white rounded-full mr-3 flex items-center justify-center text-xs font-bold">5</span>
                    Company Address
                  </li>
                </ul>
              </div>

              {/* File Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-green-500 transition">
                <input
                  type="file"
                  id="fileUpload"
                  accept=".xlsx,.xls"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <label htmlFor="fileUpload" className="cursor-pointer">
                  <div className="flex flex-col items-center">
                    <svg className="w-16 h-16 text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-lg font-semibold text-gray-700 mb-2">
                      Click to upload Excel file
                    </p>
                    <p className="text-sm text-gray-500">
                      XLSX or XLS only (MAX. 5MB)
                    </p>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Trigger file input click
                    document.getElementById('fileUpload')?.click();
                  }}
                  className="flex-1 px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition duration-200 shadow-lg"
                >
                  Choose File
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Sales Person Modal */}
      {showAddSalesmanModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add New Sales Person</h3>
              <button
                onClick={() => {
                  setShowAddSalesmanModal(false);
                  setNewSalesman({ name: "", email: "", phone: "", employeeId: "", address: "" });
                }}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddSalesman} className="p-6 space-y-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Employee ID */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSalesman.employeeId}
                    onChange={(e) => setNewSalesman({ ...newSalesman, employeeId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter employee ID"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newSalesman.name}
                    onChange={(e) => setNewSalesman({ ...newSalesman, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter full name"
                  />
                </div>

                {/* Email Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newSalesman.email}
                    onChange={(e) => setNewSalesman({ ...newSalesman, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter email address"
                  />
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={newSalesman.phone}
                    onChange={(e) => setNewSalesman({ ...newSalesman, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              {/* Address (Full Width) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  value={newSalesman.address}
                  onChange={(e) => setNewSalesman({ ...newSalesman, address: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter complete address"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddSalesmanModal(false);
                    setNewSalesman({ name: "", email: "", phone: "", employeeId: "", address: "" });
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-lg"
                >
                  Add Sales Person
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Sales Person Modal */}
      {showEditSalesmanModal && editingSalesman && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-xl font-bold text-white">Edit Sales Person</h3>
              <button
                onClick={() => {
                  setShowEditSalesmanModal(false);
                  setEditingSalesman(null);
                }}
                className="text-white hover:bg-green-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateSalesman} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingSalesman.name}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, name: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={editingSalesman.email}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={editingSalesman.phone}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employee ID <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingSalesman.employeeId}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, employeeId: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={editingSalesman.address}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, address: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingSalesman.status}
                    onChange={(e) => setEditingSalesman({ ...editingSalesman, status: e.target.value as "active" | "inactive" })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-900"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditSalesmanModal(false);
                    setEditingSalesman(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-6 py-3 text-white rounded-lg font-medium transition shadow-lg flex items-center justify-center ${isSubmitting ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    "Update Sales Person"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Sales Person Modal */}
      {showViewSalesmanModal && viewingSalesman && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-xl font-bold text-white">Sales Person Details</h3>
              <button
                onClick={() => {
                  setShowViewSalesmanModal(false);
                  setViewingSalesman(null);
                }}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Profile Section */}
                <div className="flex items-center space-x-4 pb-6 border-b border-gray-200">
                  <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-3xl">
                    {viewingSalesman.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold text-gray-900">{viewingSalesman.name}</h4>
                    <p className="text-sm text-gray-500 mt-1">Employee ID: {viewingSalesman.employeeId}</p>
                    <span
                      className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${viewingSalesman.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                        }`}
                    >
                      {viewingSalesman.status.charAt(0).toUpperCase() + viewingSalesman.status.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h5>
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Email</p>
                        <p className="text-gray-900 font-medium">{viewingSalesman.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Phone</p>
                        <p className="text-gray-900 font-medium">{viewingSalesman.phone}</p>
                      </div>
                    </div>

                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-400 mr-3 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-gray-500">Address</p>
                        <p className="text-gray-900 font-medium">{viewingSalesman.address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Information */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h5>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Joined Date</span>
                      <span className="text-gray-900 font-medium">{formatDate(viewingSalesman.joinedDate)}</span>
                    </div>
                    {viewingSalesman.createdAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created At</span>
                        <span className="text-gray-900 font-medium">{formatDate(viewingSalesman.createdAt)}</span>
                      </div>
                    )}
                    {viewingSalesman.updatedAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Updated</span>
                        <span className="text-gray-900 font-medium">{formatDate(viewingSalesman.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowViewSalesmanModal(false);
                    setViewingSalesman(null);
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowViewSalesmanModal(false);
                    setViewingSalesman(null);
                    handleEditSalesman(viewingSalesman);
                  }}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition shadow-lg"
                >
                  Edit Sales Person
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pay Commission Modal */}
      {showPayCommissionModal && payCommissionData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="bg-linear-to-r from-orange-500 to-orange-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Pay {payCommissionData.type === "commission" ? "Commission" : "Sales Commission"}
                  </h2>
                  <p className="text-orange-100 text-xs">Invoice #{payCommissionData.invoiceNumber}</p>
                </div>
              </div>
              <button
                onClick={() => { setShowPayCommissionModal(false); setPayCommissionData(null); }}
                className="text-white hover:text-orange-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Summary */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-5">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Type</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {payCommissionData.type === "commission" ? "Commission" : "Sales Commission"}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Sales Person</span>
                  <span className="text-sm font-semibold text-gray-900">{payCommissionData.salesPerson}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Commission</span>
                  <span className="text-sm font-semibold text-gray-900">{formatINR(payCommissionData.totalAmount)}</span>
                </div>
                {payCommissionData.alreadyPaid > 0 && (
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Already Paid</span>
                    <span className="text-sm font-semibold text-green-600">{formatINR(payCommissionData.alreadyPaid)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-orange-200 pt-2 mt-2">
                  <span className="text-sm font-bold text-gray-700">Remaining Balance</span>
                  <span className="text-lg font-bold text-orange-600">{formatINR(payCommissionData.totalAmount - payCommissionData.alreadyPaid)}</span>
                </div>
              </div>

              {/* Amount to Pay */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Amount to Pay
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    min={1}
                    max={payCommissionData.totalAmount - payCommissionData.alreadyPaid}
                    step={0.01}
                    value={payCommissionData.payAmount || ""}
                    onChange={(e) =>
                      setPayCommissionData({ ...payCommissionData, payAmount: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 font-semibold"
                  />
                </div>
                <div className="flex gap-3 mt-2">
                  <button
                    type="button"
                    onClick={() => setPayCommissionData({ ...payCommissionData, payAmount: payCommissionData.totalAmount - payCommissionData.alreadyPaid })}
                    className="text-xs text-orange-600 hover:text-orange-700 font-semibold underline"
                  >
                    Pay Full Remaining
                  </button>
                  {payCommissionData.totalAmount - payCommissionData.alreadyPaid > 1 && (
                    <button
                      type="button"
                      onClick={() => setPayCommissionData({ ...payCommissionData, payAmount: Math.floor((payCommissionData.totalAmount - payCommissionData.alreadyPaid) / 2) })}
                      className="text-xs text-gray-500 hover:text-gray-700 font-semibold underline"
                    >
                      Pay Half
                    </button>
                  )}
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={payCommissionData.remarks}
                  onChange={(e) =>
                    setPayCommissionData({ ...payCommissionData, remarks: e.target.value })
                  }
                  placeholder="e.g. Paid via bank transfer on 20 March 2026..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowPayCommissionModal(false); setPayCommissionData(null); }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePayCommission}
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Pay Commission Modal */}
      {showBulkPayModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className={`${bulkPayType === "commission" ? "bg-linear-to-r from-orange-500 to-orange-600" : "bg-linear-to-r from-pink-500 to-pink-600"} px-6 py-4 rounded-t-2xl flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 rounded-full p-2">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    Bulk Pay {bulkPayType === "commission" ? "Commission" : "Sales Commission"}
                  </h2>
                  <p className="text-white text-opacity-80 text-xs">
                    {filteredInvoices.filter((inv) => bulkPayType === "commission" ? !inv.commissionPaid && inv.commission > 0 : !inv.salesCommissionPaid && inv.salesCommission > 0).length} unpaid invoice(s) in current filter
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowBulkPayModal(false); setBulkPayRemarks(""); }}
                className="text-white hover:text-white/70 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Invoice List */}
              {(() => {
                const unpaid = filteredInvoices.filter((inv) =>
                  bulkPayType === "commission" ? !inv.commissionPaid && inv.commission > 0 : !inv.salesCommissionPaid && inv.salesCommission > 0
                );
                return (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Invoices to be paid ({unpaid.length})
                    </p>
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 divide-y divide-gray-100">
                      {unpaid.map((inv) => (
                        <div key={getInvoiceId(inv)} className="flex items-center justify-between px-3 py-2 bg-white hover:bg-gray-50">
                          <div>
                            <p className="text-xs font-bold text-gray-800">#{inv.invoiceNumber}</p>
                            <p className="text-xs text-gray-400">{inv.salesPerson}</p>
                          </div>
                          <span className={`text-xs font-bold ${bulkPayType === "commission" ? "text-orange-600" : "text-pink-600"}`}>
                            {formatINR(bulkPayType === "commission" ? inv.commission : inv.salesCommission)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Summary */}
              <div className={`${bulkPayType === "commission" ? "bg-orange-50 border-orange-200" : "bg-pink-50 border-pink-200"} border rounded-xl p-4 mb-5`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Invoices to pay</span>
                  <span className="text-sm font-bold text-gray-900">
                    {filteredInvoices.filter((inv) => bulkPayType === "commission" ? !inv.commissionPaid && inv.commission > 0 : !inv.salesCommissionPaid && inv.salesCommission > 0).length}
                  </span>
                </div>
                <div className="flex justify-between items-center border-t pt-2 mt-1 border-gray-200">
                  <span className="text-sm font-bold text-gray-700">Total Amount</span>
                  <span className={`text-lg font-bold ${bulkPayType === "commission" ? "text-orange-600" : "text-pink-600"}`}>
                    {formatINR(filteredInvoices.reduce((sum, inv) =>
                      bulkPayType === "commission"
                        ? sum + (inv.commissionPaid ? 0 : inv.commission)
                        : sum + (inv.salesCommissionPaid ? 0 : inv.salesCommission)
                      , 0))}
                  </span>
                </div>
              </div>

              {/* Remarks */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={bulkPayRemarks}
                  onChange={(e) => setBulkPayRemarks(e.target.value)}
                  placeholder="e.g. Bulk payment processed for March 2026..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-900 text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowBulkPayModal(false); setBulkPayRemarks(""); }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkPayCommission}
                  disabled={isSubmitting}
                  className={`flex-1 flex items-center justify-center gap-2 ${bulkPayType === "commission" ? "bg-orange-500 hover:bg-orange-600" : "bg-pink-500 hover:bg-pink-600"} disabled:opacity-60 text-white font-bold px-4 py-3 rounded-xl transition-colors shadow-sm`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Processing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Confirm Bulk Payment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Invoice Modal */}
      {showAddInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add Invoice</h3>
              <button
                onClick={() => {
                  setShowAddInvoiceModal(false);
                  setNewInvoice({
                    customerName: "",
                    salesPerson: "",
                    invoiceNumber: "",
                    saleItem: "",
                    cost: "",
                    saleAmount: "",
                    expenses: "",
                    commission: "",
                    salesCommission: "",
                    remarks: "",
                    status: "dispatch",
                    shippingRemarks: "",
                    date: "",
                  });
                }}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleAddInvoice} className="p-6 space-y-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Customer Name with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.customerName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewInvoice({ ...newInvoice, customerName: value });

                      // Filter clients based on search
                      if (value.trim()) {
                        const filtered = clients.filter(client =>
                          client.company.toLowerCase().includes(value.toLowerCase())
                        );
                        setFilteredClients(filtered);
                        setShowCustomerSuggestions(filtered.length > 0);
                      } else {
                        setShowCustomerSuggestions(false);
                        setFilteredClients([]);
                      }
                    }}
                    onFocus={() => {
                      if (newInvoice.customerName.trim() && filteredClients.length > 0) {
                        setShowCustomerSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowCustomerSuggestions(false), 200);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Search or enter customer name"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showCustomerSuggestions && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client._id || client.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewInvoice({ ...newInvoice, customerName: client.company });
                            setShowCustomerSuggestions(false);
                          }}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {client.company.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{client.company}</p>
                              <p className="text-sm text-gray-500">{client.name} • {client.email}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sales Person with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.salesPerson}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewInvoice({ ...newInvoice, salesPerson: value });

                      // Filter salesmen based on search
                      if (value.trim()) {
                        const filtered = salesmen.filter(salesman =>
                          salesman.name.toLowerCase().includes(value.toLowerCase())
                        );
                        setFilteredSalesmen(filtered);
                        setShowSalesPersonSuggestions(filtered.length > 0);
                      } else {
                        setShowSalesPersonSuggestions(false);
                        setFilteredSalesmen([]);
                      }
                    }}
                    onFocus={() => {
                      if (newInvoice.salesPerson.trim() && filteredSalesmen.length > 0) {
                        setShowSalesPersonSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      // Delay to allow click on suggestion
                      setTimeout(() => setShowSalesPersonSuggestions(false), 200);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Search or enter sales person name"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSalesPersonSuggestions && filteredSalesmen.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSalesmen.map((salesman) => (
                        <div
                          key={salesman._id || salesman.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewInvoice({ ...newInvoice, salesPerson: salesman.name });
                            setShowSalesPersonSuggestions(false);
                          }}
                          className="px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                              {salesman.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{salesman.name}</p>
                              <p className="text-xs text-gray-500">{salesman.employeeId} • {salesman.email}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.invoiceNumber}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="e.g., INV-001"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newInvoice.date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.cost}
                    onChange={(e) => setNewInvoice({ ...newInvoice, cost: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter cost"
                  />
                </div>

                {/* Sale Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sale Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.saleAmount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, saleAmount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter sale amount"
                  />
                </div>

                {/* Expenses */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expenses (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.expenses}
                    onChange={(e) => setNewInvoice({ ...newInvoice, expenses: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter expenses"
                  />
                </div>

                {/* Commission */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Commission (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.commission}
                    onChange={(e) => setNewInvoice({ ...newInvoice, commission: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter commission"
                  />
                </div>

                {/* Sales Commission */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Commission (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.salesCommission}
                    onChange={(e) => setNewInvoice({ ...newInvoice, salesCommission: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter sales commission"
                  />
                </div>
              </div>

              {/* Sale Item (Full Width) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sale Item <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Press Enter to add new line)</span>
                </label>
                <textarea
                  required
                  value={newInvoice.saleItem}
                  onChange={(e) => setNewInvoice({ ...newInvoice, saleItem: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const cursorPosition = target.selectionStart;
                      const textBeforeCursor = newInvoice.saleItem.substring(0, cursorPosition);
                      const textAfterCursor = newInvoice.saleItem.substring(cursorPosition);

                      // Add bullet point on new line
                      const newText = textBeforeCursor + '\n• ' + textAfterCursor;
                      setNewInvoice({ ...newInvoice, saleItem: newText });

                      // Set cursor position after the bullet point
                      setTimeout(() => {
                        if (target) {
                          target.selectionStart = cursorPosition + 3;
                          target.selectionEnd = cursorPosition + 3;
                        }
                      }, 0);
                    }
                  }}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400 font-mono"
                  placeholder="Enter sale item details (Press Enter to add bullet points)"
                />
              </div>

              {/* Remarks (Full Width) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={newInvoice.remarks}
                  onChange={(e) => setNewInvoice({ ...newInvoice, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter any additional remarks (optional)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddInvoiceModal(false);
                    setNewInvoice({
                      customerName: "",
                      salesPerson: "",
                      invoiceNumber: "",
                      saleItem: "",
                      cost: "",
                      saleAmount: "",
                      expenses: "",
                      commission: "",
                      salesCommission: "",
                      remarks: "",
                      status: "dispatch",
                      shippingRemarks: "",
                      date: "",
                    });
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-6 py-3 text-white font-semibold rounded-lg transition duration-200 shadow-lg flex items-center justify-center ${isSubmitting ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    "Add Invoice"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Invoice Modal */}
      {showEditInvoiceModal && editingInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full my-8">
            {/* Modal Header */}
            <div className="bg-linear-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Invoice</h3>
              <button
                onClick={() => {
                  setShowEditInvoiceModal(false);
                  setEditingInvoice(null);
                  setNewInvoice({
                    customerName: "",
                    salesPerson: "",
                    invoiceNumber: "",
                    saleItem: "",
                    cost: "",
                    saleAmount: "",
                    expenses: "",
                    commission: "",
                    salesCommission: "",
                    remarks: "",
                    status: "dispatch",
                    shippingRemarks: "",
                    date: "",
                  });
                }}
                className="text-white hover:bg-green-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleUpdateInvoice} className="p-6 space-y-5 max-h-[calc(90vh-8rem)] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Customer Name with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.customerName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewInvoice({ ...newInvoice, customerName: value });

                      // Filter clients based on search
                      if (value.trim()) {
                        const filtered = clients.filter(client =>
                          client.company.toLowerCase().includes(value.toLowerCase())
                        );
                        setFilteredClients(filtered);
                        setShowCustomerSuggestions(filtered.length > 0);
                      } else {
                        setShowCustomerSuggestions(false);
                        setFilteredClients([]);
                      }
                    }}
                    onFocus={() => {
                      if (newInvoice.customerName.trim() && filteredClients.length > 0) {
                        setShowCustomerSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowCustomerSuggestions(false), 200);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Search or enter customer name"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showCustomerSuggestions && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client._id || client.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewInvoice({ ...newInvoice, customerName: client.company });
                            setShowCustomerSuggestions(false);
                          }}
                          className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                              {client.company.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{client.company}</p>
                              <p className="text-sm text-gray-500">{client.name} • {client.email}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sales Person with Autocomplete */}
                <div className="relative">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Person <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.salesPerson}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewInvoice({ ...newInvoice, salesPerson: value });

                      // Filter salesmen based on search
                      if (value.trim()) {
                        const filtered = salesmen.filter(salesman =>
                          salesman.name.toLowerCase().includes(value.toLowerCase())
                        );
                        setFilteredSalesmen(filtered);
                        setShowSalesPersonSuggestions(filtered.length > 0);
                      } else {
                        setShowSalesPersonSuggestions(false);
                        setFilteredSalesmen([]);
                      }
                    }}
                    onFocus={() => {
                      if (newInvoice.salesPerson.trim() && filteredSalesmen.length > 0) {
                        setShowSalesPersonSuggestions(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setShowSalesPersonSuggestions(false), 200);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Search or enter sales person name"
                  />

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSalesPersonSuggestions && filteredSalesmen.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSalesmen.map((salesman) => (
                        <div
                          key={salesman._id || salesman.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewInvoice({ ...newInvoice, salesPerson: salesman.name });
                            setShowSalesPersonSuggestions(false);
                          }}
                          className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                              {salesman.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{salesman.name}</p>
                              <p className="text-xs text-gray-500">{salesman.employeeId} • {salesman.email}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Invoice Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newInvoice.invoiceNumber}
                    onChange={(e) => setNewInvoice({ ...newInvoice, invoiceNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="e.g., INV-001"
                  />
                </div>

                {/* Invoice Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newInvoice.date}
                    onChange={(e) => setNewInvoice({ ...newInvoice, date: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cost (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.cost}
                    onChange={(e) => setNewInvoice({ ...newInvoice, cost: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter cost"
                  />
                </div>

                {/* Sale Amount */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sale Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.saleAmount}
                    onChange={(e) => setNewInvoice({ ...newInvoice, saleAmount: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter sale amount"
                  />
                </div>

                {/* Expenses */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Expenses (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.expenses}
                    onChange={(e) => setNewInvoice({ ...newInvoice, expenses: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter expenses"
                  />
                </div>

                {/* Commission */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Commission (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.commission}
                    onChange={(e) => setNewInvoice({ ...newInvoice, commission: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter commission"
                  />
                </div>

                {/* Sales Commission */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sales Commission (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newInvoice.salesCommission}
                    onChange={(e) => setNewInvoice({ ...newInvoice, salesCommission: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                    placeholder="Enter sales commission"
                  />
                </div>
              </div>

              {/* Sale Item (Full Width) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Sale Item <span className="text-red-500">*</span>
                  <span className="text-xs text-gray-500 ml-2">(Press Enter to add new line)</span>
                </label>
                <textarea
                  required
                  value={newInvoice.saleItem}
                  onChange={(e) => setNewInvoice({ ...newInvoice, saleItem: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      const target = e.currentTarget;
                      const cursorPosition = target.selectionStart;
                      const textBeforeCursor = newInvoice.saleItem.substring(0, cursorPosition);
                      const textAfterCursor = newInvoice.saleItem.substring(cursorPosition);

                      // Add bullet point on new line
                      const newText = textBeforeCursor + '\n• ' + textAfterCursor;
                      setNewInvoice({ ...newInvoice, saleItem: newText });

                      // Set cursor position after the bullet point
                      setTimeout(() => {
                        if (target) {
                          target.selectionStart = cursorPosition + 3;
                          target.selectionEnd = cursorPosition + 3;
                        }
                      }, 0);
                    }
                  }}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400 font-mono"
                  placeholder="Enter sale item details (Press Enter to add bullet points)"
                />
              </div>

              {/* Remarks (Full Width) */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={newInvoice.remarks}
                  onChange={(e) => setNewInvoice({ ...newInvoice, remarks: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter any additional remarks (optional)"
                />
              </div>

              {/* Shipping Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shipping Status <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={newInvoice.status}
                  onChange={(e) => setNewInvoice({ ...newInvoice, status: e.target.value as ShippingStatus })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900"
                >
                  {SHIPPING_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shipping Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shipping Remarks
                </label>
                <textarea
                  value={newInvoice.shippingRemarks}
                  onChange={(e) => setNewInvoice({ ...newInvoice, shippingRemarks: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition text-gray-900 placeholder:text-gray-400"
                  placeholder="Enter shipping notes (optional)"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditInvoiceModal(false);
                    setEditingInvoice(null);
                    setNewInvoice({
                      customerName: "",
                      salesPerson: "",
                      invoiceNumber: "",
                      saleItem: "",
                      cost: "",
                      saleAmount: "",
                      expenses: "",
                      commission: "",
                      salesCommission: "",
                      remarks: "",
                      status: "dispatch",
                      shippingRemarks: "",
                      date: "",
                    });
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 px-6 py-3 text-white font-semibold rounded-lg transition duration-200 shadow-lg flex items-center justify-center ${isSubmitting ? "bg-green-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
                    }`}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    "Update Invoice"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Office Expense Modal */}
      {showAddOfficeExpenseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full my-8">
            <div className="bg-linear-to-r from-blue-600 to-blue-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Add Office Expense</h3>
              <button
                onClick={() => setShowAddOfficeExpenseModal(false)}
                className="text-white hover:bg-blue-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddOfficeExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Expense Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newOfficeExpense.title}
                  onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, title: e.target.value })}
                  placeholder="e.g. Monthly Internet Bill, Office Supplies"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={newOfficeExpense.category}
                    onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {["Utilities", "Rent", "Supplies", "Salaries", "Maintenance", "Travel", "Miscellaneous"].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={newOfficeExpense.amount}
                    onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, amount: e.target.value })}
                    placeholder="Enter amount"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expense Month<span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    required
                    value={newOfficeExpense.date ? newOfficeExpense.date.slice(0, 7) : ""}
                    onChange={(e) => {
                      const mVal = e.target.value;
                      if (mVal) {
                        const currentDay = newOfficeExpense.date && newOfficeExpense.date.length >= 10 ? newOfficeExpense.date.slice(8, 10) : "01";
                        setNewOfficeExpense({ ...newOfficeExpense, date: `${mVal}-${currentDay}` });
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-blue-50/40 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Exact Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={newOfficeExpense.date}
                    onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={newOfficeExpense.paymentMethod}
                    onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, paymentMethod: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {["Cash", "Bank Transfer", "Credit Card", "UPI", "Cheque"].map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    value={newOfficeExpense.paidTo}
                    onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, paidTo: e.target.value })}
                    placeholder="e.g. Electricity Board, Stationery Shop"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={newOfficeExpense.remarks}
                  onChange={(e) => setNewOfficeExpense({ ...newOfficeExpense, remarks: e.target.value })}
                  placeholder="Optional notes or details"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddOfficeExpenseModal(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-md"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Office Expense Modal */}
      {showEditOfficeExpenseModal && editingOfficeExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full my-8">
            <div className="bg-linear-to-r from-green-600 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">Edit Office Expense</h3>
              <button
                onClick={() => {
                  setShowEditOfficeExpenseModal(false);
                  setEditingOfficeExpense(null);
                }}
                className="text-white hover:bg-green-800 rounded-full p-1 transition"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateOfficeExpense} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Expense Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingOfficeExpense.title}
                  onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, title: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editingOfficeExpense.category}
                    onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, category: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {["Utilities", "Rent", "Supplies", "Salaries", "Maintenance", "Travel", "Miscellaneous"].map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Amount (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="any"
                    value={editingOfficeExpense.amount}
                    onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, amount: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Expense Month (किस महीने का खर्चा) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    required
                    value={editingOfficeExpense.date ? editingOfficeExpense.date.slice(0, 7) : ""}
                    onChange={(e) => {
                      const mVal = e.target.value;
                      if (mVal) {
                        const currentDay = editingOfficeExpense.date && editingOfficeExpense.date.length >= 10 ? editingOfficeExpense.date.slice(8, 10) : "01";
                        setEditingOfficeExpense({ ...editingOfficeExpense, date: `${mVal}-${currentDay}` });
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-green-50/40 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Exact Expense Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editingOfficeExpense.date}
                    onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={editingOfficeExpense.paymentMethod}
                    onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, paymentMethod: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    {["Cash", "Bank Transfer", "Credit Card", "UPI", "Cheque"].map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Paid To / Vendor
                  </label>
                  <input
                    type="text"
                    value={editingOfficeExpense.paidTo || ""}
                    onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, paidTo: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  rows={2}
                  value={editingOfficeExpense.remarks || ""}
                  onChange={(e) => setEditingOfficeExpense({ ...editingOfficeExpense, remarks: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900"
                />
              </div>

              <div className="flex space-x-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditOfficeExpenseModal(false);
                    setEditingOfficeExpense(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-gray-300 transition duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition duration-200 shadow-md"
                >
                  Update Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
