import Material from '../models/Material.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get unique values for frontend filters
// @route   GET /api/search/filters
// @access  Public
export const getFilters = asyncHandler(async (req, res) => {
  const categoricalFields = ['Type_of_materials', 'Sub_type_of_materials', 'Shape', 'Injury_Model', 'Cell_Type'];
  const filters = {
    categorical: {},
    ranges: {}
  };

  // 1. Get Categorical Unique Values
  for (const field of categoricalFields) {
    const distinctValues = await Material.distinct(field, {
      [field]: { $ne: null, $not: /^\s*$/ }
    });
    filters.categorical[field] = distinctValues.sort();
  }

  // 2. Get Numeric Range Bounds (Global Min/Max)
  const rangeFields = [
    { base: 'Size_nm', min: 'Size_nm_min', max: 'Size_nm_max' }
  ];

  for (const range of rangeFields) {
    const minVal = await Material.find({ [range.min]: { $ne: null } }).sort({ [range.min]: 1 }).limit(1).select(range.min);
    const maxVal = await Material.find({ [range.max]: { $ne: null } }).sort({ [range.max]: -1 }).limit(1).select(range.max);
    
    if (minVal.length > 0 && maxVal.length > 0) {
      filters.ranges[range.base] = {
        min: minVal[0][range.min],
        max: maxVal[0][range.max]
      };
    }
  }

  res.status(200).json({
    status: 'success',
    data: filters
  });
});

// @desc    Advanced search for materials
// @route   POST /api/search
// @access  Public
export const searchMaterials = asyncHandler(async (req, res) => {
  const { filters, keyword, page = 1, limit = 10 } = req.body;
  const query = {};

  // 1. Security: Strict Type Validation
  if (keyword && typeof keyword !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid keyword format. Search must be a string.'
    });
  }

  if (filters && (typeof filters !== 'object' || Array.isArray(filters))) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid filter format.'
    });
  }

  // 1. Keyword Search ($text)
  if (keyword) {
    // MongoDB $text search automatically handles tokenization and basic sanitization
    query.$text = { $search: String(keyword) };
  }

  // 2. Categorical Filters (Arrays of strings)
  if (filters) {
    const categoricalFields = [
      'Type_of_materials', 'Sub_type_of_materials', 'Functional_group_drug', 
      'Abbreviation', 'Shape', 'Agglomeration', 'Zeta_potential', 
      'Cell_Type', 'Stimulant', 'Cellular_uptake', 'Pro_inflammatory', 
      'Anti_inflammatory', 'Apoptosis', 'Organism', 'Gender', 
      'Dose_times', 'Administration_route', 'Injury_Model', 
      'Biosafety', 'Recovery'
    ];

    categoricalFields.forEach(field => {
      if (filters[field] && Array.isArray(filters[field]) && filters[field].length > 0) {
        query[field] = { $in: filters[field] };
      }
    });

    // 3. Numeric Range Filters
    // Intersection logic: User [Umin, Umax] intersects Document [Dmin, Dmax] if Dmin <= Umax AND Dmax >= Umin
    const numericPairs = [
      ['Size_nm_min', 'Size_nm_max'],
      ['NPs_Conc_ug_mL_min', 'NPs_Conc_ug_mL_max'],
      ['Stimulant_Conc_ug_ml_min', 'Stimulant_Conc_ug_ml_max'],
      ['Age_Weeks_min', 'Age_Weeks_max'],
      ['Weight_g_min', 'Weight_g_max'],
      ['Dose_invivo_mg_Kg_min', 'Dose_invivo_mg_Kg_max']
    ];

    numericPairs.forEach(([minField, maxField]) => {
      const baseName = minField.replace('_min', ''); // e.g., Size_nm
      if (filters[baseName]) {
        const { min, max } = filters[baseName];
        
        if (min !== undefined && max !== undefined) {
          // Range intersection
          query[minField] = { $lte: max };
          query[maxField] = { $gte: min };
        } else if (min !== undefined) {
          // At least some part of the material is >= min
          query[maxField] = { $gte: min };
        } else if (max !== undefined) {
          // At least some part of the material is <= max
          query[minField] = { $lte: max };
        }
      }
    });
  }

  // Pagination Logic
  const skip = (page - 1) * limit;
  
  // Execute Query
  const records = await Material.find(query)
    .select('_id Type_of_materials Sub_type_of_materials Functional_group_drug Abbreviation Size_nm_min Size_nm_max Shape')
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const totalRecords = await Material.countDocuments(query);

  res.status(200).json({
    status: 'success',
    page: Number(page),
    limit: Number(limit),
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    data: records
  });
});

// @desc    Get complete material report
// @route   GET /api/records/:id
// @access  Public
export const getMaterialById = asyncHandler(async (req, res) => {
  const material = await Material.findById(req.params.id);

  if (!material) {
    return res.status(404).json({
      status: 'error',
      message: `Material record not found with id: ${req.params.id}`
    });
  }

  res.status(200).json({
    status: 'success',
    data: material
  });
});
