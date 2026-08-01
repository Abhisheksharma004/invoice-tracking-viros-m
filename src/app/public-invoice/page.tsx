"use client";

import { useState, FormEvent, useEffect } from "react";
import toast from "react-hot-toast";

interface Client {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: string;
}

interface Salesman {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  address: string;
}

export default function PublicInvoiceForm() {
  const [formData, setFormData] = useState({
    customerName: "",
    salesPerson: "",
    invoiceNumber: "",
    date: "",
    cost: "",
    saleAmount: "",
    expenses: "",
    commission: "",
    salesCommission: "",
    saleItem: "",
    remarks: "",
    status: "dispatch",
  });

  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<{
    invoiceNumber: string;
    customerName: string;
    saleAmount: string;
  } | null>(null);

  // Autocomplete states
  const [clients, setClients] = useState<Client[]>([]);
  const [salesmen, setSalesmen] = useState<Salesman[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [filteredSalesmen, setFilteredSalesmen] = useState<Salesman[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [showSalesPersonSuggestions, setShowSalesPersonSuggestions] = useState(false);

  // Fetch clients and salesmen on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [clientsRes, salesmenRes] = await Promise.all([
          fetch("/api/clients"),
          fetch("/api/salesmen"),
        ]);

        const clientsData = await clientsRes.json();
        const salesmenData = await salesmenRes.json();

        if (clientsData.success) {
          setClients(clientsData.clients);
        }

        if (salesmenData.success) {
          setSalesmen(salesmenData.salesmen);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/public/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setCreatedInvoice({
          invoiceNumber: data.invoiceNumber,
          customerName: data.customerName,
          saleAmount: formData.saleAmount,
        });
        setShowSuccessModal(true);
        toast.success("Invoice created successfully!");
        
        // Reset form
        setFormData({
          customerName: "",
          salesPerson: "",
          invoiceNumber: "",
          date: "",
          cost: "",
          saleAmount: "",
          expenses: "",
          commission: "",
          salesCommission: "",
          saleItem: "",
          remarks: "",
          status: "dispatch",
        });
        
        // Reset filtered states
        setFilteredClients([]);
        setFilteredSalesmen([]);
      } else {
        toast.error(data.error || "Failed to create invoice");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">
              Add Invoice
            </h1>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="text-white hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Row 1: Customer Name & Sales Person */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer Name with Autocomplete */}
              <div className="relative">
                <label
                  htmlFor="customerName"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="customerName"
                  name="customerName"
                  required
                  value={formData.customerName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, customerName: value });
                    
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
                    if (formData.customerName.trim() && filteredClients.length > 0) {
                      setShowCustomerSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCustomerSuggestions(false), 200);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
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
                          setFormData({ ...formData, customerName: client.company });
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
                <label
                  htmlFor="salesPerson"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sales Person <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="salesPerson"
                  name="salesPerson"
                  required
                  value={formData.salesPerson}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, salesPerson: value });
                    
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
                    if (formData.salesPerson.trim() && filteredSalesmen.length > 0) {
                      setShowSalesPersonSuggestions(true);
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowSalesPersonSuggestions(false), 200);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
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
                          setFormData({ ...formData, salesPerson: salesman.name });
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
            </div>

            {/* Row 2: Invoice Number & Invoice Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="invoiceNumber"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Invoice Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="invoiceNumber"
                  name="invoiceNumber"
                  required
                  value={formData.invoiceNumber}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="e.g., INV-001"
                />
              </div>

              <div>
                <label
                  htmlFor="date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Invoice Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  required
                  value={formData.date}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                />
              </div>
            </div>

            {/* Row 3: Cost & Sale Amount */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="cost"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Cost (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="cost"
                  name="cost"
                  required
                  min="0"
                  step="0.01"
                  value={formData.cost}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="Enter cost"
                />
              </div>

              <div>
                <label
                  htmlFor="saleAmount"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sale Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="saleAmount"
                  name="saleAmount"
                  required
                  min="0"
                  step="0.01"
                  value={formData.saleAmount}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="Enter sale amount"
                />
              </div>
            </div>

            {/* Row 4: Expenses & Commission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expenses"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Expenses (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="expenses"
                  name="expenses"
                  required
                  min="0"
                  step="0.01"
                  value={formData.expenses}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="Enter expenses"
                />
              </div>

              <div>
                <label
                  htmlFor="commission"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Commission (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="commission"
                  name="commission"
                  required
                  min="0"
                  step="0.01"
                  value={formData.commission}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="Enter commission"
                />
              </div>
            </div>

            {/* Row 5: Sales Commission */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="salesCommission"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Sales Commission (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="salesCommission"
                  name="salesCommission"
                  required
                  min="0"
                  step="0.01"
                  value={formData.salesCommission}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                  placeholder="Enter sales commission"
                />
              </div>
            </div>

            {/* Sale Item */}
            <div>
              <label
                htmlFor="saleItem"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Sale Item <span className="text-red-500">*</span>{" "}
                <span className="text-blue-600 text-xs font-normal">(Press Enter to add new line)</span>
              </label>
              <textarea
                id="saleItem"
                name="saleItem"
                required
                rows={4}
                value={formData.saleItem}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                placeholder="Enter sale item details (Press Enter to add bullet points)"
              />
            </div>

            {/* Remarks */}
            <div>
              <label
                htmlFor="remarks"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Remarks
              </label>
              <textarea
                id="remarks"
                name="remarks"
                rows={3}
                value={formData.remarks}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-sm"
                placeholder="Enter any additional remarks (optional)"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={() => {
                  setFormData({
                    customerName: "",
                    salesPerson: "",
                    invoiceNumber: "",
                    date: "",
                    cost: "",
                    saleAmount: "",
                    expenses: "",
                    commission: "",
                    salesCommission: "",
                    saleItem: "",
                    remarks: "",
                    status: "dispatch",
                  });
                }}
                className="px-8 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Adding...</span>
                  </>
                ) : (
                  "Add Invoice"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccessModal && createdInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-fadeInScale">
            {/* Success Icon */}
            <div className="flex justify-center pt-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Invoice Created Successfully!
              </h3>
              <p className="text-gray-600 mb-6">
                Your invoice has been submitted and saved to the system.
              </p>

              {/* Invoice Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Invoice Number:</span>
                    <span className="text-sm font-bold text-gray-900">{createdInvoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Customer Name:</span>
                    <span className="text-sm font-bold text-gray-900">{createdInvoice.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-gray-600">Sale Amount:</span>
                    <span className="text-sm font-bold text-green-600">₹{parseFloat(createdInvoice.saleAmount).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setCreatedInvoice(null);
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition duration-200 shadow-lg"
                >
                  Create Another Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
