import mongoose from 'mongoose';

const citationSchema = new mongoose.Schema({
  authors: { type: String, required: true },
  title: { type: String, required: true },
  publication: { type: String },
  volume: { type: String },
  number: { type: String },
  pages: { type: String },
  year: { type: Number },
  publisher: { type: String },
}, { timestamps: true });

const Citation = mongoose.model('Citation', citationSchema);

export default Citation;
