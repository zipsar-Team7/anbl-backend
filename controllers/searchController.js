import Material from '../models/Material.js';
import PolyToxMaterial from '../models/PolyToxMaterial.js';
import asyncHandler from '../middleware/asyncHandler.js';

// @desc    Get unique values for frontend filters
// @route   GET /api/search/filters
// @access  Public
export const getFilters = asyncHandler(async (req, res) => {
  const categoricalFields = [
    'Scale_Coverage',
    'MIE_P_M_Type',
    'MIE_P_Size_nm',
    'MIE_P_Shape',
    'MIE_E_Cell_Type',
    'MIE_E_NPs_Conc_ug_mL',
    'MIE_E_Stimulant',
    'MIE_E_Injury_Model',
    'MIE_E_Organism'
  ];
  const filters = {
    categorical: {},
    ranges: {}
  };

  // 1. Get Categorical Unique Values (Parallelized to minimize network roundtrips)
  await Promise.all(
    categoricalFields.map(async (field) => {
      const distinctValues = await Material.distinct(field, {
        [field]: { $ne: null, $not: /^\s*$/ }
      });
      filters.categorical[field] = distinctValues.sort();
    })
  );

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

  // 1. Keyword Search (flexible case-insensitive regex matching across key fields)
  if (keyword) {
    const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'i');
    query.$or = [
      { Meta_Title: regex },
      { MIE_P_M_Type: regex },
      { MIE_P_Shape: regex },
      { MIE_E_Cell_Type: regex },
      { MIE_E_Injury_Model: regex },
      { Scale_Coverage: regex },
      { Meta_doi: regex }
    ];
  }

  // 2. Categorical Filters (Arrays of strings)
  if (filters) {
    const categoricalFields = [
      'Scale_Coverage',
      'Meta_Scale',
      'MIE_P_M_Type',
      'MIE_P_Size_nm',
      'MIE_P_Shape',
      'MIE_P_Agglomeration',
      'MIE_P_Zeta_potential',
      'MIE_E_Cell_Type',
      'MIE_E_NPs_Conc_ug_mL',
      'MIE_E_Stimulant',
      'MIE_E_Stimulant_Conc_ug_ml',
      'MIE_E_C_uptake',
      'KE_Pro',
      'KE_Anti',
      'KE_Apoptosis',
      'MIE_E_Organism',
      'MIE_E_Sex',
      'MIE_E_Age_Weeks',
      'MIE_E_Weight_g',
      'MIE_E_NPs_Dose_mg_Kg',
      'MIE_E_Dose_Regimen',
      'MIE_E_Ad_route',
      'MIE_E_Injury_Model',
      'AO_Biosafety',
      'AO_Recovery'
    ];

    categoricalFields.forEach(field => {
      if (filters[field] && Array.isArray(filters[field]) && filters[field].length > 0) {
        query[field] = { $in: filters[field] };
      }
    });
  }

  // Pagination Logic
  const skip = (page - 1) * limit;
  
  // Execute Query
  const records = await Material.find(query)
    .select('_id Meta_Title Scale_Coverage MIE_P_M_Type MIE_P_Size_nm MIE_P_Shape MIE_E_Injury_Model')
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

// @desc    Get unique values for PolyTox frontend filters
// @route   GET /api/polytox/filters
// @access  Public
export const getPolyToxFilters = asyncHandler(async (req, res) => {
  const categoricalFields = [
    'Polymers',
    'Polymer_type',
    'Synthesis_method',
    'Material_2',
    'Shape'
  ];
  
  const filters = {
    categorical: {},
    ranges: {
      Core_size_nm: { min: 0, max: 50000 },
      PDI: { min: 0, max: 1 },
      Hydrodynamic_size_water_nm: { min: 0, max: 1000 },
      Surface_charge_water_mV: { min: -100, max: 100 }
    }
  };

  // 1. Get Categorical Unique Values (Parallelized to minimize network roundtrips)
  await Promise.all(
    categoricalFields.map(async (field) => {
      const distinctValues = await PolyToxMaterial.distinct(field, {
        [field]: { $ne: null, $not: /^\s*$/ }
      });
      filters.categorical[field] = distinctValues.sort();
    })
  );

  res.status(200).json({
    status: 'success',
    data: filters
  });
});

// @desc    Advanced search for PolyTox materials
// @route   POST /api/polytox/search
// @access  Public
export const searchPolyTox = asyncHandler(async (req, res) => {
  const { filters, keyword, page = 1, limit = 12 } = req.body;
  const query = {};

  if (keyword && typeof keyword !== 'string') {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid keyword format.'
    });
  }

  // 1. Keyword search (filters abbreviation, polymer type, material, or article)
  if (keyword) {
    const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedKeyword, 'i');
    query.$or = [
      { Polymer_type: regex },
      { Material_2: regex },
      { Article_Name: regex },
      { Polymers: regex }
    ];
  }

  // 2. Categorical & Range filters
  if (filters) {
    const categoricalFields = [
      'Polymers',
      'Polymer_type',
      'Synthesis_method',
      'Material_2',
      'Shape'
    ];

    categoricalFields.forEach(field => {
      if (filters[field] && Array.isArray(filters[field]) && filters[field].length > 0) {
        query[field] = { $in: filters[field] };
      }
    });

    // 3. Numeric range filters
    const hasCoreFilter = (filters.core_min !== undefined && filters.core_min !== '') || 
                          (filters.core_max !== undefined && filters.core_max !== '');
    if (hasCoreFilter) {
      const coreMin = filters.core_min !== undefined && filters.core_min !== '' ? Number(filters.core_min) : 0;
      const coreMax = filters.core_max !== undefined && filters.core_max !== '' ? Number(filters.core_max) : Infinity;
      
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          {
            Core_size_min: { $lte: coreMax },
            Core_size_max: { $gte: coreMin }
          },
          { Core_size_min: null, Core_size_max: null, Core_size_nm: { $ne: 'Not reported' } }
        ]
      });
    }

    const hasPdiFilter = (filters.pdi_min !== undefined && filters.pdi_min !== '') || 
                         (filters.pdi_max !== undefined && filters.pdi_max !== '');
    if (hasPdiFilter) {
      const pdiMin = filters.pdi_min !== undefined && filters.pdi_min !== '' ? Number(filters.pdi_min) : 0;
      const pdiMax = filters.pdi_max !== undefined && filters.pdi_max !== '' ? Number(filters.pdi_max) : Infinity;
      
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          {
            PDI_min: { $lte: pdiMax },
            PDI_max: { $gte: pdiMin }
          },
          { PDI_min: null, PDI_max: null, PDI: { $ne: 'Not reported' } }
        ]
      });
    }

    const hasHydroFilter = (filters.hydro_min !== undefined && filters.hydro_min !== '') || 
                           (filters.hydro_max !== undefined && filters.hydro_max !== '');
    if (hasHydroFilter) {
      const hydroMin = filters.hydro_min !== undefined && filters.hydro_min !== '' ? Number(filters.hydro_min) : 0;
      const hydroMax = filters.hydro_max !== undefined && filters.hydro_max !== '' ? Number(filters.hydro_max) : Infinity;
      
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          {
            Hydrodynamic_size_water_min: { $lte: hydroMax },
            Hydrodynamic_size_water_max: { $gte: hydroMin }
          },
          { Hydrodynamic_size_water_min: null, Hydrodynamic_size_water_max: null, Hydrodynamic_size_water_nm: { $ne: 'Not reported' } }
        ]
      });
    }

    const hasChargeFilter = (filters.charge_min !== undefined && filters.charge_min !== '') || 
                            (filters.charge_max !== undefined && filters.charge_max !== '');
    if (hasChargeFilter) {
      const chargeMin = filters.charge_min !== undefined && filters.charge_min !== '' ? Number(filters.charge_min) : -Infinity;
      const chargeMax = filters.charge_max !== undefined && filters.charge_max !== '' ? Number(filters.charge_max) : Infinity;
      
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          {
            Surface_charge_water_min: { $lte: chargeMax },
            Surface_charge_water_max: { $gte: chargeMin }
          },
          { Surface_charge_water_min: null, Surface_charge_water_max: null, Surface_charge_water_mV: { $ne: 'Not reported' } }
        ]
      });
    }
  }

  const skip = (page - 1) * limit;
  
  const records = await PolyToxMaterial.find(query)
    .select('_id Polymers Polymer_type Material_2 Synthesis_method Shape Core_size_nm PDI Hydrodynamic_size_water_nm Surface_charge_water_mV Article_Name')
    .skip(skip)
    .limit(Number(limit))
    .lean();

  const totalRecords = await PolyToxMaterial.countDocuments(query);

  res.status(200).json({
    status: 'success',
    page: Number(page),
    limit: Number(limit),
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    data: records
  });
});

// @desc    Get PolyTox complete material report
// @route   GET /api/polytox/records/:id
// @access  Public
export const getPolyToxById = asyncHandler(async (req, res) => {
  const material = await PolyToxMaterial.findById(req.params.id);

  if (!material) {
    return res.status(404).json({
      status: 'error',
      message: `PolyTox record not found with id: ${req.params.id}`
    });
  }

  res.status(200).json({
    status: 'success',
    data: material
  });
});
