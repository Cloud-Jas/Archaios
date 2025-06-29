# Archaios API Reference

This document provides a comprehensive reference for the Archaios API endpoints, covering the DurableHandler, LiDARProcessor, and GeeProcessor services.

## Authentication

Most endpoints require authentication with a valid JWT token.

**Headers:**
```
Authorization: Bearer <token>
```

## DurableHandler API

The DurableHandler API orchestrates LiDAR processing workflows and manages the analysis pipeline.

### Process File API

Initiates the processing of a LiDAR file.

**Endpoint:** `POST /api/process-file`

**Request Body:**
```json
{
  "fileName": "example.laz",
  "fileSize": "25000000",
  "coordinates": {
    "latitude": 35.12345,
    "longitude": -92.54321
  },
  "workflow": [
    {
      "type": "dtm_generator",
      "inputs": {
        "grid_res": 0.5
      }
    },
    {
      "type": "dsm_generator",
      "inputs": {
        "grid_res": 0.5
      }
    },
    {
      "type": "hillshade_generator", 
      "inputs": {
        "azimuth": 315,
        "altitude": 45,
        "z_factor": 1.0
      }
    }
  ],
  "workflowOptions": {
    "resolution": 0.5,
    "classificationRequired": true
  }
}
```

**Response:**
```json
{
  "instanceId": "01234567-89ab-cdef-0123-456789abcdef",
  "fileName": "example.laz",
  "message": "File processing started"
}
```

### Get Processing Status

Retrieves the current status of a processing job.

**Endpoint:** `GET /api/status/{instanceId}`

**Response:**
```json
{
  "instanceId": "01234567-89ab-cdef-0123-456789abcdef",
  "status": "Processing",
  "fileName": "example.laz",
  "progress": 45,
  "stage": "GeneratingDTM",
  "createdAt": "2023-07-12T15:22:33Z",
  "lastUpdated": "2023-07-12T15:25:12Z"
}
```

### Get Site Details

Retrieves detailed information about an archaeological site.

**Endpoint:** `GET /api/sites/{siteId}`

**Response:**
```json
{
  "id": "site_123456",
  "name": "Ancient Settlement",
  "description": "Possible settlement dating to the Bronze Age",
  "latitude": 35.12345,
  "longitude": -92.54321,
  "components": [
    {
      "name": "Digital Terrain Model",
      "type": "DTM",
      "imageUrl": "https://storage.example.com/site_123456/dtm.png",
      "state": "Available"
    },
    {
      "name": "Digital Surface Model",
      "type": "DSM",
      "imageUrl": "https://storage.example.com/site_123456/dsm.png",
      "state": "Available"
    }
  ],
  "analysis": {
    "archaeologicalConfidence": 87,
    "aiDiscussion": [
      {
        "agent": "TerrainSpecialist",
        "message": "The terrain shows distinct features consistent with human modification..."
      }
    ]
  }
}
```

## GeeProcessor API

The GeeProcessor API handles satellite imagery retrieval and analysis through Google Earth Engine.

### Process Satellite Imagery

Processes satellite imagery for a specific location.

**Endpoint:** `POST /process/{imageType}`

**Request Body:**
```json
{
  "siteId": "site_123456",
  "coordinates": {
    "latitude": 35.12345,
    "longitude": -92.54321
  },
  "timeRangeYears": 1,
  "bufferDistance": 1000,
  "collection": "LANDSAT/LC08/C02/T1_TOA"
}
```

**Response:**
```json
{
  "imageType": "NDVI",
  "imageUrl": "https://storage.example.com/site_123456/ndvi.png",
  "collection": "Landsat",
  "processedDate": "2023-07-12T15:30:45Z",
  "description": "Normalized Difference Vegetation Index"
}
```

## LiDARProcessor Events

The LiDARProcessor service operates primarily through queue messages and events, rather than direct API calls.

### Processing Events

These events are sent back to the DurableHandler via Azure Durable Functions external events:

- `LiDARProcessingCompleted` - Triggered when LiDAR processing completes
- `RasterProcessingCompleted` - Triggered when raster processing completes
- `E57ProcessingCompleted` - Triggered when E57 point cloud processing completes

### Event Payload Example

```json
{
  "status": "success",
  "outputDir": "/tmp/lidar_outputs/example_20230712153045",
  "siteId": "example_20230712153045",
  "lat": 35.12345,
  "lon": -92.54321,
  "dtmImage": "https://storage.example.com/example_20230712153045/dtm.png",
  "dsmImage": "https://storage.example.com/example_20230712153045/dsm.png",
  "hillshadeImage": "https://storage.example.com/example_20230712153045/hillshade.png",
  "hillshadeMultiDirectionalImage": "https://storage.example.com/example_20230712153045/hillshade_multi.png",
  "slopeImage": "https://storage.example.com/example_20230712153045/slope.png",
  "statistics": {
    "pointCount": 2500000,
    "groundPointCount": 1200000,
    "nonGroundPointCount": 1300000,
    "areaInSquareMeters": 250000
  }
}
```