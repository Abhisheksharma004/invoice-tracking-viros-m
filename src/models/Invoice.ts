import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    salesPerson: {
      type: String,
      required: [true, "Sales person is required"],
      trim: true,
    },
    saleItem: {
      type: String,
      required: [true, "Sale item is required"],
      trim: true,
    },
    cost: {
      type: Number,
      required: [true, "Cost is required"],
      min: 0,
    },
    saleAmount: {
      type: Number,
      required: [true, "Sale amount is required"],
      min: 0,
    },
    expenses: {
      type: Number,
      required: [true, "Expenses are required"],
      min: 0,
      default: 0,
    },
    commission: {
      type: Number,
      required: [true, "Commission is required"],
      min: 0,
      default: 0,
    },
    salesCommission: {
      type: Number,
      required: [true, "Sales commission is required"],
      min: 0,
      default: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["dispatch", "intransit", "intransist", "delivered", "pending", "paid", "overdue"],
      default: "dispatch",
    },
    shippingRemarks: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      required: [true, "Invoice date is required"],
    },
    commissionPaid: {
      type: Boolean,
      default: false,
    },
    commissionPaidDate: {
      type: Date,
      default: null,
    },
    commissionPayRemarks: {
      type: String,
      default: "",
    },
    commissionPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    commissionPayments: {
      type: [
        {
          amount: { type: Number, required: true },
          date: { type: Date, required: true },
          remarks: { type: String, default: "" },
        },
      ],
      default: [],
    },
    salesCommissionPaid: {
      type: Boolean,
      default: false,
    },
    salesCommissionPaidDate: {
      type: Date,
      default: null,
    },
    salesCommissionPayRemarks: {
      type: String,
      default: "",
    },
    salesCommissionPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    salesCommissionPayments: {
      type: [
        {
          amount: { type: Number, required: true },
          date: { type: Date, required: true },
          remarks: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Calculate profit fields as virtual properties
InvoiceSchema.virtual("profit").get(function () {
  return this.saleAmount - this.cost - this.expenses;
});

InvoiceSchema.virtual("netProfit").get(function () {
  const profit = this.saleAmount - this.cost - this.expenses;
  return profit - this.commission - this.salesCommission;
});

// Ensure virtuals are included when converting to JSON
InvoiceSchema.set("toJSON", { virtuals: true });
InvoiceSchema.set("toObject", { virtuals: true });

// In development, always delete the cached model so schema changes (new fields)
// are picked up without restarting the server. Mongoose 8 strict mode silently
// drops $push/$set on paths not in the compiled model schema.
if (process.env.NODE_ENV === "development") {
  delete (mongoose.models as Record<string, unknown>)["Invoice"];
}

export default mongoose.models.Invoice ||
  mongoose.model("Invoice", InvoiceSchema);
