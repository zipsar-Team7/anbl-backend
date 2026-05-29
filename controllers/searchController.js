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
  let records = await Material.find(query)
    .select('_id Meta_Title Scale_Coverage MIE_P_M_Type MIE_P_Size_nm MIE_P_Shape MIE_E_Injury_Model')
    .skip(skip)
    .limit(Number(limit))
    .lean();

  let totalRecords = await Material.countDocuments(query);
  let isPartial = false;

  // Fallback: If 0 results and multiple filters are selected, find partial matches
  if (totalRecords === 0 && filters) {
    const activeFilterList = [];
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
        activeFilterList.push({ [field]: { $in: filters[field] } });
      }
    });

    if (activeFilterList.length > 1) {
      const partialQuery = {};
      if (keyword) {
        const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedKeyword, 'i');
        partialQuery.$or = [
          { Meta_Title: regex },
          { MIE_P_M_Type: regex },
          { MIE_P_Shape: regex },
          { MIE_E_Cell_Type: regex },
          { MIE_E_Injury_Model: regex },
          { Scale_Coverage: regex },
          { Meta_doi: regex }
        ];
      }
      partialQuery.$and = [{ $or: activeFilterList }];
      
      records = await Material.find(partialQuery)
        .select('_id Meta_Title Scale_Coverage MIE_P_M_Type MIE_P_Size_nm MIE_P_Shape MIE_E_Injury_Model')
        .skip(skip)
        .limit(Number(limit))
        .lean();
      totalRecords = await Material.countDocuments(partialQuery);
      if (totalRecords > 0) {
        isPartial = true;
      }
    }
  }

  res.status(200).json({
    status: 'success',
    page: Number(page),
    limit: Number(limit),
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    isPartial,
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
    ranges: {}
  };

  // Get Categorical Unique Values and actual range limits dynamically in parallel
  const [
    coreRange,
    pdiRange,
    hydroRange,
    chargeRange
  ] = await Promise.all([
    PolyToxMaterial.aggregate([
      { $group: { _id: null, minVal: { $min: "$Core_size_min" }, maxVal: { $max: "$Core_size_max" } } }
    ]),
    PolyToxMaterial.aggregate([
      { $group: { _id: null, minVal: { $min: "$PDI_min" }, maxVal: { $max: "$PDI_max" } } }
    ]),
    PolyToxMaterial.aggregate([
      { $group: { _id: null, minVal: { $min: "$Hydrodynamic_size_water_min" }, maxVal: { $max: "$Hydrodynamic_size_water_max" } } }
    ]),
    PolyToxMaterial.aggregate([
      { $group: { _id: null, minVal: { $min: "$Surface_charge_water_min" }, maxVal: { $max: "$Surface_charge_water_max" } } }
    ]),
    ...categoricalFields.map(async (field) => {
      const distinctValues = await PolyToxMaterial.distinct(field, {
        [field]: { $ne: null, $not: /^\s*$/ }
      });
      filters.categorical[field] = distinctValues.sort();
    })
  ]);

  filters.ranges = {
    Core_size_nm: {
      min: coreRange[0]?.minVal !== undefined && coreRange[0]?.minVal !== null ? Math.floor(coreRange[0].minVal) : 0,
      max: coreRange[0]?.maxVal !== undefined && coreRange[0]?.maxVal !== null ? Math.ceil(coreRange[0].maxVal) : 500
    },
    PDI: {
      min: pdiRange[0]?.minVal !== undefined && pdiRange[0]?.minVal !== null ? Number(pdiRange[0].minVal.toFixed(2)) : 0,
      max: pdiRange[0]?.maxVal !== undefined && pdiRange[0]?.maxVal !== null ? Number(pdiRange[0].maxVal.toFixed(2)) : 1
    },
    Hydrodynamic_size_water_nm: {
      min: hydroRange[0]?.minVal !== undefined && hydroRange[0]?.minVal !== null ? Math.floor(hydroRange[0].minVal) : 0,
      max: hydroRange[0]?.maxVal !== undefined && hydroRange[0]?.maxVal !== null ? Math.ceil(hydroRange[0].maxVal) : 1000
    },
    Surface_charge_water_mV: {
      min: chargeRange[0]?.minVal !== undefined && chargeRange[0]?.minVal !== null ? Math.floor(chargeRange[0].minVal) : -100,
      max: chargeRange[0]?.maxVal !== undefined && chargeRange[0]?.maxVal !== null ? Math.ceil(chargeRange[0].maxVal) : 100
    }
  };

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
  
  let records = await PolyToxMaterial.find(query)
    .select('_id Polymers Polymer_type Material_2 Synthesis_method Shape Core_size_nm PDI Hydrodynamic_size_water_nm Surface_charge_water_mV Article_Name')
    .skip(skip)
    .limit(Number(limit))
    .lean();

  let totalRecords = await PolyToxMaterial.countDocuments(query);
  let isPartial = false;

  // Fallback: If 0 results and multiple filters are selected, find partial matches
  if (totalRecords === 0 && filters) {
    const activeFilterList = [];
    const categoricalFields = [
      'Polymers',
      'Polymer_type',
      'Synthesis_method',
      'Material_2',
      'Shape'
    ];

    categoricalFields.forEach(field => {
      if (filters[field] && Array.isArray(filters[field]) && filters[field].length > 0) {
        activeFilterList.push({ [field]: { $in: filters[field] } });
      }
    });

    // Add ranges as criteria if present
    if (filters.core_min || filters.core_max) {
      const cMin = filters.core_min !== undefined && filters.core_min !== '' ? Number(filters.core_min) : 0;
      const cMax = filters.core_max !== undefined && filters.core_max !== '' ? Number(filters.core_max) : Infinity;
      activeFilterList.push({
        $or: [
          {
            Core_size_min: { $lte: cMax },
            Core_size_max: { $gte: cMin }
          }
        ]
      });
    }
    if (filters.pdi_min || filters.pdi_max) {
      const pMin = filters.pdi_min !== undefined && filters.pdi_min !== '' ? Number(filters.pdi_min) : 0;
      const pMax = filters.pdi_max !== undefined && filters.pdi_max !== '' ? Number(filters.pdi_max) : Infinity;
      activeFilterList.push({
        $or: [
          {
            PDI_min: { $lte: pMax },
            PDI_max: { $gte: pMin }
          }
        ]
      });
    }
    if (filters.hydro_min || filters.hydro_max) {
      const hMin = filters.hydro_min !== undefined && filters.hydro_min !== '' ? Number(filters.hydro_min) : 0;
      const hMax = filters.hydro_max !== undefined && filters.hydro_max !== '' ? Number(filters.hydro_max) : Infinity;
      activeFilterList.push({
        $or: [
          {
            Hydrodynamic_size_water_min: { $lte: hMax },
            Hydrodynamic_size_water_max: { $gte: hMin }
          }
        ]
      });
    }
    if (filters.charge_min || filters.charge_max) {
      const chMin = filters.charge_min !== undefined && filters.charge_min !== '' ? Number(filters.charge_min) : -Infinity;
      const chMax = filters.charge_max !== undefined && filters.charge_max !== '' ? Number(filters.charge_max) : Infinity;
      activeFilterList.push({
        $or: [
          {
            Surface_charge_water_min: { $lte: chMax },
            Surface_charge_water_max: { $gte: chMin }
          }
        ]
      });
    }

    if (activeFilterList.length > 1) {
      const partialQuery = {};
      if (keyword) {
        const escapedKeyword = keyword.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(escapedKeyword, 'i');
        partialQuery.$or = [
          { Polymer_type: regex },
          { Material_2: regex },
          { Article_Name: regex },
          { Polymers: regex }
        ];
      }
      partialQuery.$and = [{ $or: activeFilterList }];
      
      records = await PolyToxMaterial.find(partialQuery)
        .select('_id Polymers Polymer_type Material_2 Synthesis_method Shape Core_size_nm PDI Hydrodynamic_size_water_nm Surface_charge_water_mV Article_Name')
        .skip(skip)
        .limit(Number(limit))
        .lean();
      totalRecords = await PolyToxMaterial.countDocuments(partialQuery);
      if (totalRecords > 0) {
        isPartial = true;
      }
    }
  }

  res.status(200).json({
    status: 'success',
    page: Number(page),
    limit: Number(limit),
    totalRecords,
    totalPages: Math.ceil(totalRecords / limit),
    isPartial,
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
