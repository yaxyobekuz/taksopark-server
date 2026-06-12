import mongoose from "mongoose";

// Haydovchiga mashina biriktirilgan vaqt oralig'i (mashina tayinlash davri).
// §2: mashina ish davriga emas, alohida tayinlash manbasiga bog'lanadi va har
// kunlik planga o'sha kungi haqiqiy mashina snapshot qilinadi. endDate = null
// bo'lsa davr ochiq (haydovchi hozir shu mashinada).
//
// Yagona timeline IKKI tomondan: bir haydovchi bir vaqtda bitta mashinada;
// bitta mashina bir vaqtda bitta haydovchida (overlap servisda tekshiriladi).
const carAssignmentSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", required: true, index: true },
    car: { type: mongoose.Schema.Types.ObjectId, ref: "Car", required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, default: null },
    note: { type: String, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

carAssignmentSchema.index({ driver: 1, startDate: 1 });
carAssignmentSchema.index({ car: 1, startDate: 1 });

carAssignmentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const CarAssignment = mongoose.model("CarAssignment", carAssignmentSchema);

export default CarAssignment;
