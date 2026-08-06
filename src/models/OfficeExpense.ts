import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOfficeExpense extends Document {
  title: string;
  category: string;
  amount: number;
  date: Date;
  expenseMonth?: string;
  paymentMethod: "Cash" | "Bank Transfer" | "Credit Card" | "UPI" | "Cheque";
  paidTo?: string;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OfficeExpenseSchema: Schema<IOfficeExpense> = new Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount must be greater than or equal to 0"],
    },
    date: {
      type: Date,
      default: Date.now,
    },
    expenseMonth: {
      type: String,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Bank Transfer", "Credit Card", "UPI", "Cheque"],
      default: "Cash",
    },
    paidTo: {
      type: String,
      trim: true,
      default: "",
    },
    remarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const OfficeExpense: Model<IOfficeExpense> =
  mongoose.models.OfficeExpense ||
  mongoose.model<IOfficeExpense>("OfficeExpense", OfficeExpenseSchema);

export default OfficeExpense;
