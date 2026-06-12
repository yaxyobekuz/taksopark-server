import mongoose from "mongoose";

// Mongoose `aggregate()` `$match` da string ID ni ObjectId ga AVTOMATIK o'girmaydi
// (`.find()` o'giradi, `aggregate` esa yo'q). Handler `req.params.id` ni string sifatida
// uzatadi - shuning uchun aggregate $match'da driver ID ni shu helper bilan o'giramiz,
// aks holda hech narsa topilmay 0 qaytadi.
export const toObjectId = (id) =>
  id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
