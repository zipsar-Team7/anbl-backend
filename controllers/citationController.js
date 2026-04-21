import Citation from '../models/Citation.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get all citations (with optional search)
// @route   GET /api/citations
// @access  Public
export const getCitations = asyncHandler(async (req, res) => {
  let query = {};

  // Search logic
  if (req.query.search) {
    const keyword = req.query.search;
    query = {
      $or: [
        { title: { $regex: keyword, $options: 'i' } },   // Case-insensitive search in title
        { authors: { $regex: keyword, $options: 'i' } }, // Case-insensitive search in authors
        { publisher: { $regex: keyword, $options: 'i' } } // Case-insensitive search in publisher
      ]
    };
  }

  // Filter by year if provided
  if (req.query.year) {
    query.year = req.query.year;
  }

  const citations = await Citation.find(query).sort({ year: -1 });
  
  res.status(200).json({
    status: 'success',
    count: citations.length,
    data: citations
  });
});

// @desc    Get single citation
// @route   GET /api/citations/:id
// @access  Public
export const getCitation = asyncHandler(async (req, res) => {
  const citation = await Citation.findById(req.params.id);

  if (!citation) {
    return res.status(404).json({
      status: 'error',
      message: `Citation not found with id of ${req.params.id}`
    });
  }

  res.status(200).json({
    status: 'success',
    data: citation
  });
});
